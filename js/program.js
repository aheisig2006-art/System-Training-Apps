// Alaina's program (the default for anyone without a generated plan), plus the
// lookup that returns the active program for a player with their edits applied.
import { LIB, EQUIPMENT, setsForWeek, rpeForWeek, MUSCLE_LABELS } from './library.js';

export const DAY_ORDER = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
// pat = movement pattern, used to offer swaps from the exercise library
export const DAYS = {
  Mon: { title: 'Heavy Pull + Bench', hint: 'Main lifts. Deadlift and bench at RPE 8. Hold the top set at RPE 9 only when you are testing.', ex: [
    { id: 'dl', name: 'Deadlift', sets: 4, reps: '3-5', rpe: '8', lift: 'deadlift', m: 'back', pat: 'hinge' },
    { id: 'bp', name: 'Bench press', sets: 4, reps: '4-6', rpe: '8', lift: 'bench', m: 'chest', pat: 'hpush' },
    { id: 'pu', name: 'Pull-ups (add weight at 6 reps)', sets: 3, reps: '4-6', rpe: '8', m: 'back', pat: 'vpull', bw: true },
    { id: 'fp', name: 'Face pulls', sets: 3, reps: '12-15', rpe: '8', m: 'shoulders', pat: 'rear' }
  ]},
  Tue: { title: 'Light Deadlift + Upper Volume', hint: 'Deadlift variation at RPE 6–7 to open the day, then hypertrophy work and the calisthenics skill block.', ex: [
    { id: 'dls', name: 'Deadlift variation (RPE 6–7)', sets: 3, reps: '3-5', rpe: '6-7', m: 'back', pat: 'hinge', sug: 'deadlift' },
    { id: 'idb', name: 'Incline dumbbell press', sets: 3, reps: '8-12', rpe: '8', m: 'chest', pat: 'hpush' },
    { id: 'cr', name: 'Chest-supported row', sets: 3, reps: '10-12', rpe: '8', m: 'back', pat: 'hpull' },
    { id: 'lr', name: 'Lateral raise', sets: 3, reps: '12-15', rpe: '9', m: 'shoulders', pat: 'side' },
    { id: 'tp', name: 'Triceps pushdown', sets: 3, reps: '10-15', rpe: '9', m: 'triceps', pat: 'tricep' },
    { id: 'cu', name: 'Curls', sets: 3, reps: '8-10', rpe: '9', m: 'biceps', pat: 'bicep' },
    { id: 'pk', name: 'CALISTHENICS: Pike push-ups', sets: 4, reps: '5-8', rpe: '7', m: 'shoulders', pat: 'vpush', bw: true },
    { id: 'nr', name: 'CALISTHENICS: Negative pull-ups (5 sec down)', sets: 4, reps: '3-5', rpe: '8', m: 'back', pat: 'vpull', bw: true },
    { id: 'ab', name: 'Ab roller', sets: 3, reps: '6-8', rpe: '8', m: null, pat: 'core', bw: true }
  ]},
  Wed: { title: 'Heavy Squat + Lower Volume', hint: 'Squat is the main lift. Lower-body volume follows.', ex: [
    { id: 'sq', name: 'Squat', sets: 4, reps: '3-5', rpe: '8', lift: 'squat', m: 'quads', pat: 'squat' },
    { id: 'rdl', name: 'Romanian deadlift', sets: 3, reps: '8-10', rpe: '8', m: 'hams', pat: 'hinge' },
    { id: 'hs', name: 'Hack squat or leg press', sets: 3, reps: '10-12', rpe: '9', m: 'quads', pat: 'squat' },
    { id: 'lc', name: 'Lying leg curl', sets: 3, reps: '10-12', rpe: '9', m: 'hams', pat: 'hamcurl' },
    { id: 'be', name: 'Back extension', sets: 3, reps: '12-15', rpe: '9', m: 'hams', pat: 'hinge' },
    { id: 'cr2', name: 'Standing calf raise', sets: 3, reps: '10-15', rpe: '9', m: 'calves', pat: 'calf' }
  ]},
  Thu: { title: 'Bench Variation + Calisthenics', hint: 'Bench variation and back-off volume. Calisthenics skill block.', ex: [
    { id: 'cgb', name: 'Close-grip or paused bench', sets: 4, reps: '5-7', rpe: '7-8', m: 'triceps', pat: 'hpush' },
    { id: 'cf', name: 'Cable fly', sets: 3, reps: '12-15', rpe: '9', m: 'chest', pat: 'chestiso' },
    { id: 'ap', name: 'CALISTHENICS: Archer push-ups', sets: 3, reps: '4-6 /side', rpe: '8', m: 'chest', pat: 'hpush', bw: true },
    { id: 'rr', name: 'CALISTHENICS: Renegade rows', sets: 3, reps: '6 /side', rpe: '8', m: 'back', pat: 'hpull' },
    { id: 'ab2', name: 'Ab roller', sets: 3, reps: '6-8', rpe: '8', m: null, pat: 'core', bw: true },
    { id: 'chu', name: 'Chin-ups', sets: 3, reps: '4-6', rpe: '8', m: 'biceps', pat: 'vpull', bw: true },
    { id: 'hc', name: 'Hammer curls', sets: 2, reps: '8-10', rpe: '9', m: 'biceps', pat: 'bicep' },
    { id: 'oe', name: 'Overhead cable extension', sets: 2, reps: '12-15', rpe: '9', m: 'triceps', pat: 'tricep' }
  ]},
  Fri: { title: 'Light Squat + Legs', hint: 'Squat variation and leg work at RPE 6–7. No max attempts on Friday. If you are tired, drop to the minimum.', ex: [
    { id: 'sqv', name: 'Squat variation (RPE 6–7)', sets: 3, reps: '3-5', rpe: '6-7', m: 'quads', pat: 'squat', sug: 'squat' },
    { id: 'le', name: 'Leg extension', sets: 3, reps: '12-15', rpe: '9', m: 'quads', pat: 'quadiso' },
    { id: 'lc2', name: 'Seated leg curl', sets: 2, reps: '12-15', rpe: '9', m: 'hams', pat: 'hamcurl' },
    { id: 'bike', name: 'Bike cardio (optional, 15–20 min)', sets: 1, reps: '20 min', rpe: '6', m: null, bw: true }
  ]}
};
export const LIFTS = { deadlift: 'Deadlift', squat: 'Squat', bench: 'Bench' };
export const TARGETS = { chest: [10, 16], back: [12, 18], quads: [10, 14], hams: [10, 14], shoulders: [8, 14], triceps: [8, 12], biceps: [8, 12], calves: [6, 10] };
export const MUSCLE_NAMES = { chest: 'Chest', back: 'Back', quads: 'Quads', hams: 'Hamstrings / glutes', shoulders: 'Shoulders', triceps: 'Triceps', biceps: 'Biceps', calves: 'Calves', glutes: 'Glutes', core: 'Core' };
export const EX = {};
DAY_ORDER.forEach(d => DAYS[d].ex.forEach(e => { EX[e.id] = { ...e, day: d }; }));

