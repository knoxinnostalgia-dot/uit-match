import crypto from 'node:crypto';
import path from 'node:path';
import { Router } from 'express';
import multer from 'multer';
import { requireAuth } from '../auth.js';
import { MAX_PHOTOS, MAX_UPLOAD_BYTES, MAX_WEEKLY_CELLS, UPLOADS_DIR } from '../config.js';
import { get, nowIso, run } from '../db.js';
import { getOwnAvailability, replaceAvailability } from '../freetime.js';
import { ownProfile, parseJsonArray, validateProfile } from '../util.js';

export const profileRouter = Router();

const ALLOWED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);

const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, UPLOADS_DIR),
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase().slice(0, 5) || '.jpg';
      cb(null, `${crypto.randomBytes(12).toString('hex')}${ext}`);
    },
  }),
  limits: { fileSize: MAX_UPLOAD_BYTES, files: 1 },
  fileFilter: (_req, file, cb) => {
    if (!ALLOWED_IMAGE_TYPES.has(file.mimetype)) {
      return cb(new Error('Only JPEG, PNG, WebP or GIF images are allowed.'));
    }
    cb(null, true);
  },
});

const REQUIRED_FOR_COMPLETE = ['display_name', 'birthdate', 'gender', 'interested_in'];

function readProfile(userId) {
  return get('SELECT * FROM profiles WHERE user_id = ?', userId);
}

profileRouter.get('/me', requireAuth, (req, res) => {
  res.json({ profile: ownProfile(readProfile(req.user.id), req.user.email) });
});

profileRouter.put('/me', requireAuth, (req, res) => {
  const existing = readProfile(req.user.id);
  const { errors, fields } = validateProfile(req.body || {}, { partial: Boolean(existing) });
  if (errors.length) return res.status(400).json({ error: errors[0], errors });

  if (!existing) {
    run(
      `INSERT INTO profiles (user_id, display_name, birthdate, gender, interested_in, major, study_year, study_semester,
                             bio, interests, photos, min_age, max_age, is_complete, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)`,
      req.user.id,
      fields.display_name,
      fields.birthdate,
      fields.gender,
      fields.interested_in,
      fields.major ?? null,
      fields.study_year ?? null,
      fields.study_semester ?? null,
      fields.bio ?? '',
      fields.interests ?? '[]',
      fields.photos ?? '[]',
      fields.min_age ?? 18,
      fields.max_age ?? 30,
      nowIso(),
    );
  } else {
    const entries = Object.entries(fields);
    if (entries.length) {
      // Column names come from validateProfile's fixed whitelist, never from user input.
      const setClause = entries.map(([column]) => `${column} = ?`).join(', ');
      run(
        `UPDATE profiles SET ${setClause}, updated_at = ? WHERE user_id = ?`,
        ...entries.map(([, value]) => value),
        nowIso(),
        req.user.id,
      );
    }

    const after = readProfile(req.user.id);
    const complete = REQUIRED_FOR_COMPLETE.every((column) => after[column] !== null && after[column] !== '');
    run('UPDATE profiles SET is_complete = ? WHERE user_id = ?', complete ? 1 : 0, req.user.id);
  }

  res.json({ profile: ownProfile(readProfile(req.user.id), req.user.email) });
});

profileRouter.post('/photos', requireAuth, upload.single('photo'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No image received.' });

  const profile = readProfile(req.user.id);
  const photos = parseJsonArray(profile?.photos);
  if (photos.length >= MAX_PHOTOS) {
    return res.status(400).json({ error: `You can have up to ${MAX_PHOTOS} photos.` });
  }

  const url = `/uploads/${req.file.filename}`;
  photos.push(url);

  if (profile) {
    run('UPDATE profiles SET photos = ?, updated_at = ? WHERE user_id = ?', JSON.stringify(photos), nowIso(), req.user.id);
  }

  res.status(201).json({ url, photos });
});

profileRouter.delete('/photos', requireAuth, (req, res) => {
  const { url } = req.body || {};
  const profile = readProfile(req.user.id);
  const photos = parseJsonArray(profile?.photos).filter((p) => p !== url);
  run('UPDATE profiles SET photos = ?, updated_at = ? WHERE user_id = ?', JSON.stringify(photos), nowIso(), req.user.id);
  res.json({ photos });
});

// ---------------------------------------------------------------------------
// Free Time Match: a student's own weekly timetable.
// There is deliberately no endpoint that returns anyone else's cells.
// ---------------------------------------------------------------------------

profileRouter.get('/availability', requireAuth, (req, res) => {
  const profile = readProfile(req.user.id);
  res.json({
    cells: getOwnAvailability(req.user.id),
    enabled: Boolean(profile?.free_time_enabled),
    budget: profile?.budget ?? 'low',
    venuePreference: profile?.venue_preference ?? 'either',
  });
});

profileRouter.put('/availability', requireAuth, (req, res) => {
  const profile = readProfile(req.user.id);
  if (!profile) return res.status(400).json({ error: 'Finish your profile first.' });

  const { cells, enabled, budget, venuePreference } = req.body || {};

  if (cells !== undefined) {
    if (!Array.isArray(cells)) return res.status(400).json({ error: 'Availability must be a list of time slots.' });
    if (cells.length > MAX_WEEKLY_CELLS) return res.status(400).json({ error: 'That is more slots than a week has.' });
    replaceAvailability(req.user.id, cells);
  }

  const settings = {};
  if (enabled !== undefined) settings.freeTimeEnabled = Boolean(enabled);
  if (budget !== undefined) settings.budget = budget;
  if (venuePreference !== undefined) settings.venuePreference = venuePreference;

  if (Object.keys(settings).length) {
    const { errors, fields } = validateProfile(settings, { partial: true });
    if (errors.length) return res.status(400).json({ error: errors[0], errors });

    const entries = Object.entries(fields);
    const setClause = entries.map(([column]) => `${column} = ?`).join(', ');
    run(
      `UPDATE profiles SET ${setClause}, updated_at = ? WHERE user_id = ?`,
      ...entries.map(([, value]) => value),
      nowIso(),
      req.user.id,
    );
  }

  const updated = readProfile(req.user.id);
  res.json({
    cells: getOwnAvailability(req.user.id),
    enabled: Boolean(updated.free_time_enabled),
    budget: updated.budget,
    venuePreference: updated.venue_preference,
  });
});
