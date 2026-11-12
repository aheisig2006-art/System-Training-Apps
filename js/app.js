import { RULES, compute, dateKey, dayName, addDays, pv, isChecked, liveSets, setAt, e1rm, trainingEvents, levelFromTotal, questsFor, migrateLegacy,
  isSkipped, isLowDay, isPrAttempt, canSkip, skipsUsed, plannedSets, MAX_SKIPS, liftOf, cycleInfo } from './engine.js';
import { LIFTS, getProgram, rpeFor } from './program.js';
import { LIBRARY, generatePlan, GOALS, FOCUS, EQUIPMENT, EXPERIENCE, QUEST_PRESETS, blockWeek } from './library.js';
import { loadStore, saveStore, putLeaf, mergeStore, local, setLocal } from './store.js';
import { CHARACTERS, characterArt } from './characters.js';
import { parseProgram, pdfToText, makeExercise, refreshTargets, ALL_DAYS } from './importer.js';
import { APP_VERSION, WHATS_NEW } from './version.js';

let { store } = loadStore();
let sync = null;                 // the sync module, once loaded
let syncState = 'loading', syncUser = null;
let today = dateKey();
let game = compute(store, today);
let regIndex = 0;
let regOpen = false;
let view = local().view || 'quests';
let trainDay = null;             // chosen from the player's program
let swapOpen = null;             // exercise id with the swap list open
let wiz = null;                  // welcome flow state
let emailOpen = false;
let ed = null;                   // plan editor: { plan, origin: 'profile' | 'wizard', note }
let imp = null;                  // program import screen: { text, busy, msg }

