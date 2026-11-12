// Basic usage events: what gets tapped, which screens are opened, where people
// stop in the welcome flow, import and sign-in failures. Never workout numbers,
// names, weights or free text. Events are queued on this device and sent to
// Firestore (events collection, write-only for the app) once the user is signed in.
import { APP_VERSION } from './version.js';

const KEY = 'system-events-v1';
const MAX_QUEUE = 300;
const SAFE = /^[a-z0-9_-]{1,40}$/i;   // ids and short codes only
const SID = Math.random().toString(36).slice(2, 10) + Date.now().toString(36);

let sender = null;          // (event) => Promise<boolean>, set once sync loads
let viewName = 'quests';
let flushing = false;
let activeFrom = Date.now();

function read() { try { return JSON.parse(localStorage.getItem(KEY)) || []; } catch (e) { return []; } }
function write(q) { try { localStorage.setItem(KEY, JSON.stringify(q.slice(-MAX_QUEUE))); } catch (e) {} }

function clean(props) {
  const out = {};
  if (props && typeof props === 'object') {
    for (const k of Object.keys(props).slice(0, 6)) {
      const v = props[k];
      if (!SAFE.test(k)) continue;
      if (typeof v === 'number' && isFinite(v)) out[k] = Math.round(v);
      else if (typeof v === 'boolean') out[k] = v;
      else if (typeof v === 'string' && SAFE.test(v)) out[k] = v;
    }
  }
  return out;
}

export function track(name, props) {
  if (!SAFE.test(name)) return;
  const q = read();
  q.push({ name, props: clean(props), view: viewName, v: APP_VERSION, sid: SID, t: Date.now() });
  write(q);
  flush();
}

export function setView(v) { viewName = SAFE.test(v) ? v : 'unknown'; }

export function setSender(fn) { sender = fn; flush(); }

export async function flush() {
  if (!sender || flushing) return;
  flushing = true;
  try {
    while (read().length) {
      const ok = await sender(read()[0]);
      if (!ok) break;
      write(read().slice(1));
    }
  } finally { flushing = false; }
}

// Time on the app: one "away" event per stretch the tab was visible.
track('open', {});
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') {
    track('away', { secs: Math.round((Date.now() - activeFrom) / 1000) });
  } else activeFrom = Date.now();
});
