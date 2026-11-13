// Pure game logic. Nothing here touches the page or storage: every total is
// recalculated from the saved records, so two devices that hold the same
// records always show the same XP, level and streak.
import { EX as DEFAULT_EX, getProgram, setsFor } from './program.js';
import { LIBRARY } from './library.js';

export const QUESTS = [
  { id: 'read',     name: 'Read 10 pages',           desc: 'Pages, not minutes.',           xp: 40,  group: 'Daily' },
  { id: 'workout',  name: 'Work out',                desc: 'Full session.',                 xp: 100, group: 'Daily' },
  { id: 'pushups',  name: '100 push-ups',            desc: 'Can be split across the day.',  xp: 60,  group: 'Daily' },
  { id: 'steps',    name: 'Walk 8,000 steps',        desc: 'Check it off when you hit it.', xp: 40,  group: 'Daily' },
  { id: 'protein',  name: 'Hit your protein target', desc: 'Protein target met.',           xp: 10,  group: 'Nutrition' },
  { id: 'creatine', name: 'Take creatine (5 g)',     desc: 'Daily dose taken.',             xp: 8,   group: 'Nutrition' },
  { id: 'water',    name: 'Drink 24 oz of water',    desc: 'One full bottle.',              xp: 5,   group: 'Nutrition' }
];
// Always on for every player, even if their saved list predates them.
export const MANDATORY_QUESTS = ['protein', 'creatine', 'water'];
export const RULES = {
  BONUS_XP: 100,        // all quests cleared in a day
  MISSED_XP: 20,        // per missed (ghosted) weekday or unrested day
  EXTRA_REST_XP: 50,    // each weekday rest beyond the free one per week
  STREAK_BONUS: 40,     // every STREAK_EVERY consecutive cleared days
  STREAK_EVERY: 5,
  SET_XP: 10, SESSION_XP: 75, PR_XP: 50,
  HP_MAX: 100,
  HP_MISSED: 10,        // per missed (ghosted) weekday, alongside the XP loss
  HP_EXTRA_REST: 5,     // per paid extra rest day
  HP_CLEAR: 5           // regained on each cleared day
};
export const TITLES = { E: 'None', D: 'Hunter in training', C: 'Proven hunter', B: 'Elite hunter', A: 'National-level hunter', S: 'Shadow monarch in the making' };

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
// Quest ids that have been retired; dropped from saved lists.
const RETIRED_QUESTS = ['sleep'];
export function getQuests(store) {
  const stored = pv(store, 'quests', null);
  if (!Array.isArray(stored) || !stored.length) return QUESTS;
  const byId = Object.fromEntries(QUESTS.map(q => [q.id, q]));
  const kept = stored.filter(q => !RETIRED_QUESTS.includes(q.id));
  const have = new Set(kept.map(q => q.id));
  const merged = kept.map(q => byId[q.id] ? { ...q, ...byId[q.id] } : q);
  MANDATORY_QUESTS.forEach(id => { if (!have.has(id)) merged.push(byId[id]); });
  return merged;
}
// Quests that count on a given day ("Work out" only on training days for generated plans).
export function questsFor(store, key) {
  const prog = getProgram(store);
  return getQuests(store).filter(q => !(q.trainingOnly || q.id === 'workout') || prog.DAY_ORDER.includes(dayName(key)));
}
export function dayRec(store, key) { return (store.days && store.days[key]) || {}; }
export function isChecked(store, key, qid) {
  const c = dayRec(store, key).checks;
  if (c && c[qid] && c[qid].done) return true;
  return potionClears(store, key).has(qid);
}
export function liveSets(store) {
  const out = [];
  const weeks = store.weeks || {};
  Object.keys(weeks).forEach(w => {
    const sets = weeks[w].sets || {};
    Object.keys(sets).forEach(k => {
      const s = sets[k];
      if (s && !s.del) {
        const [ex, i] = k.split('|');
        out.push({ week: +w, ex, i: i === 'pr' ? 'pr' : +i, wt: s.wt, reps: s.reps, rpe: s.rpe, ts: s.ts, lift: s.lift, lib: s.lib });
      }
    });
  });
  return out;
}
export function setAt(store, week, exId, i) {
  const w = store.weeks && store.weeks[week];
  const s = w && w.sets && w.sets[exId + '|' + i];
  return s && !s.del ? s : null;
}
function flag(store, week, kind, key) {
  const w = store.weeks && store.weeks[week];
  const f = w && w[kind] && w[kind][key];
  return !!(f && f.on);
}
export const isSkipped = (store, week, exId) => flag(store, week, 'skips', exId);
export const isLowDay = (store, week, day) => flag(store, week, 'low', day);
export const isPrAttempt = (store, week, exId) => flag(store, week, 'pr', exId);
export const MAX_SKIPS = 2;
// The main lift (or the first exercise of the day) can't be skipped.
export function canSkip(day, e) { return !e.lift && day.ex[0] !== e; }
export function skipsUsed(store, week, day) { return day.ex.filter(e => isSkipped(store, week, e.id)).length; }
// Sets required today, after low-recovery mode.
export function plannedSets(store, e, week, dayName) {
  const n = setsFor(e, week);
  return isLowDay(store, week, dayName) ? Math.max(1, Math.ceil(n * 2 / 3)) : n;
}
export function liftOf(s, EX) { return s.lift !== undefined ? s.lift : (EX[s.ex] && EX[s.ex].lift); }
export const e1rm = (wt, reps) => wt * (1 + reps / 30);
// An entered PR is a single: its weight is the 1RM. No date, so it does not expire.
export function prE1RM(pr) {
  if (!pr || !(pr.wt > 0)) return 0;
  return pr.wt;
}
// Working weight for a target: invert Epley, so the top rep target at the target RPE lands on the estimate.
// Reps in reserve = 10 - RPE; a deload's lower RPE gives a lighter load automatically.
export function suggestWeight(est1rm, repsText, rpeText) {
  if (!est1rm) return null;
  const nums = s => (String(s || '').match(/\d+(\.\d+)?/g) || []).map(Number);
  const top = nums(repsText).slice(-1)[0] || 5;
  const r = nums(rpeText);
  const rpe = r.length ? r.reduce((a, b) => a + b, 0) / r.length : 8;
  const toFailure = top + (10 - rpe);
  return Math.round(est1rm / (1 + toFailure / 30) / 5) * 5;
}

