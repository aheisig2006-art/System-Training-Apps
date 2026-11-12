// Effort is STORED as RPE (engine rules, logged history, imported plans).
// It is SHOWN and ENTERED as RIR (reps in reserve). RIR = 10 - RPE.
const fmt = x => String(+x.toFixed(1));
const parts = s => String(s ?? '').split(/[-–]/).map(x => parseFloat(x)).filter(x => isFinite(x));
const span = (v, sep) => v.length > 1 && v[0] !== v[v.length - 1] ? fmt(v[0]) + sep + fmt(v[v.length - 1]) : (v.length ? fmt(v[0]) : '');

// Single logged set: RPE 8 -> "2" ("" when nothing was logged).
export function rirOf(rpe) { const n = +rpe; return n > 0 ? fmt(10 - n) : ''; }
// Stored target: "6-7" -> "3–4" for display.
export function rirText(rpeText) { return span(parts(rpeText).map(x => 10 - x).sort((a, b) => a - b), '–'); }
// Entered range: "3-4" -> "6-7" for storage.
export function rpeFromRirText(s) { return span(parts(s).map(x => 10 - x).sort((a, b) => a - b), '-'); }
// Text such as "RPE 6–7" written in a program name or hint -> "RIR 3–4".
export function rirInText(s) {
  return String(s ?? '').replace(/RPE\s*(\d+(?:\.\d+)?)(?:\s*[-–]\s*(\d+(?:\.\d+)?))?/gi,
    (m, a, b) => 'RIR ' + rirText(b ? a + '-' + b : a));
}
// Suffix for a logged set or a last-set line.
export function effortTag(rpe) { const r = rirOf(rpe); return r === '' ? '' : ' @ RIR ' + r; }
