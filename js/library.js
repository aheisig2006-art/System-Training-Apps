// Exercise library + plan generator for new players.
// Built on Renaissance Periodization ideas: weekly sets per muscle between
// minimum effective volume (MEV) and maximum recoverable volume (MRV), sets and
// effort rising across a 4-week block, then a deload week.
//
// Equipment codes: bb barbell+rack, db dumbbells, bench, bar pull-up/dip bar,
// dip dip bars, ham hyper/GHD-style machine (Freak Athlete type), mach gym machines,
// cable cable stack, bw bodyweight only.

// pat = movement pattern, m = muscle for volume, d = difficulty 1-3,
// t = 'c' compound | 'i' isolation | 's' skill, hold = time-based reps
export const LIBRARY = [
  // squat
  { id: 'bb_squat', name: 'Back squat', pat: 'squat', m: 'quads', eq: ['bb'], d: 2, t: 'c', lift: 'squat' },
  { id: 'bb_front_squat', name: 'Front squat', pat: 'squat', m: 'quads', eq: ['bb'], d: 3, t: 'c' },
  { id: 'db_goblet', name: 'Goblet squat', pat: 'squat', m: 'quads', eq: ['db'], d: 1, t: 'c' },
  { id: 'mach_leg_press', name: 'Leg press', pat: 'squat', m: 'quads', eq: ['mach'], d: 1, t: 'c' },
  { id: 'mach_hack', name: 'Hack squat', pat: 'squat', m: 'quads', eq: ['mach'], d: 2, t: 'c' },
  { id: 'bw_squat', name: 'Tempo squat (3 s down)', pat: 'squat', m: 'quads', eq: ['bw'], d: 1, t: 'c' },
  { id: 'bw_shrimp', name: 'Shrimp squat progression', pat: 'squat', m: 'quads', eq: ['bw'], d: 3, t: 'c' },
  { id: 'bw_pistol', name: 'Box pistol squat progression', pat: 'squat', m: 'quads', eq: ['bw'], d: 2, t: 'c' },
  // single leg
  { id: 'db_bss', name: 'Dumbbell Bulgarian split squat', pat: 'lunge', m: 'quads', eq: ['db', 'bench'], d: 2, t: 'c' },
  { id: 'db_lunge', name: 'Walking lunge (dumbbells)', pat: 'lunge', m: 'quads', eq: ['db'], d: 1, t: 'c' },
  { id: 'bw_bss', name: 'Bulgarian split squat (bodyweight)', pat: 'lunge', m: 'quads', eq: ['bw'], d: 1, t: 'c' },
  { id: 'bw_rev_lunge', name: 'Reverse lunge', pat: 'lunge', m: 'quads', eq: ['bw'], d: 1, t: 'c' },
  // hinge
  { id: 'bb_deadlift', name: 'Deadlift', pat: 'hinge', m: 'hams', eq: ['bb'], d: 2, t: 'c', lift: 'deadlift' },
  { id: 'bb_rdl', name: 'Romanian deadlift', pat: 'hinge', m: 'hams', eq: ['bb'], d: 2, t: 'c' },
  { id: 'db_rdl', name: 'Dumbbell Romanian deadlift', pat: 'hinge', m: 'hams', eq: ['db'], d: 1, t: 'c' },
  { id: 'ham_back_ext', name: 'Back extension', pat: 'hinge', m: 'hams', eq: ['ham'], d: 1, t: 'c' },
  { id: 'bw_sl_rdl', name: 'Single-leg RDL (bodyweight)', pat: 'hinge', m: 'hams', eq: ['bw'], d: 1, t: 'c' },
  // hamstring curl
  { id: 'ham_nordic', name: 'Nordic curl (machine-assisted)', pat: 'hamcurl', m: 'hams', eq: ['ham'], d: 2, t: 'i' },
  { id: 'ham_ghr', name: 'Glute-ham raise', pat: 'hamcurl', m: 'hams', eq: ['ham'], d: 3, t: 'i' },
  { id: 'mach_leg_curl', name: 'Leg curl (lying or seated)', pat: 'hamcurl', m: 'hams', eq: ['mach'], d: 1, t: 'i' },
  { id: 'bw_slider_curl', name: 'Sliding leg curl (towel on floor)', pat: 'hamcurl', m: 'hams', eq: ['bw'], d: 2, t: 'i' },
  { id: 'bw_nordic_neg', name: 'Nordic curl negatives (feet anchored)', pat: 'hamcurl', m: 'hams', eq: ['bw'], d: 3, t: 'i' },
  // glutes
  { id: 'bb_hip_thrust', name: 'Barbell hip thrust', pat: 'glute', m: 'glutes', eq: ['bb', 'bench'], d: 1, t: 'c' },
  { id: 'ham_hip_thrust', name: 'Hip thrust (hyper machine)', pat: 'glute', m: 'glutes', eq: ['ham'], d: 1, t: 'c' },
  { id: 'ham_rev_hyper', name: 'Reverse hyper', pat: 'glute', m: 'glutes', eq: ['ham'], d: 1, t: 'i' },
  { id: 'mach_abduction', name: 'Hip abduction machine', pat: 'glute', m: 'glutes', eq: ['mach'], d: 1, t: 'i' },
  { id: 'cable_kickback', name: 'Cable glute kickback', pat: 'glute', m: 'glutes', eq: ['cable'], d: 1, t: 'i' },
  { id: 'bw_sl_bridge', name: 'Single-leg glute bridge', pat: 'glute', m: 'glutes', eq: ['bw'], d: 1, t: 'i' },
  // quad isolation
  { id: 'mach_leg_ext', name: 'Leg extension', pat: 'quadiso', m: 'quads', eq: ['mach'], d: 1, t: 'i' },
  { id: 'ham_leg_ext', name: 'Leg extension (hyper machine attachment)', pat: 'quadiso', m: 'quads', eq: ['ham'], d: 1, t: 'i' },
  { id: 'bw_sissy', name: 'Assisted sissy squat', pat: 'quadiso', m: 'quads', eq: ['bw'], d: 2, t: 'i' },
  { id: 'bw_wall_sit', name: 'Wall sit', pat: 'quadiso', m: 'quads', eq: ['bw'], d: 1, t: 'i', hold: '30–60 s' },
  // calves
  { id: 'mach_calf', name: 'Calf raise machine', pat: 'calf', m: 'calves', eq: ['mach'], d: 1, t: 'i' },
  { id: 'db_calf', name: 'Single-leg calf raise (holding a dumbbell)', pat: 'calf', m: 'calves', eq: ['db'], d: 1, t: 'i' },
  { id: 'bw_calf', name: 'Single-leg calf raise on a step', pat: 'calf', m: 'calves', eq: ['bw'], d: 1, t: 'i' },
  // horizontal push
  { id: 'bb_bench', name: 'Bench press', pat: 'hpush', m: 'chest', eq: ['bb', 'bench'], d: 2, t: 'c', lift: 'bench' },
  { id: 'db_bench', name: 'Dumbbell bench press', pat: 'hpush', m: 'chest', eq: ['db', 'bench'], d: 1, t: 'c' },
  { id: 'db_incline', name: 'Incline dumbbell press', pat: 'hpush', m: 'chest', eq: ['db', 'bench'], d: 1, t: 'c' },
  { id: 'mach_chest_press', name: 'Machine chest press', pat: 'hpush', m: 'chest', eq: ['mach'], d: 1, t: 'c' },
  { id: 'bar_dips', name: 'Dips (dip bars or rack attachment)', pat: 'hpush', m: 'chest', eq: ['dip'], d: 2, t: 'c' },
  { id: 'bw_pushup', name: 'Push-ups', pat: 'hpush', m: 'chest', eq: ['bw'], d: 1, t: 'c' },
  { id: 'bw_deficit_pushup', name: 'Deficit push-ups', pat: 'hpush', m: 'chest', eq: ['bw'], d: 2, t: 'c' },
  { id: 'bw_archer', name: 'Archer push-ups', pat: 'hpush', m: 'chest', eq: ['bw'], d: 3, t: 'c' },
  // chest isolation
  { id: 'cable_fly', name: 'Cable fly', pat: 'chestiso', m: 'chest', eq: ['cable'], d: 1, t: 'i' },
  { id: 'db_fly', name: 'Dumbbell fly', pat: 'chestiso', m: 'chest', eq: ['db', 'bench'], d: 1, t: 'i' },
  { id: 'mach_pec_deck', name: 'Pec deck', pat: 'chestiso', m: 'chest', eq: ['mach'], d: 1, t: 'i' },
  { id: 'bw_wide_pushup', name: 'Wide push-ups (slow lowering)', pat: 'chestiso', m: 'chest', eq: ['bw'], d: 1, t: 'i' },
  // vertical push
  { id: 'bb_ohp', name: 'Overhead press', pat: 'vpush', m: 'shoulders', eq: ['bb'], d: 2, t: 'c' },
  { id: 'db_ohp', name: 'Seated dumbbell shoulder press', pat: 'vpush', m: 'shoulders', eq: ['db', 'bench'], d: 1, t: 'c' },
  { id: 'mach_shoulder_press', name: 'Machine shoulder press', pat: 'vpush', m: 'shoulders', eq: ['mach'], d: 1, t: 'c' },
  { id: 'bw_pike', name: 'Pike push-ups', pat: 'vpush', m: 'shoulders', eq: ['bw'], d: 2, t: 'c' },
  { id: 'bw_hspu', name: 'Wall handstand push-up progression', pat: 'vpush', m: 'shoulders', eq: ['bw'], d: 3, t: 'c' },
  // side + rear delts
  { id: 'db_lateral', name: 'Lateral raise', pat: 'side', m: 'shoulders', eq: ['db'], d: 1, t: 'i' },
  { id: 'cable_lateral', name: 'Cable lateral raise', pat: 'side', m: 'shoulders', eq: ['cable'], d: 1, t: 'i' },
  { id: 'bw_lateral', name: 'Backpack or water-jug lateral raise', pat: 'side', m: 'shoulders', eq: ['bw'], d: 1, t: 'i' },
  { id: 'cable_facepull', name: 'Face pulls', pat: 'rear', m: 'shoulders', eq: ['cable'], d: 1, t: 'i' },
  { id: 'db_rear_fly', name: 'Rear delt fly', pat: 'rear', m: 'shoulders', eq: ['db'], d: 1, t: 'i' },
  { id: 'mach_rev_pec', name: 'Reverse pec deck', pat: 'rear', m: 'shoulders', eq: ['mach'], d: 1, t: 'i' },
  { id: 'bw_ytw', name: 'Prone Y-T-W raises', pat: 'rear', m: 'shoulders', eq: ['bw'], d: 1, t: 'i' },
  // vertical pull
  { id: 'bar_pullup', name: 'Pull-ups', pat: 'vpull', m: 'back', eq: ['bar'], d: 2, t: 'c' },
  { id: 'bar_chinup', name: 'Chin-ups', pat: 'vpull', m: 'back', eq: ['bar'], d: 2, t: 'c' },
  { id: 'bar_neg_pullup', name: 'Negative pull-ups (5 s down)', pat: 'vpull', m: 'back', eq: ['bar'], d: 1, t: 'c' },
  { id: 'bar_weighted_pullup', name: 'Weighted pull-ups', pat: 'vpull', m: 'back', eq: ['bar'], d: 3, t: 'c' },
  { id: 'cable_pulldown', name: 'Lat pulldown', pat: 'vpull', m: 'back', eq: ['cable'], d: 1, t: 'c' },
  // horizontal pull
  { id: 'bb_row', name: 'Barbell row', pat: 'hpull', m: 'back', eq: ['bb'], d: 2, t: 'c' },
  { id: 'db_row', name: 'One-arm dumbbell row', pat: 'hpull', m: 'back', eq: ['db', 'bench'], d: 1, t: 'c' },
  { id: 'db_cs_row', name: 'Chest-supported dumbbell row', pat: 'hpull', m: 'back', eq: ['db', 'bench'], d: 1, t: 'c' },
  { id: 'cable_row', name: 'Seated cable row', pat: 'hpull', m: 'back', eq: ['cable'], d: 1, t: 'c' },
  { id: 'mach_row', name: 'Machine row', pat: 'hpull', m: 'back', eq: ['mach'], d: 1, t: 'c' },
  { id: 'bw_inv_row', name: 'Inverted row (low bar or sturdy table)', pat: 'hpull', m: 'back', eq: ['bw'], d: 1, t: 'c' },
  { id: 'bw_towel_row', name: 'Door towel row', pat: 'hpull', m: 'back', eq: ['bw'], d: 1, t: 'c' },
  // arms
  { id: 'db_curl', name: 'Dumbbell curl', pat: 'bicep', m: 'biceps', eq: ['db'], d: 1, t: 'i' },
  { id: 'db_hammer', name: 'Hammer curl', pat: 'bicep', m: 'biceps', eq: ['db'], d: 1, t: 'i' },
  { id: 'bb_curl', name: 'Barbell curl', pat: 'bicep', m: 'biceps', eq: ['bb'], d: 1, t: 'i' },
  { id: 'cable_curl', name: 'Cable curl', pat: 'bicep', m: 'biceps', eq: ['cable'], d: 1, t: 'i' },
  { id: 'bar_chin_slow', name: 'Slow-lowering chin-ups', pat: 'bicep', m: 'biceps', eq: ['bar'], d: 2, t: 'i' },
  { id: 'bw_table_curl', name: 'Bodyweight curl (under a sturdy table)', pat: 'bicep', m: 'biceps', eq: ['bw'], d: 2, t: 'i' },
  { id: 'cable_pushdown', name: 'Triceps pushdown', pat: 'tricep', m: 'triceps', eq: ['cable'], d: 1, t: 'i' },
  { id: 'cable_oh_ext', name: 'Overhead cable extension', pat: 'tricep', m: 'triceps', eq: ['cable'], d: 1, t: 'i' },
  { id: 'db_oh_ext', name: 'Overhead dumbbell extension', pat: 'tricep', m: 'triceps', eq: ['db'], d: 1, t: 'i' },
  { id: 'bb_skull', name: 'Skull crushers', pat: 'tricep', m: 'triceps', eq: ['bb', 'bench'], d: 2, t: 'i' },
  { id: 'bw_diamond', name: 'Diamond push-ups', pat: 'tricep', m: 'triceps', eq: ['bw'], d: 1, t: 'i' },
  { id: 'bw_bench_dip', name: 'Bench or chair dips', pat: 'tricep', m: 'triceps', eq: ['bw'], d: 1, t: 'i' },
  // core
  { id: 'bw_plank', name: 'Plank', pat: 'core', m: 'core', eq: ['bw'], d: 1, t: 'i', hold: '30–60 s' },
  { id: 'bw_hollow', name: 'Hollow body hold', pat: 'core', m: 'core', eq: ['bw'], d: 1, t: 'i', hold: '20–40 s' },
  { id: 'bw_dead_bug', name: 'Dead bug', pat: 'core', m: 'core', eq: ['bw'], d: 1, t: 'i' },
  { id: 'bar_knee_raise', name: 'Hanging knee raises', pat: 'core', m: 'core', eq: ['bar'], d: 1, t: 'i' },
  { id: 'bar_leg_raise', name: 'Hanging leg raises', pat: 'core', m: 'core', eq: ['bar'], d: 2, t: 'i' },
  { id: 'ham_ghd_situp', name: 'GHD sit-up', pat: 'core', m: 'core', eq: ['ham'], d: 2, t: 'i' },
  { id: 'cable_crunch', name: 'Cable crunch', pat: 'core', m: 'core', eq: ['cable'], d: 1, t: 'i' },
  // calisthenics skills
  { id: 'bw_wall_hs', name: 'SKILL: Wall handstand hold', pat: 'skill', m: 'shoulders', eq: ['bw'], d: 1, t: 's', hold: '20–40 s' },
  { id: 'bw_planche_lean', name: 'SKILL: Planche leans', pat: 'skill', m: 'shoulders', eq: ['bw'], d: 2, t: 's', hold: '10–20 s' },
  { id: 'bw_l_sit', name: 'SKILL: L-sit (tuck → full)', pat: 'skill', m: 'core', eq: ['bw'], d: 2, t: 's', hold: '10–20 s' },
  { id: 'bar_tuck_lever', name: 'SKILL: Tuck front lever hold', pat: 'skill', m: 'back', eq: ['bar'], d: 3, t: 's', hold: '8–15 s' },
  { id: 'bar_high_pull', name: 'SKILL: Explosive high pull-ups (muscle-up prep)', pat: 'skill', m: 'back', eq: ['bar'], d: 3, t: 's' }
];
export const LIB = Object.fromEntries(LIBRARY.map(e => [e.id, e]));

