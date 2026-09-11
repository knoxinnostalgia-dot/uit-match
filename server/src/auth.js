import crypto from 'node:crypto';
import { promisify } from 'node:util';
import { ALLOWED_EMAIL_DOMAINS, SESSION_TTL_DAYS } from './config.js';
import { get, nowIso, run } from './db.js';

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

export function createSession(userId) {
  const token = crypto.randomBytes(32).toString('base64url');
  const expires = new Date(Date.now() + SESSION_TTL_DAYS * 86400_000).toISOString();
  run(
    'INSERT INTO sessions (token, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)',
    token,
    userId,
    nowIso(),
    expires,
  );
  return token;
}

export function destroySession(token) {
  run('DELETE FROM sessions WHERE token = ?', token);
}

function readToken(req) {
  const header = req.get('authorization') || '';
  return header.startsWith('Bearer ') ? header.slice(7).trim() : null;
}

/** Populates req.user, or 401s. */
export function requireAuth(req, res, next) {
  const token = readToken(req);
  if (!token) return res.status(401).json({ error: 'Sign in to continue.' });

  const session = get('SELECT * FROM sessions WHERE token = ?', token);
  if (!session) return res.status(401).json({ error: 'Session expired. Sign in again.' });

  if (new Date(session.expires_at).getTime() < Date.now()) {
    destroySession(token);
    return res.status(401).json({ error: 'Session expired. Sign in again.' });
  }

  const user = get('SELECT id, email, created_at FROM users WHERE id = ?', session.user_id);
  if (!user) return res.status(401).json({ error: 'Account no longer exists.' });

  run('UPDATE users SET last_active_at = ? WHERE id = ?', nowIso(), user.id);
  req.user = user;
  req.token = token;
  next();
}