const $ = id => document.getElementById(id);
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const prettyDate = key => { const [y, m, d] = key.split('-').map(Number); return new Date(y, m - 1, d).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' }); };
const round5 = x => Math.round(x / 5) * 5;

// ---------- changes ----------
function commit(path, leaf) {
  const before = game, evBefore = countEvents();
  if (!putLeaf(store, path, leaf)) return;
  saveStore(store);
  if (sync) sync.push(path, leaf);
  refresh();
  celebrate(before, evBefore);
}
function commitMany(list) {
  list.forEach(([path, leaf]) => { if (putLeaf(store, path, leaf) && sync) sync.push(path, leaf); });
  saveStore(store);
  refresh();
}
function setProfile(field, v) { commit(['profile', field], { v, at: Date.now() }); }
function hasProgress() {
  const b = pv(store, 'baseline', { xp: 0 });
  return (b && b.xp > 0) || Object.keys(store.days || {}).length > 0 || Object.keys(store.weeks || {}).length > 0;
}

function countEvents() {
  const ev = trainingEvents(store);
  return { pr: ev.filter(e => e.kind === 'pr').length, session: ev.filter(e => e.kind === 'session').length };
}
function celebrate(before, evBefore) {
  const ev = countEvents();
  if (game.rank !== before.rank && game.level > before.level) return flash('RANK UP\n' + game.rank + '-RANK', true);
  if (game.level > before.level) return flash('LEVEL ' + game.level);
  if (ev.pr > evBefore.pr) return flash('NEW PR\n+' + RULES.PR_XP + ' XP', true);
  if (ev.session > evBefore.session) return flash('SESSION CLEARED');
  if (game.today.allDone && !before.today.allDone) {
    return flash(game.streak && game.streak % RULES.STREAK_EVERY === 0 ? 'DAY CLEARED\n' + game.streak + '-DAY STREAK +' + RULES.STREAK_BONUS + ' XP' : 'DAY CLEARED');
  }
}
function flash(text, big) {
  const f = $('flash');
  $('flashText').textContent = text;
  f.classList.toggle('big', !!big);
  f.classList.remove('on'); void f.offsetWidth; f.classList.add('on');
}

function refresh() {
  today = dateKey();
  game = compute(store, today);
  render();
}

// ---------- rendering ----------
function render() {
  renderHunter();
  document.querySelectorAll('.tab[data-view]').forEach(t => t.classList.toggle('on', t.dataset.view === view));
  if (view === 'quests') renderQuests();
  else if (view === 'training') renderTraining();
  else renderProfile();
  renderOverlay();
}

function syncLabel() {
  return { loading: 'LOCAL', 'signed-out': 'LOCAL', unavailable: 'LOCAL', syncing: 'SYNCING', synced: 'SYNCED', offline: 'OFFLINE', error: 'SYNC ERROR' }[syncState] || 'LOCAL';
}

function renderHunter() {
  const ch = CHARACTERS.find(c => c.id === pv(store, 'character', null));
  $('hunter').innerHTML =
    '<div class="hunter">' +
      '<div class="avatar">' + (ch ? characterArt(ch, 64) : '') + '</div>' +
      '<div class="who"><div class="hname">' + esc(pv(store, 'name', '') || 'Unnamed hunter') + '</div><div class="lvl">' + esc(game.title) + '</div></div>' +
      '<div style="text-align:right"><div class="rank">' + game.rank + '</div><div class="lvl">LEVEL ' + game.level + '</div></div>' +
    '</div>' +
    '<div class="bar"><div class="fill" style="width:' + Math.min(100, game.xp / game.need * 100) + '%"></div></div>' +
    '<div class="stats"><span>XP <b>' + game.xp + ' / ' + game.need + '</b></span><span>Streak <b>' + game.streak + '</b></span><span>Days cleared <b>' + game.days + '</b></span>' +
    '<span class="sync sync-' + syncState + '">' + syncLabel() + '</span></div>';
}

function renderQuests() {
  const t = game.today;
  const prog = getProgram(store);
  let html = '';
  if (game.penaltyOpen) {
    html += '<div class="panel penalty"><h1>&#9888; Penalty Zone</h1>' +
      '<p class="note">You missed a day. −' + RULES.MISSED_XP + ' XP per missed day was deducted and your streak reset. Complete the penalty to clear the mark.</p>' +
      '<button class="quest" data-action="penalty"><span class="box"></span><span class="qt"><span class="n">50 squats + 5-minute walk</span><span class="d">Penalty quest. No XP reward.</span></span></button></div>';
  }
  let restLine;
  if (t.declaredRest) restLine = '<div class="restbox on"><b>Rest day.</b> Every quest is excused today' + (t.paidRest ? ' (−' + RULES.EXTRA_REST_XP + ' XP, extra rest day this week)' : ' (free rest day this week)') + '. Your streak is safe. <button class="btn sm" data-action="unrest">Cancel rest day</button></div>';
  else if (t.weekend) restLine = '<div class="restbox on"><b>Weekend: automatic rest day.</b> Quests are optional. Clear them all and it still counts toward your streak.</div>';
  else restLine = '<div class="restbox"><button class="btn" data-action="rest">Take a rest day</button> <span class="note">' + (game.restCostToday ? 'Free rest day used this week. This one costs −' + RULES.EXTRA_REST_XP + ' XP.' : 'Free: your one weekday rest day this week.') + '</span></div>';

  html += '<div class="panel"><h1>Daily Quests · ' + esc(dayName(today)) + '</h1>' +
    '<p class="note">Resets at midnight. A missed weekday costs −' + RULES.MISSED_XP + ' XP and breaks your streak.</p>' + restLine;
  if (prog.custom && !prog.DAY_ORDER.includes(dayName(today)) && !t.weekend && !t.declaredRest) {
    html += '<p class="note">No training scheduled today, so "Work out" is off the list.</p>';
  }
  const dayQuests = questsFor(store, today);
  dayQuests.forEach(q => {
    const d = isChecked(store, today, q.id);
    html += '<button class="quest' + (d ? ' done' : '') + '" data-action="quest" data-id="' + esc(q.id) + '" aria-pressed="' + d + '">' +
      '<span class="box">' + (d ? '&#10003;' : '') + '</span>' +
      '<span class="qt"><span class="n">' + esc(q.name) + '</span><span class="d">' + esc(q.desc || '') + '</span></span>' +
      '<span class="xp">+' + q.xp + ' XP</span></button>';
  });
  const doneCount = dayQuests.filter(q => t.doneIds.includes(q.id)).length;
  html += '<div class="foot"><span>' + doneCount + ' / ' + dayQuests.length + ' complete</span><span>' +
    (t.allDone ? 'Day cleared: +' + RULES.BONUS_XP + ' XP' : 'Clear all for +' + RULES.BONUS_XP + ' XP') + '</span></div>' +
    '<p class="note" style="margin-top:8px">Every ' + RULES.STREAK_EVERY + ' cleared days in a row: +' + RULES.STREAK_BONUS + ' XP.</p></div>';

  const recent = game.log.slice(-14);
  if (recent.length > 1) {
    html += '<div class="panel"><h1>Record</h1><div class="days">' + recent.map(r =>
      '<div class="dcell ' + r.status + '" title="' + r.date + ': ' + r.status + (r.delta ? ' (' + (r.delta > 0 ? '+' : '') + r.delta + ' XP)' : '') + '"><span>' + dayName(r.date)[0] + '</span></div>').join('') +
      '</div><div class="legend"><span class="dcell cleared"></span>cleared <span class="dcell rest"></span>rest <span class="dcell missed"></span>missed <span class="dcell open"></span>today</div></div>';
  }
  $('view').innerHTML = html;
}

function bestE1RM(lift) {
  const EX = getProgram(store).EX;
  let best = 0;
  liveSets(store).forEach(s => { if (liftOf(s, EX) === lift && s.reps <= 12 && s.wt > 0) best = Math.max(best, e1rm(s.wt, s.reps)); });
  return best;
}
// Last logged set of the same exercise (matched across days and swaps).
function lastSetFor(e) {
  const EX = getProgram(store).EX;
  let best = null;
  liveSets(store).forEach(s => {
    const same = e.lib ? (s.lib ? s.lib === e.lib : EX[s.ex] && EX[s.ex].lib === e.lib && !EX[s.ex].swappedFrom) : (s.ex === e.id && !s.lib);
    if (same && s.i !== 'pr' && (!best || s.ts > best.ts)) best = s;
  });
  return best;
}
const upper = reps => { const n = String(reps).match(/\d+/g); return n ? +n[n.length - 1] : 0; };

function cycleHtml(ci, compact) {
  if (!ci.on) return '';
  const loggedToday = !!(store.days[today] && store.days[today].period && store.days[today].period.on);
  const btn = loggedToday
    ? '<button class="btn sm" data-action="periodundo">Logged today · undo</button>'
    : '<button class="btn sm" data-action="period">Period started today</button>';
  if (!ci.known) return '<div class="panel cyc"><h1>Cycle</h1><p class="note">Log the first day of your period and the System plans heavy work around it.</p>' + btn + '</div>';
  const msg = ci.noMax
    ? '<div class="cycwarn">No max-effort work right now: top sets at RPE 8 or below, no PR attempts. Heavy work is back on from <b>' + prettyDate(ci.heavyFrom) + '</b>.</div>'
    : (ci.phase === 'Strong window' ? '<div class="cycgo">Green light: a good window for heavy work and PR attempts.</div>' : '<div class="cycgo">Heavy work is fine. The no-max window starts around ' + prettyDate(addDays(ci.lastStart, ci.length - 5)) + '.</div>');
  return '<div class="panel cyc"><h1>Cycle</h1><div class="cycrow"><span>Day <b>' + ci.day + '</b> of ~' + ci.length + ' · ' + ci.phase + '</span>' + btn + '</div>' + msg +
    (ci.estimated && !compact ? '<p class="note" style="margin-top:8px">Cycle length is assumed to be 28 days until you log your next start.</p>' : '') + '</div>';
}

function renderTraining() {
  const prog = getProgram(store);
  const week = pv(store, 'week', 1);
  if (!trainDay || !prog.DAY_ORDER.includes(trainDay)) {
    const saved = local().trainDay;
    trainDay = prog.DAY_ORDER.includes(dayName(today)) ? dayName(today) : (prog.DAY_ORDER.includes(saved) ? saved : prog.DAY_ORDER[0]);
  }
  const day = prog.DAYS[trainDay];
  const bw = blockWeek(week);
  const deload = prog.generated ? bw === 5 : (prog.imported ? false : week % 5 === 0);
  const low = isLowDay(store, week, trainDay);
  const ci = cycleInfo(store, today);
  const used = skipsUsed(store, week, day);

  let html = cycleHtml(ci) + '<div class="panel"><h1>Weekly Split</h1>' +
    '<div class="weekrow">Week <b>' + week + '</b> <button class="btn sm" data-action="week" data-d="-1" aria-label="Previous week">−</button> <button class="btn sm" data-action="week" data-d="1" aria-label="Next week">+</button></div>' +
    (prog.generated ? '<p class="note">Block week ' + bw + ' of 5 · ' + (bw === 5 ? 'deload' : bw === 4 ? 'peak week: hardest effort' : 'building: sets and effort rise each week') + '</p>' : '') +
    '<div class="tabs">' + prog.DAY_ORDER.map(d => '<button class="tab' + (d === trainDay ? ' on' : '') + '" data-action="tday" data-d="' + d + '">' + d + '</button>').join('') + '</div>' +
    (deload ? '<div class="deload">Deload week. Take about half the sets, stay around RPE 5–6, and do not test maxes.</div>' : '') +
    '<div class="dayname">' + trainDay + ': ' + esc(day.title) + '</div><div class="dayhint">' + esc(day.hint) + '</div>' +
    '<div class="daytools"><button class="btn sm' + (low ? ' on' : '') + '" data-action="low" aria-pressed="' + low + '">' + (low ? '✓ Low-recovery day' : 'Low-recovery day') + '</button>' +
    '<span class="note">' + (low ? 'Sets cut by a third. The session still counts.' : 'Slept badly or still sore? Cuts every exercise to about 2/3 of the sets.') + '</span></div>' +
    '<p class="note">Skips used today: ' + used + ' / ' + MAX_SKIPS + '</p>';

  day.ex.forEach((e, idx) => {
    const nSets = plannedSets(store, e, week, trainDay), rpe = rpeFor(e, week);
    const skipped = isSkipped(store, week, e.id);
    const pr = !!e.lift && isPrAttempt(store, week, e.id);
    const last = lastSetFor(e);
    let lastHtml = '';
    if (last && !skipped) {
      const hit = upper(e.reps) && last.reps >= upper(e.reps) && last.rpe <= 8 && e.lift;
      lastHtml = '<div class="last">Last: <b>' + (last.wt > 0 ? last.wt + ' × ' : 'BW × ') + last.reps + '</b> @ ' + last.rpe +
        (hit ? ' <span class="hint">&rarr; top of range at RPE 8 or below. Add 5 lb next time.</span>' : '') + '</div>';
    }
    const skippable = canSkip(day, e);
    let tools = '<div class="tools">' +
      '<button class="btn xs" data-action="swapopen" data-ex="' + e.id + '">' + (swapOpen === e.id ? 'Close' : 'Swap') + '</button>' +
      (skipped ? '<button class="btn xs" data-action="unskip" data-ex="' + e.id + '">Unskip</button>'
        : (skippable ? '<button class="btn xs" data-action="skip" data-ex="' + e.id + '"' + (used >= MAX_SKIPS ? ' disabled title="2 skips used"' : '') + '>Skip today</button>' : '<span class="tag">main lift: no skip</span>')) +
      (e.lift ? '<button class="btn xs' + (pr ? ' on' : '') + '" data-action="pr" data-ex="' + e.id + '">' + (pr ? '✓ PR attempt' : 'Go for a PR') + '</button>' : '') +
      '</div>';
    if (swapOpen === e.id) {
      const opts = LIBRARY.filter(x => x.pat && x.pat === e.pat && x.id !== e.lib && x.name.toLowerCase() !== e.name.toLowerCase() && x.eq.every(q => prog.has.includes(q))).sort((a, b) => a.d - b.d);
      tools += '<div class="swaplist"><p class="note">Swap for the rest of your plan (logged sets stay in your history):</p>' +
        (opts.length ? opts.map(o => '<button class="opt sm" data-action="swapto" data-ex="' + e.id + '" data-lib="' + o.id + '">' + esc(o.name) + '</button>').join('') : '<p class="note">No alternatives for this one with your equipment.</p>') +
        (e.swappedFrom ? '<button class="opt sm" data-action="swapto" data-ex="' + e.id + '" data-lib="">Back to original: ' + esc(e.swappedFrom) + '</button>' : '') + '</div>';
    }
    let rows = '';
    if (skipped) rows = '<p class="note skipnote">Skipped today. Doesn\'t block the session clear.</p>';
    else {
      for (let i = 0; i < nSets; i++) rows += setRow(e, week, i, 'Set ' + (i + 1));
      if (pr) {
        const best = bestE1RM(e.lift);
        rows += '<div class="prbox"><b>PR attempt.</b> Warm up, then work up to one heavy single.' +
          (best ? ' Your best estimated max is <b>' + Math.round(best) + ' lb</b>. A single at <b>' + round5(best + 5) + ' lb</b> or more is a new PR.' : ' Log it and it becomes your baseline.') +
          (ci.on && ci.noMax ? '<div class="cycwarn">Your cycle window says no max effort until ' + prettyDate(ci.heavyFrom) + '. Your call.</div>' : '') +
          setRow(e, week, 'pr', 'PR') + '</div>';
      }
    }
    const heavyNote = (ci.on && ci.noMax && e.lift && !skipped && !pr) ? '<div class="cycnote">Cycle window: keep the top set at RPE 8 or below today.</div>' : '';
    html += '<div class="ex' + (skipped ? ' skipped' : '') + '"><div class="exh"><span class="exn">' + esc(e.name) + '</span><span class="tgt">' + nSets + ' × ' + esc(e.reps) + (rpe ? ' @ RPE ' + rpe : '') + '</span></div>' +
      (e.swappedFrom ? '<div class="exm">Swapped from ' + esc(e.swappedFrom) + '</div>' : '') +
      (e.start ? '<div class="exm">Starting: ' + e.start + '</div>' : '') +
      (e.m ? '<div class="exm">' + esc(prog.NAMES[e.m] || e.m) + (e.focus ? ' · focus' : '') + (e.bw ? ' · bodyweight' : '') + '</div>' : '') +
      tools + heavyNote + lastHtml + rows + '</div>';
  });
  html += '<p class="note">+' + RULES.SET_XP + ' XP per set · +' + RULES.SESSION_XP + ' XP for a full session · +' + RULES.PR_XP + ' XP for a new PR</p></div>';

  const lifts = Object.keys(LIFTS).filter(l => Object.values(prog.EX).some(e => e.lift === l) || bestE1RM(l) > 0);
  if (lifts.length) {
    html += '<div class="panel"><h1>Big Three (estimated 1RM)</h1><p class="note">Epley: weight × (1 + reps / 30). Best logged set, all weeks.</p>' +
      lifts.map(l => { const v = bestE1RM(l); return '<div class="prow"><span>' + LIFTS[l] + '</span><span>' + (v ? '<b>' + Math.round(v) + ' lb</b> <span class="muted">est. 1RM</span>' : '<span class="muted">no sets logged</span>') + '</span></div>'; }).join('') + '</div>';
  }

  const counts = {};
  liveSets(store).forEach(s => { if (s.week !== week || s.i === 'pr') return; const e = prog.EX[s.ex]; const m = s.lib ? (LIBRARY.find(x => x.id === s.lib) || {}).m : e && e.m; if (m) counts[m] = (counts[m] || 0) + 1; });
  html += '<div class="panel"><h1>Weekly Volume (hard sets per muscle)</h1>' + (prog.generated ? '<p class="note">Ranges are minimum effective to maximum recoverable sets per week (Renaissance Periodization).</p>' : '') + Object.keys(prog.TARGETS).map(m => {
    const [lo, hi] = prog.TARGETS[m]; const c = counts[m] || 0;
    return '<div class="vrow"><div class="vhead"><span>' + esc(prog.NAMES[m] || m) + '</span><span>' + c + ' / ' + lo + '–' + hi + ' sets</span></div><div class="vbar"><div class="vfill' + (c >= lo ? ' ok' : '') + '" style="width:' + Math.min(100, c / hi * 100) + '%"></div></div></div>';
  }).join('') + '</div>';

  // keep numbers typed into unlogged sets when the screen redraws
  const typed = {};
  document.querySelectorAll('#view .set[data-ex] input').forEach(inp => { if (inp.value) typed[inp.closest('.set').dataset.ex + '|' + inp.closest('.set').dataset.i + '|' + inp.name] = inp.value; });
  $('view').innerHTML = html;
  document.querySelectorAll('#view .set[data-ex] input').forEach(inp => {
    const k = inp.closest('.set').dataset.ex + '|' + inp.closest('.set').dataset.i + '|' + inp.name;
    if (typed[k]) inp.value = typed[k];
  });
}
function setRow(e, week, i, label) {
  const s = setAt(store, week, e.id, i);
  if (s) return '<div class="set done"><span>' + label + '</span><span>' + (s.wt > 0 ? s.wt + ' × ' : 'BW × ') + s.reps + ' @ ' + s.rpe + '</span><button class="btn sm red" data-action="undo" data-ex="' + e.id + '" data-i="' + i + '">undo</button></div>';
  return '<div class="set" data-ex="' + e.id + '" data-i="' + i + '"><span class="lab">' + label + '</span>' +
    '<input name="wt" type="number" inputmode="decimal" placeholder="' + (e.bw ? '+lb' : 'lb') + '" aria-label="' + (e.bw ? 'Added weight (optional)' : 'Weight') + ', ' + label + '">' +
    '<input name="reps" type="number" inputmode="numeric" placeholder="reps" aria-label="Reps, ' + label + '">' +
    '<input name="rpe" type="number" inputmode="decimal" placeholder="RPE" step="0.5" min="1" max="10" aria-label="RPE, ' + label + '">' +
    '<button class="btn sm" data-action="log">Log</button></div>';
}

function authBox() {
  return '<div class="authbox"><button class="btn primary" data-action="signin">Sign in with Google</button>' +
    '<button class="linkbtn" data-action="emailtoggle">' + (emailOpen ? 'Hide email sign-in' : 'Use email instead') + '</button>' +
    (emailOpen ? '<div class="emailform"><label class="note" for="authEmail">Email</label><input id="authEmail" name="email" type="email" autocomplete="email">' +
      '<label class="note" for="authPw">Password</label><input id="authPw" name="password" type="password" autocomplete="current-password" minlength="6">' +
      '<div class="row"><button class="btn primary" data-action="emailsignin">Sign in</button><button class="btn" data-action="emailsignup">Create account</button></div>' +
      '<button class="linkbtn" data-action="emailreset">Forgot password?</button></div>' : '') +
    '<p class="note err authmsg" role="status"></p></div>';
}
function authMsg(text, ok) { document.querySelectorAll('.authmsg').forEach(el => { el.textContent = text; el.classList.toggle('ok', !!ok); }); }
async function runAuth(fn, okText) {
  if (!sync) { authMsg('Sync is still loading. Try again in a moment.'); return; }
  authMsg('');
  try { await fn(); if (okText) authMsg(okText, true); }
  catch (err) {
    const code = (err && err.code) || '';
    const m = {
      'auth/operation-not-allowed': 'Email sign-in isn\'t switched on yet (Firebase setting).',
      'auth/invalid-credential': 'Email or password is wrong.', 'auth/wrong-password': 'Email or password is wrong.', 'auth/user-not-found': 'No account with that email. Tap Create account.',
      'auth/email-already-in-use': 'That email already has an account. Tap Sign in.', 'auth/weak-password': 'Password needs at least 6 characters.',
      'auth/invalid-email': 'That email doesn\'t look right.', 'auth/popup-closed-by-user': 'The sign-in window was closed.', 'auth/popup-blocked': 'The browser blocked the sign-in window. Allow pop-ups and try again.',
      'auth/network-request-failed': 'No connection. Try again when you\'re online.'
    }[code];
    authMsg(m || ('Sign-in did not finish: ' + (code.replace('auth/', '') || err.message || err)));
  }
}

function renderProfile() {
  const ch = CHARACTERS.find(c => c.id === pv(store, 'character', null));
  const prog = getProgram(store);
  const st = prog.settings;
  let acct;
  if (syncUser) acct = '<p>Signed in as <b>' + esc(syncUser.email) + '</b>. Progress syncs across every device signed in to this account.</p><button class="btn" data-action="signout">Sign out</button>';
  else if (syncState === 'unavailable') acct = '<p class="note">Sync could not load. Check your connection and reopen the app.</p>';
  else acct = '<p class="note">Signed out: progress is saved on this device only.</p>' + authBox();
  const ci = cycleInfo(store, today);
  const removed = prog.removed;
  $('view').innerHTML =
    '<div class="panel"><h1>Hunter</h1><div class="prof">' + (ch ? characterArt(ch, 96) : '') +
      '<div><label class="note" for="nameInput">Hunter name</label><input id="nameInput" maxlength="20" value="' + esc(pv(store, 'name', '')) + '"><br>' +
      '<button class="btn sm" data-action="register" style="margin-top:8px">Change character</button></div></div></div>' +
    '<div class="panel"><h1>Your Plan</h1><p class="note">' +
      (prog.generated && st ? 'Built from your answers: ' + esc(GOALS[st.goal].label) + ' · ' + esc(FOCUS[st.focus].label) + ' · ' + esc(EQUIPMENT[st.equipment].label) + ' · ' + st.days + ' days/week · ' + esc(EXPERIENCE[st.experience].label) + '.'
        : prog.imported ? 'Your own program, ' + prog.DAY_ORDER.length + ' days a week.' : 'Your original program, ' + prog.DAY_ORDER.length + ' days a week.') +
      ' Logged history and XP stay when you change it.</p>' +
      '<div class="row"><button class="btn" data-action="editplan">Edit my plan</button><button class="btn" data-action="importplan">Paste or upload a program</button></div></div>' +
    '<div class="panel"><h1>Cycle-Aware Scheduling</h1><p class="note">Track period start dates. The System flags the no-max-effort window (mid-PMS through period week) and tells you when heavy work is back on.</p>' +
      '<label class="switch"><input type="checkbox" id="cycleToggle"' + (ci.on ? ' checked' : '') + '> <span>' + (ci.on ? 'On' : 'Off') + '</span></label>' +
      (ci.on ? '<div class="row"><label class="note" for="pastPeriod" style="align-self:center">Log a past start:</label><input id="pastPeriod" type="date" max="' + today + '" style="width:auto"><button class="btn sm" data-action="pastperiod">Add</button></div>' : '') + '</div>' +
    (removed.length ? '<div class="panel"><h1>Removed Exercises</h1>' + removed.map(r => '<div class="prow"><span>' + esc(r.day) + ': ' + esc(r.name) + '</span><button class="btn sm" data-action="restore" data-ex="' + r.id + '">Restore</button></div>').join('') + '</div>' : '') +
    '<div class="panel"><h1>Account &amp; Sync</h1>' + acct + '</div>' +
    '<div class="panel"><h1>New Players</h1><p class="note">See exactly what a friend goes through the first time they open the app. Nothing is saved.</p><button class="btn" data-action="preview">Preview new-player setup</button></div>' +
    '<div class="panel"><h1>Backup</h1><p class="note">Your progress lives in the cloud once you sign in. A backup file is extra insurance: export one every month or so.</p>' +
      '<div class="row"><button class="btn" data-action="export">Export backup</button><label class="btn" for="importFile">Import backup</label><input type="file" id="importFile" accept="application/json" hidden></div></div>' +
    '<div class="panel"><h1>Danger Zone</h1><p class="note">Restart wipes your level, XP and streak. Training history and PRs are kept.</p><button class="btn red" data-action="restart">Restart from Level 1</button></div>' +
    '<p class="ver">SYSTEM v' + APP_VERSION + '</p>';
}

// ---------- welcome flow for new players ----------
function newWizard(preview) {
  regIndex = 0;
  return {
    preview, step: 0,
    d: { name: preview ? '' : pv(store, 'name', ''), character: CHARACTERS[0].id, goal: null, focus: null, equipment: null, pullupBar: false, days: null, experience: null, cycle: null,
      quests: new Set(QUEST_PRESETS.filter(q => q.on).map(q => q.id)), custom: [] }
  };
}
function wizSteps() {
  const s = [];
  if (!wiz.preview && !syncUser) s.push('start');
  s.push('hunter', 'source');
  if (wiz.d.source === 'own') s.push('equipment', 'import');
  else s.push('goal', 'focus', 'equipment', 'days', 'experience');
  s.push('cycle', 'quests', 'plan');
  return s;
}
function wizSettings() {
  const d = wiz.d;
  return { goal: d.goal, focus: d.focus, equipment: d.equipment, days: d.days, experience: d.experience, pullupBar: d.equipment === 'none' && d.pullupBar };
}
function optCards(key, defs, cur) {
  return '<div class="opts">' + Object.keys(defs).map(k =>
    '<button class="opt' + (String(cur) === String(k) ? ' on' : '') + '" data-action="wizpick" data-k="' + key + '" data-v="' + k + '" aria-pressed="' + (String(cur) === String(k)) + '"><b>' + esc(defs[k].label) + '</b><span>' + esc(defs[k].desc) + '</span></button>').join('') + '</div>';
}
function renderWizard(o) {
  const steps = wizSteps();
  if (wiz.step >= steps.length) wiz.step = steps.length - 1;
  const step = steps[wiz.step];
  const d = wiz.d;
  const typedName = $('wizName') ? $('wizName').value : null;
  let body = '', canNext = true, nextLabel = 'Next';
  switch (step) {
    case 'start':
      body = '<h2 class="sysmsg">You have been chosen as a Player.</h2><p class="note">Sign in so your progress is saved and syncs to every device. Already a player? Signing in loads your progress.</p>' + authBox() +
        '<button class="linkbtn" data-action="wizskip" style="margin-top:12px">Continue without an account</button>';
      canNext = false; break;
    case 'hunter':
      body = '<h2 class="sysmsg">Register your hunter.</h2>' +
        '<div class="carousel" id="carousel">' + CHARACTERS.map((c, i) => '<div class="cslide" data-i="' + i + '">' + characterArt(c, 170) + '<div class="cname">' + esc(c.name) + '</div></div>').join('') + '</div>' +
        '<div class="dots">' + CHARACTERS.map((c, i) => '<button class="dot' + (i === regIndex ? ' on' : '') + '" data-action="regdot" data-i="' + i + '" aria-label="' + esc(c.name) + '"></button>').join('') + '</div>' +
        '<label class="note" for="wizName">Hunter name</label><input id="wizName" maxlength="20" value="' + esc(d.name) + '" placeholder="Your name">';
      break;
    case 'source': body = '<h2 class="sysmsg">How do you want your training plan?</h2>' +
      optCards('source', { build: { label: 'Build one for me', desc: 'Answer a few questions and the System builds an RP-based plan' }, own: { label: 'I have my own program', desc: 'Type it, paste it, or upload a PDF' } }, d.source);
      canNext = !!d.source; break;
    case 'import':
      body = '<h2 class="sysmsg">Add your program.</h2>' + importBody();
      canNext = false; break;
    case 'goal': body = '<h2 class="sysmsg">What do you want from training?</h2>' + optCards('goal', GOALS, d.goal); canNext = !!d.goal; break;
    case 'focus': body = '<h2 class="sysmsg">Any focus area?</h2>' + optCards('focus', FOCUS, d.focus); canNext = !!d.focus; break;
    case 'equipment':
      body = '<h2 class="sysmsg">Where do you train?</h2>' + optCards('equipment', EQUIPMENT, d.equipment) +
        (d.equipment === 'none' ? '<label class="switch"><input type="checkbox" id="wizBar"' + (d.pullupBar ? ' checked' : '') + '> <span>I have a pull-up bar</span></label>' : '');
      canNext = !!d.equipment; break;
    case 'days': body = '<h2 class="sysmsg">How many days a week?</h2>' + optCards('days', { 3: { label: '3 days', desc: 'Full body: Mon, Wed, Fri' }, 4: { label: '4 days', desc: 'Upper / lower: Mon, Tue, Thu, Fri' }, 5: { label: '5 days', desc: 'Upper, lower, push, pull, legs: Mon–Fri' } }, d.days); canNext = !!d.days; break;
    case 'experience': body = '<h2 class="sysmsg">Training experience?</h2>' + optCards('experience', EXPERIENCE, d.experience); canNext = !!d.experience; break;
    case 'cycle': body = '<h2 class="sysmsg">Cycle-aware scheduling?</h2><p class="note">Optional. Log period start dates and the System flags the days to avoid max-effort lifting. You can change this later.</p>' +
      optCards('cycle', { on: { label: 'Turn it on', desc: 'Track my cycle' }, off: { label: 'No thanks', desc: 'Skip it' } }, d.cycle); canNext = !!d.cycle; break;
    case 'quests':
      body = '<h2 class="sysmsg">Choose your daily quests.</h2><p class="note">Clear them all each day for bonus XP. Miss a weekday and the System takes XP.</p><div class="chks">' +
        QUEST_PRESETS.map(q => '<label class="chk"><input type="checkbox" data-quest="' + q.id + '"' + (d.quests.has(q.id) ? ' checked' : '') + '> <span><b>' + esc(q.name) + '</b> <span class="xp">+' + q.xp + ' XP</span></span></label>').join('') +
        d.custom.map((c, i) => '<div class="chk"><span><b>' + esc(c) + '</b> <span class="xp">+30 XP</span></span><button class="btn xs red" data-action="wizdelquest" data-i="' + i + '">Remove</button></div>').join('') +
        '</div><div class="row"><input id="customQuest" maxlength="40" placeholder="Add your own quest"><button class="btn sm" data-action="wizaddquest">Add</button></div>';
      canNext = d.quests.size + d.custom.length > 0; break;
    case 'plan': {
      if (d.source === 'own') {
        if (!ed || ed.origin !== 'wizard') { body = '<p class="note">Go back and add your program first.</p>'; canNext = false; break; }
        body = '<h2 class="sysmsg">Check your program.</h2>' + editorBody();
        nextLabel = wiz.preview ? 'Exit preview' : 'Begin';
        break;
      }
      const plan = generatePlan(wizSettings());
      body = '<h2 class="sysmsg">Your training plan.</h2><p class="note">Built from your answers on Renaissance Periodization principles: sets and effort build for 4 weeks, then a deload week. Swap or skip exercises anytime.</p>' +
        plan.DAY_ORDER.map(dn => '<div class="planday"><b>' + dn + ' · ' + esc(plan.DAYS[dn].title) + '</b><ul>' + plan.DAYS[dn].ex.map(e => '<li>' + esc(e.name) + ' <span class="muted">' + e.sets + ' × ' + esc(e.reps) + '</span></li>').join('') + '</ul></div>').join('');
      nextLabel = wiz.preview ? 'Exit preview' : 'Begin';
      break;
    }
  }
  o.innerHTML = '<div class="modal wiz"><h1>[ System ]' + (wiz.preview ? ' · Preview' : '') + '</h1>' +
    '<div class="stepper" aria-label="Step ' + (wiz.step + 1) + ' of ' + steps.length + '">' + steps.map((s, i) => '<span class="' + (i < wiz.step ? 'done' : i === wiz.step ? 'on' : '') + '"></span>').join('') + '</div>' +
    body +
    '<p class="note err" id="wizMsg"></p>' +
    '<div class="row wiznav">' + (wiz.step > 0 ? '<button class="btn" data-action="wizback">Back</button>' : '') +
      (wiz.preview ? '<button class="btn" data-action="wizexit">Close</button>' : '') +
      (step !== 'start' ? '<button class="btn primary" data-action="' + (step === 'plan' ? 'wizfinish' : 'wiznext') + '"' + (canNext ? '' : ' disabled') + '>' + nextLabel + '</button>' : '') + '</div></div>';
  o.hidden = false;
  if (step === 'hunter') {
    if (typedName !== null) $('wizName').value = typedName;
    bindCarousel();
  }
}
function wizPick(k, v) { wiz.d[k] = k === 'days' ? +v : v; renderOverlay(); }

// ---------- program import + plan editor ----------
function importBody() {
  const st = imp || (imp = { text: (wiz && wiz.d.importText) || '', msg: '' });
  return '<p class="note">One day per heading, one exercise per line. Like this:</p>' +
    '<pre class="example">Mon - Upper\nBench press 4x6 @8\nPull-ups 3x8\n\nWed - Lower\nSquat 4x5\nRDL 3x8-10</pre>' +
    '<label class="note" for="impText">Type or paste your program</label>' +
    '<textarea id="impText" rows="9" placeholder="Paste from Notes, a doc or a spreadsheet">' + esc(st.text) + '</textarea>' +
    '<div class="row"><button class="btn primary" data-action="impread"' + (st.busy ? ' disabled' : '') + '>Read my program</button>' +
    '<label class="btn" for="impPdf">' + (st.busy ? 'Reading PDF…' : 'Upload a PDF') + '</label><input type="file" id="impPdf" accept="application/pdf" hidden></div>' +
    '<p class="note err" id="impMsg">' + esc(st.msg || '') + '</p>' +
    '<p class="note">PDFs work when they contain real text (exported from Docs, Word or an app). Scanned pages or photos can\'t be read; type those in instead.</p>';
}
function renderImport(o) {
  o.innerHTML = '<div class="modal wiz"><h1>[ Import a Program ]</h1>' + importBody() +
    '<div class="row wiznav"><button class="btn" data-action="impcancel">Cancel</button></div></div>';
  o.hidden = false;
}
function readImport(fromPdf) {
  const ta = $('impText');
  if (!fromPdf && ta) imp.text = ta.value;
  if (wiz) wiz.d.importText = imp.text;
  const r = parseProgram(imp.text, { equipment: wiz ? wiz.d.equipment : null });
  if (!r.plan.DAY_ORDER.length) { imp.msg = 'Couldn\'t find any exercises. Put one exercise per line, like "Squat 4x5".'; renderOverlay(); return; }
  let note = 'Read ' + r.plan.DAY_ORDER.length + ' day' + (r.plan.DAY_ORDER.length > 1 ? 's' : '') + ' and ' + Object.values(r.plan.DAYS).reduce((a, d) => a + d.ex.length, 0) + ' exercises. Check everything below.';
  if (r.guessed) note += ' ' + r.guessed + ' had no sets × reps, so they\'re set to 3 × 8-12: fix them if needed.';
  if (r.skipped.length) note += ' Skipped lines: ' + r.skipped.slice(0, 5).map(x => '"' + x.slice(0, 30) + '"').join(', ') + (r.skipped.length > 5 ? '…' : '') + '.';
  ed = { plan: r.plan, origin: wiz ? 'wizard' : 'profile', note };
  imp = null;
  if (wiz) { wiz.step = wizSteps().indexOf('cycle'); }
  renderOverlay();
}
async function readPdf(file) {
  imp.text = $('impText') ? $('impText').value : imp.text;
  imp.busy = true; imp.msg = ''; renderOverlay();
  try {
    const text = await pdfToText(file);
    imp.busy = false;
    if (!text.replace(/\s/g, '').length) { imp.msg = 'This PDF has no readable text (probably a scan or photo). Type the program in instead.'; renderOverlay(); return; }
    imp.text = text.trim();
    readImport(true);
  } catch (err) {
    console.warn('[SYSTEM] pdf', err);
    imp.busy = false; imp.msg = 'Couldn\'t read that PDF. Paste or type the program instead.'; renderOverlay();
  }
}
function planFromProgram() {
  // start the editor from whatever plan is active now (swaps included), keeping exercise ids so history still links up
  const prog = getProgram(store);
  const plan = { DAY_ORDER: prog.DAY_ORDER.slice(), DAYS: {}, targets: {}, imported: true, settings: { source: 'edit', equipment: (prog.settings && prog.settings.equipment) || 'home' } };
  prog.DAY_ORDER.forEach(d => {
    const day = prog.DAYS[d];
    plan.DAYS[d] = { title: day.title, hint: day.hint, ex: day.ex.map(e => {
      const x = { id: e.id, name: e.name, sets: e.prog ? e.sets : e.sets, reps: e.reps, rpe: e.rpe, m: e.m, t: e.t || 'c' };
      ['lib', 'pat', 'bw', 'lift', 'start'].forEach(k => { if (e[k] !== undefined) x[k] = e[k]; });
      x._orig = e.name;
      return x;
    }) };
  });
  return plan;
}
function editorBody() {
  const p = ed.plan;
  return (ed.note ? '<p class="note ok">' + esc(ed.note) + '</p>' : '') +
    '<p class="note">Changes apply from today. Logged sets and XP stay.</p>' +
    p.DAY_ORDER.map((dn, di) => {
      const day = p.DAYS[dn];
      return '<div class="edday"><div class="edhead">' +
        '<select data-ed="day" data-d="' + di + '" aria-label="Day of the week">' + ALL_DAYS.map(x => '<option' + (x === dn ? ' selected' : '') + '>' + x + '</option>').join('') + '</select>' +
        '<input data-ed="title" data-d="' + di + '" value="' + esc(day.title) + '" aria-label="Day name" placeholder="Day name">' +
        '<button class="btn xs red" data-action="edrmday" data-d="' + di + '" aria-label="Remove ' + dn + '">✕</button></div>' +
        day.ex.map((e, ei) => '<div class="edex' + (e.guessed ? ' guessed' : '') + '">' +
          '<input class="edname" data-ed="name" data-d="' + di + '" data-e="' + ei + '" value="' + esc(e.name) + '" aria-label="Exercise">' +
          '<div class="ednums"><input data-ed="sets" data-d="' + di + '" data-e="' + ei + '" type="number" min="1" max="12" value="' + e.sets + '" aria-label="Sets"><span>×</span>' +
          '<input data-ed="reps" data-d="' + di + '" data-e="' + ei + '" value="' + esc(e.reps) + '" aria-label="Reps"><span>@</span>' +
          '<input data-ed="rpe" data-d="' + di + '" data-e="' + ei + '" value="' + esc(e.rpe) + '" aria-label="RPE">' +
          '<button class="btn xs" data-action="edup" data-d="' + di + '" data-e="' + ei + '" aria-label="Move up"' + (ei ? '' : ' disabled') + '>↑</button>' +
          '<button class="btn xs red" data-action="edrmex" data-d="' + di + '" data-e="' + ei + '" aria-label="Remove exercise">✕</button></div></div>').join('') +
        '<button class="btn xs" data-action="edaddex" data-d="' + di + '">+ Add exercise</button></div>';
    }).join('') +
    (p.DAY_ORDER.length < 7 ? '<button class="btn sm" data-action="edaddday">+ Add a day</button>' : '') +
    '<p class="note err" id="edMsg"></p>';
}
function renderEditor(o) {
  o.innerHTML = '<div class="modal wiz edmodal"><h1>[ Your Plan ]</h1>' + editorBody() +
    '<div class="row wiznav"><button class="btn" data-action="edcancel">Cancel</button><button class="btn primary" data-action="edsave">Save plan</button></div></div>';
  o.hidden = false;
}
function syncEditorInputs() {
  if (!ed) return;
  const p = ed.plan;
  document.querySelectorAll('[data-ed]').forEach(inp => {
    const di = +inp.dataset.d, dn = p.DAY_ORDER[di];
    if (!dn) return;
    const k = inp.dataset.ed;
    if (k === 'title') p.DAYS[dn].title = inp.value.trim();
    else if (k === 'day') inp.dataset.pending = inp.value;
    else {
      const e = p.DAYS[dn].ex[+inp.dataset.e];
      if (!e) return;
      if (k === 'sets') e.sets = Math.max(1, Math.min(12, parseInt(inp.value, 10) || 1));
      else e[k] = inp.value.trim();
      if (k !== 'name') delete e.guessed;
    }
  });
  // weekday changes last, so indexes above stay valid
  const moves = [...document.querySelectorAll('[data-ed="day"]')].map(s => ({ from: p.DAY_ORDER[+s.dataset.d], to: s.value }));
  if (moves.some(m => m.from !== m.to)) {
    const days = {}, order = [];
    moves.forEach(m => { days[m.to] = days[m.to] ? null : p.DAYS[m.from]; order.push(m.to); });
    if (order.every(x => days[x]) && new Set(order).size === order.length) {
      p.DAYS = days; p.DAY_ORDER = order.sort((a, b) => ALL_DAYS.indexOf(a) - ALL_DAYS.indexOf(b));
    } else { ed.dupDays = true; }
  }
}
function finalizePlan(p) {
  if (ed && ed.dupDays) { ed.dupDays = false; return 'Two days are set to the same weekday. Pick a different day for one of them.'; }
  if (!p.DAY_ORDER.length) return 'Add at least one training day.';
  for (const dn of p.DAY_ORDER) {
    const day = p.DAYS[dn];
    day.ex = day.ex.filter(e => e.name && e.name.trim());
    if (!day.ex.length) return dn + ' has no exercises. Add one or remove the day.';
    const used = {};
    p.DAY_ORDER.forEach(x => p.DAYS[x].ex.forEach(e => { if (e.id) used[e.id] = 1; }));
    day.ex.forEach(e => {
      if (e._orig === undefined || e.name !== e._orig) {
        // new or renamed: re-match to the library (muscle, swaps, big-three) but keep the id
        const fresh = makeExercise({ name: e.name, sets: e.sets, reps: e.reps, rpe: e.rpe }, dn, used);
        ['lib', 'pat', 'bw', 'lift', 'start'].forEach(k => { delete e[k]; if (fresh[k] !== undefined) e[k] = fresh[k]; });
        e.m = fresh.m; e.t = fresh.t;
        if (!e.id) e.id = fresh.id;
      }
      delete e._orig; delete e.guessed;
    });
    if (!day.title) day.title = 'Workout';
    if (!day.hint) day.hint = 'Your own program. Swap or skip exercises anytime; edit it from Profile → Your Plan.';
  }
  refreshTargets(p);
  return null;
}
function saveEditor() {
  syncEditorInputs();
  const err = finalizePlan(ed.plan);
  if (err) { $('edMsg').textContent = err; return; }
  const now = Date.now();
  const list = [[['profile', 'plan'], { v: ed.plan, at: now }]];
  // swaps are baked into the saved plan, so clear them
  Object.keys(store.profile.edits || {}).forEach(id => list.push([['profile', 'edits', id], { swap: null, removed: false, at: now + 1 }]));
  ed = null; trainDay = null;
  commitMany(list);
  flash('PLAN UPDATED');
}
function edRender() { if (wiz) renderOverlay(); else renderOverlay(); }
function wizNext() {
  const steps = wizSteps();
  if (steps[wiz.step] === 'hunter') {
    const n = $('wizName').value.trim();
    if (!n) { $('wizMsg').textContent = 'Enter a hunter name.'; $('wizName').focus(); return; }
    wiz.d.name = n; wiz.d.character = CHARACTERS[regIndex].id;
  }
  wiz.step++; renderOverlay();
  const m = document.querySelector('.modal'); if (m) m.scrollTop = 0;
}
function wizBack() {
  if (wizSteps()[wiz.step] === 'plan' && ed) syncEditorInputs();
  if (wizSteps()[wiz.step] === 'hunter') wiz.d.name = $('wizName').value.trim();
  wiz.step = Math.max(0, wiz.step - 1); renderOverlay();
}
function wizFinish() {
  if (wiz.preview) { wiz = null; ed = null; imp = null; renderOverlay(); return; }
  const d = wiz.d, now = Date.now();
  let plan;
  if (d.source === 'own') {
    syncEditorInputs();
    const err = finalizePlan(ed.plan);
    if (err) { $('wizMsg').textContent = err; return; }
    plan = ed.plan; plan.settings = { source: 'import', equipment: d.equipment || 'gym' };
    ed = null;
  } else plan = generatePlan(wizSettings());
  const quests = QUEST_PRESETS.filter(q => d.quests.has(q.id)).map(({ on, ...q }) => q)
    .concat(d.custom.map((c, i) => ({ id: 'custom' + (i + 1), name: c, desc: 'Your own quest.', xp: 30 })));
  const P = (k, v, i = 0) => [['profile', k], { v, at: now + i }];
  wiz = null;
  commitMany([
    P('name', d.name), P('plan', plan, 1), P('quests', quests, 2), P('cycle', d.cycle === 'on', 3), P('week', 1, 4),
    P('startDate', today, 5), P('startTs', now, 6), P('baseline', { xp: 0, streak: 0, days: 0, penalty: false }, 7),
    P('character', d.character, 8)
  ]);
  view = 'quests'; setLocal({ view });
  render();
  flash('WELCOME, PLAYER', true);
}
function bindCarousel() {
  const car = $('carousel');
  if (!car) return;
  car.scrollLeft = regIndex * car.clientWidth;
  car.addEventListener('scroll', () => {
    const i = Math.round(car.scrollLeft / car.clientWidth);
    if (i !== regIndex) { regIndex = i; if (wiz) wiz.d.character = CHARACTERS[i].id; document.querySelectorAll('.dot').forEach((dd, j) => dd.classList.toggle('on', j === i)); }
  }, { passive: true });
}

function renderOverlay() {
  const o = $('overlay');
  if (game.failed && !wiz) {
    o.innerHTML = '<div class="modal failed"><h2>YOU HAVE FAILED</h2><p>Your XP has fallen to zero.</p>' +
      '<div class="row"><button class="btn red" data-action="failrestart">Restart</button><button class="btn" data-action="failcontinue">Continue at Level 1</button></div>' +
      '<p class="note">Restart wipes level, XP and streak. Training history and PRs are kept.</p></div>';
    o.hidden = false; return;
  }
  if (ed && !wiz) { renderEditor(o); return; }
  if (imp && !wiz) { renderImport(o); return; }
  if (wiz && !wiz.preview && pv(store, 'character', null)) wiz = null;   // signed in and existing progress loaded
  if (!wiz && !pv(store, 'character', null) && !hasProgress()) wiz = newWizard(false);
  if (wiz) { renderWizard(o); return; }
  const needsReg = regOpen || !pv(store, 'character', null);
  if (needsReg) {
    const sel = pv(store, 'character', null);
    const typedName = $('regName') ? $('regName').value : null;
    if (!regOpen && sel) regIndex = Math.max(0, CHARACTERS.findIndex(c => c.id === sel));
    o.innerHTML = '<div class="modal reg"><h1>[ Player Registration ]</h1>' +
      (!syncUser ? '<p class="note">Already have progress on another device? Sign in first and it loads here.</p>' + authBox() : '') +
      '<div class="carousel" id="carousel">' + CHARACTERS.map((c, i) => '<div class="cslide" data-i="' + i + '">' + characterArt(c, 170) + '<div class="cname">' + esc(c.name) + '</div></div>').join('') + '</div>' +
      '<div class="dots">' + CHARACTERS.map((c, i) => '<button class="dot' + (i === regIndex ? ' on' : '') + '" data-action="regdot" data-i="' + i + '" aria-label="' + esc(c.name) + '"></button>').join('') + '</div>' +
      '<label class="note" for="regName">Hunter name</label><input id="regName" maxlength="20" value="' + esc(pv(store, 'name', '')) + '" placeholder="Hunter name">' +
      '<div class="row"><button class="btn primary" data-action="regconfirm">Confirm</button>' + (regOpen && sel ? '<button class="btn" data-action="regcancel">Cancel</button>' : '') + '</div>' +
      '<p class="note err" id="regMsg"></p></div>';
    o.hidden = false;
    if (typedName !== null) $('regName').value = typedName;
    bindCarousel();
    return;
  }
  o.hidden = true; o.innerHTML = '';
}

// ---------- actions ----------
document.addEventListener('click', async e => {
  const t = e.target.closest('[data-action], .tab[data-view]');
  if (!t || t.disabled) return;
  if (t.dataset.view) { view = t.dataset.view; setLocal({ view }); swapOpen = null; render(); window.scrollTo(0, 0); return; }
  const a = t.dataset.action, now = Date.now();
  const week = String(pv(store, 'week', 1));
  switch (a) {
    case 'quest': commit(['days', today, 'checks', t.dataset.id], { done: !isChecked(store, today, t.dataset.id), at: now }); break;
    case 'penalty': commit(['days', today, 'penaltyClear'], { on: true, at: now }); break;
    case 'rest': {
      const msg = game.restCostToday ? 'Take an extra rest day? It costs ' + RULES.EXTRA_REST_XP + ' XP. All quests are excused and your streak is kept.' : 'Use your free rest day for this week? All quests are excused and your streak is kept.';
      if (confirm(msg)) commit(['days', today, 'rest'], { on: true, at: now });
      break;
    }
    case 'unrest': commit(['days', today, 'rest'], { on: false, at: now }); break;
    case 'week': setProfile('week', Math.max(1, pv(store, 'week', 1) + parseInt(t.dataset.d, 10))); break;
    case 'tday': trainDay = t.dataset.d; swapOpen = null; setLocal({ trainDay }); render(); break;
    case 'log': {
      const row = t.closest('.set');
      const exDef = getProgram(store).EX[row.dataset.ex] || {};
      const wt = parseFloat(row.querySelector('[name=wt]').value) || 0;
      const reps = parseInt(row.querySelector('[name=reps]').value, 10);
      const rpe = parseFloat(row.querySelector('[name=rpe]').value) || 0;
      if (!reps) { row.querySelector('[name=reps]').focus(); return; }
      if (!wt && !exDef.bw) { row.querySelector('[name=wt]').focus(); return; }
      const i = row.dataset.i;
      const leaf = { ex: row.dataset.ex, wt, reps, rpe, ts: now, del: false, at: now };
      if (exDef.lib) leaf.lib = exDef.lib;
      leaf.lift = exDef.lift || null;
      commit(['weeks', week, 'sets', row.dataset.ex + '|' + i], leaf);
      break;
    }
    case 'undo': {
      const key = t.dataset.ex + '|' + t.dataset.i;
      const s = setAt(store, week, t.dataset.ex, t.dataset.i === 'pr' ? 'pr' : +t.dataset.i);
      if (s) commit(['weeks', week, 'sets', key], { ...s, del: true, at: now });
      break;
    }
    case 'skip': commit(['weeks', week, 'skips', t.dataset.ex], { on: true, at: now }); break;
    case 'unskip': commit(['weeks', week, 'skips', t.dataset.ex], { on: false, at: now }); break;
    case 'low': commit(['weeks', week, 'low', trainDay], { on: !isLowDay(store, +week, trainDay), at: now }); break;
    case 'pr': commit(['weeks', week, 'pr', t.dataset.ex], { on: !isPrAttempt(store, +week, t.dataset.ex), at: now }); break;
    case 'swapopen': swapOpen = swapOpen === t.dataset.ex ? null : t.dataset.ex; render(); break;
    case 'swapto': swapOpen = null; commit(['profile', 'edits', t.dataset.ex], { swap: t.dataset.lib || null, removed: false, at: now }); break;
    case 'remove': {
      const ex = getProgram(store).EX[t.dataset.ex];
      if (ex && confirm('Remove "' + ex.name + '" from your plan? You can restore it from the Profile tab.')) commit(['profile', 'edits', t.dataset.ex], { swap: null, removed: true, at: now });
      break;
    }
    case 'restore': commit(['profile', 'edits', t.dataset.ex], { swap: null, removed: false, at: now }); break;
    case 'period': commitMany([[['days', today, 'period'], { on: true, at: now }], [['profile', 'cycle'], { v: true, at: now }]]); break;
    case 'periodundo': commit(['days', today, 'period'], { on: false, at: now }); break;
    case 'pastperiod': {
      const v = $('pastPeriod').value;
      if (v && v <= today) { commit(['days', v, 'period'], { on: true, at: now }); }
      break;
    }
    case 'signin': await runAuth(() => sync.signIn()); break;
    case 'emailtoggle': emailOpen = !emailOpen; if (wiz || !pv(store, 'character', null) || regOpen) renderOverlay(); else render(); break;
    case 'emailsignin': case 'emailsignup': case 'emailreset': {
      const box = t.closest('.authbox');
      const email = box.querySelector('[name=email]').value.trim(), pw = box.querySelector('[name=password]').value;
      if (!email) { authMsg('Enter your email.'); return; }
      if (a === 'emailreset') { await runAuth(() => sync.resetPassword(email), 'Password reset email sent. Check your inbox.'); return; }
      if (pw.length < 6) { authMsg('Password needs at least 6 characters.'); return; }
      await runAuth(() => a === 'emailsignup' ? sync.signUpEmail(email, pw) : sync.signInEmail(email, pw));
      break;
    }
    case 'signout': if (confirm('Sign out? Progress stays on this device but stops syncing.')) await sync.signOutNow(); break;
    case 'register': regOpen = true; renderOverlay(); break;
    case 'regcancel': regOpen = false; renderOverlay(); break;
    case 'regdot': {
      const car = $('carousel'); regIndex = +t.dataset.i;
      if (wiz) wiz.d.character = CHARACTERS[regIndex].id;
      car.scrollTo({ left: regIndex * car.clientWidth, behavior: 'smooth' });
      document.querySelectorAll('.dot').forEach((d, j) => d.classList.toggle('on', j === regIndex));
      break;
    }
    case 'regconfirm': {
      const name = $('regName').value.trim();
      if (!name) { $('regMsg').textContent = 'Enter a hunter name.'; $('regName').focus(); return; }
      regOpen = false;
      const list = [];
      if (name !== pv(store, 'name', '')) list.push([['profile', 'name'], { v: name, at: now }]);
      list.push([['profile', 'character'], { v: CHARACTERS[regIndex].id, at: now + 1 }]);
      commitMany(list);
      break;
    }
    case 'preview': wiz = newWizard(true); ed = null; imp = null; renderOverlay(); break;
    case 'editplan': ed = { plan: planFromProgram(), origin: 'profile' }; renderOverlay(); break;
    case 'importplan': imp = { text: '', msg: '' }; renderOverlay(); break;
    case 'impcancel': imp = null; renderOverlay(); break;
    case 'impread': readImport(false); break;
    case 'edcancel': ed = null; renderOverlay(); break;
    case 'edsave': saveEditor(); break;
    case 'edaddex': { syncEditorInputs(); const dn = ed.plan.DAY_ORDER[+t.dataset.d]; ed.plan.DAYS[dn].ex.push({ id: '', name: '', sets: 3, reps: '8-12', rpe: '8', m: null, t: 'c' }); edRender(); const inputs = document.querySelectorAll('.edday')[+t.dataset.d].querySelectorAll('.edname'); inputs[inputs.length - 1].focus(); break; }
    case 'edrmex': { syncEditorInputs(); const dn = ed.plan.DAY_ORDER[+t.dataset.d]; ed.plan.DAYS[dn].ex.splice(+t.dataset.e, 1); edRender(); break; }
    case 'edup': { syncEditorInputs(); const dn = ed.plan.DAY_ORDER[+t.dataset.d], i = +t.dataset.e, list = ed.plan.DAYS[dn].ex; [list[i - 1], list[i]] = [list[i], list[i - 1]]; edRender(); break; }
    case 'edrmday': { syncEditorInputs(); const dn = ed.plan.DAY_ORDER[+t.dataset.d]; if (confirm('Remove ' + dn + ' from your plan?')) { ed.plan.DAY_ORDER.splice(+t.dataset.d, 1); delete ed.plan.DAYS[dn]; edRender(); } break; }
    case 'edaddday': { syncEditorInputs(); const free = ALL_DAYS.find(x => !ed.plan.DAY_ORDER.includes(x)); ed.plan.DAY_ORDER.push(free); ed.plan.DAY_ORDER.sort((a, b) => ALL_DAYS.indexOf(a) - ALL_DAYS.indexOf(b)); ed.plan.DAYS[free] = { title: 'Workout', hint: '', ex: [{ id: '', name: '', sets: 3, reps: '8-12', rpe: '8', m: null, t: 'c' }] }; edRender(); break; }
    case 'wizpick': wizPick(t.dataset.k, t.dataset.v); break;
    case 'wiznext': wizNext(); break;
    case 'wizback': wizBack(); break;
    case 'wizskip': wiz.step++; renderOverlay(); break;
    case 'wizfinish': wizFinish(); break;
    case 'wizexit': wiz = null; renderOverlay(); break;
    case 'wizaddquest': { const v = $('customQuest').value.trim(); if (v) { wiz.d.custom.push(v.slice(0, 40)); renderOverlay(); } break; }
    case 'wizdelquest': wiz.d.custom.splice(+t.dataset.i, 1); renderOverlay(); break;
    case 'export': exportBackup(); break;
    case 'restart':
      if (confirm('Restart from Level 1? This wipes your level, XP and streak on every device. Training history and PRs are kept.')) doRestart();
      break;
    case 'failrestart': doRestart(); break;
    case 'failcontinue': setProfile('failAck', game.failed); break;
  }
});
document.addEventListener('change', e => {
  const t = e.target;
  if (t.dataset && t.dataset.quest && wiz) { if (t.checked) wiz.d.quests.add(t.dataset.quest); else wiz.d.quests.delete(t.dataset.quest); renderOverlay(); }
  if (t.id === 'wizBar' && wiz) wiz.d.pullupBar = t.checked;
  if (t.id === 'cycleToggle') setProfile('cycle', t.checked);
  if (t.id === 'nameInput') { const v = t.value.trim(); if (v) setProfile('name', v); }
  if (t.id === 'importFile' && t.files[0]) { importBackup(t.files[0]); t.value = ''; }
  if (t.id === 'impPdf' && t.files[0]) { const f = t.files[0]; t.value = ''; readPdf(f); }
});
document.addEventListener('keydown', e => {
  if (e.key === 'Enter' && e.target.id === 'customQuest') { e.preventDefault(); document.querySelector('[data-action="wizaddquest"]').click(); }
});

function doRestart() {
  const now = Date.now();
  commitMany([[['profile', 'restart'], { v: { date: today, ts: now }, at: now }], [['profile', 'failAck'], { v: null, at: now + 1 }]]);
}

function exportBackup() {
  const blob = new Blob([JSON.stringify({ app: 'the-system', version: APP_VERSION, exported: new Date().toISOString(), data: store }, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'the-system-backup-' + today + '.json';
  document.body.appendChild(a); a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
}
function importBackup(file) {
  const r = new FileReader();
  r.onload = () => {
    try {
      const obj = JSON.parse(r.result);
      let incoming = obj.data || obj;
      if (incoming.v !== 2) {
        const isTraining = incoming.sets !== undefined;
        incoming = migrateLegacy(isTraining ? null : incoming, isTraining ? incoming : null, today, Date.now());
        if (!confirm('This is a backup from the old app. Add its progress on top of your current progress?')) return;
        const cur = pv(store, 'baseline', { xp: 0, streak: 0, days: 0, penalty: false });
        const add = pv(incoming, 'baseline', { xp: 0 });
        incoming.profile = { baseline: { v: { ...cur, xp: cur.xp + add.xp }, at: Date.now() }, ...(incoming.profile.week ? { week: incoming.profile.week } : {}) };
      } else if (!confirm('Merge this backup into your current progress? Newer entries win.')) return;
      const n = mergeStore(store, incoming);
      saveStore(store);
      if (sync && syncUser) {
        ['profile', 'days', 'weeks'].forEach(top => {
          const walk = (o, p) => { if (o && typeof o.at === 'number') sync.push(p, o); else if (o && typeof o === 'object') Object.keys(o).forEach(k => walk(o[k], p.concat(k))); };
          walk(incoming[top], [top]);
        });
      }
      refresh();
      alert('Backup imported (' + n + ' entries).');
    } catch (err) { alert('That file is not a valid backup.'); }
  };
  r.readAsText(file);
}

// ---------- midnight + returning to the app ----------
setInterval(() => { if (dateKey() !== today) refresh(); }, 30000);
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') { refresh(); if (swReg) swReg.update().catch(() => {}); }
});

// ---------- updates ----------
let swReg = null;
let updating = false;
function showUpdateBanner(worker) {
  const b = $('banner');
  b.innerHTML = '<span>SYSTEM UPDATE available</span><button class="btn sm primary" id="updBtn">Install</button>';
  b.hidden = false;
  $('updBtn').onclick = () => { updating = true; worker.postMessage({ type: 'SKIP_WAITING' }); b.innerHTML = '<span>Installing update…</span>'; };
}
if ('serviceWorker' in navigator) {
  let reloading = false;
  // reload only when the player tapped Install, not when the first worker takes over
  navigator.serviceWorker.addEventListener('controllerchange', () => { if (updating && !reloading) { reloading = true; location.reload(); } });
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').then(reg => {
      swReg = reg;
      if (reg.waiting && navigator.serviceWorker.controller) showUpdateBanner(reg.waiting);
      reg.addEventListener('updatefound', () => {
        const nw = reg.installing;
        nw && nw.addEventListener('statechange', () => { if (nw.state === 'installed' && navigator.serviceWorker.controller) showUpdateBanner(nw); });
      });
    }).catch(() => {});
  });
}
(function whatsNew() {
  const l = local();
  if (l.lastVersion && l.lastVersion !== APP_VERSION && WHATS_NEW[APP_VERSION]) {
    const b = $('banner');
    b.innerHTML = '<span><b>Updated to v' + APP_VERSION + ':</b> ' + esc(WHATS_NEW[APP_VERSION]) + '</span><button class="btn sm" id="nwBtn">OK</button>';
    b.hidden = false;
    $('nwBtn').onclick = () => { b.hidden = true; };
  }
  setLocal({ lastVersion: APP_VERSION });
})();

// ---------- start ----------
render();
import('./sync.js').then(mod => {
  sync = mod;
  return mod.initSync({
    getStore: () => store,
    replaceStore: s => { store = s; saveStore(store); refresh(); },
    onRemoteChange: () => { saveStore(store); refresh(); },
    onStatus: (s, u) => {
      const userChanged = (u && u.uid) !== (syncUser && syncUser.uid);
      syncState = s; syncUser = u;
      renderHunter();
      if (view === 'profile') renderProfile();
      if (userChanged) renderOverlay();
    }
  });
}).catch(() => { syncState = 'unavailable'; render(); });

// exposed for testing in the browser console
window.__system = { get store() { return store; }, get game() { return game; }, levelFromTotal };