export const EQUIPMENT = {
  home: { label: 'Home gym', desc: 'Rack, barbell, dumbbells, bench, pull-up bar, hyper/leg machine', has: ['bb', 'db', 'bench', 'bar', 'dip', 'ham', 'bw'] },
  none: { label: 'No equipment', desc: 'Bodyweight only: becomes a calisthenics plan', has: ['bw'] },
  gym: { label: 'Full gym', desc: 'Gym membership: machines, cables, everything', has: ['bb', 'db', 'bench', 'bar', 'dip', 'ham', 'mach', 'cable', 'bw'] }
};
export const GOALS = {
  strength: { label: 'Get stronger', desc: 'Heavier lifts, lower reps' },
  muscle: { label: 'Build muscle', desc: 'Hypertrophy: moderate weight, more reps' },
  calisthenics: { label: 'Calisthenics skills', desc: 'Pull-ups, handstands, levers, bodyweight strength' },
  mix: { label: 'A mix', desc: 'Strength, muscle and bodyweight skills' }
};
export const FOCUS = {
  none: { label: 'Balanced', desc: 'No extra focus' },
  glutes: { label: 'Glutes', desc: 'Extra glute work on lower days' },
  legs: { label: 'Legs', desc: 'Extra quad and hamstring work' },
  upper: { label: 'Upper body', desc: 'Extra chest and shoulder work' },
  pullups: { label: 'Back & pull-ups', desc: 'Extra pulling, pull-up progressions' },
  arms: { label: 'Arms', desc: 'Extra biceps and triceps' },
  core: { label: 'Core', desc: 'Core work every session' }
};
export const EXPERIENCE = {
  beginner: { label: 'Beginner', desc: 'Under a year of consistent training' },
  intermediate: { label: 'Intermediate', desc: 'A year or more, know the main lifts' }
};
// RP-style weekly hard-set ranges [MEV, MRV] per muscle.
export const LANDMARKS = { chest: [8, 20], back: [10, 22], shoulders: [8, 22], biceps: [8, 20], triceps: [6, 18], quads: [8, 18], hams: [6, 16], glutes: [4, 16], calves: [8, 16], core: [4, 16] };
export const MUSCLE_LABELS = { chest: 'Chest', back: 'Back', shoulders: 'Shoulders', biceps: 'Biceps', triceps: 'Triceps', quads: 'Quads', hams: 'Hamstrings', glutes: 'Glutes', calves: 'Calves', core: 'Core' };

