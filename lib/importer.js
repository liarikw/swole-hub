/* One-shot import from the Google Sheet (payload sent by apps-script/migrate.gs).
   Replaces all data. Idempotent: re-running with fresh data gives the same result. */
import { USERS, RENAMES } from './config.js';
import { normIso } from './dates.js';
import { hashPin } from './auth.js';
import { SCHEMA } from './schema.js';

const str = v => (v === null || v === undefined) ? '' : String(v);
const numOrNull = v => { if (v === '' || v == null) return null; const n = Number(v); return isFinite(n) ? n : null; };
function objects(t) {
  if (!t || !Array.isArray(t.headers) || !Array.isArray(t.rows)) return [];
  return t.rows.map(r => { const o = {}; t.headers.forEach((h, i) => o[h] = r[i]); return o; });
}

export async function applySchema(db) {
  for (const stmt of SCHEMA.split(/;\s*\n/).map(s => s.replace(/--.*$/gm, '').trim()).filter(Boolean)) await db.query(stmt);
}

export async function runImport(db, payload) {
  const renames = Object.assign({}, RENAMES, payload.renames || {});
  const userOf = u => { u = str(u).trim() || USERS[0]; return renames[u] || u; };

  const users = Object.entries(payload.pins || {}).map(([name, pin]) => ({ name, pin_hash: hashPin(name, pin) }));

  const program = objects(payload.program).filter(r => str(r.Exercise)).map(r => ({
    user_name: userOf(r.User), day: str(r.Day), ord: numOrNull(r.Order) == null ? null : Math.round(Number(r.Order)),
    exercise: str(r.Exercise), sets: numOrNull(r.Sets), reps: numOrNull(r.Reps), target_weight: numOrNull(r.TargetWeight),
    load_type: str(r.LoadType), category: str(r.Category), preset: str(r.Preset) }));

  const logMap = new Map();   // dedupe on user+exercise+date, last row wins (matches the app's reads)
  let logSkipped = 0;
  objects(payload.log).forEach(r => {
    const date = normIso(r.Date);
    if (!date || !str(r.Exercise)) { logSkipped++; return; }
    const ts = r.Timestamp ? new Date(Date.parse(str(r.Timestamp))) : null;
    const row = { ts: ts && !isNaN(ts) ? ts.toISOString() : new Date().toISOString(), date, day: str(r.Day),
      exercise: str(r.Exercise), sets: numOrNull(r.Sets), reps: numOrNull(r.Reps), weight: numOrNull(r.Weight),
      load_type: str(r.LoadType), eff_weight: numOrNull(r.EffWeight), volume: numOrNull(r.Volume), progress: str(r.Progress),
      category: str(r.Category), notes: str(r.Notes), time: numOrNull(r.Time), level: numOrNull(r.Level), pace: str(r.Pace),
      calories: numOrNull(r.Calories), user_name: userOf(r.User) };
    logMap.set(row.user_name + '\u0000' + row.exercise + '\u0000' + row.date, row);
  });
  const log = [...logMap.values()];

  const skipMap = new Map();
  objects(payload.skips).forEach(r => {
    const date = normIso(r.Date); if (!date || !str(r.Exercise)) return;
    const row = { user_name: userOf(r.User), date, exercise: str(r.Exercise), day: str(r.Day) };
    skipMap.set(row.user_name + '\u0000' + row.exercise + '\u0000' + row.date, row);
  });
  const skips = [...skipMap.values()];

  await applySchema(db);
  await db.tx(async t => {
    await t.query('truncate users, program, log, skips restart identity');
    await t.query(`insert into users (name, pin_hash) select name, pin_hash from json_to_recordset($1::json) as x(name text, pin_hash text)`,
      [JSON.stringify(users)]);
    await t.query(`insert into program (user_name, day, ord, exercise, sets, reps, target_weight, load_type, category, preset)
      select user_name, day, ord, exercise, sets, reps, target_weight, load_type, category, preset
      from json_to_recordset($1::json) as x(user_name text, day text, ord int, exercise text, sets float8, reps float8,
        target_weight float8, load_type text, category text, preset text)`, [JSON.stringify(program)]);
    await t.query(`insert into log (ts, date, day, exercise, sets, reps, weight, load_type, eff_weight, volume, progress,
        category, notes, time, level, pace, calories, user_name)
      select ts, date, day, exercise, sets, reps, weight, load_type, eff_weight, volume, progress, category, notes, time,
        level, pace, calories, user_name
      from json_to_recordset($1::json) as x(ts timestamptz, date date, day text, exercise text, sets float8, reps float8,
        weight float8, load_type text, eff_weight float8, volume float8, progress text, category text, notes text,
        time float8, level float8, pace text, calories float8, user_name text)`, [JSON.stringify(log)]);
    await t.query(`insert into skips (user_name, date, exercise, day)
      select user_name, date, exercise, day from json_to_recordset($1::json) as x(user_name text, date date, exercise text, day text)`,
      [JSON.stringify(skips)]);
  });
  return { ok: true, users: users.length, program: program.length, log: log.length,
           logDuplicatesMerged: objects(payload.log).length - logSkipped - log.length, logSkipped, skips: skips.length };
}
