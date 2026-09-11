import { BUDGET_ORDER, MAX_PHOTOS, VENUES } from './config.js';

/** Age expression reused by the discovery query so JS and SQL agree on "how old is this person". */
export const SQL_AGE = "CAST((julianday('now') - julianday(p.birthdate)) / 365.25 AS INTEGER)";

export function calcAge(birthdate) {
  const dob = new Date(birthdate);
  if (Number.isNaN(dob.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - dob.getFullYear();
  const monthDelta = now.getMonth() - dob.getMonth();
  if (monthDelta < 0 || (monthDelta === 0 && now.getDate() < dob.getDate())) age -= 1;
  return age;
}

export function parseJsonArray(value) {
  try {
    const parsed = JSON.parse(value ?? '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function publicProfile(row, extra = {}) {
  if (!row) return null;
  return {
    userId: row.user_id,
    displayName: row.display_name,
    age: calcAge(row.birthdate),
    gender: row.gender,
    major: row.major,
    studyYear: row.study_year,
    studySemester: row.study_semester,
    bio: row.bio,
    interests: parseJsonArray(row.interests),
    photos: parseJsonArray(row.photos),
    ...extra,
  };
}

export function ownProfile(row, email) {
  if (!row) return null;
  return {
    ...publicProfile(row),
    email,
    birthdate: row.birthdate,
    interestedIn: row.interested_in,
    minAge: row.min_age,
    maxAge: row.max_age,
    isComplete: Boolean(row.is_complete),
    freeTimeEnabled: Boolean(row.free_time_enabled),
    budget: row.budget,
    venuePreference: row.venue_preference,
  };
}

const GENDERS = ['woman', 'man', 'nonbinary'];
const PREFERENCES = ['women', 'men', 'everyone'];

/** Maps "who am I" to "who is looking for me", so attraction can be checked in both directions. */
export const GENDER_TO_PREFERENCE = {
  woman: 'women',
  man: 'men',
  nonbinary: 'everyone',
};

export function validateProfile(input, { partial = false } = {}) {
  const errors = [];
  const out = {};

  const has = (key) => input[key] !== undefined && input[key] !== null;
  const required = (key) => !partial || has(key);

  if (required('displayName')) {
    const name = String(input.displayName ?? '').trim();
    if (name.length < 2 || name.length > 40) errors.push('Name must be 2-40 characters.');
    else out.display_name = name;
  }

  if (required('birthdate')) {
    const birthdate = String(input.birthdate ?? '').slice(0, 10);
    const age = calcAge(birthdate);
    if (age === null) errors.push('Enter a valid date of birth.');
    else if (age < 18) errors.push('You must be at least 18 to use UIT Match.');
    else if (age > 80) errors.push('Enter a valid date of birth.');
    else out.birthdate = birthdate;
  }

  if (required('gender')) {
    if (!GENDERS.includes(input.gender)) errors.push('Choose a gender.');
    else out.gender = input.gender;
  }

  if (required('interestedIn')) {
    if (!PREFERENCES.includes(input.interestedIn)) errors.push('Choose who you want to see.');
    else out.interested_in = input.interestedIn;
  }

  if (has('major')) out.major = String(input.major).trim().slice(0, 60);

  if (has('studyYear')) {
    const year = Number(input.studyYear);
    if (!Number.isInteger(year) || year < 1 || year > 5) errors.push('Study year must be 1-5.');
    else out.study_year = year;
  }

  if (has('studySemester')) {
    const semester = Number(input.studySemester);
    if (!Number.isInteger(semester) || semester < 1 || semester > 2) errors.push('Semester must be 1 or 2.');
    else out.study_semester = semester;
  }

  if (has('bio')) {
    const bio = String(input.bio).trim();
    if (bio.length > 500) errors.push('Bio must be under 500 characters.');
    else out.bio = bio;
  }

  if (has('interests')) {
    const interests = Array.isArray(input.interests) ? input.interests : [];
    if (interests.length > 10) errors.push('Pick at most 10 interests.');
    else out.interests = JSON.stringify(interests.map((i) => String(i).trim().slice(0, 30)).filter(Boolean));
  }

  if (has('photos')) {
    const photos = Array.isArray(input.photos) ? input.photos : [];
    // Only server-issued upload paths are accepted, so a client can't point a photo at an arbitrary URL.
    const safe = photos.filter((p) => typeof p === 'string' && p.startsWith('/uploads/')).slice(0, MAX_PHOTOS);
    out.photos = JSON.stringify(safe);
  }

  // Free Time Match settings. All optional: a profile is complete without them.
  if (has('freeTimeEnabled')) {
    out.free_time_enabled = input.freeTimeEnabled ? 1 : 0;
  }

  if (has('budget')) {
    if (!(input.budget in BUDGET_ORDER)) errors.push('Choose a valid budget.');
    else out.budget = input.budget;
  }

  if (has('venuePreference')) {
    if (!VENUES.some((v) => v.key === input.venuePreference)) errors.push('Choose a valid venue preference.');
    else out.venue_preference = input.venuePreference;
  }

  if (has('minAge') || has('maxAge')) {
    const minAge = Number(input.minAge ?? 18);
    const maxAge = Number(input.maxAge ?? 30);
    if (!Number.isInteger(minAge) || !Number.isInteger(maxAge) || minAge < 18 || maxAge > 80 || minAge > maxAge) {
      errors.push('Age range must be between 18 and 80, with a valid minimum and maximum.');
    } else {
      out.min_age = minAge;
      out.max_age = maxAge;
    }
  }

  return { errors, fields: out };
}

const AVATAR_PALETTES = [
  ['#ff6b8b', '#ff2d6f', '#7a1fa2'],
  ['#7c5cff', '#4d2bff', '#00c2ff'],
  ['#00c9a7', '#00a3ff', '#0b5fff'],
  ['#ffa53b', '#ff5f6d', '#c22ed0'],
  ['#3ddc97', '#1fa2ff', '#12d8fa'],
  ['#f857a6', '#ff5858', '#ffae42'],
];

function hashString(text) {
  let hash = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return Math.abs(hash);
}

export function initialsOf(name) {
  return String(name)
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join('');
}

/**
 * Placeholder portrait art generated locally so seeded profiles look alive
 * without reaching out to an image service.
 */
export function generateAvatarSvg(seed, name) {
  const hash = hashString(seed);
  const [c1, c2, c3] = AVATAR_PALETTES[hash % AVATAR_PALETTES.length];
  // 3:4 portrait so it fills a profile card without the initials being blown up.
  const W = 768;
  const H = 1024;

  const blobs = [0, 1, 2].map((i) => {
    const h = hashString(`${seed}:${i}`);
    return {
      cx: 140 + (h % (W - 280)),
      cy: 160 + ((h >> 5) % (H - 320)),
      r: 190 + ((h >> 9) % 190),
      fill: [c1, c2, c3][i],
      opacity: 0.5 + ((h >> 13) % 30) / 100,
    };
  });

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${c1}"/>
      <stop offset="100%" stop-color="${c3}"/>
    </linearGradient>
    <filter id="soft" x="-50%" y="-50%" width="200%" height="200%">
      <feGaussianBlur stdDeviation="95"/>
    </filter>
  </defs>
  <rect width="${W}" height="${H}" fill="url(#bg)"/>
  <g filter="url(#soft)">
    ${blobs
      .map((b) => `<circle cx="${b.cx}" cy="${b.cy}" r="${b.r}" fill="${b.fill}" opacity="${b.opacity}"/>`)
      .join('\n    ')}
  </g>
  <text x="${W / 2}" y="${H * 0.42}" text-anchor="middle" dominant-baseline="central"
        font-family="Segoe UI, Roboto, Helvetica, Arial, sans-serif" font-size="200"
        font-weight="700" fill="#ffffff" fill-opacity="0.9">${initialsOf(name)}</text>
</svg>`;
}
