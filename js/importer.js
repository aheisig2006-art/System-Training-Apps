// Turns a typed, pasted or PDF-extracted workout program into a plan.
// Free and offline: plain pattern matching, no AI. The result is always shown
// in the editor first so the player can fix anything it misread.
import { LIBRARY, LANDMARKS } from './library.js';

const WEEKDAYS = { mon: 'Mon', tue: 'Tue', wed: 'Wed', thu: 'Thu', fri: 'Fri', sat: 'Sat', sun: 'Sun' };
export const ALL_DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const SPREAD = { 1: ['Mon'], 2: ['Mon', 'Thu'], 3: ['Mon', 'Wed', 'Fri'], 4: ['Mon', 'Tue', 'Thu', 'Fri'], 5: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'], 6: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'], 7: ALL_DAYS };

// Common names and abbreviations → library ids
const ALIASES = {
  'squat': 'bb_squat', 'back squat': 'bb_squat', 'squats': 'bb_squat', 'front squat': 'bb_front_squat', 'goblet squat': 'db_goblet',
  'deadlift': 'bb_deadlift', 'deadlifts': 'bb_deadlift', 'conventional deadlift': 'bb_deadlift', 'dl': 'bb_deadlift',
  'rdl': 'bb_rdl', 'romanian deadlift': 'bb_rdl', 'rdls': 'bb_rdl', 'db rdl': 'db_rdl', 'dumbbell rdl': 'db_rdl',
  'bench': 'bb_bench', 'bench press': 'bb_bench', 'flat bench': 'bb_bench', 'barbell bench press': 'bb_bench',
  'db bench': 'db_bench', 'dumbbell bench': 'db_bench', 'dumbbell bench press': 'db_bench', 'incline db press': 'db_incline', 'incline dumbbell press': 'db_incline',
  'ohp': 'bb_ohp', 'overhead press': 'bb_ohp', 'military press': 'bb_ohp', 'shoulder press': 'db_ohp', 'db shoulder press': 'db_ohp',
  'pull ups': 'bar_pullup', 'pullups': 'bar_pullup', 'pull-ups': 'bar_pullup', 'pull up': 'bar_pullup', 'chin ups': 'bar_chinup', 'chinups': 'bar_chinup', 'chin-ups': 'bar_chinup',
  'lat pulldown': 'cable_pulldown', 'lat pull down': 'cable_pulldown', 'pulldown': 'cable_pulldown', 'pulldowns': 'cable_pulldown',
  'barbell row': 'bb_row', 'bent over row': 'bb_row', 'db row': 'db_row', 'dumbbell row': 'db_row', 'cable row': 'cable_row', 'seated row': 'cable_row', 'seated cable row': 'cable_row',
  'hip thrust': 'bb_hip_thrust', 'hip thrusts': 'bb_hip_thrust', 'glute bridge': 'bw_sl_bridge',
  'leg press': 'mach_leg_press', 'hack squat': 'mach_hack', 'leg extension': 'mach_leg_ext', 'leg extensions': 'mach_leg_ext',
  'leg curl': 'mach_leg_curl', 'leg curls': 'mach_leg_curl', 'hamstring curl': 'mach_leg_curl', 'nordic curl': 'ham_nordic', 'nordics': 'ham_nordic',
  'lunges': 'db_lunge', 'walking lunges': 'db_lunge', 'bulgarian split squat': 'db_bss', 'split squat': 'db_bss', 'bss': 'db_bss',
  'dips': 'bar_dips', 'push ups': 'bw_pushup', 'pushups': 'bw_pushup', 'push-ups': 'bw_pushup',
  'lateral raise': 'db_lateral', 'lateral raises': 'db_lateral', 'side raises': 'db_lateral', 'face pull': 'cable_facepull', 'face pulls': 'cable_facepull', 'rear delt fly': 'db_rear_fly',
  'bicep curl': 'db_curl', 'bicep curls': 'db_curl', 'curls': 'db_curl', 'dumbbell curl': 'db_curl', 'hammer curl': 'db_hammer', 'hammer curls': 'db_hammer',
  'tricep pushdown': 'cable_pushdown', 'triceps pushdown': 'cable_pushdown', 'skull crushers': 'bb_skull', 'overhead tricep extension': 'db_oh_ext',
  'calf raise': 'mach_calf', 'calf raises': 'mach_calf', 'plank': 'bw_plank', 'hanging leg raise': 'bar_leg_raise', 'hanging leg raises': 'bar_leg_raise',
  'back extension': 'ham_back_ext', 'back extensions': 'ham_back_ext', 'reverse hyper': 'ham_rev_hyper', 'ghd sit up': 'ham_ghd_situp', 'cable fly': 'cable_fly', 'pec deck': 'mach_pec_deck'
};
const MUSCLE_WORDS = [
  ['calves', /calf|calves/], ['core', /plank|\bab\b|abs|crunch|core|sit.?up|leg raise|hollow|dead bug|l-sit/],
  ['hams', /rdl|romanian|hamstring|leg curl|nordic|good morning|deadlift|ghr|glute.ham/], ['glutes', /glute|hip thrust|bridge|abduct|kickback/],
  ['quads', /squat|leg press|lunge|step.?up|leg ext|split squat|pistol/], ['biceps', /curl|bicep/], ['triceps', /tricep|pushdown|skull|kickback|close.grip|dip/],
  ['shoulders', /shoulder|lateral|delt|face pull|overhead press|ohp|military|arnold|pike|handstand|y.?raise/],
  ['back', /row|pull.?up|pulldown|chin|lat\b|lats|pull.?over|shrug/], ['chest', /bench|chest|fly|flye|push.?up|pec|press/]
];