export const QUEST_PRESETS = [
  { id: 'workout', name: 'Work out', desc: "Complete today's training session.", xp: 100, trainingOnly: true, on: true, group: 'Daily' },
  { id: 'pushups', name: '100 push-ups', desc: 'Can be split across the day.', xp: 60, on: false, group: 'Daily' },
  { id: 'steps', name: 'Walk 8,000 steps', desc: 'Check it off when you hit it.', xp: 40, on: true, group: 'Daily' },
  { id: 'read', name: 'Read 10 pages', desc: 'Pages, not minutes.', xp: 40, on: false, group: 'Daily' },
  { id: 'mobility', name: '10 minutes of mobility', desc: 'Stretching or mobility work.', xp: 30, on: false, group: 'Daily' },
  { id: 'run', name: 'Go for a 1-mile run', desc: 'One mile, any pace.', xp: 60, on: false, group: 'Daily' },
  { id: 'protein', name: 'Hit your protein target', desc: 'Roughly 0.7–1 g per lb of bodyweight.', xp: 10, on: true, group: 'Nutrition' },
  { id: 'creatine', name: 'Take creatine (5 g)', desc: 'Daily dose taken.', xp: 8, on: true, group: 'Nutrition' },
  { id: 'water', name: 'Drink 24 oz of water', desc: 'One full bottle.', xp: 5, on: true, group: 'Nutrition' }
];