// ---------- the active program for a player ----------
// Generated plans (welcome flow) live in profile.plan; everyone else uses the
// program above. profile.edits[exerciseId] = { swap: libraryId|null, removed, at }.
const cache = new Map();
export function getProgram(store) {
  const prof = (store && store.profile) || {};
  const plan = prof.plan && prof.plan.v && prof.plan.v.DAYS ? prof.plan.v : null;
  const edits = prof.edits || {};
  const key = (plan ? 'p' + prof.plan.at : 'default') + '|' + Object.keys(edits).map(k => k + edits[k].at).join(',');
  if (cache.has(key)) return cache.get(key);

  const base = plan || { DAY_ORDER, DAYS, targets: TARGETS };
  const has = plan ? hasFor(plan.settings) : EQUIPMENT.home.has;
  const days = {}, ex = {}, removed = [];
  base.DAY_ORDER.forEach(d => {
    const list = [];
    base.DAYS[d].ex.forEach(orig => {
      const ed = edits[orig.id];
      if (ed && ed.removed) { removed.push({ ...orig, day: d }); return; }
      let e = { ...orig, pat: orig.pat || (orig.lib && LIB[orig.lib] && LIB[orig.lib].pat), baseSets: orig.sets };
      if (ed && ed.sets) e.sets = Math.max(1, orig.sets + ed.sets);
      if (ed && ed.swap && LIB[ed.swap]) {
        const L = LIB[ed.swap];
        e = { ...e, lib: L.id, name: L.name, lift: L.lift, m: L.m || e.m, pat: L.pat, bw: L.eq.every(q => q === 'bw' || q === 'bar' || q === 'dip'),
          reps: L.hold || e.reps, swappedFrom: orig.name, sug: undefined };
      }
      list.push(e);
      ex[e.id] = { ...e, day: d };
    });
    days[d] = { ...base.DAYS[d], ex: list };
  });
  // keep removed exercises findable so their logged history still counts
  removed.forEach(r => { if (!ex[r.id]) ex[r.id] = { ...r, removed: true }; });
  const p = {
    DAY_ORDER: base.DAY_ORDER, DAYS: days, EX: ex, removed, has,
    TARGETS: plan ? (plan.targets || {}) : TARGETS,
    NAMES: plan ? MUSCLE_LABELS : MUSCLE_NAMES,
    generated: !!plan && !plan.imported, imported: !!(plan && plan.imported), custom: !!plan, settings: plan ? plan.settings : null
  };
  if (cache.size > 20) cache.clear();
  cache.set(key, p);
  return p;
}
export function hasFor(settings) {
  if (!settings) return EQUIPMENT.home.has;
  const has = EQUIPMENT[settings.equipment].has.slice();
  if (settings.equipment === 'none' && settings.pullupBar) has.push('bar');
  return has;
}
export function setsFor(e, week) { return setsForWeek(e, week); }
export function rpeFor(e, week) { return rpeForWeek(e, week); }