const norm = s => s.toLowerCase().replace(/[^a-z0-9 -]/g, ' ').replace(/\s+/g, ' ').trim();
function matchLibrary(name) {
  const n = norm(name).replace(/\b(barbell|bb)\b/g, '').trim();
  if (ALIASES[n]) return LIBRARY.find(e => e.id === ALIASES[n]);
  if (ALIASES[norm(name)]) return LIBRARY.find(e => e.id === ALIASES[norm(name)]);
  const words = new Set(n.split(' ').filter(w => w.length > 2));
  let best = null, bestScore = 0;
  LIBRARY.forEach(e => {
    const ew = norm(e.name.replace(/^SKILL: /, '')).split(' ').filter(w => w.length > 2);
    if (!ew.length) return;
    const hit = ew.filter(w => words.has(w)).length;
    const score = hit / Math.max(ew.length, words.size);
    if (score > bestScore) { bestScore = score; best = e; }
  });
  return bestScore >= 0.75 ? best : null;
}
export function guessMuscle(name) {
  const n = norm(name);
  if (/leg curl|hamstring curl/.test(n)) return 'hams';
  if (/leg ext/.test(n)) return 'quads';
  for (const [m, re] of MUSCLE_WORDS) if (re.test(n)) return m;
  return null;
}
function guessLift(name) {
  const n = norm(name);
  if (/^(back )?squats?$/.test(n) || n === 'barbell back squat') return 'squat';
  if (/^(barbell |flat )?bench( press)?$/.test(n)) return 'bench';
  if (/^(conventional |sumo )?deadlifts?$/.test(n)) return 'deadlift';
  return undefined;
}

