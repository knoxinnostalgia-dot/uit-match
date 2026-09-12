import crypto from 'node:crypto';
import { promisify } from 'node:util';
import { ALLOWED_EMAIL_DOMAINS, SESSION_TTL_DAYS } from './config.js';
import { db, get, nowIso, run } from './db.js';

const scrypt = promisify(crypto.scrypt);
const KEY_LEN = 64;

export async function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const key = await scrypt(password, salt, KEY_LEN);
  return `scrypt:${salt}:${key.toString('hex')}`;
}

export async function verifyPassword(password, stored) {
  const [scheme, salt, expectedHex] = String(stored).split(':');
  if (scheme !== 'scrypt' || !salt || !expectedHex) return false;
  const expected = Buffer.from(expectedHex, 'hex');
  const actual = await scrypt(password, salt, expected.length);
  return expected.length === actual.length && crypto.timingSafeEqual(expected, actual);
}

export function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

/** The whole point of the app: only UIT mailboxes are allowed to register. */
export function checkCampusEmail(email) {
  const normalized = normalizeEmail(email);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) {
    return { ok: false, error: 'Enter a valid email address.' };
  }
  const domain = normalized.split('@')[1];
  if (!ALLOWED_EMAIL_DOMAINS.includes(domain)) {
    return {
      ok: false,
      error: `Only University of Information Technology accounts can join. Use your @${ALLOWED_EMAIL_DOMAINS[0]} address.`,
    };
  }
  return { ok: true, email: normalized };
}

function sessionSecret() {
  return process.env.SESSION_SECRET || process.env.BLOB_READ_WRITE_TOKEN || 'uit-match-local-dev';
}

function signBytes(payload) {
  return crypto.createHmac('sha256', sessionSecret()).update(payload).digest('base64url');
}

function hmacEqual(left, right) {
  const a = Buffer.from(String(left));
  const b = Buffer.from(String(right));
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

function readSignedSession(token) {
  const dot = String(token).lastIndexOf('.');
  if (dot <= 0) return null;
  const payload = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  if (!sig || !hmacEqual(signBytes(payload), sig)) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    if (!Number.isInteger(data.sub) || typeof data.exp !== 'number' || data.exp < Date.now()) {
      return null;
    }
    return data;
  } catch {
    return null;
  }
}

/** Signed token so a later request can log you in even if the sessions table was lost. */
export function createSession(userId) {
  const payload = Buffer.from(
    JSON.stringify({
      sub: Number(userId),
      exp: Date.now() + SESSION_TTL_DAYS * 86400_000,
    }),
    'utf8',
  ).toString('base64url');
  return `${payload}.${signBytes(payload)}`;
}

export function destroySession(token) {
  if (!token || token.includes('.')) return;
  run('DELETE FROM sessions WHERE token = ?', token);
}

function readToken(req) {
  const header = req.get('authorization') || '';
  return header.startsWith('Bearer ') ? header.slice(7).trim() : null;
}

function loadAuthedUser(userId) {
  return get('SELECT id, email, created_at FROM users WHERE id = ?', userId);
}

function touchUser(userId) {
  db.prepare('UPDATE users SET last_active_at = ? WHERE id = ?').run(nowIso(), userId);
}

/** Populates req.user, or 401s. */
export function requireAuth(req, res, next) {
  const token = readToken(req);
  if (!token) return res.status(401).json({ error: 'Sign in to continue.' });

  const signed = readSignedSession(token);
  if (signed) {
    const user = loadAuthedUser(signed.sub);
    if (!user) return res.status(401).json({ error: 'Session expired. Sign in again.' });
    touchUser(user.id);
    req.user = user;
    req.token = token;
    return next();
  }

  const session = get('SELECT * FROM sessions WHERE token = ?', token);
  if (!session) return res.status(401).json({ error: 'Session expired. Sign in again.' });

  if (new Date(session.expires_at).getTime() < Date.now()) {
    destroySession(token);
    return res.status(401).json({ error: 'Session expired. Sign in again.' });
  }

  const user = loadAuthedUser(session.user_id);
  if (!user) return res.status(401).json({ error: 'Session expired. Sign in again.' });

  touchUser(user.id);
  req.user = user;
  req.token = token;
  next();
}
