/* Local test: in-memory Postgres (PGlite) + the real API + the real index.html in jsdom.
   Run: node scripts/test-local.mjs */
import { PGlite } from '@electric-sql/pglite';
import { JSDOM } from 'jsdom';
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';

process.env.ADMIN_KEY = 'test-key';
process.env.SWOLE_TODAY = '2026-07-15';   // a Wednesday
const { runImport } = await import('../lib/importer.js');
const { createApi, PUBLIC_FNS, CALLABLE_FNS } = await import('../lib/core.js');
const { verifyToken } = await import('../lib/auth.js');
const { PROGRAM } = await import('../lib/config.js');

const pg = new PGlite();
const db = {
  query: async (t, p = []) => (await pg.query(t, p)).rows,
  tx: fn => pg.transaction(tx => fn({ query: async (t, p = []) => (await tx.query(t, p)).rows }))
};

/* ---- payload shaped like apps-script/migrate.gs output ---- */
const LOGH = ['Timestamp','Date','Day','Exercise','Sets','Reps','Weight','LoadType','EffWeight','Volume','Progress','Category','Notes','Time','Level','Pace','Calories','User'];
const L = (date, day, ex, s, r, w, cat, extra = {}) => LOGH.map(h => ({ Timestamp: date + 'T22:00:00.000Z', Date: date, Day: day, Exercise: ex,
  Sets: s, Reps: r, Weight: w, LoadType: 'total', EffWeight: w, Volume: (s && r && w !== '') ? s * r * w : '', Progress: '', Category: cat,
  Notes: '', Time: '', Level: '', Pace: '', Calories: '', User: 'Arik', ...extra })[h]);
const payload = {
  pins: { 'Arik': '5555', 'Leon 肛卜咛': '6969' },
  renames: { 'User 2': 'Leon 肛卜咛' },
  program: { headers: ['Day','Order','Exercise','Sets','Reps','TargetWeight','LoadType','Category','Preset','User'],
             rows: PROGRAM.map(p => p.concat(['Arik'])).concat(PROGRAM.map(p => p.concat(['User 2']))) },
  log: { headers: LOGH, rows: [
    L('2026-07-06', 'Mon', 'Barbell Bench', 5, 7, 195, 'Push', { Progress: 'PR' }),
    L('2026-07-08', 'Wed', 'Back Squat', 4, 14, 70, 'Legs'),
    L('2026-07-08', 'Wed', 'Leg Press', 3, 15, 100, 'Legs'),
    L('7/13/2026', 'Mon', 'Barbell Bench', 4, 6, 195, 'Push'),
    L('2026-07-13', 'Mon', 'Barbell Bench', 4, 6, 200, 'Push'),            // duplicate key -> last wins
    L('2026-07-14', 'Tue', 'Stairmaster', 0, 0, '', 'Cardio', { Time: 50, Level: 10, Calories: 710, Notes: 'steady' }),
    L('2026-07-14', 'Tue', 'Sauna', 0, 0, '', 'Habit', { Time: 5 }),
    L('2026-07-15', 'Wed', 'Workout Session', 0, 0, '', 'Session', { Time: 75, Notes: '18:00|19:15' }),
    L('2026-07-15', 'Wed', 'Piano', 0, 0, '', 'FineArts', { Time: 30, Level: 4, Notes: 'scales' }),
    L('', 'Wed', 'Broken', 0, 0, '', 'Push')                                  // no date -> skipped
  ] },
  skips: { headers: ['Date','Exercise','Day','User'], rows: [
    ['2026-07-14', 'Rowing Machine', 'Tue', 'Arik'], ['2026-07-14', 'Inside Run', 'Tue', 'Arik'], ['2026-07-14', 'Outside Run', 'Tue', 'Arik'],
    ['2026-07-15', '__ABS__', 'Wed', 'Arik'] ] }
};

const imp = await runImport(db, payload);
console.log('import', imp);
assert.equal(imp.log, 8); assert.equal(imp.logSkipped, 1); assert.equal(imp.logDuplicatesMerged, 1);
assert.equal(imp.program, PROGRAM.length * 2);

const api = createApi(db);
assert.equal(await api.checkPin('Arik', '0000'), false);
const tok = await api.checkPin('Arik', '5555');
assert.equal(verifyToken(tok), 'Arik');
assert.equal(verifyToken(tok.slice(0, -2) + 'xx'), null);

const boot = await api.getBoot('Arik');
assert.equal(boot.state.today.day, 'Wednesday');
assert.equal(boot.state.today.dateLabel, 'Wed, Jul 15');
assert.equal(boot.state.today.absSkipped, true);
assert.deepEqual(boot.state.today.session, { start: '18:00', end: '19:15', minutes: 75 });
assert.equal(boot.state.dashboard.benchPR, 200);
assert.equal(boot.state.dashboard.weekMinutes, 75);
assert.equal(boot.week.weekLabel, 'Jul 13 – Jul 19');
const tue = boot.week.days.find(d => d.name === 'Tuesday');
assert.equal(tue.pct, 100);                    // 3 skipped + stairmaster logged = 4 of 4
const squat = boot.state.today.items.find(i => i.exercise === 'Back Squat');
assert.deepEqual(squat.last, { sets: 4, reps: 14, weight: 70, date: '7/8', progress: '' });
const bench = (await api.getDay('Arik', 'Monday', '2026-07-13')).items[0];
// baseline = previous session, never the same day's own entry
assert.equal(bench.last.weight, 195, 'last = session before the viewed date');
assert.equal(bench.prevMax, 195);
assert.equal(bench.existing.weight, 200);
assert.equal(bench.pyramid, true);

