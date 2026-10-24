/* POST /api/import  (header x-admin-key: <ADMIN_KEY>) — replaces all data with the Sheet export. */
import { getDb } from '../lib/db.js';
import { runImport } from '../lib/importer.js';
import { safeEqual } from '../lib/auth.js';

export const config = { maxDuration: 60 };

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
  if (!process.env.ADMIN_KEY || !safeEqual(req.headers['x-admin-key'], process.env.ADMIN_KEY)) {
    return res.status(401).json({ error: 'Bad admin key' });
  }
  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch (e) { return res.status(400).json({ error: 'Invalid JSON' }); } }
  try {
    return res.status(200).json(await runImport(getDb(), body || {}));
  } catch (e) {
    console.error('import', e);
    return res.status(500).json({ error: e.message });
  }
}
