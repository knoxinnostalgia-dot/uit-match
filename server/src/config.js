import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));

export const ROOT_DIR = path.resolve(here, '..');
const ephemeralRoot = process.env.VERCEL ? '/tmp/uit-match' : ROOT_DIR;
export const DATA_DIR = path.join(ephemeralRoot, 'data');
export const UPLOADS_DIR = path.join(ephemeralRoot, 'uploads');
export const DB_PATH = process.env.DB_PATH || path.join(DATA_DIR, 'uitmatch.db');

export const PORT = Number(process.env.PORT || 4000);

/**
 * Only people with a University of Information Technology mailbox get in.
 * Override with ALLOWED_EMAIL_DOMAINS="a.edu,b.edu" to run this for another campus.
 */
export const ALLOWED_EMAIL_DOMAINS = (
  process.env.ALLOWED_EMAIL_DOMAINS || 'uit.edu.mm,student.uit.edu.mm'
)
  .split(',')
  .map((d) => d.trim().toLowerCase())
  .filter(Boolean);

export const SESSION_TTL_DAYS = 30;
export const MAX_PHOTOS = 6;
export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

/** UIT undergraduate structure: five academic years, two semesters each. */
export const STUDY_YEARS = [1, 2, 3, 4, 5];
export const STUDY_SEMESTERS = [1, 2];

export const MAJORS = [
  'Software Engineering',
  'Computer Science',
  'Computer Networks',
  'Cyber Security',
  'Business Information Systems',
  'Knowledge Engineering',
  'High Performance Computing',
  'Embedded Systems',
];

export const INTEREST_TAGS = [
  'Coding', 'Anime', 'Football', 'K-pop', 'Gaming', 'Coffee', 'Photography',
  'Hackathons', 'Reading', 'Travelling', 'Music', 'Movies', 'Gym', 'Cooking',
  'Badminton', 'Startups', 'AI/ML', 'Cats', 'Dogs', 'Painting', 'Guitar',
  'Volunteering', 'Chess', 'Dancing', 'Street food', 'Cycling',
];

/** Chips shown on the profile card, e.g. "☕ Coffee". */
export const INTEREST_EMOJI = {
  Coding: '💻', Anime: '🌸', Football: '⚽', 'K-pop': '🎤', Gaming: '🎮',
  Coffee: '☕', Photography: '📷', Hackathons: '⚡', Reading: '📖',
  Travelling: '✈️', Music: '🎧', Movies: '🎬', Gym: '🏋️', Cooking: '🍳',
  Badminton: '🏸', Startups: '🚀', 'AI/ML': '🤖', Cats: '🐱', Dogs: '🐶',
  Painting: '🎨', Guitar: '🎸', Volunteering: '🤝', Chess: '♟️',
  Dancing: '💃', 'Street food': '🍢', Cycling: '🚲',
};

// ---------------------------------------------------------------------------
// Free Time Match
// ---------------------------------------------------------------------------

/** Monday-first, matching how UIT timetables are printed. */
export const DAYS = [
  { index: 0, key: 'mon', short: 'Mon', label: 'Monday' },
  { index: 1, key: 'tue', short: 'Tue', label: 'Tuesday' },
  { index: 2, key: 'wed', short: 'Wed', label: 'Wednesday' },
  { index: 3, key: 'thu', short: 'Thu', label: 'Thursday' },
  { index: 4, key: 'fri', short: 'Fri', label: 'Friday' },
  { index: 5, key: 'sat', short: 'Sat', label: 'Saturday' },
  { index: 6, key: 'sun', short: 'Sun', label: 'Sunday' },
];

export const SLOTS = [
  { key: 'l1', short: 'L1', label: 'Lecture 1', range: '08:30 – 09:30', band: 'morning' },
  { key: 'l2', short: 'L2', label: 'Lecture 2', range: '09:40 – 10:40', band: 'morning' },
  { key: 'l3', short: 'L3', label: 'Lecture 3', range: '10:50 – 11:50', band: 'morning' },
  { key: 'lunch', short: 'Lunch', label: 'Lunch break', range: '11:50 – 12:40', band: 'lunch' },
  { key: 'l4', short: 'L4', label: 'Lecture 4', range: '12:40 – 13:40', band: 'afternoon' },
  { key: 'l5', short: 'L5', label: 'Lecture 5', range: '13:50 – 14:50', band: 'afternoon' },
  { key: 'l6', short: 'L6', label: 'Lecture 6', range: '15:00 – 16:00', band: 'afternoon' },
];

export const SLOT_KEYS = SLOTS.map((s) => s.key);
export const MAX_WEEKLY_CELLS = DAYS.length * SLOTS.length;

/** Overlaps needed before the free-time part of compatibility is considered "full marks". */
export const OVERLAP_TARGET = 8;

export const BUDGETS = [
  { key: 'free', label: 'Free', note: 'costs nothing' },
  { key: 'low', label: 'Low', note: 'under 5,000 MMK each' },
  { key: 'medium', label: 'Medium', note: 'under 15,000 MMK each' },
];

export const BUDGET_ORDER = { free: 0, low: 1, medium: 2 };

export const VENUES = [
  { key: 'campus', label: 'On campus' },
  { key: 'nearby', label: 'Near campus' },
  { key: 'either', label: 'Either is fine' },
];

export const ACTIVITIES = [
  { key: 'coffee', emoji: '☕', label: 'Coffee' },
  { key: 'food', emoji: '🍕', label: 'Food' },
  { key: 'movie', emoji: '🎬', label: 'Movie' },
  { key: 'walk', emoji: '🚶', label: 'Campus walk' },
  { key: 'study', emoji: '📚', label: 'Study together' },
  { key: 'gaming', emoji: '🎮', label: 'Gaming' },
  { key: 'event', emoji: '🎨', label: 'University event' },
];

export const ACTIVITY_KEYS = ACTIVITIES.map((a) => a.key);