// write path: insert, PR detection, update-in-place
let r = await api.logSet({ user: 'Arik', exercise: 'Back Squat', sets: 4, reps: 14, weight: 80, loadType: 'total', category: 'Legs - Push', day: 'Wednesday', logDate: '2026-07-15' });
assert.deepEqual([r.isPR, r.updated], [true, false]);
r = await api.logSet({ user: 'Arik', exercise: 'Back Squat', sets: 4, reps: 15, weight: 80, loadType: 'total', category: 'Legs - Push', day: 'Wednesday', logDate: '2026-07-15' });
assert.equal(r.updated, true);
r = await api.logSet({ user: 'Arik', exercise: 'Barbell Bench', category: 'Chest/Arms - Push', day: 'Wednesday', logDate: '2026-07-15', loadType: 'total',
                       pyramid: [{ w: 135, r: 12 }, { w: 205, r: 5 }, { w: 185, r: 8 }], notes: 'felt good' });
assert.equal(r.isPR, true);
const b2 = (await createApi(db).getDay('Arik', 'Wednesday', '2026-07-15'));
assert.equal((await createApi(db).getDashboardPublic('Arik')).benchPR, 205);
const hist = await createApi(db).getHistory('Arik', 'Barbell Bench');
assert.deepEqual(hist.points.map(p => p.weight), [195, 200, 205]);
assert.equal(b2.items.find(i => i.exercise === 'Back Squat').existing.reps, 15);

// skips + extras + arts
await api.setSkip('Arik', 'Leg Curls', 'Wednesday', '2026-07-15', true);
await api.setSkip('Arik', 'Leg Curls', 'Wednesday', '2026-07-15', true);  // idempotent
assert.equal((await createApi(db).getDay('Arik', 'Wednesday', '2026-07-15')).items.find(i => i.exercise === 'Leg Curls').skipped, true);
await api.setSkip('Arik', 'Leg Curls', 'Wednesday', '2026-07-15', false);
await api.logExtra('Arik', 'Swimming', 'Wednesday', '2026-07-15', 30, 12, 'Free:10|Back:2|Breast:0|Fly:0', true);
assert.equal((await createApi(db).getDashboardPublic('Arik')).extraCounts.Swimming, 1);
await api.logExtra('Arik', 'Swimming', 'Wednesday', '2026-07-15', '', '', '', false);
assert.equal((await createApi(db).getDashboardPublic('Arik')).extraCounts.Swimming, 0);
const arts = await createApi(db).getArtsDay('Arik', '2026-07-15');
assert.equal(arts.activities[0].done, true);
assert.deepEqual((await api.getArtsDay('Leon 肛卜咛', '2026-07-15')).activities, []);
const artsWeek = await createApi(db).getWeek('Arik', 0, 'arts');
assert.equal(artsWeek.days.find(d => d.iso === '2026-07-15').done, 1);

// renamed user got the program; brand-new user gets default program on boot
assert.equal((await createApi(db).getBoot('Leon 肛卜咛')).state.today.items.length, 9);
assert.equal((await createApi(db).getBoot('Desitrain')).state.today.items.length, 9);
const dp = await createApi(db).getDayProgress('Arik', 'Wednesday');
assert.ok(dp.exercises.includes('Back Squat'));
console.log('API tests passed');

