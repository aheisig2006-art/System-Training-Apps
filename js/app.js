import { QUESTS, RULES, compute, dateKey, dayName, pv, isChecked, liveSets, setAt, e1rm, trainingEvents, levelFromTotal } from './engine.js';
import { DAYS, DAY_ORDER, LIFTS, TARGETS, MUSCLE_NAMES, EX } from './program.js';
import { loadStore, saveStore, putLeaf, mergeStore, local, setLocal } from './store.js';
import { CHARACTERS, characterArt } from './characters.js';
import { APP_VERSION, WHATS_NEW } from './version.js';
import { migrateLegacy } from './engine.js';

let { store } = loadStore();
let sync = null;                 // the sync module, once loaded
let syncState = 'loading', syncUser = null;
let today = dateKey();
let game = compute(store, today);
let regIndex = 0;
let regOpen = false;
const L = local();
let view = L.view || 'quests';
let trainDay = DAY_ORDER.includes(dayName(today)) ? dayName(today) : (L.trainDay || 'Mon');

const $ = id => document.getElementById(id);
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// ---------- changes ----------
function commit(path, leaf) {
  const before = game, evBefore = countEvents();
  if (!putLeaf(store, path, leaf)) return;
  saveStore(store);
  if (sync) sync.push(path, leaf);
  refresh();
  celebrate(before, evBefore);
}
function setProfile(field, v) { commit(['profile', field], { v, at: Date.now() }); }

function countEvents() {
  const ev = trainingEvents(store);
  return { pr: ev.filter(e => e.kind === 'pr').length, session: ev.filter(e => e.kind === 'session').length };
}
function celebrate(before, evBefore) {
  const ev = countEvents();
  if (game.rank !== before.rank && game.level > before.level) return flash('RANK UP\n' + game.rank + '-RANK', true);
  if (game.level > before.level) return flash('LEVEL ' + game.level);
  if (ev.session > evBefore.session) return flash('SESSION CLEARED');
  if (ev.pr > evBefore.pr) return flash('NEW PR');
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
  QUESTS.forEach(q => {
    const d = isChecked(store, today, q.id);
    html += '<button class="quest' + (d ? ' done' : '') + '" data-action="quest" data-id="' + q.id + '" aria-pressed="' + d + '">' +
      '<span class="box">' + (d ? '&#10003;' : '') + '</span>' +
      '<span class="qt"><span class="n">' + q.name + '</span><span class="d">' + q.desc + '</span></span>' +
      '<span class="xp">+' + q.xp + ' XP</span></button>';
  });
  html += '<div class="foot"><span>' + t.doneIds.length + ' / ' + QUESTS.length + ' complete</span><span>' +
    (t.allDone ? 'Day cleared: +' + RULES.BONUS_XP + ' XP' : 'Clear all for +' + RULES.BONUS_XP + ' XP') + '</span></div>' +
    '<p class="note" style="margin-top:8px">Every ' + RULES.STREAK_EVERY + ' cleared days in a row: +' + RULES.STREAK_BONUS + ' XP.</p></div>';

  // last 14 days
  const recent = game.log.slice(-14);
  if (recent.length > 1) {
    html += '<div class="panel"><h1>Record</h1><div class="days">' + recent.map(r =>
      '<div class="dcell ' + r.status + '" title="' + r.date + ': ' + r.status + (r.delta ? ' (' + (r.delta > 0 ? '+' : '') + r.delta + ' XP)' : '') + '"><span>' + dayName(r.date)[0] + '</span></div>').join('') +
      '</div><div class="legend"><span class="dcell cleared"></span>cleared <span class="dcell rest"></span>rest <span class="dcell missed"></span>missed <span class="dcell open"></span>today</div></div>';
  }
  $('view').innerHTML = html;
}

function bestE1RM(lift) {
  let best = 0;
  liveSets(store).forEach(s => { const e = EX[s.ex]; if (e && e.lift === lift && s.reps <= 12) best = Math.max(best, e1rm(s.wt, s.reps)); });
  return best;
}
function lastSetFor(exId) {
  let best = null;
  liveSets(store).forEach(s => { if (s.ex === exId && (!best || s.ts > best.ts)) best = s; });
  return best;
}
const upper = reps => { const n = String(reps).match(/\d+/g); return n ? +n[n.length - 1] : 0; };