// Training XP events, each with a timestamp: sets, PRs (judged in the order they
// were logged), and cleared sessions (dated by the set that completed them).
export function trainingEvents(store) {
  const prog = getProgram(store);
  const EX = prog.EX;
  const sets = liveSets(store).sort((a, b) => a.ts - b.ts);
  const events = [];
  const best = {};
  const fx = potionEffects(store);
  sets.forEach(s => {
    events.push({ ts: s.ts, xp: RULES.SET_XP, kind: 'set' });
    const lift = liftOf(s, EX);
    if (lift && s.reps <= 12 && s.wt > 0) {
      const v = e1rm(s.wt, s.reps);
      if ((best[lift] || 0) > 0 && v > best[lift] + 0.5) events.push({ ts: s.ts, xp: RULES.PR_XP, kind: 'pr' });
      best[lift] = Math.max(best[lift] || 0, v);
    }
  });
  const weeks = new Set(sets.map(s => s.week));
  weeks.forEach(w => {
    prog.DAY_ORDER.forEach(d => {
      let last = 0, ok = true;
      let logged = 0;
      prog.DAYS[d].ex.forEach(e => {
        if (isSkipped(store, w, e.id)) return;
        for (let i = 0; i < plannedSets(store, e, w, d); i++) {
          const s = setAt(store, w, e.id, i);
          const br = fx.breaks.get(w + '|' + e.id + '|' + i);
          if (s) { last = Math.max(last, s.ts); logged++; }
          else if (br) last = Math.max(last, br);   // removed by a Set Break potion
          else ok = false;
        }
      });
      if (!logged) ok = false;
      if (ok) events.push({ ts: last, xp: RULES.SESSION_XP, kind: 'session', week: w, day: d });
    });
  });
  return events;
}

