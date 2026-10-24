import postgres from 'postgres';

/* Thin adapter: db.query(text, params) -> rows[], db.tx(fn). Swappable for tests. */
let sql = null;

export function getDb() {
  if (!sql) {
    const raw = process.env.POSTGRES_URL || process.env.DATABASE_URL;
    if (!raw) throw new Error('No database configured (POSTGRES_URL / DATABASE_URL).');
    const u = new URL(raw);
    const local = /^(localhost|127\.0\.0\.1)$/.test(u.hostname);
    u.search = '';   // drop provider-specific params (e.g. supa=, sslmode=) that postgres.js would forward
    sql = postgres(u.toString(), {
      max: 1, prepare: false, idle_timeout: 20, connect_timeout: 10,
      ssl: local ? false : 'require'
    });
  }
  return wrap(sql);
}

function wrap(s) {
  return {
    query: (text, params = []) => s.unsafe(text, params),
    tx: (fn) => s.begin(t => fn({ query: (text, params = []) => t.unsafe(text, params) }))
  };
}
