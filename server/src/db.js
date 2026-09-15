import fs from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { DATA_DIR, DB_PATH, UPLOADS_DIR } from './config.js';

const BLOB_PATH = 'data/uitmatch.db';
const USERS_BLOB = 'data/users.json';
let ready = false;
let dirty = false;
let blobEtag = null;
let usersEtag = null;
let requestLock = Promise.resolve();

/** Opened in initDb(). Live-bound so route modules can import it at load time. */
export let db;

export const nowIso = () => new Date().toISOString();

/** node:sqlite can hand back BigInt for rowids depending on the value. */
export const toNumber = (value) => (typeof value === 'bigint' ? Number(value) : value);

function blobTokenFromEnv() {
  if (process.env.BLOB_READ_WRITE_TOKEN) return process.env.BLOB_READ_WRITE_TOKEN;
  for (const [key, value] of Object.entries(process.env)) {
    if (key.endsWith('BLOB_READ_WRITE_TOKEN') && value) return value;
  }
  return '';
}

export function usesBlob() {
  return Boolean(blobTokenFromEnv() || process.env.BLOB_STORE_ID);
}

export function persistenceMode() {
  if (usesBlob()) return 'blob';
  if (process.env.VERCEL) return 'ephemeral';
  return 'local';
}

export function markDirty() {
  dirty = true;
}

/** @deprecated Use markDirty(); the request middleware saves the file. */
export function schedulePersist() {
  markDirty();
}

function blobAuth() {
  const token = blobTokenFromEnv();
  return token ? { token } : {};
}

function closeDb() {
  if (!db) return;
  try {
    db.close();
  } catch {
    // Already closed between overlapping requests.
  }
  db = undefined;
  ready = false;
}

function openDb() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
  db = new DatabaseSync(DB_PATH);
  db.exec(`PRAGMA journal_mode = ${process.env.VERCEL ? 'DELETE' : 'WAL'}`);
  db.exec('PRAGMA foreign_keys = ON');
  applySchema();
  ready = true;
  dirty = false;
  return db;
}

async function persistToBlob() {
  if (!usesBlob() || !db) return;
  db.exec('PRAGMA wal_checkpoint(TRUNCATE)');
  const { put, BlobPreconditionFailedError } = await import('@vercel/blob');
  try {
    const result = await put(BLOB_PATH, fs.readFileSync(DB_PATH), {
      access: 'private',
      addRandomSuffix: false,
      allowOverwrite: true,
      cacheControlMaxAge: 60,
      ...blobAuth(),
      ...(blobEtag ? { ifMatch: blobEtag } : {}),
    });
    blobEtag = result.etag || blobEtag;
    dirty = false;
  } catch (err) {
    if (err instanceof BlobPreconditionFailedError) {
      const conflict = new Error('Could not save your account. Please try again.');
      conflict.status = 503;
      throw conflict;
    }
    throw err;
  }
}

async function restoreFromBlob() {
  if (!usesBlob()) return;
  try {
    const { get } = await import('@vercel/blob');
    const result = await get(BLOB_PATH, {
      access: 'private',
      useCache: false,
      ...blobAuth(),
    });
    if (!result?.stream || result.statusCode !== 200) return;
    const chunks = [];
    for await (const chunk of result.stream) chunks.push(chunk);
    fs.writeFileSync(DB_PATH, Buffer.concat(chunks));
    blobEtag = result.blob?.etag || blobEtag;
  } catch (err) {
    if (err?.constructor?.name === 'BlobNotFoundError') return;
    console.warn('Starting with an empty database:', err.message);
  }
}

export async function initDb() {
  if (ready && db) return db;
  await restoreFromBlob();
  openDb();
  await pullAccounts();
  return db;
}

/**
 * On Vercel, each serverless instance has its own /tmp sqlite file.
 * Reload accounts from Blob at the start of every request so signup on
 * instance A is visible to login on instance B.
 */
export async function beginRequest() {
  if (!usesBlob()) return initDb();
  closeDb();
  await restoreFromBlob();
  openDb();
  await pullAccounts();
  return db;
}

async function readStream(stream) {
  const chunks = [];
  for await (const chunk of stream) chunks.push(chunk);
  return Buffer.concat(chunks.map((part) => (Buffer.isBuffer(part) ? part : Buffer.from(part))));
}

function mergeAccounts(remote, local) {
  const byEmail = new Map();
  for (const row of remote) {
    if (!row?.email) continue;
    byEmail.set(row.email, {
      id: toNumber(row.id),
      email: row.email,
      password_hash: row.password_hash,
      created_at: row.created_at,
    });
  }
  const usedIds = new Set([...byEmail.values()].map((row) => row.id));
  for (const row of local) {
    if (!row?.email) continue;
    if (byEmail.has(row.email)) {
      const prev = byEmail.get(row.email);
      byEmail.set(row.email, {
        ...prev,
        password_hash: row.password_hash || prev.password_hash,
      });
      continue;
    }
    let id = toNumber(row.id);
    if (!id || usedIds.has(id)) {
      id = (usedIds.size ? Math.max(...usedIds) : 0) + 1;
    }
    usedIds.add(id);
    byEmail.set(row.email, {
      id,
      email: row.email,
      password_hash: row.password_hash,
      created_at: row.created_at,
    });
  }
  return [...byEmail.values()];
}

