/* Swole Hub backend logic, ported 1:1 from Code.gs. Sheet reads become per-user SQL reads,
   memoized per request so a call like getBoot hits each table once. */
import { USERS, WELCOME, ARTS_USERS, EXTRA_TARGETS, FINE_ARTS, KEY_LIFTS, PYRAMID_EXERCISES,
         START_DATE, DAYS, MON_FIRST, PROGRAM } from './config.js';
import { todayISO, dowOf, addDays, fmtMD, fmtMMMd, fmtLabel, normIso } from './dates.js';
import { hashPin, makeToken } from './auth.js';

const E = v => (v === null || v === undefined) ? '' : v;           // DB null -> sheet blank
const N = v => (v === '' || v === null || v === undefined) ? null : v; // sheet blank -> DB null
function num_(v) { const n = Number(v); return isNaN(n) ? 0 : n; }
function pick_(src, key) { if (!src) return ''; const v = src[key]; return (v === '' || v == null) ? '' : v; }
const canArts_ = user => ARTS_USERS.indexOf(user) >= 0;

/* Pyramid detail rides in Notes as "PYR:135x12,155x10,...\n<user note>" */
function parsePyr_(notes) {
  const s = String(notes || ''); if (s.indexOf('PYR:') !== 0) return null;
  const nl = s.indexOf('\n');
  const body = nl < 0 ? s.slice(4) : s.slice(4, nl);
  const note = nl < 0 ? '' : s.slice(nl + 1);
  const sets = body.split(',').map(t => { const m = t.split('x'); return { w: Number(m[0]) || 0, r: Number(m[1]) || 0 }; })
                   .filter(x => x.w || x.r);
  return { sets, note };
}

const LOG_SELECT = `select id, ts, to_char(date,'YYYY-MM-DD') as date, day, exercise, sets, reps, weight, load_type,
  eff_weight, volume, progress, category, notes, time, level, pace, calories, user_name from log`;
const logRow = r => ({ Timestamp: r.ts, Date: r.date, Day: E(r.day), Exercise: r.exercise, Sets: E(r.sets), Reps: E(r.reps),
  Weight: E(r.weight), LoadType: E(r.load_type), EffWeight: E(r.eff_weight), Volume: E(r.volume), Progress: E(r.progress),
  Category: E(r.category), Notes: E(r.notes), Time: E(r.time), Level: E(r.level), Pace: E(r.pace), Calories: E(r.calories),
  User: r.user_name });
const progRow = r => ({ Day: r.day, Order: E(r.ord), Exercise: r.exercise, Sets: E(r.sets), Reps: E(r.reps),
  TargetWeight: E(r.target_weight), LoadType: E(r.load_type), Category: E(r.category), Preset: E(r.preset), User: r.user_name });

