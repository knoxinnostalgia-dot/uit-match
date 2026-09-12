import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import {
  ACTIVITIES,
  ALLOWED_EMAIL_DOMAINS,
  BUDGETS,
  DAYS,
  INTEREST_EMOJI,
  INTEREST_TAGS,
  MAJORS,
  MAX_PHOTOS,
  PORT,
  ROOT_DIR,
  SLOTS,
  STUDY_SEMESTERS,
  STUDY_YEARS,
  UPLOADS_DIR,
  VENUES,
} from './config.js';
import { beginRequest, initDb, persistIfDirty, persistenceMode, runExclusive, usesBlob } from './db.js';
import { authRouter } from './routes/auth.js';
import { discoverRouter } from './routes/discover.js';
import { matchesRouter } from './routes/matches.js';
import { magicRouter } from './routes/magic.js';
import { profileRouter } from './routes/profile.js';

const app = express();

app.use(express.json({ limit: '1mb' }));
app.use('/uploads', express.static(UPLOADS_DIR, { maxAge: '7d' }));

/**
 * Reload sqlite from Blob, then save it again before the response leaves.
 * Without this, signup can land on one serverless instance and login on another
 * that never saw the new account.
 */
app.use((req, res, next) => {
  if (!usesBlob()) {
    initDb().then(() => next(), next);
    return;
  }

  runExclusive(async () => {
    await beginRequest();
    await new Promise((resolve, reject) => {
      const origEnd = res.end.bind(res);
      let finished = false;
      const finish = (err) => {
        if (finished) return;
        finished = true;
        clearTimeout(stuck);
        if (err) reject(err);
        else resolve();
      };
      const stuck = setTimeout(() => finish(), 20_000);
      res.end = function (...args) {
        persistIfDirty()
          .then(() => {
            origEnd(...args);
            finish();
          })
          .catch((err) => {
            console.error('Could not save database:', err.message);
            if (!res.headersSent) {
              res.statusCode = err.status || 503;
              res.setHeader('content-type', 'application/json; charset=utf-8');
              origEnd(JSON.stringify({ error: err.message || 'Could not save your account. Please try again.' }));
            } else {
              origEnd(...args);
            }
            finish();
          });
        return res;
      };
      next();
    });
  }).catch(next);
});

app.get('/api/health', (_req, res) => res.json({ ok: true, persistence: persistenceMode() }));

/** Everything the client needs to render pickers, kept in one place. */
app.get('/api/meta', (_req, res) => {
  res.json({
    majors: MAJORS,
    studyYears: STUDY_YEARS,
    studySemesters: STUDY_SEMESTERS,
    interests: INTEREST_TAGS,
    interestEmoji: INTEREST_EMOJI,
    days: DAYS,
    slots: SLOTS,
    activities: ACTIVITIES,
    budgets: BUDGETS,
    venues: VENUES,
    allowedEmailDomains: ALLOWED_EMAIL_DOMAINS,
    maxPhotos: MAX_PHOTOS,
  });
});

app.use('/api/auth', authRouter);
app.use('/api/profile', profileRouter);
app.use('/api', magicRouter);
app.use('/api', discoverRouter);
app.use('/api', matchesRouter);

app.use('/api', (_req, res) => res.status(404).json({ error: 'Not found.' }));

// Serve the built frontend when it exists, so `npm run build && npm start` works.
const distDir = path.resolve(ROOT_DIR, '..', 'web', 'dist');
if (fs.existsSync(distDir)) {
  app.use(express.static(distDir));
  app.get('*', (_req, res) => res.sendFile(path.join(distDir, 'index.html')));
}

app.use((err, _req, res, _next) => {
  const status = err.status || (err.code === 'LIMIT_FILE_SIZE' ? 413 : 500);
  if (status >= 500) console.error(err);
  res.status(status).json({ error: err.message || 'Something went wrong.' });
});

await initDb();

if (process.env.VERCEL && !usesBlob()) {
  console.error(
    'BLOB_READ_WRITE_TOKEN is missing. Accounts created on this deployment will not survive the next request.',
  );
}

export default app;

if (!process.env.VERCEL) {
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`UIT Match API listening on http://localhost:${PORT}`);
    console.log(`Campus domains: ${ALLOWED_EMAIL_DOMAINS.join(', ')}`);
  });
}
