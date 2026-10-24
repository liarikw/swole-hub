# Welcome to Swole Hub 🏋️

* This is a workout and hobby learning logger that is mobile-first but also works on a desktop or laptop
* I created this to replace the annoyance of logging and tracking my workouts in my Notes app, but it has evolved into tracking my habits like learning languages and practicing instruments.
* Now I can track lifts, cardio, recovery, other workouts
* It runs on Vercel (static page + serverless functions) with a Supabase Postgres database. No app store install: open https://swole-hub.vercel.app and Add to Home Screen

---

## Swole Hub Overview ~~~

Every day has its own plan: a preset list of exercises. You open the app, it already knows what today is and what you're supposed to do, and you just tap to bump the numbers up or down and log. Over time it quietly builds a history so you can see whether you're actually getting stronger, swimming more, or keeping up your languages.

3 ideas hold it together:

1. **Preloaded plans:** Pick a day, and see the preset workout (activity) along with recovery and other workouts (activities)
2. **Logging through simple taps:** Steppers for sets / reps / weight, quick "I went up" tags, and a Save button
3. **Nothing gets lost or duplicated:** Each entry is keyed to *who + exercise +  date*, so re-saving a day updates it instead of piling on junk rows

---

## How Swole Hub is Built ~~~

- **Front End:** one static page, `public/index.html` (UI + styles + logic), served by Vercel
- **API:** `api/[fn].js`, one serverless function that exposes the backend functions in `lib/core.js` as `POST /api/<name>`
- **Database:** Supabase Postgres (`log`, `program`, `skips`, `users`), every row tagged with a user. RLS is on and the public API is locked out; only the server talks to the database
- **Login:** profile + PIN, checked server-side (PINs stored hashed), then a signed session token on every call

---

## Swole Hub's Features ~~~

### Private profiles
For now, I've enabled two profiles for me and someone else to share the app with our separate data. I use a simple PIN to log in.

### Weekly bar
* A scrolling week strip across the top shows each day as a ring that fills up as you complete the day's work
* Days are labeled in kanji, with full Japanese and Korean day names shown on the workout title
* Today is highlighted, future days are dimmed, and you can page back through previous weeks

### At-a-glance stats
Three headline tiles up top: current **Bench PR**, how many **full days** completed this week, and total **time trained** this week

### Workout logging
* Each day loads preset exercises as cards
* For a normal lift you get steppers for **sets, reps, and weight**, plus quick tags for **▲ set / ▲ rep / ▲ weight / PR** so you can mark *how* you progressed
* Swole Hub remembers your last entry for that lift and shows it, gently warns you if something looks off (like tagging a PR without actually beating your old weight, or a weight that's suspiciously high), and celebrates a real PR
* Cardio exercises swap in the right fields automatically: stairmaster gets level and calories, treadmill gets pace, and so on
* Anything you skip can be marked skipped without penalty, and each card can carry a note

### Workout time
A start/end time logger for each session, so your total training minutes roll up into weekly stats

### The "Other Exercises" sections
Everything that isn't a numbered lift lives in its own tidy section:

- **Warmups** — stretching (just a tap) and a bar-hang timer.
- **Abs Stuff** — a full menu of core moves, collapsible to stay out of the way, with a "skip all" button for days you bail on abs
- **Other Cardio** — swimming (tracked by stroke and laps plus time), boxing, and cycling
- **Chillax Time** — recovery: sauna, steam room, and cold plunge, each with a simple minute counter

Items with a weekly goal (like swimming 3× a week) show a little progress bar toward the target

### Fine Arts
* A separate tab for the non-gym practice I'm working on: piano, saxophone, and reading/watching in Chinese, Japanese, and Korean
* Each logs practice **minutes**, a **1–5 star rating** for how it went, and a note on what was actually worked on

### Progress
* A dedicated tab that turns history into charts, in three modes — **Workout**, **Other Exercises**, and **Fine Arts**
* Pick any lift or activity and see  top weight (or reps, laps, minutes, or rating) trend over time, plus total volume
* This is the payoff tab where I can see proof that the daily tapping is adding up

---

## How to use it daily

1. Open the app (from the home-screen icon once it's installed)
2. Tap your profile and enter your PIN
3. Tap through the workout cards, bump your numbers, tag your progress, and hit **Log**.
4. Fill in the recovery and habit sections as you go.
5. Check the **Progress** tab whenever you want to see how you're trending.

---

## Where the data lives

Supabase project **Swole Hub** (us-east-1). Browse or export it from the Supabase Table Editor. Saves are keyed to user + exercise + date (a unique constraint), so editing a past day updates that row instead of adding duplicates.

The original Google Sheet ("Training HQ Database") is the pre-October 2026 history and is no longer written to.

---

## The pieces, at a glance

| Path | What it does |
|------|--------------|
| `public/index.html` | The whole interface: logging, steppers, tabs, charts, styles |
| `api/[fn].js` | RPC endpoint; checks the session and calls into `lib/core.js` |
| `lib/core.js` | Backend logic: builds each day and week, logs sets, PRs, progress |
| `lib/config.js` | Profiles, welcome messages, default program, key lifts |
| `lib/importer.js`, `api/import.js` | One-time import from the Google Sheet (needs `ADMIN_KEY`) |
| `apps-script/` | The original Apps Script files and the migration script |
| `scripts/test-local.mjs`, `scripts/test-wire.mjs` | Tests: `npm i && node scripts/test-local.mjs && node scripts/test-wire.mjs` |
| `index.html` (repo root) | Redirect for the old GitHub Pages home-screen link |

Environment variables on Vercel: `POSTGRES_URL` (Supabase transaction pooler) and `ADMIN_KEY` (signs sessions, guards the import).