/* ---- frontend smoke test: real index.html, fetch routed into the handler logic ---- */
async function fakeFetch(url, opts) {
  const fn = url.replace('/api/', '');
  const args = JSON.parse(opts.body);
  const reply = (status, body) => ({ ok: status < 400, status, json: async () => body });
  if (!CALLABLE_FNS.has(fn)) return reply(404, { error: 'Unknown' });
  if (!PUBLIC_FNS.has(fn)) {
    const u = verifyToken(opts.headers['x-swole-token']); if (!u) return reply(401, { error: 'auth' });
    if (fn === 'logSet') args[0] = { ...args[0], user: u }; else args[0] = u;
  }
  try { return reply(200, { result: await createApi(db)[fn](...args) ?? null }); } catch (e) { return reply(500, { error: e.message }); }
}
const html = readFileSync(new URL('../public/index.html', import.meta.url), 'utf8').replace(/<script defer src="https:[^"]+"><\/script>/, '');
const errors = [];
const dom = new JSDOM(html, { runScripts: 'dangerously', pretendToBeVisual: true, url: 'https://swole.test/', beforeParse(w) {
  w.fetch = fakeFetch; w.Chart = function () { this.destroy = () => {}; };
  w.HTMLElement.prototype.scrollIntoView = () => {}; w.scrollTo = () => {};
  w.addEventListener('error', e => errors.push(e.message));
}});
const w = dom.window, $ = id => w.document.getElementById(id);
const tick = () => new Promise(r => setTimeout(r, 30));
await tick();
assert.ok($('picker').classList.contains('show'), 'picker shows for new device');
[...$('pickerBtns').children].find(b => b.textContent === 'Arik').click();
$('pinInput').value = '5555'; $('pinInput').dispatchEvent(new w.Event('input', { bubbles: true }));
for (let i = 0; i < 20 && !$('cards').querySelector('.card'); i++) await tick();
assert.ok(!$('picker').classList.contains('show'), 'picker closed after PIN');
assert.equal(w.document.querySelectorAll('#cards .card').length, 9);
assert.equal(w.document.querySelectorAll('#days .day').length, 7);
assert.match($('kpis').textContent, /205/);
assert.ok(w.localStorage.getItem('thq_tok'));
// everything collapsible starts collapsed; tapping the row (not a button) opens it and is remembered
const secs = [...w.document.querySelectorAll('#extras .exsec.tap')];
assert.equal(secs.length, 4);
assert.ok(secs.every(h => !h.classList.contains('open') && h.nextElementSibling.style.display === 'none'), 'sections collapsed by default');
assert.ok(!w.document.querySelector('#extras').textContent.match(/hide|show/), 'no hide/show labels');
secs[0].click();
const warm = w.document.querySelector('#extras .exsec.tap');
assert.ok(warm.classList.contains('open') && warm.nextElementSibling.style.display !== 'none', 'tap opens section');
assert.equal(w.localStorage.getItem('thq_sec_Warmups'), '1');
const cards = [...w.document.querySelectorAll('#cards .card')];
assert.ok(cards.every(c => $('cbody' + cards.indexOf(c)).style.display === 'none'), 'cards collapsed by default');
cards[0].querySelector('.cardhead').click();
assert.ok(cards[0].classList.contains('open') && $('cbody0').style.display === '', 'tap opens card');
// log a card through the UI
const idx = [...w.document.querySelectorAll('#cards .card')].findIndex(c => c._it.exercise === 'Leg Press');
$('w' + idx).value = '110'; w.logCard(idx);
for (let i = 0; i < 20 && !/Logged|Updated/.test($('btn' + idx).textContent); i++) await tick();
assert.match($('btn' + idx).textContent, /Logged|Updated/);
assert.match($('toast').textContent, /PR|Leg Press/);
// colors vs PREVIOUS session (Back Squat: last session 4x14 @70; today already logged @80 earlier in this test)
const cardsNow = [...w.document.querySelectorAll('#cards .card')];
const sq = cardsNow.findIndex(c => c._it.exercise === 'Back Squat');
const sqCard = () => w.document.querySelectorAll('#cards .card')[sq];
assert.equal(sqCard()._it.last.weight, 70, 'baseline is last week, not today');
assert.ok(sqCard().classList.contains('record'), 'heavier than ever before -> gold');
const logAndWait = async (sets, reps, weight) => {
  $('s' + sq).value = sets; $('r' + sq).value = reps; $('w' + sq).value = weight; w.live(sq);
  $('btn' + sq).textContent = 'Update'; w.logCard(sq);
  for (let i = 0; i < 30 && !/Logged|Updated/.test($('btn' + sq).textContent); i++) await tick();
};
await logAndWait(4, 14, 70);   // misclicked up earlier, corrected back to last week's numbers
assert.ok(sqCard().classList.contains('flat') && !sqCard().classList.contains('invalid'), 'same as last week -> orange, not red');
assert.equal(sqCard()._it.last.weight, 70, 'baseline not overwritten by today');
await logAndWait(4, 15, 70);   // one more rep than last week
assert.ok(sqCard().classList.contains('done') && !sqCard().classList.contains('flat'), 'reps up -> green');
await logAndWait(3, 12, 65);   // lighter and fewer reps
assert.ok(sqCard().classList.contains('flat'), 'went down -> orange');
// auto tag follows the numbers
$('w' + sq).value = 72.5; w.live(sq);
assert.equal(sqCard()._prog, 'PR', 'above all-time best -> PR');
$('w' + sq).value = 70; $('r' + sq).value = 16; w.live(sq);
assert.equal(sqCard()._prog, '+rep');
$('r' + sq).value = 14; w.live(sq);
assert.equal(sqCard()._prog, '', 'nothing up -> no tag');
// expired token -> back to picker
w.localStorage.setItem('thq_tok', 'bogus.bogus'); w.selectDay('Monday');
for (let i = 0; i < 20 && !$('picker').classList.contains('show'); i++) await tick();
assert.ok($('picker').classList.contains('show'), 'bad token sends user back to picker');
assert.deepEqual(errors, []);
console.log('Frontend smoke test passed');