function renderTraining() {
  const week = pv(store, 'week', 1);
  const day = DAYS[trainDay];
  let html = '<div class="panel"><h1>Weekly Split</h1>' +
    '<div class="weekrow">Week <b>' + week + '</b> <button class="btn sm" data-action="week" data-d="-1" aria-label="Previous week">−</button> <button class="btn sm" data-action="week" data-d="1" aria-label="Next week">+</button></div>' +
    '<div class="tabs">' + DAY_ORDER.map(d => '<button class="tab' + (d === trainDay ? ' on' : '') + '" data-action="tday" data-d="' + d + '">' + d + '</button>').join('') + '</div>' +
    (week % 5 === 0 ? '<div class="deload">Deload week. Take about half the sets, stay around RPE 5–6, and do not test maxes.</div>' : '') +
    '<div class="dayname">' + trainDay + ': ' + esc(day.title) + '</div><div class="dayhint">' + esc(day.hint) + '</div>';
  day.ex.forEach(e => {
    const last = lastSetFor(e.id);
    let lastHtml = '';
    if (last) {
      const hit = upper(e.reps) && last.reps >= upper(e.reps) && last.rpe <= 8 && e.lift;
      lastHtml = '<div class="last">Last: <b>' + last.wt + ' × ' + last.reps + '</b> @ ' + last.rpe +
        (hit ? ' <span class="hint">&rarr; top of range at RPE 8 or below. Add 5 lb next time.</span>' : '') + '</div>';
    }
    let rows = '';
    for (let i = 0; i < e.sets; i++) {
      const s = setAt(store, week, e.id, i);
      if (s) rows += '<div class="set done"><span>Set ' + (i + 1) + '</span><span>' + s.wt + ' × ' + s.reps + ' @ ' + s.rpe + '</span><button class="btn sm red" data-action="undo" data-ex="' + e.id + '" data-i="' + i + '">undo</button></div>';
      else rows += '<div class="set" data-ex="' + e.id + '" data-i="' + i + '"><span class="lab">Set ' + (i + 1) + '</span>' +
        '<input name="wt" type="number" inputmode="decimal" placeholder="lb" aria-label="Weight, set ' + (i + 1) + '">' +
        '<input name="reps" type="number" inputmode="numeric" placeholder="reps" aria-label="Reps, set ' + (i + 1) + '">' +
        '<input name="rpe" type="number" inputmode="decimal" placeholder="RPE" step="0.5" min="1" max="10" aria-label="RPE, set ' + (i + 1) + '">' +
        '<button class="btn sm" data-action="log">Log</button></div>';
    }
    html += '<div class="ex"><div class="exh"><span class="exn">' + esc(e.name) + '</span><span class="tgt">' + e.sets + ' × ' + e.reps + (e.rpe ? ' @ RPE ' + e.rpe : '') + '</span></div>' +
      (e.start ? '<div class="exm">Starting: ' + e.start + '</div>' : '') + (e.m ? '<div class="exm">' + MUSCLE_NAMES[e.m] + '</div>' : '') + lastHtml + rows + '</div>';
  });
  html += '<p class="note">+' + RULES.SET_XP + ' XP per set · +' + RULES.SESSION_XP + ' XP for a full session · +' + RULES.PR_XP + ' XP for a new PR</p></div>';

  html += '<div class="panel"><h1>Big Three (estimated 1RM)</h1><p class="note">Epley: weight × (1 + reps / 30). Best logged set, all weeks.</p>' +
    Object.keys(LIFTS).map(l => { const v = bestE1RM(l); return '<div class="prow"><span>' + LIFTS[l] + '</span><span>' + (v ? '<b>' + Math.round(v) + ' lb</b> <span class="muted">est. 1RM</span>' : '<span class="muted">no sets logged</span>') + '</span></div>'; }).join('') + '</div>';

  const counts = {};
  liveSets(store).forEach(s => { if (s.week !== week) return; const e = EX[s.ex]; if (e && e.m) counts[e.m] = (counts[e.m] || 0) + 1; });
  html += '<div class="panel"><h1>Weekly Volume (hard sets per muscle)</h1>' + Object.keys(TARGETS).map(m => {
    const [lo, hi] = TARGETS[m]; const c = counts[m] || 0;
    return '<div class="vrow"><div class="vhead"><span>' + MUSCLE_NAMES[m] + '</span><span>' + c + ' / ' + lo + '–' + hi + ' sets</span></div><div class="vbar"><div class="vfill' + (c >= lo ? ' ok' : '') + '" style="width:' + Math.min(100, c / hi * 100) + '%"></div></div></div>';
  }).join('') + '</div>';
  // keep numbers typed into unlogged sets when the screen redraws (sync, midnight, coming back to the app)
  const typed = {};
  document.querySelectorAll('#view .set[data-ex] input').forEach(inp => {
    if (inp.value) typed[inp.closest('.set').dataset.ex + '|' + inp.closest('.set').dataset.i + '|' + inp.name] = inp.value;
  });
  $('view').innerHTML = html;
  document.querySelectorAll('#view .set[data-ex] input').forEach(inp => {
    const k = inp.closest('.set').dataset.ex + '|' + inp.closest('.set').dataset.i + '|' + inp.name;
    if (typed[k]) inp.value = typed[k];
  });
}

