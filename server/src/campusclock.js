import { DAYS, SLOTS } from './config.js';

const WEEKDAY = { Mon: 0, Tue: 1, Wed: 2, Thu: 3, Fri: 4, Sat: 5, Sun: 6 };

function toMinutes(stamp) {
  const [hours, minutes] = String(stamp).trim().split(':').map(Number);
  return hours * 60 + minutes;
}

function parseRange(range) {
  const [start, end] = String(range).split('–').map((part) => part.trim());
  return { start: toMinutes(start), end: toMinutes(end) };
}

/** UIT lives on Myanmar time. Fate and "right now" follow Yangon, not the server clock. */
export function yangonNow(date = new Date()) {
  const formatter = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Yangon',
    weekday: 'short',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  });
  const parts = Object.fromEntries(
    formatter
      .formatToParts(date)
      .filter((part) => part.type !== 'literal')
      .map((part) => [part.type, part.value]),
  );
  const minutes = Number(parts.hour) * 60 + Number(parts.minute);
  return {
    dayIndex: WEEKDAY[parts.weekday] ?? 0,
    dateKey: `${parts.year}-${parts.month}-${parts.day}`,
    minutes,
    weekday: DAYS[WEEKDAY[parts.weekday] ?? 0],
  };
}

export function slotAt(minutes) {
  for (const slot of SLOTS) {
    const { start, end } = parseRange(slot.range);
    if (minutes >= start && minutes < end) return { ...slot, start, end };
  }
  return null;
}

export function currentCampusSlot(date = new Date()) {
  const now = yangonNow(date);
  const slot = slotAt(now.minutes);
  return { ...now, slot };
}

export function minutesUntil(endMinutes, nowMinutes) {
  return Math.max(0, endMinutes - nowMinutes);
}
