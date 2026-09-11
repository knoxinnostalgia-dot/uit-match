import { Router } from 'express';
import { requireAuth } from '../auth.js';
import { computeCompatibility } from '../compatibility.js';
import { all, get, nowIso, pairKey, run } from '../db.js';
import { freeTimeFor } from '../freetime.js';
import { listEligibleRows } from '../pool.js';
import { publicProfile } from '../util.js';

export const discoverRouter = Router();

const DECK_SIZE = 20;
const REWIND_MS = 10 * 60 * 1000;

function requireOwnProfile(req, res) {
  const profile = get('SELECT * FROM profiles WHERE user_id = ?', req.user.id);
  if (!profile || !profile.is_complete) {
    res.status(409).json({ error: 'Finish your profile before browsing.', code: 'PROFILE_INCOMPLETE' });
    return null;
  }
  return profile;
}

function sparkFromBody(body) {
  const note = String(body?.sparkNote ?? '').trim().slice(0, 120);
  const photoIndex = Number.isInteger(Number(body?.sparkPhoto)) ? Number(body.sparkPhoto) : null;
  return {
    note: note || null,
    photo: note && photoIndex !== null && photoIndex >= 0 ? photoIndex : note ? 0 : null,
  };
}

function dropSparkMessages(matchId, userA, userB) {
  const already = get(`SELECT 1 AS ok FROM messages WHERE match_id = ? AND body LIKE '✦%'`, matchId);
  if (already) return;

  const rows = all(
    `SELECT swiper_id, spark_note FROM swipes
     WHERE spark_note IS NOT NULL AND trim(spark_note) != ''
       AND ((swiper_id = ? AND target_id = ?) OR (swiper_id = ? AND target_id = ?))`,
    userA,
    userB,
    userB,
    userA,
  );
  for (const row of rows) {
    run(
      'INSERT INTO messages (match_id, sender_id, body, created_at) VALUES (?, ?, ?, ?)',
      matchId,
      row.swiper_id,
      `✦ Spark: ${row.spark_note}`,
      nowIso(),
    );
  }
}

discoverRouter.get('/discover', requireAuth, (req, res) => {
  const me = requireOwnProfile(req, res);
  if (!me) return;

  const viewer = publicProfile(me);
  const rows = listEligibleRows(req.user.id, me);

  const cards = rows
    .map((row) => {
      const candidate = publicProfile(row);
      const freeTime = freeTimeFor(req.user.id, row.user_id, 'summary');
      const compatibility = computeCompatibility(viewer, candidate, freeTime);
      return { ...candidate, likesMe: false, freeTime, compatibility };
    })
    .sort((a, b) => b.compatibility.score - a.compatibility.score)
    .slice(0, DECK_SIZE);

  res.json({ cards });
});

discoverRouter.post('/swipes/rewind', requireAuth, (req, res) => {
  const me = requireOwnProfile(req, res);
  if (!me) return;

  const last = get('SELECT * FROM swipes WHERE swiper_id = ? ORDER BY id DESC LIMIT 1', req.user.id);
  if (!last || last.action !== 'pass') {
    return res.status(400).json({ error: 'You can only rewind a pass.' });
  }
  if (Date.now() - new Date(last.created_at).getTime() > REWIND_MS) {
    return res.status(400).json({ error: 'That pass is too old to rewind.' });
  }

  run('DELETE FROM swipes WHERE id = ?', last.id);
  res.json({ ok: true, restoredId: last.target_id });
});

discoverRouter.post('/swipes', requireAuth, (req, res) => {
  const me = requireOwnProfile(req, res);
  if (!me) return;

  const targetId = Number(req.body?.targetId);
  const action = req.body?.action;
  const spark = sparkFromBody(req.body);

  if (!['like', 'pass', 'superlike'].includes(action)) {
    return res.status(400).json({ error: 'Unknown swipe action.' });
  }
  if (!Number.isInteger(targetId) || targetId === req.user.id) {
    return res.status(400).json({ error: 'Invalid profile.' });
  }

  const target = get('SELECT * FROM profiles WHERE user_id = ? AND is_complete = 1', targetId);
  if (!target) return res.status(404).json({ error: 'That profile is no longer available.' });

  const sparkNote = action === 'pass' ? null : spark.note;
  const sparkPhoto = action === 'pass' ? null : spark.photo;

  run(
    `INSERT INTO swipes (swiper_id, target_id, action, created_at, spark_note, spark_photo)
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT (swiper_id, target_id) DO NOTHING`,
    req.user.id,
    targetId,
    action,
    nowIso(),
    sparkNote,
    sparkPhoto,
  );

  if (action === 'pass') return res.json({ match: null });

  const reciprocal = get(
    `SELECT 1 FROM swipes WHERE swiper_id = ? AND target_id = ? AND action IN ('like', 'superlike')`,
    targetId,
    req.user.id,
  );
  if (!reciprocal) return res.json({ match: null });

  const [userA, userB] = pairKey(req.user.id, targetId);
  run(
    `INSERT INTO matches (user_a, user_b, created_at) VALUES (?, ?, ?)
     ON CONFLICT (user_a, user_b) DO UPDATE SET closed_at = NULL, closed_by = NULL`,
    userA,
    userB,
    nowIso(),
  );
  const match = get('SELECT * FROM matches WHERE user_a = ? AND user_b = ?', userA, userB);
  dropSparkMessages(match.id, req.user.id, targetId);

  const sparkRows = all(
    `SELECT swiper_id, spark_note, spark_photo FROM swipes
     WHERE spark_note IS NOT NULL AND trim(spark_note) != ''
       AND ((swiper_id = ? AND target_id = ?) OR (swiper_id = ? AND target_id = ?))`,
    req.user.id,
    targetId,
    targetId,
    req.user.id,
  );

  res.json({
    match: {
      id: match.id,
      createdAt: match.created_at,
      profile: publicProfile(target),
      freeTime: freeTimeFor(req.user.id, targetId, 'detail'),
      sparks: sparkRows.map((row) => ({
        fromMe: row.swiper_id === req.user.id,
        note: row.spark_note,
        photoIndex: row.spark_photo,
      })),
    },
  });
});