function dayHeader(line) {
  const t = line.trim().replace(/^[#*•\-–\s]+/, '').replace(/[*:]+$/, '').trim();
  const m = t.match(/^(mon|tue|wed|thu|fri|sat|sun)[a-z]*\.?\b\s*[-–:|,]?\s*(.*)$/i);
  if (m) return { day: WEEKDAYS[m[1].toLowerCase()], title: m[2].replace(/^[-–:|,\s]+/, '').trim() };
  const d = t.match(/^(day|workout|session)\s*(\d+|[a-e])\b\s*[-–:|,]?\s*(.*)$/i);
  if (d) return { day: null, title: d[3].trim() || (d[1][0].toUpperCase() + d[1].slice(1).toLowerCase() + ' ' + d[2].toUpperCase()) };
  if (/^(upper|lower|push|pull|legs|full body|arms|chest|back|shoulders)( body)?( day)?( [a-d1-4])?$/i.test(t)) return { day: null, title: t };
  return null;
}

// "4x6", "4 x 6-8", "3 sets of 10", "3x30s", "4x5 @8", "RPE 8", "4 × 8–10"
function parseExercise(line) {
  let raw = line.replace(/^\s*(?:[-•*·]|\d+[.)])\s*/, '').trim();
  if (!raw) return null;
  let cells = raw.split(/\t|\s{3,}|\s*,\s*(?=\d)|\s*\|\s*/).map(c => c.trim()).filter(Boolean);
  let name, sets, reps, rpe;
  const rpeM = raw.match(/(?:@\s*(?:rpe\s*)?|rpe\s*)(\d+(?:\.\d+)?(?:\s*[-–]\s*\d+(?:\.\d+)?)?)/i);
  if (rpeM) rpe = rpeM[1].replace(/\s+/g, '').replace('–', '-');
  const sx = raw.match(/(\d+)\s*(?:sets?\s*)?[x×X*]\s*(\d+(?:\s*[-–]\s*\d+)?\s*(?:s|sec|secs|seconds|min|reps?)?|amrap|max)/i)
    || raw.match(/(\d+)\s*sets?\s*(?:of\s*)?(\d+(?:\s*[-–]\s*\d+)?\s*(?:s|sec|seconds|min|reps?)?)/i);
  if (sx) {
    sets = +sx[1];
    reps = sx[2].replace(/\s+/g, '').replace('–', '-').replace(/reps?$/i, '');
    name = raw.slice(0, sx.index).replace(/[-–:,(|]+\s*$/, '').trim();
  } else if (cells.length >= 3 && /^\d+$/.test(cells[1])) {
    // spreadsheet row: name | sets | reps | (rpe)
    name = cells[0]; sets = +cells[1]; reps = cells[2].replace(/\s*reps?$/i, '');
    if (!rpe && cells[3] && /^\d+(\.\d+)?$/.test(cells[3])) rpe = cells[3];
  } else {
    name = raw.replace(/(?:@\s*(?:rpe\s*)?|rpe\s*)\d.*$/i, '').trim();
  }
  name = name.replace(/\s*[-–:]\s*$/, '').replace(/\s{2,}/g, ' ').trim();
  if (!name || name.length < 3 || !/[a-z]/i.test(name)) return null;
  if (sets && (sets < 1 || sets > 12)) sets = undefined;
  return { name, sets, reps, rpe, guessed: !sets };
}

const slug = s => norm(s).replace(/ /g, '_').slice(0, 24) || 'ex';

export function parseProgram(text, opts = {}) {
  const lines = String(text || '').replace(/\r/g, '').split('\n');
  const groups = [];
  let cur = null;
  const skipped = [];
  lines.forEach(rawLine => {
    const line = rawLine.trim();
    if (!line) return;
    const h = dayHeader(line);
    if (h) { cur = { day: h.day, title: h.title, ex: [] }; groups.push(cur); return; }
    if (/^(exercise|movement|lift|name)\b/i.test(line) && /\b(sets?|reps?)\b/i.test(line) && !/\d/.test(line)) return; // table header
    const ex = parseExercise(line);
    if (!ex) { skipped.push(line); return; }
    // a title or note line (no sets × reps) before any day, or one that reads like a heading
    if (ex.guessed && (!cur || /\b(program|week|phase|block|notes?|warm.?up|cool.?down|rest)\b/i.test(ex.name))) { skipped.push(line); return; }
    if (!cur) { cur = { day: null, title: '', ex: [] }; groups.push(cur); }
    cur.ex.push(ex);
  });
  const filled = groups.filter(g => g.ex.length);
  // assign weekdays: named ones keep theirs; the rest fill a sensible spread
  const taken = new Set(filled.map(g => g.day).filter(Boolean));
  const spread = (SPREAD[Math.min(7, filled.length)] || ALL_DAYS).filter(d => !taken.has(d));
  const free = spread.concat(ALL_DAYS.filter(d => !taken.has(d) && !spread.includes(d)));
  filled.forEach(g => { if (!g.day || filled.filter(x => x.day === g.day).length > 1 && g !== filled.find(x => x.day === g.day)) { g.day = free.shift(); taken.add(g.day); } });
  filled.sort((a, b) => ALL_DAYS.indexOf(a.day) - ALL_DAYS.indexOf(b.day));

  const plan = { DAY_ORDER: [], DAYS: {}, targets: {}, imported: true, settings: { source: 'import', equipment: opts.equipment || 'gym' } };
  const used = {};
  filled.forEach(g => {
    plan.DAY_ORDER.push(g.day);
    plan.DAYS[g.day] = {
      title: g.title || 'Workout',
      hint: 'Your own program. Swap or skip exercises anytime; edit it from Profile → Your Plan.',
      ex: g.ex.map(x => makeExercise(x, g.day, used))
    };
  });
  refreshTargets(plan);
  return { plan, skipped, guessed: filled.reduce((a, g) => a + g.ex.filter(x => x.guessed).length, 0) };
}

export function makeExercise(x, day, used = {}) {
  const lib = matchLibrary(x.name);
  let id = day + '_' + slug(x.name);
  while (used[id]) id += '_';
  used[id] = 1;
  const e = {
    id, name: x.name.charAt(0).toUpperCase() + x.name.slice(1),
    sets: x.sets || 3, reps: x.reps || (lib && lib.hold) || '8-12', rpe: x.rpe || '8',
    m: (lib && lib.m) || guessMuscle(x.name) || null, t: lib ? lib.t : 'c'
  };
  if (lib) { e.lib = lib.id; e.pat = lib.pat; e.bw = lib.eq.every(q => q === 'bw' || q === 'bar' || q === 'dip'); }
  const lift = guessLift(x.name) || (lib && lib.lift && norm(x.name) === norm(lib.name) ? lib.lift : undefined);
  if (lift) e.lift = lift;
  if (x.guessed) e.guessed = true;
  return e;
}

export function refreshTargets(plan) {
  plan.targets = {};
  Object.values(plan.DAYS).forEach(d => d.ex.forEach(e => { if (e.m && LANDMARKS[e.m]) plan.targets[e.m] = LANDMARKS[e.m]; }));
  return plan;
}

// ---------- PDF → text (pdf.js, loaded only when someone picks a PDF) ----------
export async function pdfToText(file) {
  const pdfjs = await import('../vendor/pdf.min.mjs');
  pdfjs.GlobalWorkerOptions.workerSrc = new URL('../vendor/pdf.worker.min.mjs', import.meta.url).href;
  const doc = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise;
  const out = [];
  for (let p = 1; p <= Math.min(doc.numPages, 20); p++) {
    const page = await doc.getPage(p);
    const content = await page.getTextContent();
    // group text pieces into lines by their vertical position
    const rows = new Map();
    content.items.forEach(it => {
      if (!it.str || !it.str.trim()) return;
      const y = Math.round(it.transform[5] / 3) * 3;
      if (!rows.has(y)) rows.set(y, []);
      rows.get(y).push({ x: it.transform[4], s: it.str });
    });
    [...rows.keys()].sort((a, b) => b - a).forEach(y => {
      const parts = rows.get(y).sort((a, b) => a.x - b.x);
      let line = '', lastX = null;
      parts.forEach(pt => { line += (lastX !== null && pt.x - lastX > 20 ? '\t' : (line ? ' ' : '')) + pt.s.trim(); lastX = pt.x + pt.s.length * 4; });
      out.push(line);
    });
    out.push('');
  }
  return out.join('\n');
}
