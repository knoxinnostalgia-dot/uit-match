import { Router } from 'express';
import { requireAuth } from '../auth.js';
import { currentCampusSlot, minutesUntil, slotAt } from '../campusclock.js';
import { chemistryStory } from '../chemistry.js';
import { computeCompatibility } from '../compatibility.js';
import { all, get, run } from '../db.js';
import { freeTimeFor, overlapCells } from '../freetime.js';
import { hashString, listEligibleRows } from '../pool.js';
import { publicProfile } from '../util.js';

export const magicRouter = Router();

function requireOwnProfile(req, res) {
  const profile = get('SELECT * FROM profiles WHERE user_id = ?', req.user.id);
  if (!profile || !profile.is_complete) {
    res.status(409).json({ error: 'Finish your profile first.', code: 'PROFILE_INCOMPLETE' });
    return null;
  }
  return profile;
}

function todayOverlap(viewerId, targetId, dayIndex) {
  const cells = overlapCells(viewerId, targetId);
  if (!cells) return 0;
  return cells.filter((cell) => cell.day === dayIndex).length;
}

function decorateFate(me, candidate, freeTime, compatibility, todayCount) {
  return {
    ...candidate,
    likesMe: false,
    freeTime,
    compatibility,
    todayOverlap: todayCount,
    story: chemistryStory({
      displayName: candidate.displayName,
      overlapCount: freeTime.overlapCount,
      hint: freeTime.hint,
      todayCount,
      sameMajor: Boolean(me.major) && me.major === candidate.major,
      sharedInterests: compatibility.sharedInterests || [],
      score: compatibility.score,
    }),
  };
}

magicRouter.get('/fate', requireAuth, (req, res) => {
  const me = requireOwnProfile(req, res);
  if (!me) return;

  const { dateKey, dayIndex, weekday } = currentCampusSlot();
  const viewer = publicProfile(me);

  const locked = get('SELECT target_id FROM daily_fate WHERE user_id = ? AND date_key = ?', req.user.id, dateKey);
  if (locked) {
    const already = get(
      'SELECT 1 AS ok FROM swipes WHERE swiper_id = ? AND target_id = ?',
      req.user.id,
      locked.target_id,
    );
    if (already) {
      return res.json({ date: dateKey, weekday: weekday?.label ?? null, person: null, used: true });
    }
    const row = get('SELECT * FROM profiles WHERE user_id = ? AND is_complete = 1', locked.target_id);
    if (!row) return res.json({ date: dateKey, weekday: weekday?.label ?? null, person: null, used: true });
    const candidate = publicProfile(row);
    const freeTime = freeTimeFor(req.user.id, row.user_id, 'summary');
    const compatibility = computeCompatibility(viewer, candidate, freeTime);
    const todayCount = todayOverlap(req.user.id, row.user_id, dayIndex);
    return res.json({
      date: dateKey,
      weekday: weekday?.label ?? null,
      person: decorateFate(me, candidate, freeTime, compatibility, todayCount),
    });
  }

  const rows = listEligibleRows(req.user.id, me);

  const ranked = rows
    .map((row) => {
      const candidate = publicProfile(row);
      const freeTime = freeTimeFor(req.user.id, row.user_id, 'summary');
      const compatibility = computeCompatibility(viewer, candidate, freeTime);
      const todayCount = todayOverlap(req.user.id, row.user_id, dayIndex);
      const score =
        todayCount * 48 +
        (freeTime.overlapCount || 0) * 4 +
        compatibility.score;
      return {
        candidate,
        freeTime,
        compatibility,
        todayCount,
        score,
      };
    })
    .sort((a, b) => b.score - a.score);

  if (ranked.length === 0) {
    return res.json({
      date: dateKey,
      weekday: weekday?.label ?? null,
      person: null,
    });
  }

  const shortlist = ranked.slice(0, Math.min(7, ranked.length));
  const pick = shortlist[hashString(`${req.user.id}:${dateKey}`) % shortlist.length];
  run(
    'INSERT INTO daily_fate (user_id, date_key, target_id) VALUES (?, ?, ?) ON CONFLICT DO NOTHING',
    req.user.id,
    dateKey,
    pick.candidate.userId,
  );

  res.json({
    date: dateKey,
    weekday: weekday?.label ?? null,
    person: decorateFate(me, pick.candidate, pick.freeTime, pick.compatibility, pick.todayCount),
  });
});

magicRouter.get('/admirers', requireAuth, (req, res) => {
  const me = requireOwnProfile(req, res);
  if (!me) return;

  const row = get(
    `SELECT COUNT(*) AS n
     FROM swipes s
     JOIN profiles p ON p.user_id = s.swiper_id AND p.is_complete = 1
     WHERE s.target_id = ?
       AND s.action IN ('like', 'superlike')
       AND NOT EXISTS (SELECT 1 FROM swipes mine WHERE mine.swiper_id = ? AND mine.target_id = s.swiper_id)
       AND NOT EXISTS (
             SELECT 1 FROM blocks b
             WHERE (b.blocker_id = ? AND b.blocked_id = s.swiper_id)
                OR (b.blocker_id = s.swiper_id AND b.blocked_id = ?)
           )`,
    req.user.id,
    req.user.id,
    req.user.id,
    req.user.id,
  );

  res.json({ count: Number(row?.n ?? 0) });
});

magicRouter.get('/serendipity', requireAuth, (req, res) => {
  const me = requireOwnProfile(req, res);
  if (!me) return;

  const now = currentCampusSlot();
  if (!now.slot) return res.json({ moments: [], clock: now });

  const matches = all(
    `SELECT m.id, m.user_a, m.user_b FROM matches m
     WHERE (m.user_a = ? OR m.user_b = ?) AND m.closed_at IS NULL`,
    req.user.id,
    req.user.id,
  );

  const moments = [];
  for (const match of matches) {
    const otherId = match.user_a === req.user.id ? match.user_b : match.user_a;
    const cells = overlapCells(req.user.id, otherId);
    if (!cells) continue;
    const hit = cells.find((cell) => cell.day === now.dayIndex && cell.slot === now.slot.key);
    if (!hit) continue;
    const profile = get('SELECT display_name, photos FROM profiles WHERE user_id = ?', otherId);
    const slot = slotAt(now.minutes);
    moments.push({
      matchId: match.id,
      name: profile?.display_name ?? 'A match',
      slotLabel: hit.slotLabel,
      slotRange: hit.slotRange,
      endsInMinutes: slot ? minutesUntil(slot.end, now.minutes) : 0,
    });
  }

  res.json({ moments, clock: { date: now.dateKey, slot: now.slot.short, range: now.slot.range } });
});
