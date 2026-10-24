import crypto from 'node:crypto';

/* Session tokens: "<base64url(user)>.<hmac>", signed with ADMIN_KEY. Rotating ADMIN_KEY logs everyone out. */
function secret() {
  const k = process.env.ADMIN_KEY;
  if (!k) throw new Error('ADMIN_KEY is not set.');
  return k;
}
const b64u = s => Buffer.from(s, 'utf8').toString('base64url');
const sign = user => crypto.createHmac('sha256', secret()).update('swole:' + user).digest('base64url');

export function hashPin(user, pin) {
  return crypto.createHash('sha256').update(String(user) + ':' + String(pin)).digest('hex');
}
export function makeToken(user) { return b64u(user) + '.' + sign(user); }
export function verifyToken(tok) {
  if (!tok || typeof tok !== 'string' || tok.indexOf('.') < 0) return null;
  const [u, mac] = tok.split('.');
  let user;
  try { user = Buffer.from(u, 'base64url').toString('utf8'); } catch (e) { return null; }
  const want = sign(user);
  if (mac.length !== want.length) return null;
  return crypto.timingSafeEqual(Buffer.from(mac), Buffer.from(want)) ? user : null;
}
export function safeEqual(a, b) {
  const x = Buffer.from(String(a || '')), y = Buffer.from(String(b || ''));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}
