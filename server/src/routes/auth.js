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
import { get, nowIso, persistAccounts, run } from '../db.js';
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
  run(
    'INSERT INTO users (email, password_hash, created_at) VALUES (?, ?, ?)',
    check.email,
    passwordHash,
    nowIso(),
  );
  try {
    await persistAccounts();
  } catch (err) {
    return res.status(err.status || 503).json({ error: err.message || 'Could not save your account. Please try again.' });
  }
  const created = get('SELECT id, email FROM users WHERE email = ?', check.email);
  if (!created) {
    return res.status(503).json({ error: 'Could not save your account. Please try again.' });
  }
  const token = createSession(created.id, created.email);
  res.status(201).json({ token, ...loadMe(created.id, created.email) });
});

authRouter.post('/login', async (req, res) => {
  const email = normalizeEmail(req.body?.email);
  const password = req.body?.password;

  const user = get('SELECT * FROM users WHERE email = ?', email);
  if (!user) {
    return res.status(401).json({
      error: 'No account with that email yet. If you just created one, wait a moment and try again — or create the account once more.',
    });
  }
  const ok = typeof password === 'string' && (await verifyPassword(password, user.password_hash));
  if (!ok) return res.status(401).json({ error: 'Email or password is incorrect.' });

  try {
    await persistAccounts();
  } catch (err) {
    return res.status(err.status || 503).json({ error: err.message || 'Could not save your account. Please try again.' });
  }
  const saved = get('SELECT id, email FROM users WHERE email = ?', email);
  if (!saved) {
    return res.status(503).json({ error: 'Could not save your account. Please try again.' });
  }
  const token = createSession(saved.id, saved.email);
  res.json({ token, ...loadMe(saved.id, saved.email) });
});

authRouter.post('/logout', requireAuth, (req, res) => {
  destroySession(req.token);
  res.json({ ok: true });
});

authRouter.get('/me', requireAuth, (req, res) => {
  res.json(loadMe(req.user.id, req.user.email));
});
