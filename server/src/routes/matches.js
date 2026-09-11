import { Router } from 'express';
import { requireAuth } from '../auth.js';
import { computeCompatibility } from '../compatibility.js';
import { ACTIVITY_KEYS, BUDGET_ORDER, VENUES } from '../config.js';
import { currentCampusSlot, minutesUntil } from '../campusclock.js';
import { all, get, nowIso, run } from '../db.js';
import { suggestDateIdeas } from '../dateideas.js';
import { freeTimeFor, isValidCell, overlapCells } from '../freetime.js';
import { publicProfile } from '../util.js';

export const matchesRouter = Router();

/** Loads a match the caller is actually part of, or null. */
function loadMatch(matchId, userId) {
  const match = get(
    'SELECT * FROM matches WHERE id = ? AND (user_a = ? OR user_b = ?) AND closed_at IS NULL',
    Number(matchId),
    userId,
    userId,
  );
  if (!match) return null;
  return { match, otherId: match.user_a === userId ? match.user_b : match.user_a };
}

function withMatch(req, res, handler) {
  const found = loadMatch(req.params.id, req.user.id);
  if (!found) return res.status(404).json({ error: 'Match not found.' });
  return handler(found.match, found.otherId);
}

function serializePlan(row, userId) {
  return {
    id: row.id,
    activity: row.activity,
    title: row.title,
    description: row.description,
    day: row.day,
    slot: row.slot,
    budget: row.budget,
    venue: row.venue,
    status: row.status,
    createdAt: row.created_at,
    respondedAt: row.responded_at,
    proposedByMe: row.proposed_by === userId,
  };
}

matchesRouter.get('/matches', requireAuth, (req, res) => {
  const rows = all(
    `SELECT m.id, m.created_at, m.user_a, m.user_b
     FROM matches m
     WHERE (m.user_a = ? OR m.user_b = ?) AND m.closed_at IS NULL
     ORDER BY m.created_at DESC`,
    req.user.id,
    req.user.id,
  );

  const matches = rows.map((row) => {
    const otherId = row.user_a === req.user.id ? row.user_b : row.user_a;
    const profileRow = get('SELECT * FROM profiles WHERE user_id = ?', otherId);
    const lastMessage = get(
      'SELECT body, sender_id, created_at FROM messages WHERE match_id = ? ORDER BY id DESC LIMIT 1',
      row.id,
    );
    const unread = get(
      'SELECT COUNT(*) AS n FROM messages WHERE match_id = ? AND sender_id != ? AND read_at IS NULL',
      row.id,
      req.user.id,
    );

    return {
      id: row.id,
      createdAt: row.created_at,
      profile: publicProfile(profileRow),
      freeTime: freeTimeFor(req.user.id, otherId, 'summary'),
      lastMessage: lastMessage
        ? { body: lastMessage.body, mine: lastMessage.sender_id === req.user.id, createdAt: lastMessage.created_at }
        : null,
      unread: Number(unread?.n ?? 0),
    };
  });

  res.json({ matches });
});

matchesRouter.get('/matches/:id', requireAuth, (req, res) =>
  withMatch(req, res, (match, otherId) => {
    const meRow = get('SELECT * FROM profiles WHERE user_id = ?', req.user.id);
    const otherRow = get('SELECT * FROM profiles WHERE user_id = ?', otherId);

    // Matched, so the shared cells are fair game. Still only the intersection.
    const freeTime = freeTimeFor(req.user.id, otherId, 'detail');
    const compatibility = computeCompatibility(publicProfile(meRow), publicProfile(otherRow), freeTime);

    const sparks = all(
      `SELECT swiper_id, spark_note, spark_photo FROM swipes
       WHERE spark_note IS NOT NULL AND trim(spark_note) != ''
         AND ((swiper_id = ? AND target_id = ?) OR (swiper_id = ? AND target_id = ?))`,
      req.user.id,
      otherId,
      otherId,
      req.user.id,
    );

    const now = currentCampusSlot();
    let rightNow = null;
    if (now.slot) {
      const hit = (overlapCells(req.user.id, otherId) || []).find(
        (cell) => cell.day === now.dayIndex && cell.slot === now.slot.key,
      );
      if (hit) {
        rightNow = {
          slotLabel: hit.slotLabel,
          slotRange: hit.slotRange,
          endsInMinutes: minutesUntil(now.slot.end, now.minutes),
        };
      }
    }

    res.json({
      match: {
        id: match.id,
        createdAt: match.created_at,
        profile: publicProfile(otherRow),
        freeTime,
        compatibility,
        sparks: sparks.map((row) => ({
          fromMe: row.swiper_id === req.user.id,
          note: row.spark_note,
          photoIndex: row.spark_photo,
        })),
        rightNow,
        plans: all('SELECT * FROM date_plans WHERE match_id = ? ORDER BY id DESC', match.id).map((p) =>
          serializePlan(p, req.user.id),
        ),
      },
    });
  }),
);

