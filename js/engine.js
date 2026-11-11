// Pure game logic. Nothing here touches the page or storage: every total is
// recalculated from the saved records, so two devices that hold the same
// records always show the same XP, level and streak.
import { DAYS, DAY_ORDER, EX } from './program.js';

export const QUESTS = [
  { id: 'read',    name: 'Read 10 pages',             desc: 'Pages, not minutes.',                       xp: 40 },
  { id: 'workout', name: 'Work out',                  desc: 'Full session.',                             xp: 100 },
  { id: 'water',   name: 'Drink 24 oz of water',      desc: 'One full bottle.',                          xp: 20 },
  { id: 'pushups', name: '100 push-ups',              desc: 'Can be split across the day.',              xp: 60 },
  { id: 'protein', name: 'Hit protein + supplements', desc: 'Protein target met, creatine and supplements taken.', xp: 40 }
];
export const RULES = {
  BONUS_XP: 100,        // all quests cleared in a day
  MISSED_XP: 20,        // per missed (ghosted) weekday or unrested day
  EXTRA_REST_XP: 50,    // each weekday rest beyond the free one per week
  STREAK_BONUS: 40,     // every STREAK_EVERY consecutive cleared days
  STREAK_EVERY: 5,
  SET_XP: 10, SESSION_XP: 75, PR_XP: 50
};
export const TITLES = { E: 'Lowest of the low', D: 'Hunter in training', C: 'Proven hunter', B: 'Elite hunter', A: 'National-level hunter', S: 'Shadow monarch in the making' };

// ---------- dates (local time, YYYY-MM-DD) ----------
export function dateKey(d = new Date()) {
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}
function parse(key) { const [y, m, d] = key.split('-').map(Number); return new Date(y, m - 1, d); }
export function addDays(key, n) { const d = parse(key); d.setDate(d.getDate() + n); return dateKey(d); }
export function weekday(key) { return parse(key).getDay(); } // 0 = Sunday
export function isWeekend(key) { const w = weekday(key); return w === 0 || w === 6; }
export function weekStart(key) { const w = weekday(key); return addDays(key, w === 0 ? -6 : 1 - w); } // Monday
export function dayName(key) { return ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][weekday(key)]; }

// ---------- levels ----------
export const cumulative = L => 50 * L * (L - 1);          // total XP needed to reach level L
export function levelFromTotal(total) {
  let L = 1;
  while (total >= cumulative(L + 1)) L++;
  return { level: L, xp: total - cumulative(L), need: 100 * L };
}
export function rankOf(l) { return l >= 30 ? 'S' : l >= 20 ? 'A' : l >= 15 ? 'B' : l >= 10 ? 'C' : l >= 5 ? 'D' : 'E'; }

// ---------- record helpers ----------
export function pv(store, field, dflt) {
  const leaf = store.profile && store.profile[field];
  return leaf && leaf.v !== undefined ? leaf.v : dflt;
}
export function dayRec(store, key) { return (store.days && store.days[key]) || {}; }
export function isChecked(store, key, qid) {
  const c = dayRec(store, key).checks;
  return !!(c && c[qid] && c[qid].done);
}
export function liveSets(store) {
  const out = [];
  const weeks = store.weeks || {};
  Object.keys(weeks).forEach(w => {
    const sets = weeks[w].sets || {};
    Object.keys(sets).forEach(k => {
      const s = sets[k];
      if (s && !s.del) { const [ex, i] = k.split('|'); out.push({ week: +w, ex, i: +i, wt: s.wt, reps: s.reps, rpe: s.rpe, ts: s.ts }); }
    });
  });
  return out;
}
export function setAt(store, week, exId, i) {
  const w = store.weeks && store.weeks[week];
  const s = w && w.sets && w.sets[exId + '|' + i];
  return s && !s.del ? s : null;
}
export const e1rm = (wt, reps) => wt * (1 + reps / 30);

// Training XP events, each with a timestamp: sets, PRs (judged in the order they
// were logged), and cleared sessions (dated by the set that completed them).
export function trainingEvents(store) {
  const sets = liveSets(store).sort((a, b) => a.ts - b.ts);
  const events = [];
  const best = {};
  sets.forEach(s => {
    events.push({ ts: s.ts, xp: RULES.SET_XP, kind: 'set' });
    const lift = EX[s.ex] && EX[s.ex].lift;
    if (lift && s.reps <= 12) {
      const v = e1rm(s.wt, s.reps);
      if ((best[lift] || 0) > 0 && v > best[lift] + 0.5) events.push({ ts: s.ts, xp: RULES.PR_XP, kind: 'pr' });
      best[lift] = Math.max(best[lift] || 0, v);
    }
  });
  const weeks = new Set(sets.map(s => s.week));
  weeks.forEach(w => {
    DAY_ORDER.forEach(d => {
      let last = 0, ok = true;
      DAYS[d].ex.forEach(e => {
        for (let i = 0; i < e.sets; i++) {
          const s = setAt(store, w, e.id, i);
          if (!s) ok = false; else last = Math.max(last, s.ts);
        }
      });
      if (ok) events.push({ ts: last, xp: RULES.SESSION_XP, kind: 'session', week: w, day: d });
    });
  });
  return events;
}