// ---------- split templates (pattern lists; * marks a main lift) ----------
const T = {
  fbA: { title: 'Full Body A', slots: ['squat*', 'hpush*', 'hpull', 'hamcurl', 'side', 'core'] },
  fbB: { title: 'Full Body B', slots: ['hinge*', 'vpush', 'vpull', 'lunge', 'bicep', 'tricep'] },
  fbC: { title: 'Full Body C', slots: ['squat', 'hpush', 'vpull', 'glute', 'rear', 'calf', 'core'] },
  upA: { title: 'Upper A', slots: ['hpush*', 'vpull', 'vpush', 'hpull', 'side', 'bicep', 'tricep'] },
  loA: { title: 'Lower A', slots: ['squat*', 'hinge', 'quadiso', 'hamcurl', 'calf', 'core'] },
  upB: { title: 'Upper B', slots: ['hpush', 'hpull', 'vpull', 'chestiso', 'rear', 'tricep', 'bicep'] },
  loB: { title: 'Lower B', slots: ['hinge*', 'lunge', 'glute', 'hamcurl', 'quadiso', 'core'] },
  push: { title: 'Push', slots: ['hpush', 'vpush', 'chestiso', 'side', 'tricep', 'tricep'] },
  pull: { title: 'Pull', slots: ['vpull', 'hpull', 'rear', 'bicep', 'bicep', 'core'] },
  legs: { title: 'Legs', slots: ['squat', 'hinge', 'glute', 'quadiso', 'hamcurl', 'calf'] }
};
const SPLITS = {
  3: [['Mon', 'fbA'], ['Wed', 'fbB'], ['Fri', 'fbC']],
  4: [['Mon', 'upA'], ['Tue', 'loA'], ['Thu', 'upB'], ['Fri', 'loB']],
  5: [['Mon', 'upA'], ['Tue', 'loA'], ['Wed', 'push'], ['Thu', 'pull'], ['Fri', 'legs']]
};
const UPPER = ['fbA', 'fbB', 'fbC', 'upA', 'upB', 'push', 'pull'];
const LOWER = ['fbA', 'fbB', 'fbC', 'loA', 'loB', 'legs'];
const FOCUS_ADD = {
  glutes: { days: LOWER, pats: ['glute'] },
  legs: { days: LOWER, pats: ['quadiso', 'hamcurl'] },
  upper: { days: UPPER, pats: ['chestiso', 'side'] },
  pullups: { days: UPPER, pats: ['vpull'] },
  arms: { days: UPPER, pats: ['bicep', 'tricep'] },
  core: { days: Object.keys(T), pats: ['core'] }
};
const FALLBACK = { vpull: 'hpull', chestiso: 'hpush', rear: 'hpull' };

