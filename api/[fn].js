/* RPC endpoint: POST /api/<fnName> with a JSON array of args. Mirrors google.script.run. */
import { getDb } from '../lib/db.js';
import { createApi, PUBLIC_FNS, CALLABLE_FNS } from '../lib/core.js';
import { verifyToken } from '../lib/auth.js';

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
  const fn = String(req.query.fn || '');
  if (!CALLABLE_FNS.has(fn)) return res.status(404).json({ error: 'Unknown function' });

  let args = req.body;
  if (typeof args === 'string') { try { args = JSON.parse(args); } catch (e) { args = []; } }
  if (!Array.isArray(args)) args = [];

  if (!PUBLIC_FNS.has(fn)) {
    const user = verifyToken(req.headers['x-swole-token']);
    if (!user) return res.status(401).json({ error: 'Not signed in' });
    // The signed-in profile always wins over whatever user the client passed.
    if (fn === 'logSet') args[0] = Object.assign({}, args[0] || {}, { user });
    else args[0] = user;
  }

  try {
    const result = await createApi(getDb())[fn](...args);
    return res.status(200).json({ result: result === undefined ? null : result });
  } catch (e) {
    console.error(fn, e);
    return res.status(500).json({ error: e && e.message ? e.message : String(e) });
  }
}
