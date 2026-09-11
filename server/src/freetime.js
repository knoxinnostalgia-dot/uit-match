import { DAYS, SLOTS, SLOT_KEYS } from './config.js';
import { all, db, get, run } from './db.js';

const SLOT_LABEL = Object.fromEntries(SLOTS.map((s) => [s.key, s.short]));
const SLOT_RANGE = Object.fromEntries(SLOTS.map((s) => [s.key, s.range]));
const SLOT_BAND = Object.fromEntries(SLOTS.map((s) => [s.key, s.band]));
const DAY_LABEL = Object.fromEntries(DAYS.map((d) => [d.index, d.label]));
const DAY_SHORT = Object.fromEntries(DAYS.map((d) => [d.index, d.short]));

const BAND_HINT = {
  morning: 'morning lectures',
  lunch: 'lunch breaks',
  afternoon: 'afternoon lectures',
};

export const cellId = (day, slot) => `${day}:${slot}`;

export function isValidCell(day, slot) {
  return Number.isInteger(day) && day >= 0 && day <= 6 && SLOT_KEYS.includes(slot);
}

/** Raw timetable for a single user. Only ever called for the signed-in user's own data. */
export function getOwnAvailability(userId) {
  return all('SELECT day, slot FROM availability WHERE user_id = ? ORDER BY day, slot', userId);
}

export function getAvailabilitySet(userId) {
  return new Set(getOwnAvailability(userId).map((r) => cellId(r.day, r.slot)));
}

export function replaceAvailability(userId, cells) {
  const unique = new Map();
  for (const cell of cells) {
    const day = Number(cell?.day);
    const slot = String(cell?.slot);
    if (isValidCell(day, slot)) unique.set(cellId(day, slot), { day, slot });
  }

  db.exec('BEGIN');
  try {
    run('DELETE FROM availability WHERE user_id = ?', userId);
    const insert = db.prepare('INSERT INTO availability (user_id, day, slot) VALUES (?, ?, ?)');
    for (const { day, slot } of unique.values()) insert.run(userId, day, slot);
    db.exec('COMMIT');
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
  return unique.size;
}

export function freeTimeEnabled(userId) {
  const row = get('SELECT free_time_enabled FROM profiles WHERE user_id = ?', userId);
  return Boolean(row?.free_time_enabled);
}

/**
 * The intersection of two timetables, computed server-side and never returned
 * alongside either person's own cells.
 */
export function overlapCells(userA, userB) {
  if (!freeTimeEnabled(userA) || !freeTimeEnabled(userB)) return null;

  const setB = getAvailabilitySet(userB);
  if (setB.size === 0) return [];

  return getOwnAvailability(userA)
    .filter((cell) => setB.has(cellId(cell.day, cell.slot)))
    .map(({ day, slot }) => ({
      day,
      slot,
      dayLabel: DAY_LABEL[day],
      dayShort: DAY_SHORT[day],
      slotLabel: SLOT_LABEL[slot],
      slotRange: SLOT_RANGE[slot],
    }));
}

/**
 * A coarse, human description derived only from the shared cells, so it leaks
 * nothing about the times where just one of the two people is free.
 */
export function describeOverlap(cells) {
  if (!cells || cells.length === 0) return null;

  const total = cells.length;
  const byBand = new Map();
  for (const cell of cells) {
    const band = SLOT_BAND[cell.slot] || 'morning';
    byBand.set(band, (byBand.get(band) || 0) + 1);
  }

  const [topBand, topCount] = [...byBand.entries()].sort((a, b) => b[1] - a[1])[0];
  const weekendRatio = cells.filter((c) => c.day >= 5).length / total;
  const hint = BAND_HINT[topBand] || 'free periods';

  if (topCount / total >= 0.6) {
    if (weekendRatio >= 0.6) return `Weekend ${hint}`;
    if (weekendRatio <= 0.2) return `Weekday ${hint}`;
    return `Mostly ${hint}`;
  }
  if (weekendRatio >= 0.6) return 'Mostly weekends';
  if (weekendRatio <= 0.2) return 'Mostly weekdays';
  return 'Spread across the week';
}

/**
 * Free-time information about another student, gated by relationship.
 *
 *  - `summary`  (browsing the deck): how many periods line up, plus a vague
 *               shape like "Weekday lunch breaks". No specific day is named.
 *  - `detail`   (after a mutual match): the shared cells themselves, which are
 *               mutual information. Still never the other person's full week.
 */
export function freeTimeFor(viewerId, targetId, level = 'summary') {
  const cells = overlapCells(viewerId, targetId);

  if (cells === null) {
    return { available: false, overlapCount: 0, hint: null, slots: [] };
  }

  const base = {
    available: true,
    overlapCount: cells.length,
    hint: describeOverlap(cells),
    slots: [],
  };

  if (level === 'detail') base.slots = cells;
  return base;
}
