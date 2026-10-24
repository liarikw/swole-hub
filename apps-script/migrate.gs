/*************************************************************
 * SWOLE HUB -> VERCEL MIGRATION
 * 1. In the Apps Script editor: + (Add a file) > Script > name it "migrate", paste this in.
 * 2. Fill in VERCEL_URL and ADMIN_KEY below.
 * 3. Pick migrateToVercel in the function dropdown > Run. Approve the "connect to an external service" prompt.
 * 4. Check the Execution log: you should see 200 and row counts.
 * Re-running replaces everything in the new database with what's in the Sheet right now.
 *************************************************************/
const VERCEL_URL = 'https://YOUR-APP.vercel.app';
const ADMIN_KEY  = 'PASTE_ADMIN_KEY_HERE';

function migrateToVercel() {
  const ss = getSS_(), tz = Session.getScriptTimeZone();
  function dump(name) {
    const sh = ss.getSheetByName(name);
    if (!sh || sh.getLastRow() < 1) return { headers: [], rows: [] };
    const v = sh.getDataRange().getValues();
    const headers = v.shift().map(String);
    const rows = v.map(r => r.map((c, i) => c instanceof Date
      ? (headers[i] === 'Timestamp' ? c.toISOString() : Utilities.formatDate(c, tz, 'yyyy-MM-dd'))
      : c));
    return { headers: headers, rows: rows };
  }
  const payload = { pins: PINS, renames: RENAMES, log: dump(LOG_SHEET), program: dump(PROGRAM_SHEET), skips: dump(SKIPS_SHEET) };
  const res = UrlFetchApp.fetch(VERCEL_URL.replace(/\/$/, '') + '/api/import', {
    method: 'post', contentType: 'application/json', headers: { 'x-admin-key': ADMIN_KEY },
    payload: JSON.stringify(payload), muteHttpExceptions: true
  });
  Logger.log(res.getResponseCode() + ' ' + res.getContentText());
}
