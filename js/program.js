// Training program (Phase 1 keeps the current program; Phase 2 rebuilds it around the home gym).
export const DAY_ORDER = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
export const DAYS = {
  Mon: { title: 'Heavy Pull + Bench', hint: 'Main lifts. Deadlift and bench at RPE 8. Hold the top set at RPE 9 only when you are testing.', ex: [
    { id: 'dl', name: 'Deadlift', sets: 4, reps: '3-5', rpe: '8', lift: 'deadlift', m: 'back', start: '205–215 lb' },
    { id: 'bp', name: 'Bench press', sets: 4, reps: '4-6', rpe: '8', lift: 'bench', m: 'chest', start: '90 lb' },
    { id: 'pu', name: 'Pull-ups (add weight at 6 reps)', sets: 3, reps: '4-6', rpe: '8', m: 'back' },
    { id: 'fp', name: 'Face pulls', sets: 3, reps: '12-15', rpe: '8', m: 'shoulders' }
  ]},
  Tue: { title: 'Upper Volume + Calisthenics', hint: 'Hypertrophy work at moderate loads. Calisthenics skill block.', ex: [
    { id: 'idb', name: 'Incline dumbbell press', sets: 3, reps: '8-12', rpe: '8', m: 'chest' },
    { id: 'cr', name: 'Chest-supported row', sets: 3, reps: '10-12', rpe: '8', m: 'back' },
    { id: 'lr', name: 'Lateral raise', sets: 3, reps: '12-15', rpe: '9', m: 'shoulders' },
    { id: 'tp', name: 'Triceps pushdown', sets: 3, reps: '10-15', rpe: '9', m: 'triceps' },
    { id: 'cu', name: 'Curls', sets: 3, reps: '8-10', rpe: '9', m: 'biceps' },
    { id: 'pk', name: 'CALISTHENICS: Pike push-ups', sets: 4, reps: '5-8', rpe: '7', m: 'shoulders' },
    { id: 'nr', name: 'CALISTHENICS: Negative pull-ups (5 sec down)', sets: 4, reps: '3-5', rpe: '8', m: 'back' },
    { id: 'ab', name: 'Ab roller', sets: 3, reps: '6-8', rpe: '8', m: null }
  ]},
  Wed: { title: 'Heavy Squat + Lower Volume', hint: 'Squat is the main lift. Lower-body volume follows.', ex: [
    { id: 'sq', name: 'Squat', sets: 4, reps: '3-5', rpe: '8', lift: 'squat', m: 'quads', start: '130 lb' },
    { id: 'rdl', name: 'Romanian deadlift', sets: 3, reps: '8-10', rpe: '8', m: 'hams' },
    { id: 'hs', name: 'Hack squat or leg press', sets: 3, reps: '10-12', rpe: '9', m: 'quads' },
    { id: 'lc', name: 'Lying leg curl', sets: 3, reps: '10-12', rpe: '9', m: 'hams' },
    { id: 'be', name: 'Back extension', sets: 3, reps: '12-15', rpe: '9', m: 'hams' },
    { id: 'cr2', name: 'Standing calf raise', sets: 3, reps: '10-15', rpe: '9', m: 'calves' }
  ]},
  Thu: { title: 'Bench Variation + Calisthenics', hint: 'Bench variation and back-off volume. Calisthenics skill block.', ex: [
    { id: 'cgb', name: 'Close-grip or paused bench', sets: 4, reps: '5-7', rpe: '7-8', m: 'triceps' },
    { id: 'cf', name: 'Cable fly', sets: 3, reps: '12-15', rpe: '9', m: 'chest' },
    { id: 'ap', name: 'CALISTHENICS: Archer push-ups', sets: 3, reps: '4-6 /side', rpe: '8', m: 'chest' },
    { id: 'rr', name: 'CALISTHENICS: Renegade rows', sets: 3, reps: '6 /side', rpe: '8', m: 'back' },
    { id: 'ab2', name: 'Ab roller', sets: 3, reps: '6-8', rpe: '8', m: null },
    { id: 'chu', name: 'Chin-ups', sets: 3, reps: '4-6', rpe: '8', m: 'biceps' },
    { id: 'hc', name: 'Hammer curls', sets: 2, reps: '8-10', rpe: '9', m: 'biceps' },
    { id: 'oe', name: 'Overhead cable extension', sets: 2, reps: '12-15', rpe: '9', m: 'triceps' }
  ]},
  Fri: { title: 'Light Lower + Posterior', hint: 'Keep this at RPE 6–7. No max attempts on Friday. If you are tired, drop to the minimum.', ex: [
    { id: 'dls', name: 'Deadlift variation (RPE 6–7)', sets: 3, reps: '3-5', rpe: '6-7', m: 'back' },
    { id: 'ht', name: 'Hip thrust', sets: 3, reps: '8-10', rpe: '8', m: 'hams' },
    { id: 'le', name: 'Leg extension', sets: 3, reps: '12-15', rpe: '9', m: 'quads' },
    { id: 'lc2', name: 'Seated leg curl', sets: 2, reps: '12-15', rpe: '9', m: 'hams' },
    { id: 'bike', name: 'Bike cardio (optional, 15–20 min)', sets: 1, reps: '20 min', rpe: '6', m: null }
  ]}
};
export const LIFTS = { deadlift: 'Deadlift', squat: 'Squat', bench: 'Bench' };
export const TARGETS = { chest: [10, 16], back: [12, 18], quads: [10, 14], hams: [10, 14], shoulders: [8, 14], triceps: [8, 12], biceps: [8, 12], calves: [6, 10] };
export const MUSCLE_NAMES = { chest: 'Chest', back: 'Back', quads: 'Quads', hams: 'Hamstrings / glutes', shoulders: 'Shoulders', triceps: 'Triceps', biceps: 'Biceps', calves: 'Calves' };
export const EX = {};
DAY_ORDER.forEach(d => DAYS[d].ex.forEach(e => { EX[e.id] = { ...e, day: d }; }));
