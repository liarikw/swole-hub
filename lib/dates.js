import { TZ } from './config.js';

const ymd = new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' });
const MON = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const WD = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

/* All dates in the app are 'YYYY-MM-DD' strings in New York time. */
export function todayISO() { return process.env.SWOLE_TODAY || ymd.format(new Date()); }
function parts(iso) { const [y, m, d] = String(iso).slice(0, 10).split('-').map(Number); return [y, m, d]; }
export function dowOf(iso) { const [y, m, d] = parts(iso); return new Date(Date.UTC(y, m - 1, d)).getUTCDay(); }
export function addDays(iso, n) { const [y, m, d] = parts(iso); return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10); }
export function fmtMD(iso) { if (!iso) return ''; const [, m, d] = parts(iso); return m + '/' + d; }
export function fmtMMMd(iso) { const [, m, d] = parts(iso); return MON[m - 1] + ' ' + d; }
export function fmtLabel(iso) { const [, m, d] = parts(iso); return WD[dowOf(iso)] + ', ' + MON[m - 1] + ' ' + d; }

/* Accepts 'YYYY-MM-DD', ISO datetimes, or 'M/D/YYYY'; returns 'YYYY-MM-DD' or null. */
export function normIso(v) {
  if (v == null || v === '') return null;
  const s = String(v).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  let m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (m) return m[3] + '-' + m[1].padStart(2, '0') + '-' + m[2].padStart(2, '0');
  const t = Date.parse(s);
  return isNaN(t) ? null : ymd.format(new Date(t));
}