export function createApi(db) {
  const cache = {};
  async function logFor(user) {
    const k = 'log:' + user;
    if (!cache[k]) cache[k] = (await db.query(LOG_SELECT + ' where user_name=$1 order by id', [user])).map(logRow);
    return cache[k];
  }
  async function progFor(user) {
    const k = 'prog:' + user;
    if (!cache[k]) cache[k] = (await db.query('select * from program where user_name=$1 order by id', [user])).map(progRow);
    return cache[k];
  }
  async function skipsAll_(user) {   // { dateISO: {exercise:true} }
    const k = 'skips:' + user;
    if (!cache[k]) {
      const out = {};
      (await db.query(`select to_char(date,'YYYY-MM-DD') as date, exercise from skips where user_name=$1`, [user]))
        .forEach(r => { (out[r.date] = out[r.date] || {})[r.exercise] = true; });
      cache[k] = out;
    }
    return cache[k];
  }
  const dirty = user => { delete cache['log:' + user]; delete cache['skips:' + user]; delete cache['prog:' + user]; };

  /* Most recent session per exercise strictly BEFORE beforeISO (the comparison baseline),
     plus the heaviest weight ever logged before that date (for PR detection). */
  async function lastByExercise_(user, beforeISO) {
    const out = {}, maxW = {};
    (await logFor(user)).forEach(r => {
      if (!r.Date || (beforeISO && r.Date >= beforeISO)) return;
      if (!out[r.Exercise] || r.Date >= out[r.Exercise].Date) out[r.Exercise] = r;
      const w = Number(r.Weight); if (r.Weight !== '' && !isNaN(w) && (maxW[r.Exercise] == null || w > maxW[r.Exercise])) maxW[r.Exercise] = w;
    });
    return { last: out, maxW };
  }
  async function logOnDate_(user, dateISO) {
    const out = {};
    (await logFor(user)).forEach(r => { if (r.Date && r.Date === dateISO) out[r.Exercise] = r; });
    return out;
  }
  async function ensureUserProgram_(user) {
    if ((await progFor(user)).length) return;
    const rows = PROGRAM.map(p => ({ user_name: user, day: p[0], ord: p[1], exercise: p[2], sets: p[3], reps: p[4],
      target_weight: p[5], load_type: p[6], category: p[7], preset: p[8] }));
    await db.query(`insert into program (user_name, day, ord, exercise, sets, reps, target_weight, load_type, category, preset)
      select user_name, day, ord, exercise, sets, reps, target_weight, load_type, category, preset
      from json_to_recordset($1::text::json) as x(user_name text, day text, ord int, exercise text, sets float8, reps float8,
        target_weight float8, load_type text, category text, preset text)`, [JSON.stringify(rows)]);
    dirty(user);
  }

  async function buildDay_(user, dayName, dateISO) {
    const today = todayISO();
    const todayName = DAYS[dowOf(today)];
    const prog = (await progFor(user)).filter(r => r.Day === dayName).sort((a, b) => a.Order - b.Order);
    const { last, maxW } = await lastByExercise_(user, dateISO || today);
    const onDate = dateISO ? await logOnDate_(user, dateISO) : {};
    const skips = dateISO ? ((await skipsAll_(user))[dateISO] || {}) : {};
    const items = prog.map(p => {
      const l = last[p.Exercise] || null, e = onDate[p.Exercise] || null, src = e || l;
      const isPyr = PYRAMID_EXERCISES.indexOf(p.Exercise) >= 0;
      const pyrE = isPyr && e ? parsePyr_(e.Notes) : null;
      const pyrL = isPyr && l ? parsePyr_(l.Notes) : null;
      return {
        exercise: p.Exercise, category: p.Category, loadType: p.LoadType || 'total', preset: p.Preset || '',
        skipped: !!skips[p.Exercise],
        pyramid: isPyr,
        pyramidStart: (pyrE ? pyrE.sets : (pyrL ? pyrL.sets : null)),
        pyramidLast: (pyrL ? pyrL.sets : null),
        target: { sets: p.Sets, reps: p.Reps, weight: p.TargetWeight },
        last: l ? { sets: l.Sets, reps: l.Reps, weight: l.Weight, date: fmtMD(l.Date), progress: l.Progress } : null,
        existing: e ? { sets: e.Sets, reps: e.Reps, weight: e.Weight, progress: e.Progress, notes: (pyrE ? pyrE.note : e.Notes) } : null,
        start: src ? { sets: src.Sets || p.Sets, reps: src.Reps || p.Reps,
                       weight: (src.Weight !== '' && src.Weight != null ? src.Weight : p.TargetWeight) }
                   : { sets: p.Sets, reps: p.Reps, weight: p.TargetWeight },
        cardioStart: { time: pick_(src, 'Time'), level: pick_(src, 'Level'), pace: (src && src.Pace) || '', calories: pick_(src, 'Calories') },
        cardioLast: l ? { time: l.Time, level: l.Level, pace: l.Pace, calories: l.Calories, date: fmtMD(l.Date) } : null,
        prevMax: maxW[p.Exercise] != null ? maxW[p.Exercise] : null
      };
    });
    const extras = {};
    Object.keys(onDate).forEach(ex => { const c = onDate[ex].Category;
      if (c === 'Extra' || c === 'Habit') extras[ex] = { time: onDate[ex].Time, reps: onDate[ex].Reps, notes: onDate[ex].Notes }; });
    const absSkipped = !!skips['__ABS__'];
    const sess = onDate['Workout Session'];
    const session = sess ? { start: String(sess.Notes || '').split('|')[0] || '', end: String(sess.Notes || '').split('|')[1] || '', minutes: sess.Time } : null;
    return {
      day: dayName, isToday: dayName === todayName, dateISO: dateISO || null,
      dateLabel: fmtLabel(dateISO || today),
      extras, absSkipped, session, items
    };
  }

  async function getDashboard_(user) {
    const log = await logFor(user);
    const today = todayISO();
    const weekStart = addDays(today, -((dowOf(today) + 6) % 7));
    const EX = c => c === 'Habit' || c === 'Session' || c === 'FineArts' || c === 'Extra';
    let weekEntries = 0, weekMinutes = 0; const maxWt = {}, lastDate = {};
    const extraCounts = {}; Object.keys(EXTRA_TARGETS).forEach(n => extraCounts[n] = 0);
    const doneByDate = {};
    log.forEach(r => {
      const iso = r.Date || '';
      if (iso && iso >= weekStart) {
        if (!EX(r.Category)) weekEntries++;
        if (r.Category === 'Session') weekMinutes += Number(r.Time) || 0;
        if ((r.Category === 'Extra' || r.Category === 'Habit') && extraCounts[r.Exercise] !== undefined) extraCounts[r.Exercise]++;
      }
      if (!EX(r.Category) && iso) (doneByDate[iso] = doneByDate[iso] || {})[r.Exercise] = true;
      const w = Number(r.Weight);
      if (!isNaN(w)) { if (maxWt[r.Exercise] === undefined || w > maxWt[r.Exercise]) maxWt[r.Exercise] = w; }
      if (iso && (!lastDate[r.Exercise] || iso > lastDate[r.Exercise])) lastDate[r.Exercise] = iso;
    });
    const progEx = {};
    (await progFor(user)).forEach(r => { (progEx[r.Day] = progEx[r.Day] || []).push(r.Exercise); });
    const skipByDate = await skipsAll_(user);
    let completeDays = 0;
    for (let i = 0; i < 7; i++) {
      const iso = addDays(weekStart, i);
      if (iso > today) continue;
      const list = progEx[MON_FIRST[i]] || []; if (!list.length) continue;
      const dn = doneByDate[iso] || {}, sp = skipByDate[iso] || {};
      if (list.every(ex => dn[ex] || sp[ex])) completeDays++;
    }
    const sinceDays = Math.floor((Date.now() - Date.parse(START_DATE)) / 86400000);
    return {
      sinceDays, weeksIn: Math.round(sinceDays / 7),
      benchPR: Math.max(user === USERS[0] ? 195 : 0, maxWt['Barbell Bench'] || 0),
      weekEntries, completeDays, weekMinutes: Math.round(weekMinutes),
      extraCounts,
      keyLifts: KEY_LIFTS.map(k => ({ name: k, max: (maxWt[k] !== undefined ? maxWt[k] : null), last: (lastDate[k] ? fmtMD(lastDate[k]) : null) }))
    };
  }

  async function deleteLogRow_(user, exercise, dateISO) {
    await db.query('delete from log where user_name=$1 and exercise=$2 and date=$3', [user, exercise, normIso(dateISO)]);
    dirty(user);
  }

  const api = {
    getUsers() { return USERS; },
    getArtsList() { return FINE_ARTS; },

    async checkPin(user, pin) {
      const rows = await db.query('select pin_hash from users where name=$1', [user]);
      if (!rows.length || rows[0].pin_hash !== hashPin(user, pin)) return false;
      return makeToken(user);   // truthy = success; client stores it
    },

    async getBoot(user) {
      await ensureUserProgram_(user);
      const [today, dashboard, week] = [await buildDay_(user, DAYS[dowOf(todayISO())], todayISO()), await getDashboard_(user), await api.getWeek(user, 0, 'workout')];
      return { state: { user, today, dashboard, welcome: WELCOME[user] || '', canArts: canArts_(user) }, week };
    },
    async getState(user) {
      const today = todayISO();
      return { user, today: await buildDay_(user, DAYS[dowOf(today)], today), dashboard: await getDashboard_(user),
               welcome: WELCOME[user] || '', canArts: canArts_(user) };
    },
    getDashboardPublic(user) { return getDashboard_(user); },
    getDay(user, dayName, dateISO) { return buildDay_(user, dayName, dateISO); },

    async getWeek(user, offset, mode) {
      offset = Number(offset) || 0;
      const today = todayISO();
      const mon = addDays(today, -((dowOf(today) + 6) % 7) + offset * 7);
      const days = [];
      for (let i = 0; i < 7; i++) {
        const iso = addDays(mon, i);
        days.push({ name: MON_FIRST[i], iso, label: fmtMD(iso), isToday: iso === today, isFuture: iso > today });
      }
      const log = await logFor(user);
      if (mode === 'arts') {
        const total = FINE_ARTS.length, doneByDate = {};
        log.forEach(r => { if (r.Category === 'FineArts' && r.Date) (doneByDate[r.Date] = doneByDate[r.Date] || {})[r.Exercise] = true; });
        days.forEach(d => { const dn = doneByDate[d.iso] || {}; const res = FINE_ARTS.filter(a => dn[a]).length;
          d.total = total; d.done = res; d.pct = total ? Math.round(100 * res / total) : 0; });
      } else {
        const progEx = {};
        (await progFor(user)).forEach(r => { (progEx[r.Day] = progEx[r.Day] || []).push(r.Exercise); });
        const doneByDate = {};
        log.forEach(r => {
          if (!r.Date || r.Category === 'Habit' || r.Category === 'Session' || r.Category === 'FineArts' || r.Category === 'Extra') return;
          (doneByDate[r.Date] = doneByDate[r.Date] || {})[r.Exercise] = true;
        });
        const skipByDate = await skipsAll_(user);
        days.forEach(d => {
          const list = progEx[d.name] || [], dn = doneByDate[d.iso] || {}, sp = skipByDate[d.iso] || {};
          const resolved = list.filter(ex => dn[ex] || sp[ex]).length;
          d.total = list.length; d.done = resolved;
          d.pct = list.length ? Math.round(100 * resolved / list.length) : 0;
        });
      }
      return { offset, weekLabel: fmtMMMd(mon) + ' – ' + fmtMMMd(addDays(mon, 6)), days };
    },

    /* ---------- Fine Arts ---------- */
    async getArtsDay(user, dateISO) {
      if (!canArts_(user)) return { dateISO, dateLabel: fmtLabel(dateISO), activities: [] };
      const onDate = await logOnDate_(user, dateISO);
      const activities = FINE_ARTS.map(a => {
        const e = (onDate[a] && onDate[a].Category === 'FineArts') ? onDate[a] : null;
        return { name: a, done: !!e, minutes: e ? e.Time : '', rating: e ? e.Level : '', note: e ? e.Notes : '' };
      });
      return { dateISO, dateLabel: fmtLabel(dateISO), activities };
    },
    async setArts(user, name, dayName, dateISO, minutes, rating, note, on) {
      if (!canArts_(user)) return { ok: false, on: false };
      if (on) await api.logSet({ user, exercise: name, category: 'FineArts', time: minutes, level: rating, notes: note,
                                 sets: 0, reps: 0, weight: '', loadType: '', progress: '', day: dayName, logDate: dateISO });
      else await deleteLogRow_(user, name, dateISO);
      return { ok: true, on };
    },
    async getArtsProgress(user, activity) {
      if (!canArts_(user)) return { activity, points: [], totalMin: 0, sessions: 0, avgRating: 0 };
      const rows = (await logFor(user)).filter(r => r.Exercise === activity && r.Category === 'FineArts' && r.Date)
        .map(r => ({ d: r.Date, min: Number(r.Time) || 0, rating: Number(r.Level) || 0 }))
        .sort((a, b) => a.d < b.d ? -1 : a.d > b.d ? 1 : 0);
      return { activity,
        points: rows.map(r => ({ date: fmtMD(r.d), minutes: r.min, rating: r.rating })),
        totalMin: rows.reduce((s, r) => s + r.min, 0), sessions: rows.length,
        avgRating: rows.length ? Math.round(10 * rows.reduce((s, r) => s + r.rating, 0) / rows.length) / 10 : 0 };
    },

    /* log / unlog a daily "extra" (warmup, ab, cardio, chillax) */
    async logExtra(user, name, dayName, dateISO, time, reps, notes, on) {
      if (on) await api.logSet({ user, exercise: name, category: 'Extra', time, reps, notes,
                                 sets: 0, weight: '', loadType: '', progress: '', level: '', day: dayName, logDate: dateISO });
      else await deleteLogRow_(user, name, dateISO);
      return { ok: true, on };
    },

    async getDayProgress(user, dayName) {
      const abbr = String(dayName).slice(0, 3);
      const log = (await logFor(user)).filter(r => r.Day === abbr && r.Date && r.Category !== 'Habit' && r.Category !== 'Session');
      const byV = {}, byC = {};
      log.forEach(r => { byV[r.Date] = (byV[r.Date] || 0) + (Number(r.Volume) || 0); byC[r.Date] = (byC[r.Date] || 0) + (Number(r.Calories) || 0); });
      const sessions = Object.keys(byV).sort().map(iso => ({ date: fmtMD(iso), volume: Math.round(byV[iso]), calories: Math.round(byC[iso]) }));
      const prog = (await progFor(user)).filter(r => r.Day === dayName).sort((a, b) => a.Order - b.Order).map(r => r.Exercise);
      const seen = {}; prog.forEach(e => seen[e] = true);
      log.forEach(r => { if (r.Category !== 'Habit' && r.Category !== 'Session' && r.Category !== 'FineArts' && r.Category !== 'Extra' && !seen[r.Exercise]) { seen[r.Exercise] = true; prog.push(r.Exercise); } });
      return { day: dayName, sessions, exercises: prog };
    },

    async getHistory(user, exercise) {
      const rows = (await logFor(user)).filter(r => r.Exercise === exercise && r.Date)
        .map(r => ({ d: r.Date, weight: Number(r.Weight) || 0, eff: Number(r.EffWeight) || 0,
                     volume: Number(r.Volume) || 0, reps: Number(r.Reps) || 0,
                     time: Number(r.Time) || 0, level: Number(r.Level) || 0, calories: Number(r.Calories) || 0, pace: r.Pace || '' }))
        .sort((a, b) => a.d < b.d ? -1 : a.d > b.d ? 1 : 0);
      const cardio = rows.some(r => r.time > 0 || r.level > 0 || r.calories > 0);
      return { exercise, cardio,
        points: rows.map(r => ({ date: fmtMD(r.d), weight: r.weight, volume: r.volume, reps: r.reps,
                                 time: r.time, level: r.level, calories: r.calories, pace: r.pace })),
        maxWeight: rows.reduce((m, r) => Math.max(m, r.weight), 0),
        maxTime: rows.reduce((m, r) => Math.max(m, r.time), 0),
        maxCal: rows.reduce((m, r) => Math.max(m, r.calories), 0) };
    },

    /* entry = {user, exercise, sets, reps, weight, loadType, progress, category, notes, day, logDate,
                time, level, pace, calories, pyramid?} — upsert by user+exercise+date */
    async logSet(entry) {
      entry = entry || {};
      const user = entry.user || USERS[0];
      let sets = num_(entry.sets), reps = num_(entry.reps);
      let weight = (entry.weight === '' || entry.weight == null) ? '' : num_(entry.weight);
      const load = entry.loadType || 'total';
      let notesOut = entry.notes || '';
      let volOverride = null;
      if (entry.pyramid && entry.pyramid.length) {
        const ps = entry.pyramid.map(s => ({ w: num_(s.w), r: num_(s.r) })).filter(s => s.w > 0 || s.r > 0);
        if (ps.length) {
          sets = ps.length;
          let top = ps[0]; ps.forEach(s => { if (s.w > top.w) top = s; });
          weight = top.w; reps = top.r;
          const lf = (load === 'e/s') ? 2 : 1;
          volOverride = ps.reduce((a, s) => a + s.w * lf * s.r, 0);
          notesOut = 'PYR:' + ps.map(s => s.w + 'x' + s.r).join(',') + (entry.notes ? '\n' + entry.notes : '');
        }
      }
      const eff = (weight === '') ? '' : (load === 'e/s' ? weight * 2 : weight);
      const vol = (volOverride != null) ? volOverride : ((sets && reps && eff !== '') ? sets * reps * eff : '');
      const dateISO = (entry.logDate && normIso(entry.logDate)) || todayISO();
      const dayAbbr = entry.day ? String(entry.day).slice(0, 3) : MON_FIRST[(dowOf(dateISO) + 6) % 7].slice(0, 3);

      let priorMax = -Infinity;
      (await logFor(user)).forEach(r => {
        if (r.Exercise === entry.exercise && r.Date && r.Date !== dateISO) { const w = Number(r.Weight); if (!isNaN(w)) priorMax = Math.max(priorMax, w); }
      });
      let progress = entry.progress || '';
      const isPR = (weight !== '' && weight > priorMax && priorMax > -Infinity);
      if (isPR && !progress) progress = 'PR';

      const timeV = (entry.time === '' || entry.time == null) ? '' : num_(entry.time);
      const levelV = (entry.level === '' || entry.level == null) ? '' : num_(entry.level);
      const calV = (entry.calories === '' || entry.calories == null) ? '' : num_(entry.calories);
      const rows = await db.query(`insert into log (ts, date, day, exercise, sets, reps, weight, load_type, eff_weight, volume,
          progress, category, notes, time, level, pace, calories, user_name)
        values (now(), $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
        on conflict (user_name, exercise, date) do update set ts = excluded.ts, day = excluded.day, sets = excluded.sets,
          reps = excluded.reps, weight = excluded.weight, load_type = excluded.load_type, eff_weight = excluded.eff_weight,
          volume = excluded.volume, progress = excluded.progress, category = excluded.category, notes = excluded.notes,
          time = excluded.time, level = excluded.level, pace = excluded.pace, calories = excluded.calories
        returning (xmax = 0) as inserted`,
        [dateISO, dayAbbr, entry.exercise, sets, reps, N(weight), load, N(eff), N(vol), progress, entry.category || '',
         notesOut, N(timeV), N(levelV), entry.pace || '', N(calV), user]);
      dirty(user);
      const updated = !(rows[0] && rows[0].inserted);
      return { ok: true, isPR, updated,
               message: isPR ? ('New PR on ' + entry.exercise + '!') : (entry.exercise + (updated ? ' updated' : ' logged')) };
    },

    async setSkip(user, exercise, dayName, dateISO, on) {
      const iso = normIso(dateISO);
      if (on) await db.query('insert into skips (user_name, date, exercise, day) values ($1,$2,$3,$4) on conflict do nothing',
                             [user, iso, exercise, String(dayName).slice(0, 3)]);
      else await db.query('delete from skips where user_name=$1 and date=$2 and exercise=$3', [user, iso, exercise]);
      dirty(user);
      return { ok: true, skipped: on };
    },

    async setHabit(user, name, dayName, dateISO, on, minutes) {
      if (on) await api.logSet({ user, exercise: name, sets: 0, reps: 0, weight: '', loadType: '', progress: '',
                                 category: 'Habit', notes: '', day: dayName, logDate: dateISO,
                                 time: (minutes == null || minutes === '') ? '' : num_(minutes) });
      else await deleteLogRow_(user, name, dateISO);
      return { ok: true, on };
    }
  };
  return api;
}

/* Callable from the browser. Everything except PUBLIC requires a session token. */
export const PUBLIC_FNS = new Set(['getUsers', 'getArtsList', 'checkPin']);
export const CALLABLE_FNS = new Set(['getUsers', 'getArtsList', 'checkPin', 'getBoot', 'getState', 'getDashboardPublic',
  'getDay', 'getWeek', 'getArtsDay', 'setArts', 'getArtsProgress', 'logExtra', 'getDayProgress', 'getHistory',
  'logSet', 'setSkip', 'setHabit']);
