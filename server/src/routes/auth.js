import { Router } from 'express';
import {
  checkCampusEmail,
  createSession,
  destroySession,
  hashPassword,
  normalizeEmail,
  requireAuth,
  verifyPassword,
} from '../auth.js';
import { get, nowIso, run } from '../db.js';
import { ownProfile } from '../util.js';

export const authRouter = Router();

function loadMe(userId, email) {
  const profileRow = get('SELECT * FROM profiles WHERE user_id = ?', userId);
  return { user: { id: userId, email }, profile: ownProfile(profileRow, email) };
}

authRouter.post('/signup', async (req, res) => {
  const { password } = req.body || {};
  const check = checkCampusEmail(req.body?.email);
  if (!check.ok) return res.status(400).json({ error: check.error });

  if (typeof password !== 'string' || password.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters.' });
  }

  const existing = get('SELECT id FROM users WHERE email = ?', check.email);
  if (existing) return res.status(409).json({ error: 'That email is already registered. Try signing in.' });

  const passwordHash = await hashPassword(password);
  const { lastInsertRowid } = run(
    'INSERT INTO users (email, password_hash, created_at) VALUES (?, ?, ?)',
    check.email,
    passwordHash,
    nowIso(),
  );

  const token = createSession(lastInsertRowid);
  res.status(201).json({ token, ...loadMe(lastInsertRowid, check.email) });
});

authRouter.post('/login', async (req, res) => {
  const email = normalizeEmail(req.body?.email);
  const password = req.body?.password;

  const user = get('SELECT * FROM users WHERE email = ?', email);
  const ok = user && typeof password === 'string' && (await verifyPassword(password, user.password_hash));
  if (!ok) return res.status(401).json({ error: 'Email or password is incorrect.' });

  const token = createSession(user.id);
  res.json({ token, ...loadMe(user.id, user.email) });
});

authRouter.post('/logout', requireAuth, (req, res) => {
  destroySession(req.token);
  res.json({ ok: true });
});

authRouter.get('/me', requireAuth, (req, res) => {
  res.json(loadMe(req.user.id, req.user.email));
});