matchesRouter.delete('/matches/:id', requireAuth, (req, res) =>
  withMatch(req, res, (match) => {
    run('UPDATE matches SET closed_at = ?, closed_by = ? WHERE id = ?', nowIso(), req.user.id, match.id);
    res.json({ ok: true });
  }),
);

// ---------------------------------------------------------------------------
// Messages
// ---------------------------------------------------------------------------

matchesRouter.get('/matches/:id/messages', requireAuth, (req, res) =>
  withMatch(req, res, (match) => {
    const after = Number(req.query.after || 0);
    const messages = all(
      'SELECT * FROM messages WHERE match_id = ? AND id > ? ORDER BY id ASC LIMIT 200',
      match.id,
      Number.isFinite(after) ? after : 0,
    );

    run(
      'UPDATE messages SET read_at = ? WHERE match_id = ? AND sender_id != ? AND read_at IS NULL',
      nowIso(),
      match.id,
      req.user.id,
    );

    res.json({
      messages: messages.map((m) => ({
        id: Number(m.id),
        body: m.body,
        mine: m.sender_id === req.user.id,
        createdAt: m.created_at,
      })),
    });
  }),
);

matchesRouter.post('/matches/:id/messages', requireAuth, (req, res) =>
  withMatch(req, res, (match) => {
    const body = String(req.body?.body ?? '').trim();
    if (!body) return res.status(400).json({ error: 'Message is empty.' });
    if (body.length > 2000) return res.status(400).json({ error: 'Message is too long.' });

    const { lastInsertRowid } = run(
      'INSERT INTO messages (match_id, sender_id, body, created_at) VALUES (?, ?, ?, ?)',
      match.id,
      req.user.id,
      body,
      nowIso(),
    );

    const row = get('SELECT * FROM messages WHERE id = ?', lastInsertRowid);
    res.status(201).json({
      message: { id: row.id, body: row.body, mine: true, createdAt: row.created_at },
    });
  }),
);

// ---------------------------------------------------------------------------
// Free Time Match: Plan a Date
// ---------------------------------------------------------------------------

matchesRouter.get('/matches/:id/date-ideas', requireAuth, (req, res) =>
  withMatch(req, res, (match, otherId) => {
    const activity = String(req.query.activity || 'coffee');
    if (!ACTIVITY_KEYS.includes(activity)) return res.status(400).json({ error: 'Unknown activity.' });

    const meRow = get('SELECT * FROM profiles WHERE user_id = ?', req.user.id);
    const otherRow = get('SELECT * FROM profiles WHERE user_id = ?', otherId);

    const freeTime = freeTimeFor(req.user.id, otherId, 'detail');
    const { sharedInterests } = computeCompatibility(publicProfile(meRow), publicProfile(otherRow), freeTime);

    const budget = req.query.budget && req.query.budget in BUDGET_ORDER ? req.query.budget : meRow.budget;
    const venue = VENUES.some((v) => v.key === req.query.venue) ? req.query.venue : meRow.venue_preference;

    res.json({
      ideas: suggestDateIdeas({
        activity,
        sharedInterests,
        overlapSlots: freeTime.slots,
        budget,
        venue,
      }),
      context: { sharedInterests, overlapCount: freeTime.overlapCount, budget, venue },
    });
  }),
);