function applyAccountRows(rows) {
  if (!db || !rows.length) return;
  for (const row of rows) {
    const id = toNumber(row.id);
    if (!id || !row.email || !row.password_hash) continue;
    try {
      db.prepare('DELETE FROM users WHERE email = ? AND id != ?').run(row.email, id);
    } catch {
      // Keep the existing row if a foreign key blocks the cleanup.
    }
    const existing = db.prepare('SELECT id FROM users WHERE id = ?').get(id);
    if (existing) {
      db.prepare(
        'UPDATE users SET email = ?, password_hash = ?, created_at = COALESCE(?, created_at) WHERE id = ?',
      ).run(row.email, row.password_hash, row.created_at || null, id);
    } else {
      db.prepare(
        'INSERT INTO users (id, email, password_hash, created_at) VALUES (?, ?, ?, ?)',
      ).run(id, row.email, row.password_hash, row.created_at || nowIso());
    }
  }
  const max = toNumber(get('SELECT MAX(id) AS m FROM users')?.m) || 0;
  const seq = get("SELECT seq FROM sqlite_sequence WHERE name = 'users'");
  if (seq) {
    db.prepare("UPDATE sqlite_sequence SET seq = ? WHERE name = 'users'").run(Math.max(toNumber(seq.seq) || 0, max));
  } else if (max) {
    try {
      db.prepare('INSERT INTO sqlite_sequence (name, seq) VALUES (?, ?)').run('users', max);
    } catch {
      // sqlite_sequence is only present after AUTOINCREMENT inserts.
    }
  }
}

async function readUsersBlob() {
  const { get } = await import('@vercel/blob');
  const result = await get(USERS_BLOB, {
    access: 'private',
    useCache: false,
    ...blobAuth(),
  });
  if (!result?.stream || result.statusCode !== 200) return { users: [] };
  usersEtag = result.blob?.etag || usersEtag;
  const parsed = JSON.parse((await readStream(result.stream)).toString('utf8'));
  const users = Array.isArray(parsed) ? parsed : parsed?.users;
  return { users: Array.isArray(users) ? users : [] };
}

export async function pullAccounts() {
  if (!usesBlob()) return;
  try {
    const { users } = await readUsersBlob();
    applyAccountRows(users);
  } catch (err) {
    if (err?.constructor?.name === 'BlobNotFoundError') return;
    console.warn('Could not load accounts:', err.message);
  }
}

/** Wait until student accounts are in Blob before telling the browser login succeeded. */
export async function persistAccounts() {
  if (!usesBlob()) {
    if (process.env.VERCEL) {
      const err = new Error(
        'This live site cannot save accounts yet. In Vercel open uit-match → Storage → Connect Blob (empty prefix) → Redeploy.',
      );
      err.status = 503;
      throw err;
    }
    return;
  }

  const local = all('SELECT id, email, password_hash, created_at FROM users').map((row) => ({
    id: toNumber(row.id),
    email: row.email,
    password_hash: row.password_hash,
    created_at: row.created_at,
  }));

  const { put, BlobPreconditionFailedError } = await import('@vercel/blob');
  for (let attempt = 0; attempt < 6; attempt += 1) {
    let remote = [];
    try {
      ({ users: remote } = await readUsersBlob());
    } catch (err) {
      if (err?.constructor?.name !== 'BlobNotFoundError') throw err;
      usersEtag = null;
    }
    const merged = mergeAccounts(remote, local);
    try {
      const result = await put(USERS_BLOB, JSON.stringify({ users: merged }), {
        access: 'private',
        addRandomSuffix: false,
        allowOverwrite: true,
        cacheControlMaxAge: 60,
        contentType: 'application/json',
        ...blobAuth(),
        ...(usersEtag ? { ifMatch: usersEtag } : {}),
      });
      usersEtag = result.etag || usersEtag;
      applyAccountRows(merged);
      return merged;
    } catch (err) {
      if (err instanceof BlobPreconditionFailedError) continue;
      throw err;
    }
  }

  const err = new Error('Could not save your account. Please try again.');
  err.status = 503;
  throw err;
}

export async function persistIfDirty() {
  if (!usesBlob() || !dirty) return;
  await persistToBlob();
}