function reps(e, goal, heavy) {
  if (e.hold) return e.hold;
  if (e.t === 's') return '3–5 reps';
  if (e.lift && (goal === 'strength' || goal === 'mix')) return heavy ? '3-5' : '6-8';
  if (e.t === 'c') {
    if (goal === 'strength') return '5-8';
    if (goal === 'calisthenics' && e.eq.includes('bw')) return '5-10';
    if (goal === 'calisthenics' && e.eq.includes('bar')) return '3-8';
    return '6-10';
  }
  return goal === 'strength' ? '8-12' : '10-15';
}

// Pick an exercise for a movement pattern from what the player has.
function pick(pat, ctx, main, used) {
  const ok = e => e.pat === pat && e.eq.every(q => ctx.has.includes(q)) && e.d <= ctx.maxD;
  let c = LIBRARY.filter(ok);
  if (!c.length && FALLBACK[pat]) return pick(FALLBACK[pat], ctx, main, used);
  if (!c.length) return null;
  const score = e => {
    let s = 0;
    if (main && e.lift && ctx.lifts) s += 50;
    if (ctx.goal === 'calisthenics' && (e.eq.includes('bw') || e.eq.includes('bar'))) s += 20;
    if (ctx.goal === 'muscle' && (e.eq.includes('cable') || e.eq.includes('mach') || e.eq.includes('db'))) s += e.t === 'i' ? 10 : 8;
    if (ctx.goal === 'strength' && e.eq.includes('bb')) s += 10;
    if (ctx.goal === 'mix' && e.eq.includes('bb') && e.t === 'c') s += 6;
    if (!main && e.lift) s -= 30;                          // keep the big lifts for their own slots
    if (e.eq.includes('ham') && ctx.has.includes('mach')) s -= 5; // gyms: prefer the gym's own machines
    if (ctx.focus === 'pullups' && e.pat === 'vpull' && e.eq.includes('bar')) s += 15;
    if (ctx.focus === 'glutes' && e.m === 'glutes') s += 5;
    // harder variations for experienced players, easier for beginners
    s += ctx.exp === 'beginner' ? [0, 6, 3, 0][e.d] : [0, 3, 6, 2][e.d];
    s -= (used[e.id] || 0) * 12;   // vary exercises across the week
    if (ctx.goal !== 'calisthenics' && e.eq.length === 1 && e.eq[0] === 'bw' && ctx.has.length > 2) s -= 15; // has gear: use it
    if (!e.eq.includes('bw') && !e.eq.includes('bar') && ctx.has.length === 1) s -= 100;
    return s;
  };
  c = c.sort((a, b) => score(b) - score(a));
  return c[0];
}