// ---------- the whole game state ----------
export function compute(store, today = dateKey(), now = Date.now()) {
  const restart = pv(store, 'restart', null);              // {date, ts}
  const startDate = restart ? restart.date : pv(store, 'startDate', today);
  const startTs = restart ? restart.ts : pv(store, 'startTs', 0);
  const base = restart ? { xp: 0, streak: 0, days: 0, penalty: false } : pv(store, 'baseline', { xp: 0, streak: 0, days: 0, penalty: false });

  // training XP grouped by local day, only after the starting point
  const tByDay = {};
  trainingEvents(store).forEach(ev => {
    if (ev.ts <= startTs || ev.ts > now + 864e5) return;
    const k = dateKey(new Date(ev.ts));
    tByDay[k] = (tByDay[k] || 0) + ev.xp;
  });

  let total = base.xp, streak = base.streak, days = base.days;
  let lastMissed = base.penalty ? addDays(startDate, -1) : null;
  let lastPenaltyClear = null;
  let failedOn = null;
  const restsByWeek = {};
  const log = [];
  let todayInfo = null;

  for (let d = startDate; d <= today; d = addDays(d, 1)) {
    const rec = dayRec(store, d);
    const doneIds = QUESTS.filter(q => isChecked(store, d, q.id)).map(q => q.id);
    const allDone = doneIds.length === QUESTS.length;
    const declaredRest = !!(rec.rest && rec.rest.on) && !isWeekend(d);
    const wk = weekStart(d);
    let paidRest = false;
    if (declaredRest) {
      restsByWeek[wk] = (restsByWeek[wk] || 0) + 1;
      paidRest = restsByWeek[wk] > 1;
    }
    if (rec.penaltyClear && rec.penaltyClear.on) lastPenaltyClear = d;

    let status;
    if (declaredRest) status = 'rest';
    else if (allDone) status = 'cleared';
    else if (d === today) status = 'open';
    else if (isWeekend(d)) status = 'rest';
    else status = 'missed';

    let delta = QUESTS.filter(q => doneIds.includes(q.id)).reduce((a, q) => a + q.xp, 0) + (tByDay[d] || 0);
    let streakBonus = false;
    if (status === 'cleared') {
      delta += RULES.BONUS_XP;
      streak++; days++;
      if (streak % RULES.STREAK_EVERY === 0) { delta += RULES.STREAK_BONUS; streakBonus = true; }
    } else if (status === 'missed') {
      delta -= RULES.MISSED_XP;
      streak = 0;
      lastMissed = d;
    }
    if (paidRest) delta -= RULES.EXTRA_REST_XP;

    const before = total;
    total = Math.max(0, total + delta);
    if (total === 0 && delta < 0 && before >= 0) failedOn = d;
    log.push({ date: d, status, delta, paidRest, streakBonus });

    if (d === today) {
      todayInfo = {
        status, doneIds, allDone, declaredRest, paidRest,
        weekend: isWeekend(d),
        restUsedThisWeek: (restsByWeek[wk] || 0) - (declaredRest ? 1 : 0)
      };
    }
  }
  if (!todayInfo) todayInfo = { status: 'open', doneIds: [], allDone: false, declaredRest: false, paidRest: false, weekend: isWeekend(today), restUsedThisWeek: 0 };

  const lv = levelFromTotal(total);
  const failAck = pv(store, 'failAck', null);
  return {
    total, ...lv, rank: rankOf(lv.level), title: TITLES[rankOf(lv.level)],
    streak, days, log, today: todayInfo, startDate,
    penaltyOpen: !!lastMissed && !(lastPenaltyClear && lastPenaltyClear > lastMissed),
    failed: !!failedOn && failAck !== failedOn ? failedOn : null,
    restCostToday: todayInfo.weekend ? 0 : (todayInfo.restUsedThisWeek >= 1 ? RULES.EXTRA_REST_XP : 0)
  };
}

// ---------- migration from the two old apps ----------
// questsOld: 'solo-leveling-tracker-v1', trainingOld: 'workout-tracker-v1'
export function migrateLegacy(questsOld, trainingOld, today = dateKey(), now = Date.now()) {
  const at = now;
  const store = { v: 2, profile: {}, days: {}, weeks: {} };
  const P = (k, v) => { store.profile[k] = { v, at }; };
  let questTotal = 0, streak = 0, days = 0, penalty = false;

  if (questsOld && typeof questsOld.level === 'number') {
    questTotal = cumulative(questsOld.level) + (questsOld.xp || 0);
    streak = questsOld.streak || 0;
    days = questsOld.days || 0;
    penalty = !!questsOld.penalty;
    const done = questsOld.done || {};
    const allDone = QUESTS.every(q => done[q.id]);
    if (questsOld.dayKey === today) {
      // today's ticks move over as records; their XP leaves the baseline so it isn't counted twice
      QUESTS.forEach(q => {
        if (done[q.id]) {
          store.days[today] = store.days[today] || { checks: {} };
          store.days[today].checks[q.id] = { done: true, at };
          questTotal -= q.xp;
        }
      });
      if (questsOld.bonus) questTotal -= RULES.BONUS_XP;
    } else if (questsOld.dayKey && questsOld.dayKey < today) {
      // the old app would have settled that last day on its next open
      if (allDone) { streak++; days++; }
      else { questTotal -= RULES.MISSED_XP; streak = 0; penalty = true; }
    }
    if (questsOld.name) P('name', questsOld.name);
  }

  let trainingTotal = 0;
  if (trainingOld && typeof trainingOld.level === 'number') {
    trainingTotal = cumulative(trainingOld.level) + (trainingOld.xp || 0);
    P('week', trainingOld.week || 1);
    const sets = trainingOld.sets || {};
    Object.keys(sets).forEach(k => {
      const [w, ex, i] = k.split('|');
      const s = sets[k];
      if (!s || !EX[ex]) return;
      store.weeks[w] = store.weeks[w] || { sets: {} };
      store.weeks[w].sets[ex + '|' + i] = { ex, wt: s.wt, reps: s.reps, rpe: s.rpe || 0, ts: s.ts || at - 1, del: false, at };
    });
  }

  P('startDate', today);
  P('startTs', now);
  P('baseline', { xp: Math.max(0, questTotal + trainingTotal), streak, days, penalty });
  return store;
}