/** One in-flight request per instance so we never close sqlite under another handler. */
export function runExclusive(work) {
  const run = requestLock.then(work, work);
  requestLock = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

export function run(sql, ...params) {
  const result = db.prepare(sql).run(...params);
  markDirty();
  return {
    changes: toNumber(result.changes),
    lastInsertRowid: toNumber(result.lastInsertRowid),
  };
}

export function get(sql, ...params) {
  return db.prepare(sql).get(...params);
}

export function all(sql, ...params) {
  return db.prepare(sql).all(...params);
}

/** Matches are stored with the lower user id first so a pair can only exist once. */
export function pairKey(a, b) {
  return a < b ? [a, b] : [b, a];
}

function applySchema() {
  db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  email          TEXT NOT NULL UNIQUE,
  password_hash  TEXT NOT NULL,
  created_at     TEXT NOT NULL,
  last_active_at TEXT
);

CREATE TABLE IF NOT EXISTS profiles (
  user_id       INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  display_name  TEXT NOT NULL,
  birthdate     TEXT NOT NULL,
  gender        TEXT NOT NULL,
  interested_in TEXT NOT NULL,
  major         TEXT,
  study_year    INTEGER,
  study_semester INTEGER,
  bio           TEXT NOT NULL DEFAULT '',
  interests     TEXT NOT NULL DEFAULT '[]',
  photos        TEXT NOT NULL DEFAULT '[]',
  min_age       INTEGER NOT NULL DEFAULT 18,
  max_age       INTEGER NOT NULL DEFAULT 30,
  is_complete   INTEGER NOT NULL DEFAULT 0,
  updated_at    TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
  token      TEXT PRIMARY KEY,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS swipes (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  swiper_id  INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  target_id  INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  action     TEXT NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE (swiper_id, target_id)
);

CREATE TABLE IF NOT EXISTS matches (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_a     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  user_b     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL,
  closed_at  TEXT,
  closed_by  INTEGER,
  UNIQUE (user_a, user_b)
);

CREATE TABLE IF NOT EXISTS messages (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  match_id   INTEGER NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  sender_id  INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  body       TEXT NOT NULL,
  created_at TEXT NOT NULL,
  read_at    TEXT
);

CREATE TABLE IF NOT EXISTS blocks (
  blocker_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  blocked_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL,
  PRIMARY KEY (blocker_id, blocked_id)
);

CREATE TABLE IF NOT EXISTS reports (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  reporter_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reported_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reason      TEXT NOT NULL,
  details     TEXT NOT NULL DEFAULT '',
  created_at  TEXT NOT NULL
);

-- Free Time Match: one row per weekly slot a student marks themselves free.
-- Stored separately from profiles because it is the most privacy-sensitive data
-- in the app and must never be joined into a public profile payload.
CREATE TABLE IF NOT EXISTS availability (
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  day     INTEGER NOT NULL,
  slot    TEXT NOT NULL,
  PRIMARY KEY (user_id, day, slot)
);

-- Free Time Match: a date proposed by one matched student to the other.
CREATE TABLE IF NOT EXISTS date_plans (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  match_id     INTEGER NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  proposed_by  INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  activity     TEXT NOT NULL,
  title        TEXT NOT NULL,
  description  TEXT NOT NULL DEFAULT '',
  day          INTEGER,
  slot         TEXT,
  budget       TEXT NOT NULL DEFAULT 'low',
  venue        TEXT NOT NULL DEFAULT 'campus',
  status       TEXT NOT NULL DEFAULT 'proposed',
  created_at   TEXT NOT NULL,
  responded_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_swipes_target ON swipes (target_id, action);
CREATE INDEX IF NOT EXISTS idx_messages_match ON messages (match_id, id);
CREATE INDEX IF NOT EXISTS idx_matches_users ON matches (user_a, user_b);
CREATE INDEX IF NOT EXISTS idx_availability_slot ON availability (day, slot);
CREATE INDEX IF NOT EXISTS idx_date_plans_match ON date_plans (match_id, id);

CREATE TABLE IF NOT EXISTS daily_fate (
  user_id   INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  date_key  TEXT NOT NULL,
  target_id INTEGER NOT NULL,
  PRIMARY KEY (user_id, date_key)
);
`);

/** Additive migration so an existing database picks up new columns without being rebuilt. */
function ensureColumn(table, column, definition) {
  const columns = all(`PRAGMA table_info(${table})`);
  if (!columns.some((c) => c.name === column)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }
}

// Free Time Match settings live alongside the rest of a student's preferences.
ensureColumn('profiles', 'free_time_enabled', 'INTEGER NOT NULL DEFAULT 1');
ensureColumn('profiles', 'budget', "TEXT NOT NULL DEFAULT 'low'");
ensureColumn('profiles', 'venue_preference', "TEXT NOT NULL DEFAULT 'either'");
ensureColumn('profiles', 'study_semester', 'INTEGER');
ensureColumn('swipes', 'spark_note', 'TEXT');
ensureColumn('swipes', 'spark_photo', 'INTEGER');

db.exec(`UPDATE profiles SET study_year = 5 WHERE study_year IS NOT NULL AND study_year > 5`);
}