export function generatePlan(settings) {
  const { goal = 'mix', focus = 'none', equipment = 'home', days = 4, experience = 'beginner', pullupBar = false } = settings;
  const has = EQUIPMENT[equipment].has.slice();
  if (equipment === 'none' && pullupBar) has.push('bar');
  const ctx = { goal, focus, exp: experience, has, maxD: experience === 'beginner' ? 2 : 3, lifts: has.includes('bb') && goal !== 'calisthenics' && goal !== 'muscle' };
  if (goal === 'muscle' && has.includes('bb')) ctx.lifts = true;
  const maxEx = experience === 'beginner' ? 5 : 7;
  const used = {};
  const liftCount = {};
  const plan = { DAY_ORDER: [], DAYS: {}, targets: {}, settings: { goal, focus, equipment, days, experience, pullupBar } };

  SPLITS[days].forEach(([dname, key]) => {
    const tpl = T[key];
    let slots = tpl.slots.slice();
    const fa = FOCUS_ADD[focus];
    if (fa && fa.days.includes(key)) slots.splice(2, 0, ...fa.pats.map(p => p + '+'));
    if ((goal === 'calisthenics' || goal === 'mix') && UPPER.includes(key) && !LOWER.includes(key)) slots.unshift('skill');
    if ((goal === 'calisthenics') && LOWER.includes(key) && UPPER.includes(key)) slots.unshift('skill');
    slots = slots.slice(0, maxEx + (goal === 'calisthenics' ? 1 : 0));

    const ex = [];
    const seenToday = {};
    slots.forEach(slot => {
      const main = slot.endsWith('*'), extra = slot.endsWith('+');
      const pat = slot.replace(/[*+]$/, '');
      const e = pick(pat, ctx, main, Object.assign({}, used, seenToday));
      if (!e || seenToday[e.id]) return;
      seenToday[e.id] = 9; used[e.id] = (used[e.id] || 0) + 1;
      let heavy = true;
      if (e.lift) { liftCount[e.lift] = (liftCount[e.lift] || 0) + 1; heavy = liftCount[e.lift] === 1; }
      const base = (e.t === 'c' ? 3 : (experience === 'beginner' ? 2 : 3)) + (e.lift && experience !== 'beginner' ? 1 : 0) + (extra ? 0 : 0);
      ex.push({
        id: dname + '_' + e.id, lib: e.id, name: e.name + (e.lift && !heavy ? ' (light day)' : ''),
        sets: base, reps: reps(e, goal, heavy), rpe: e.t === 's' ? '7' : '8', m: e.m, lift: e.lift || undefined,
        t: e.t, prog: true, bw: e.eq.every(q => q === 'bw' || q === 'bar' || q === 'dip'), focus: extra || undefined
      });
    });
    plan.DAY_ORDER.push(dname);
    const hasMain = ex.find(x => x.lift);
    plan.DAYS[dname] = {
      title: tpl.title,
      hint: (hasMain ? hasMain.name.replace(' (light day)', '') + (hasMain.name.includes('light') ? ' light day: smooth reps, stop well short of failure. ' : ' is the main lift today: rest 2–3 minutes between sets. ') : '') +
        'Follow the week\'s target effort (RPE). Add weight or reps when you hit the top of the range.',
      ex
    };
  });
  const musc = {};
  Object.values(plan.DAYS).forEach(d => d.ex.forEach(e => { if (e.m) musc[e.m] = true; }));
  Object.keys(LANDMARKS).forEach(m => { if (musc[m]) plan.targets[m] = LANDMARKS[m]; });
  return plan;
}

// ---------- weekly progression inside a 5-week block ----------
// Weeks 1-4 build (sets and effort rise), week 5 is a deload.
export function blockWeek(week) { return ((week - 1) % 5) + 1; }
export function setsForWeek(e, week) {
  if (!e.prog) return e.sets;
  const w = blockWeek(week);
  if (w === 5) return Math.max(1, Math.ceil(e.sets / 2));
  if (w === 4) return e.sets + 1;
  if (w === 3 && e.t !== 'c') return e.sets + 1;
  return e.sets;
}
export function rpeForWeek(e, week) {
  if (!e.prog) return e.rpe;
  const w = blockWeek(week);
  if (e.t === 's') return w === 5 ? '5-6' : '7';
  return ['7', '7.5', '8', '9', '5-6'][w - 1];
}
export function swapOptions(e, has) {
  const lib = LIB[e.lib];
  if (!lib) return [];
  return LIBRARY.filter(x => x.pat === lib.pat && x.id !== lib.id && x.eq.every(q => has.includes(q))).slice(0, 3);
}
