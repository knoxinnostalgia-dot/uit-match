# UIT Match

A campus-only dating **website** for the **University of Information Technology**. Real students only — no fake profiles. Match around the actual UIT lecture timetable (six periods plus lunch).

Live site: [https://uit-match.vercel.app](https://uit-match.vercel.app)

<p align="center">
  <img src="web/public/entrance/heart.png" width="32%" alt="Cinematic intro heart" />
  <img src="web/public/entrance/handshake.png" width="32%" alt="Intro handshake" />
  <img src="web/public/auth/hero.png" width="32%" alt="Campus sign-in" />
</p>

The signed-out site opens on a dark ember intro (Find / Love, then a campus handshake), then university-email sign in. The rest of the app uses the same near-black and ember look — not the old pink mockups.

## Quick start

```bash
npm install
npm run reset     # empty database, no fake students
npm run dev       # API on :4000, web on :5173
```

Open <http://127.0.0.1:5173> and create an account with your UIT email.

Other commands: `npm run seed` (reseed in place), `npm run build`, `npm start` (serves the built
frontend from the API server on :4000).

## The base app

- **Campus-only signup.** Registration is rejected unless the address ends in `@uit.edu.mm` or
  `@student.uit.edu.mm`. Set `ALLOWED_EMAIL_DOMAINS` to run it for another university.
- **Profiles** with photos, major, study year, bio and interests.
- **Swipe deck** — drag a card, use the buttons, or the arrow keys. Mutual likes create a match.
- **Chat** on every match, with unread counts.
- **Safety**: block, report and unmatch.

## Free Time Match

Students fill in the UIT lecture grid — six periods plus lunch — marking when they have no class.
Only the overlap is ever shown to someone else.

### On a profile card

```
Zin Mar Oo, 21
Business Information Systems · Year 3          ❤️ 63%
🎓 Both year 3   ☕ Coffee
🕐 5 overlapping free periods · Weekday lunch breaks
```

The compatibility percentage blends the signals the app already had with the new one:

| Factor | Weight |
| --- | --- |
| Shared interests | 35% |
| Major and study year | 15% |
| Age proximity | 10% |
| Same university | 10% |
| Overlapping free time | 30% |

If either person has Free Time Match switched off, the free-time weight is redistributed across the
other factors rather than scoring that person a zero.

### Plan a Date

After a mutual match, either person can open **Plan a date**, pick from ☕ Coffee, 🍕 Food, 🎬 Movie,
🚶 Campus walk, 📚 Study together, 🎮 Gaming or 🎨 University event, and get ideas ranked by their
shared interests, when they are both free, their budget, and whether they prefer on-campus or nearby.
Suggesting an idea posts it into the chat, and the other person accepts or declines.

## Privacy model

The timetable is the most sensitive thing in the app, so access to it is tiered:

| Who is asking | What they get |
| --- | --- |
| You | Your own grid, editable |
| Anyone browsing your card | A **count** of periods you both have free, plus a coarse hint like "Weekday lunch breaks" |
| Someone you have matched with | The specific periods you have **in common** |
| Anyone at all | Never your full timetable |

- There is no endpoint that returns another user's availability rows. `overlapCells()` computes the
  intersection server-side and only the intersection ever leaves the process.
- Even the coarse hint is derived from the intersection, so it cannot describe a time when only one
  of you is free.
- Turning Free Time Match off removes you from comparison in both directions immediately.
- Date ideas describe a *kind* of place ("a tea shop near the gate"), never an address. The app has no
  location tracking and none was added.

## Architecture

Two workspaces. The server has two runtime dependencies; the database is Node's built-in
`node:sqlite` and password hashing is `node:crypto` scrypt, so there is nothing to compile.

```
server/src
  config.js          domains, majors, interests, days, slots, activities, budgets
  db.js              schema + additive migrations
  auth.js            scrypt hashing, campus email check, signed sessions
  freetime.js        timetable storage, overlap intersection, privacy tiers
  compatibility.js   scoring + the chips shown on a card
  dateideas.js       activity catalogue + ranking
  routes/            auth · profile (incl. availability) · discover · matches
  seed.js            clears the database (never creates fake students)

web/src
  pages/             AuthPage · OnboardingPage · DiscoverPage · MatchesPage
                     ChatPage · FreeTimePage · ProfilePage
  components/        SwipeCard · MatchModal · AvailabilityGrid · PlanDatePanel · NavBar
  entrance/          cinematic intro
```

Free Time Match was added to the existing schema additively — two new tables (`availability`,
`date_plans`) and three new `profiles` columns applied through `ensureColumn()`. No existing table was
restructured.

### API

| Method | Path | Notes |
| --- | --- | --- |
| `POST` | `/api/auth/signup` · `/login` · `/logout` | UIT domains only |
| `GET` | `/api/auth/me` | current user + profile |
| `GET`/`PUT` | `/api/profile/me` | create and edit profile |
| `POST`/`DELETE` | `/api/profile/photos` | upload, max 6 |
| `GET`/`PUT` | `/api/profile/availability` | **your own** timetable and settings |
| `GET` | `/api/discover` | deck with compatibility + overlap count |
| `POST` | `/api/swipes` | like / pass / superlike, returns a match |
| `GET` | `/api/matches` · `/api/matches/:id` | detail reveals shared slots |
| `GET`/`POST` | `/api/matches/:id/messages` | short-polled |
| `GET` | `/api/matches/:id/date-ideas` | `?activity=&budget=&venue=` |
| `POST` | `/api/matches/:id/plans` · `/api/plans/:id/respond` | propose / accept / decline |
| `POST` | `/api/blocks` · `/api/reports` | safety |

## Known limitations

This is an MVP. Chat is short-polled rather than websocket-driven; email addresses are trusted after
the domain check rather than verified with a confirmation link; and photos are stored on disk.
The live Vercel deployment needs Blob storage connected with `BLOB_READ_WRITE_TOKEN` so accounts
survive across requests.
