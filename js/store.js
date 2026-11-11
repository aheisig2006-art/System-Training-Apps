// Local copy of all records. Every value that can change is a "leaf" with an
// `at` timestamp; when two copies disagree, the newer leaf wins.
import { dateKey, migrateLegacy } from './engine.js';

const KEY = 'system-v2';
const LEGACY_QUESTS = 'solo-leveling-tracker-v1';
const LEGACY_TRAINING = 'workout-tracker-v1';

export function isLeaf(o) { return o && typeof o === 'object' && typeof o.at === 'number'; }

function readJSON(k) { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } }

export function loadStore() {
  const s = readJSON(KEY);
  if (s && s.v === 2) return { store: s, migrated: false };
  const q = readJSON(LEGACY_QUESTS), t = readJSON(LEGACY_TRAINING);
  const store = migrateLegacy(q, t, dateKey(), Date.now());
  saveStore(store);
  return { store, migrated: !!(q || t) };
}
export function saveStore(store) {
  try { localStorage.setItem(KEY, JSON.stringify(store)); } catch (e) {}
}
export function emptyStore() { return { v: 2, profile: {}, days: {}, weeks: {} }; }

export function getAt(store, path) {
  let o = store;
  for (const p of path) { if (!o) return undefined; o = o[p]; }
  return o;
}
// Write a leaf if it is newer than what is there. Returns true when it changed.
export function putLeaf(store, path, leaf) {
  const cur = getAt(store, path);
  if (isLeaf(cur) && cur.at >= leaf.at) return false;
  let o = store;
  for (let i = 0; i < path.length - 1; i++) {
    if (!o[path[i]] || typeof o[path[i]] !== 'object') o[path[i]] = {};
    o = o[path[i]];
  }
  o[path[path.length - 1]] = leaf;
  return true;
}
// Visit every leaf under obj, calling fn(pathSuffix, leaf).
export function eachLeaf(obj, fn, prefix = []) {
  if (!obj || typeof obj !== 'object') return;
  if (isLeaf(obj)) { fn(prefix, obj); return; }
  Object.keys(obj).forEach(k => eachLeaf(obj[k], fn, prefix.concat(k)));
}
// Merge a whole store (e.g. an imported backup) leaf by leaf.
export function mergeStore(target, incoming) {
  let n = 0;
  ['profile', 'days', 'weeks'].forEach(top => {
    eachLeaf(incoming[top], (p, leaf) => { if (putLeaf(target, [top].concat(p), leaf)) n++; });
  });
  return n;
}

// Small per-device settings that never sync (selected tab, last seen version...).
const LKEY = 'system-v2-local';
export function local() { return readJSON(LKEY) || {}; }
export function setLocal(patch) {
  const l = Object.assign(local(), patch);
  try { localStorage.setItem(LKEY, JSON.stringify(l)); } catch (e) {}
  return l;
}