// ---------- potions ----------
// Stored as profile records named potion:<id>, so they sync with everything else.
// A potion's type is rolled once, when it is granted, and kept with the record.
export const POTIONS = {
  minor:    { name: 'Minor potion', xp: 25 },
  major:    { name: 'Major potion', xp: 50 },
  clear:    { name: 'Clear potion' },
  setbreak: { name: 'Set Break potion' }
};
const POTION_ODDS = [['minor', 35], ['major', 25], ['clear', 20], ['setbreak', 20]];
export const POTION_CAP = 3;
export const RANK_LEVELS = [5, 10, 15, 20, 30];
export function rollPotion(r = Math.random()) {
  let x = r * 100;
  for (const [type, w] of POTION_ODDS) { x -= w; if (x < 0) return type; }
  return POTION_ODDS[POTION_ODDS.length - 1][0];
}
export function potionRecs(store) {
  const out = {};
  Object.keys(store.profile || {}).forEach(k => {
    if (k.indexOf('potion:') === 0 && store.profile[k]) out[k.slice(7)] = store.profile[k];
  });
  return out;
}
export function potionStock(store) {
  const recs = potionRecs(store);
  return Object.keys(recs).map(id => ({ id, ...recs[id] })).filter(p => !p.wasted && !p.used);
}
// What the potions already used have done: XP by day, quests cleared by day, sets removed (with the time).
export function potionEffects(store) {
  const xpByDay = {}, clears = {}, breaks = new Map();
  const recs = potionRecs(store);
  Object.keys(recs).forEach(id => {
    const p = recs[id];
    if (!p || p.wasted || !p.used) return;
    const u = p.used, def = POTIONS[p.type] || {};
    if (def.xp) xpByDay[u.day] = (xpByDay[u.day] || 0) + def.xp;
    if (u.quest) (clears[u.day] = clears[u.day] || new Set()).add(u.quest);
    if (u.set) breaks.set(u.set, u.at);
  });
  return { xpByDay, clears, breaks };
}
export function potionClears(store, key) { return potionEffects(store).clears[key] || new Set(); }
// What is owed since the last check: one per cleared day (from the start of potions on),
// one per new level, two per rank-up. Fixed ids mean nothing is granted twice.
export function potionGrants(store, g, today) {
  const from = pv(store, 'potionsFrom', null);
  if (!from) return { setup: today, grants: [], level: g.level };
  const have = potionRecs(store);
  const grants = [];
  g.log.forEach(e => {
    const id = 'day:' + e.date;
    if (e.status === 'cleared' && e.date >= from && !have[id]) grants.push(id);
  });
  const prev = pv(store, 'potionLevel', g.level);
  for (let L = prev + 1; L <= g.level; L++) {
    grants.push('lvl:' + L);
    if (RANK_LEVELS.includes(L)) grants.push('rank:' + L + ':1', 'rank:' + L + ':2');
  }
  return { setup: null, grants, level: Math.max(prev, g.level) };
}

// ---------- the whole game state ----------
export function compute(store, today = dateKey(), now = Date.now()) {
  const restart = pv(store, 'restart', null);              // {date, ts}
  const startDate = restart ? restart.date : pv(store, 'startDate', today);
  const startTs = restart ? restart.ts : pv(store, 'startTs', 0);
  const base = restart ? { xp: 0, streak: 0, days: 0, penalty: false } : pv(store, 'baseline', { xp: 0, streak: 0, days: 0, penalty: false });

  const fx = potionEffects(store);
  // training XP grouped by local day, only after the starting point
  const tByDay = {};
  trainingEvents(store).forEach(ev => {
    if (ev.ts <= startTs || ev.ts > now + 864e5) return;
    const k = dateKey(new Date(ev.ts));
    tByDay[k] = (tByDay[k] || 0) + ev.xp;
  });

  let total = base.xp, streak = base.streak, days = base.days;
  let hp = RULES.HP_MAX, deathOn = null;
  let lastMissed = base.penalty ? addDays(startDate, -1) : null;
  let lastPenaltyClear = null;
  let failedOn = null;
  const restsByWeek = {};
  const log = [];
  let todayInfo = null;

  for (let d = startDate; d <= today; d = addDays(d, 1)) {
    const rec = dayRec(store, d);
    const dayQuests = questsFor(store, d);
    const doneIds = getQuests(store).filter(q => isChecked(store, d, q.id)).map(q => q.id);
    const allDone = dayQuests.every(q => doneIds.includes(q.id));
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
    else if (d === startDate) status = 'grace';   // the first day never costs anything
    else status = 'missed';

    let delta = getQuests(store).filter(q => doneIds.includes(q.id)).reduce((a, q) => a + q.xp, 0) + (tByDay[d] || 0) + (fx.xpByDay[d] || 0);
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

    let hpDelta = 0;
    if (status === 'cleared') hpDelta = RULES.HP_CLEAR;
    else if (status === 'missed') hpDelta = -RULES.HP_MISSED;
    if (paidRest) hpDelta -= RULES.HP_EXTRA_REST;
    hp = Math.min(RULES.HP_MAX, Math.max(0, hp + hpDelta));
    if (hp === 0 && hpDelta < 0 && !deathOn) deathOn = d;

    const before = total;
    total = Math.max(0, total + delta);
    if (total === 0 && delta < 0 && before >= 0) failedOn = d;
    log.push({ date: d, status, delta, paidRest, streakBonus, hp });

    if (d === today) {
      todayInfo = {
        status, doneIds, allDone, declaredRest, paidRest, questIds: dayQuests.map(q => q.id),
        weekend: isWeekend(d),
        restUsedThisWeek: (restsByWeek[wk] || 0) - (declaredRest ? 1 : 0)
      };
    }
  }
  if (!todayInfo) todayInfo = { status: 'open', questIds: questsFor(store, today).map(q => q.id), doneIds: [], allDone: false, declaredRest: false, paidRest: false, weekend: isWeekend(today), restUsedThisWeek: 0 };

  const lv = levelFromTotal(total);
  const failAck = pv(store, 'failAck', null);
  return {
    total, ...lv, rank: rankOf(lv.level), title: TITLES[rankOf(lv.level)],
    hp, maxHp: RULES.HP_MAX, dead: !!deathOn, deathDate: deathOn,
    stats: statusStats(store, today),
    streak, days, log, today: todayInfo, startDate,
    penaltyOpen: !!lastMissed && !(lastPenaltyClear && lastPenaltyClear > lastMissed),
    failed: !!failedOn && failAck !== failedOn ? failedOn : null,
    restCostToday: todayInfo.weekend ? 0 : (todayInfo.restUsedThisWeek >= 1 ? RULES.EXTRA_REST_XP : 0)
  };
}