function renderProfile() {
  const ch = CHARACTERS.find(c => c.id === pv(store, 'character', null));
  let acct;
  if (syncUser) acct = '<p>Signed in as <b>' + esc(syncUser.email) + '</b>. Progress syncs across every device signed in to this account.</p><button class="btn" data-action="signout">Sign out</button>';
  else if (syncState === 'unavailable') acct = '<p class="note">Sync could not load. Check your connection and reopen the app.</p>';
  else acct = '<p class="note">Signed out: progress is saved on this device only.</p><button class="btn primary" data-action="signin">Sign in with Google</button>';
  $('view').innerHTML =
    '<div class="panel"><h1>Hunter</h1><div class="prof">' + (ch ? characterArt(ch, 96) : '') +
      '<div><label class="note" for="nameInput">Hunter name</label><input id="nameInput" maxlength="20" value="' + esc(pv(store, 'name', '')) + '"><br>' +
      '<button class="btn sm" data-action="register" style="margin-top:8px">Change character</button></div></div></div>' +
    '<div class="panel"><h1>Account &amp; Sync</h1>' + acct + '<p id="authMsg" class="note err"></p></div>' +
    '<div class="panel"><h1>Backup</h1><p class="note">Your progress lives in the cloud once you sign in. A backup file is extra insurance: export one every month or so.</p>' +
      '<div class="row"><button class="btn" data-action="export">Export backup</button><label class="btn" for="importFile">Import backup</label><input type="file" id="importFile" accept="application/json" hidden></div></div>' +
    '<div class="panel"><h1>Danger Zone</h1><p class="note">Restart wipes your level, XP and streak. Training history and PRs are kept.</p><button class="btn red" data-action="restart">Restart from Level 1</button></div>' +
    '<p class="ver">SYSTEM v' + APP_VERSION + '</p>';
}

function renderOverlay() {
  const o = $('overlay');
  const needsReg = regOpen || !pv(store, 'character', null);
  if (game.failed) {
    o.innerHTML = '<div class="modal failed"><h2>YOU HAVE FAILED</h2><p>Your XP has fallen to zero.</p>' +
      '<div class="row"><button class="btn red" data-action="failrestart">Restart</button><button class="btn" data-action="failcontinue">Continue at Level 1</button></div>' +
      '<p class="note">Restart wipes level, XP and streak. Training history and PRs are kept.</p></div>';
    o.hidden = false; return;
  }
  if (needsReg) {
    const sel = pv(store, 'character', null);
    const typedName = $('regName') ? $('regName').value : null;
    if (!regOpen && sel) regIndex = Math.max(0, CHARACTERS.findIndex(c => c.id === sel));
    const signedOut = !syncUser;
    o.innerHTML = '<div class="modal reg"><h1>[ Player Registration ]</h1>' +
      (signedOut ? '<p class="note">Already have progress on another device? <button class="linkbtn" data-action="signin">Sign in with Google first</button> and it loads here.</p>' : '') +
      '<div class="carousel" id="carousel">' + CHARACTERS.map((c, i) => '<div class="cslide" data-i="' + i + '">' + characterArt(c, 180) + '<div class="cname">' + esc(c.name) + '</div></div>').join('') + '</div>' +
      '<div class="dots">' + CHARACTERS.map((c, i) => '<button class="dot' + (i === regIndex ? ' on' : '') + '" data-action="regdot" data-i="' + i + '" aria-label="' + esc(c.name) + '"></button>').join('') + '</div>' +
      '<label class="note" for="regName">Hunter name</label><input id="regName" maxlength="20" value="' + esc(pv(store, 'name', '')) + '" placeholder="Hunter name">' +
      '<div class="row"><button class="btn primary" data-action="regconfirm">Confirm</button>' + (regOpen && sel ? '<button class="btn" data-action="regcancel">Cancel</button>' : '') + '</div>' +
      '<p id="regMsg" class="note err"></p></div>';
    o.hidden = false;
    if (typedName !== null) $('regName').value = typedName;
    const car = $('carousel');
    car.scrollLeft = regIndex * car.clientWidth;
    car.addEventListener('scroll', () => {
      const i = Math.round(car.scrollLeft / car.clientWidth);
      if (i !== regIndex) { regIndex = i; document.querySelectorAll('.dot').forEach((d, j) => d.classList.toggle('on', j === i)); }
    }, { passive: true });
    return;
  }
  o.hidden = true; o.innerHTML = '';
}

