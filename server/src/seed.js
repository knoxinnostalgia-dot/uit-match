/**
 * Clears local data. Does not create fake students — UIT Match is real people only.
 *
 *   npm run seed
 *   npm run reset
 */
import fs from 'node:fs';
import path from 'node:path';
import { DATA_DIR, DB_PATH, UPLOADS_DIR } from './config.js';

const RESET = process.argv.includes('--reset');

if (RESET) {
  for (const suffix of ['', '-wal', '-shm']) {
    fs.rmSync(`${DB_PATH}${suffix}`, { force: true });
  }
  console.log('Removed existing database.');
}

fs.mkdirSync(DATA_DIR, { recursive: true });
fs.mkdirSync(UPLOADS_DIR, { recursive: true });

const { run, get } = await import('./db.js');

for (const table of [
  'date_plans',
  'messages',
  'matches',
  'swipes',
  'availability',
  'blocks',
  'reports',
  'sessions',
  'profiles',
  'users',
]) {
  run(`DELETE FROM ${table}`);
}

for (const file of fs.readdirSync(UPLOADS_DIR)) {
  if (file.startsWith('seed-')) fs.rmSync(path.join(UPLOADS_DIR, file), { force: true });
}

const students = get('SELECT COUNT(*) AS n FROM users').n;
console.log(`Database is empty (${students} students).`);
console.log('Sign up at the site with a UIT email — no demo accounts and no fake profiles.');