// ---------- status: attributes and fatigue ----------
// Both are recalculated from saved records, like XP. Neither awards XP.
const BODYWEIGHT_EQ = ['bw', 'bar', 'dip'];
const VERTICAL_OR_PRESS = ['vpull', 'vpush', 'hpush', 'hpull'];
// Which attributes one logged set feeds. Loaded work feeds STR. Bodyweight work feeds AGI,
// and bodyweight pulls and presses (pull-ups, dips, push-ups) feed both.
export function attrsOfSet(s, EX) {
  const lib = s.lib ? LIBRARY.find(x => x.id === s.lib) : null;
  const ex = EX[s.ex] || {};
  const pat = lib ? lib.pat : ex.pat;
  const bw = lib ? lib.eq.every(q => BODYWEIGHT_EQ.includes(q)) : !!ex.bw;
  if (!bw) return { str: true, agi: false };
  if (VERTICAL_OR_PRESS.includes(pat)) return { str: true, agi: true };
  return { str: false, agi: true };
}
// Cardio minutes feed VITALITY: 2 points a minute easy, 3 hard.
export const cardioPoints = c => (c && c.min > 0 ? c.min * (c.hard ? 3 : 2) : 0);
// Attribute levels reuse the hunter curve. One level unit is 10 points, so STR counts reps.
const attrLevel = points => { const L = levelFromTotal(Math.floor(points / 10)); return { points, level: L.level, xp: L.xp, need: L.need }; };
const FATIGUE_DECAY = 0.75, FATIGUE_REST_DECAY = 0.5, FATIGUE_PER_LOAD = 2;
// Load per day: a hard set (RPE 8+) is 1, any other logged set 0.5, each 10 min of cardio 1 (2 when hard),
// and each day of the first week after a period starts adds 1. Fatigue = decayed yesterday + 2 x load.
export function fatigueLabel(v) { return v < 35 ? 'Low' : v < 65 ? 'Moderate' : 'High'; }
export function statusStats(store, today = dateKey()) {
  const EX = getProgram(store).EX;
  const pts = { str: 0, agi: 0, vit: 0 };
  const load = {};
  const addLoad = (d, v) => { if (d) load[d] = (load[d] || 0) + v; };
  liveSets(store).forEach(s => {
    const reps = +s.reps || 0;
    if (reps > 0) {
      const a = attrsOfSet(s, EX);
      if (a.str) pts.str += reps;
      if (a.agi) pts.agi += reps;
    }
    if (s.ts) addLoad(dateKey(new Date(s.ts)), +s.rpe >= 8 ? 1 : 0.5);
  });
  const days = store.days || {};
  Object.keys(days).forEach(d => {
    const c = days[d] && days[d].cardio;
    if (c && c.min > 0) { pts.vit += cardioPoints(c); addLoad(d, c.min / 10 * (c.hard ? 2 : 1)); }
  });
  const starts = periodStarts(store);
  const inPeriodWeek = d => starts.some(s => { const k = diffDays(s, d); return k >= 0 && k < 7; });
  const keys = [...Object.keys(load), ...Object.keys(days), ...starts].sort();
  let f = 0;
  if (keys.length) {
    for (let d = keys[0]; d <= today; d = addDays(d, 1)) {
      const day = (load[d] || 0) + (inPeriodWeek(d) ? 1 : 0);
      const rec = dayRec(store, d);
      const restDay = !!(rec.rest && rec.rest.on) || (isWeekend(d) && !load[d]);
      const decay = !day && restDay ? FATIGUE_REST_DECAY : FATIGUE_DECAY;
      f = Math.min(100, f * decay + day * FATIGUE_PER_LOAD);
    }
  }
  const fatigue = Math.round(f);
  return {
    str: attrLevel(pts.str), agi: attrLevel(pts.agi), vit: attrLevel(pts.vit),
    fatigue: { value: fatigue, label: fatigueLabel(fatigue) },
    cardioToday: days[today] && days[today].cardio && days[today].cardio.min > 0 ? days[today].cardio : null
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
      if (!s || !DEFAULT_EX[ex]) return;
      store.weeks[w] = store.weeks[w] || { sets: {} };
      store.weeks[w].sets[ex + '|' + i] = { ex, wt: s.wt, reps: s.reps, rpe: s.rpe || 0, ts: s.ts || at - 1, del: false, at };
    });
  }

  P('startDate', today);
  P('startTs', now);
  P('baseline', { xp: Math.max(0, questTotal + trainingTotal), streak, days, penalty });
  return store;
}