// ---------- actions ----------
document.addEventListener('click', async e => {
  const t = e.target.closest('[data-action], .tab[data-view]');
  if (!t) return;
  if (t.dataset.view) { view = t.dataset.view; setLocal({ view }); render(); window.scrollTo(0, 0); return; }
  const a = t.dataset.action, now = Date.now();
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
    case 'tday': trainDay = t.dataset.d; setLocal({ trainDay }); render(); break;
    case 'log': {
      const row = t.closest('.set');
      const wt = parseFloat(row.querySelector('[name=wt]').value);
      const reps = parseInt(row.querySelector('[name=reps]').value, 10);
      const rpe = parseFloat(row.querySelector('[name=rpe]').value) || 0;
      if (!wt || !reps) { row.querySelector(wt ? '[name=reps]' : '[name=wt]').focus(); return; }
      commit(['weeks', String(pv(store, 'week', 1)), 'sets', row.dataset.ex + '|' + row.dataset.i], { ex: row.dataset.ex, wt, reps, rpe, ts: now, del: false, at: now });
      break;
    }
    case 'undo': {
      const week = String(pv(store, 'week', 1)), key = t.dataset.ex + '|' + t.dataset.i;
      const s = setAt(store, week, t.dataset.ex, +t.dataset.i);
      if (s) commit(['weeks', week, 'sets', key], { ...s, del: true, at: now });
      break;
    }
    case 'signin': {
      const msgEl = $('regMsg') || $('authMsg');
      try { if (msgEl) msgEl.textContent = ''; await sync.signIn(); }
      catch (err) { if (msgEl) msgEl.textContent = 'Sign-in did not finish: ' + (err && err.code ? err.code.replace('auth/', '') : err.message || err); }
      break;
    }
    case 'signout': if (confirm('Sign out? Progress stays on this device but stops syncing.')) await sync.signOutNow(); break;
    case 'register': regOpen = true; renderOverlay(); break;
    case 'regcancel': regOpen = false; renderOverlay(); break;
    case 'regdot': { const car = $('carousel'); regIndex = +t.dataset.i; car.scrollTo({ left: regIndex * car.clientWidth, behavior: 'smooth' }); document.querySelectorAll('.dot').forEach((d, j) => d.classList.toggle('on', j === regIndex)); break; }
    case 'regconfirm': {
      const name = $('regName').value.trim();
      if (!name) { $('regMsg').textContent = 'Enter a hunter name.'; $('regName').focus(); return; }
      regOpen = false;
      if (name !== pv(store, 'name', '')) commit(['profile', 'name'], { v: name, at: now });
      commit(['profile', 'character'], { v: CHARACTERS[regIndex].id, at: now + 1 });
      refresh();
      break;
    }
    case 'export': exportBackup(); break;
    case 'restart':
      if (confirm('Restart from Level 1? This wipes your level, XP and streak on every device. Training history and PRs are kept.')) doRestart();
      break;
    case 'failrestart': doRestart(); break;
    case 'failcontinue': setProfile('failAck', game.failed); break;
  }
});
document.addEventListener('change', e => {
  if (e.target.id === 'nameInput') { const v = e.target.value.trim(); if (v) setProfile('name', v); }
  if (e.target.id === 'importFile' && e.target.files[0]) { importBackup(e.target.files[0]); e.target.value = ''; }
});

function doRestart() {
  const now = Date.now();
  commit(['profile', 'restart'], { v: { date: today, ts: now }, at: now });
  commit(['profile', 'failAck'], { v: null, at: now + 1 });
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
        // a backup from one of the old apps
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
function showUpdateBanner(worker) {
  const b = $('banner');
  b.innerHTML = '<span>SYSTEM UPDATE available</span><button class="btn sm primary" id="updBtn">Install</button>';
  b.hidden = false;
  $('updBtn').onclick = () => { worker.postMessage({ type: 'SKIP_WAITING' }); b.innerHTML = '<span>Installing update…</span>'; };
}
if ('serviceWorker' in navigator) {
  let reloading = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => { if (!reloading) { reloading = true; location.reload(); } });
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').then(reg => {
      swReg = reg;
      if (reg.waiting && navigator.serviceWorker.controller) showUpdateBanner(reg.waiting);
      reg.addEventListener('updatefound', () => {
        const nw = reg.installing;
        nw && nw.addEventListener('statechange', () => {
          if (nw.state === 'installed' && navigator.serviceWorker.controller) showUpdateBanner(nw);
        });
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
