/* Wire-protocol test: the production DB client (postgres.js via lib/db.js) against a local
   Postgres-compatible server (PGlite socket). Catches client-specific serialization bugs.
   Run: node scripts/test-wire.mjs */
import { PGlite } from '@electric-sql/pglite';
import { PGLiteSocketServer } from '@electric-sql/pglite-socket';
import assert from 'node:assert/strict';

const pg = await PGlite.create();
const server = new PGLiteSocketServer({ db: pg, port: 54329, host: '127.0.0.1' });
await server.start();
process.env.POSTGRES_URL = 'postgresql://postgres:postgres@127.0.0.1:54329/postgres?sslmode=disable&supa=base-pooler.x';
process.env.ADMIN_KEY = 'test-key';
process.env.SWOLE_TODAY = '2026-07-15';

const { getDb } = await import('../lib/db.js');
const { runImport } = await import('../lib/importer.js');
const { createApi } = await import('../lib/core.js');
const { PROGRAM } = await import('../lib/config.js');
const db = getDb();

const LOGH = ['Timestamp','Date','Day','Exercise','Sets','Reps','Weight','LoadType','EffWeight','Volume','Progress','Category','Notes','Time','Level','Pace','Calories','User'];
const res = await runImport(db, {
  pins: { 'Arik': '5555' },
  program: { headers: ['Day','Order','Exercise','Sets','Reps','TargetWeight','LoadType','Category','Preset','User'], rows: PROGRAM.map(p => p.concat(['Arik'])) },
  log: { headers: LOGH, rows: [['2026-07-13T22:00:00.000Z','2026-07-13','Mon','Barbell Bench',4,6,200,'total',200,4800,'','Push','','','','','','Arik'],
                               ['7/14/2026 18:44:39','7/14/2026','Tue','Sauna',0,0,'','total','','','','Habit','',5,'','','','Arik']] },
  skips: { headers: ['Date','Exercise','Day','User'], rows: [['2026-07-14','Rowing Machine','Tue','Arik']] }
});
console.log('import', res);
assert.equal(res.log, 2); assert.equal(res.program, PROGRAM.length); assert.equal(res.users, 1);

const api = createApi(db);
assert.ok(await api.checkPin('Arik', '5555'));
const boot = await api.getBoot('Arik');
assert.equal(boot.state.dashboard.benchPR, 200);
const r = await api.logSet({ user: 'Arik', exercise: 'Back Squat', sets: 4, reps: 14, weight: 75, category: 'Legs - Push', day: 'Wednesday', logDate: '2026-07-15' });
assert.equal(r.updated, false);
assert.equal((await createApi(db).logSet({ user: 'Arik', exercise: 'Back Squat', sets: 4, reps: 15, weight: 75, day: 'Wednesday', logDate: '2026-07-15' })).updated, true);
await api.setSkip('Arik', 'Leg Curls', 'Wednesday', '2026-07-15', true);
assert.equal((await createApi(db).getBoot('Desitrain')).state.today.items.length, 9);   // default program insert path
console.log('Wire test passed (postgres.js client)');
await server.stop(); process.exit(0);