// ---------- cycle ----------
// Period start dates are logged as days[date].period = {on, at}. Cycle length is
// the average of the recent gaps (28 until there are two starts). The no-max
// window runs from mid-PMS (about 5 days before the next period) through day 7.
function diffDays(a, b) { return Math.round((parse(b) - parse(a)) / 864e5); }
export function periodStarts(store) {
  return Object.keys(store.days || {}).filter(d => store.days[d].period && store.days[d].period.on).sort();
}
export function cycleInfo(store, today = dateKey()) {
  const starts = periodStarts(store).filter(d => d <= today);
  const on = pv(store, 'cycle', starts.length > 0);
  if (!on) return { on: false, asked: !!(store.profile && store.profile.cycle) };
  if (!starts.length) return { on: true, known: false };
  const gaps = [];
  for (let i = Math.max(1, starts.length - 6); i < starts.length; i++) {
    const g = diffDays(starts[i - 1], starts[i]);
    if (g >= 18 && g <= 45) gaps.push(g);
  }
  const manual = pv(store, 'cycleLen', null);
  const length = gaps.length ? Math.round(gaps.reduce((a, b) => a + b, 0) / gaps.length) : (manual || 28);
  const last = starts[starts.length - 1];
  const day = diffDays(last, today) + 1;
  const nextStart = addDays(last, length);
  const pmsFrom = length - 4;
  let phase, noMax = false, heavyFrom = null;
  if (day <= 7) { phase = 'Period week'; noMax = true; heavyFrom = addDays(last, 7); }
  else if (day >= pmsFrom && day <= length + 7) { phase = day > length ? 'Period due' : 'Pre-period'; noMax = true; heavyFrom = addDays(nextStart, 7); }
  else if (day >= length - 7) { phase = 'Early pre-period'; }
  else { phase = 'Strong window'; }
  // history: each logged start with the length of the cycle that followed it
  const history = starts.slice(-6).map((d, i, arr) => ({ date: d, length: i < arr.length - 1 ? diffDays(d, arr[i + 1]) : null })).reverse();
  return { on: true, known: true, day, length, phase, noMax, heavyFrom, nextStart, lastStart: last, estimated: !gaps.length, manual: !gaps.length && !!manual, pmsFrom, history,
    noMaxFrom: addDays(last, pmsFrom - 1) };
}