matchesRouter.post('/matches/:id/plans', requireAuth, (req, res) =>
  withMatch(req, res, (match) => {
    const { activity, title, description = '', day = null, slot = null, budget = 'low', venue = 'campus' } =
      req.body || {};

    if (!ACTIVITY_KEYS.includes(activity)) return res.status(400).json({ error: 'Choose an activity.' });
    if (!String(title || '').trim()) return res.status(400).json({ error: 'Give the plan a title.' });
    if (day !== null && !isValidCell(Number(day), String(slot))) {
      return res.status(400).json({ error: 'Pick a valid day and time.' });
    }
    if (!(budget in BUDGET_ORDER)) return res.status(400).json({ error: 'Choose a valid budget.' });
    if (!VENUES.some((v) => v.key === venue)) return res.status(400).json({ error: 'Choose a valid venue.' });

    const { lastInsertRowid } = run(
      `INSERT INTO date_plans (match_id, proposed_by, activity, title, description, day, slot, budget, venue, status, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'proposed', ?)`,
      match.id,
      req.user.id,
      activity,
      String(title).trim().slice(0, 120),
      String(description).slice(0, 400),
      day === null ? null : Number(day),
      day === null ? null : String(slot),
      budget,
      venue,
      nowIso(),
    );

    // Drop a line into the conversation so the invite is visible in chat too.
    run(
      'INSERT INTO messages (match_id, sender_id, body, created_at) VALUES (?, ?, ?, ?)',
      match.id,
      req.user.id,
      `?? Suggested a plan: ${String(title).trim()}`,
      nowIso(),
    );

    const row = get('SELECT * FROM date_plans WHERE id = ?', lastInsertRowid);
    res.status(201).json({ plan: serializePlan(row, req.user.id) });
  }),
);

matchesRouter.post('/plans/:planId/respond', requireAuth, (req, res) => {
  const status = req.body?.status;
  if (!['accepted', 'declined'].includes(status)) return res.status(400).json({ error: 'Unknown response.' });

  const plan = get('SELECT * FROM date_plans WHERE id = ?', Number(req.params.planId));
  if (!plan) return res.status(404).json({ error: 'Plan not found.' });

  const found = loadMatch(plan.match_id, req.user.id);
  if (!found) return res.status(404).json({ error: 'Plan not found.' });
  if (plan.proposed_by === req.user.id) {
    return res.status(400).json({ error: 'Wait for them to respond to your plan.' });
  }

  run('UPDATE date_plans SET status = ?, responded_at = ? WHERE id = ?', status, nowIso(), plan.id);
  run(
    'INSERT INTO messages (match_id, sender_id, body, created_at) VALUES (?, ?, ?, ?)',
    plan.match_id,
    req.user.id,
    status === 'accepted' ? `? Accepted: ${plan.title}` : `? Cannot make it: ${plan.title}`,
    nowIso(),
  );

  res.json({ plan: serializePlan(get('SELECT * FROM date_plans WHERE id = ?', plan.id), req.user.id) });
});

// ---------------------------------------------------------------------------
// Safety
// ---------------------------------------------------------------------------

matchesRouter.post('/blocks', requireAuth, (req, res) => {
  const blockedId = Number(req.body?.userId);
  if (!Number.isInteger(blockedId) || blockedId === req.user.id) {
    return res.status(400).json({ error: 'Invalid profile.' });
  }

  run(
    'INSERT INTO blocks (blocker_id, blocked_id, created_at) VALUES (?, ?, ?) ON CONFLICT DO NOTHING',
    req.user.id,
    blockedId,
    nowIso(),
  );

  const [a, b] = req.user.id < blockedId ? [req.user.id, blockedId] : [blockedId, req.user.id];
  run('UPDATE matches SET closed_at = ?, closed_by = ? WHERE user_a = ? AND user_b = ?', nowIso(), req.user.id, a, b);

  res.json({ ok: true });
});

matchesRouter.post('/reports', requireAuth, (req, res) => {
  const reportedId = Number(req.body?.userId);
  const reason = String(req.body?.reason || '').trim();
  if (!Number.isInteger(reportedId) || !reason) return res.status(400).json({ error: 'Tell us what happened.' });

  run(
    'INSERT INTO reports (reporter_id, reported_id, reason, details, created_at) VALUES (?, ?, ?, ?, ?)',
    req.user.id,
    reportedId,
    reason.slice(0, 80),
    String(req.body?.details || '').slice(0, 1000),
    nowIso(),
  );

  res.json({ ok: true });
});
