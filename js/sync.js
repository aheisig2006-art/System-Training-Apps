// Google sign-in + Firestore sync. Loaded after the app is already on screen,
// so the app works offline and signed out; sync only mirrors the local records.
//
// Cloud layout (all under users/{uid}/):
//   meta/profile        -> store.profile
//   days/{YYYY-MM-DD}   -> store.days[date]
//   weeks/{n}           -> store.weeks[n]
import { putLeaf, eachLeaf, getAt, isLeaf, emptyStore, local, setLocal } from './store.js';

const firebaseConfig = {
  apiKey: 'AIzaSyCOiWuXfR6m7Q0LX0bsOhikbQwwH7rcuiA',
  authDomain: 'the-system-d364e.firebaseapp.com',
  projectId: 'the-system-d364e',
  storageBucket: 'the-system-d364e.firebasestorage.app',
  messagingSenderId: '913076900291',
  appId: '1:913076900291:web:8be4fadc74bce29de8ad76'
};

let fb = null, auth = null, db = null, user = null;
let unsubs = [];
let hooks = null;          // { getStore, replaceStore, onRemoteChange, onStatus }
let remoteAt = {};         // path string -> at, as last seen from the cloud
let pending = 0;

function status(s) { hooks && hooks.onStatus(s, user); }

export async function initSync(h) {
  hooks = h;
  try {
    fb = await import('../vendor/firebase.js');
  } catch (e) { status('unavailable'); return; }
  const app = fb.initializeApp(firebaseConfig);
  auth = fb.getAuth(app);
  try {
    db = fb.initializeFirestore(app, { ignoreUndefinedProperties: true, localCache: fb.persistentLocalCache({ tabManager: fb.persistentMultipleTabManager() }) });
  } catch (e) {
    db = fb.initializeFirestore(app, { ignoreUndefinedProperties: true });
  }
  fb.onAuthStateChanged(auth, u => {
    stopListening();
    user = u;
    if (u) startListening(); else status('signed-out');
  });
  window.addEventListener('online', () => user && status(pending ? 'syncing' : 'synced'));
  window.addEventListener('offline', () => user && status('offline'));
}

export async function signIn() {
  if (!fb) throw new Error('Sync is still loading. Try again in a moment.');
  const provider = new fb.GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });
  await fb.signInWithPopup(auth, provider);
}
export async function signInEmail(email, pw) { await ready(); await fb.signInWithEmailAndPassword(auth, email, pw); }
export async function signUpEmail(email, pw) { await ready(); await fb.createUserWithEmailAndPassword(auth, email, pw); }
export async function resetPassword(email) { await ready(); await fb.sendPasswordResetEmail(auth, email); }
async function ready() { if (!fb) throw new Error('Sync is still loading. Try again in a moment.'); }
export async function signOutNow() { if (auth) await fb.signOut(auth); }
export function currentUser() { return user; }

function stopListening() { unsubs.forEach(u => u()); unsubs = []; remoteAt = {}; }

function refFor(path) {
  // path is a store path: ['profile', field], ['days', date, ...], ['weeks', n, ...]
  const base = 'users/' + user.uid + '/';
  if (path[0] === 'profile') return { ref: fb.doc(db, base + 'meta/profile'), rest: path.slice(1) };
  return { ref: fb.doc(db, base + path[0] + '/' + path[1]), rest: path.slice(2) };
}
function nest(rest, leaf) {
  const o = {}; let cur = o;
  rest.forEach((k, i) => { if (i === rest.length - 1) cur[k] = leaf; else { cur[k] = {}; cur = cur[k]; } });
  return o;
}

// Called by the app after every local change.
export function push(path, leaf) {
  if (!user || !db) return;
  const { ref, rest } = refFor(path);
  pending++;
  status(navigator.onLine ? 'syncing' : 'offline');
  remoteAt[path.join('/')] = leaf.at;
  fb.setDoc(ref, nest(rest, leaf), { merge: true })
    .catch(err => console.warn('[SYSTEM] sync write failed', err))
    .finally(() => { pending--; if (!pending) status(navigator.onLine ? 'synced' : 'offline'); });
}

function startListening() {
  status('syncing');
  const base = 'users/' + user.uid + '/';
  const firstLoad = { profile: false, days: false, weeks: false };
  const firstDocs = { profile: null, days: [], weeks: [] };
  let reconciled = false;

  const apply = (top, id, data) => {
    const prefix = top === 'profile' ? ['profile'] : [top, id];
    let changed = false;
    eachLeaf(data, (p, leaf) => {
      const path = prefix.concat(p);
      remoteAt[path.join('/')] = leaf.at;
      if (putLeaf(hooks.getStore(), path, leaf)) changed = true;
      else {
        const mine = getAt(hooks.getStore(), path);
        if (reconciled && isLeaf(mine) && mine.at > leaf.at) push(path, mine); // our copy is newer: send it back
      }
    });
    return changed;
  };

  const maybeReconcile = () => {
    if (reconciled || !firstLoad.profile || !firstLoad.days || !firstLoad.weeks) return;
    reconciled = true;
    const store = hooks.getStore();
    const L = local();
    const cloudHasData = !!firstDocs.profile;
    if (L.syncedUid !== user.uid && cloudHasData) {
      // This device has never synced with this account and the cloud already has
      // progress: the cloud copy is the real one. Replace local entirely.
      const fresh = emptyStore();
      fresh.profile = {};
      eachLeaf(firstDocs.profile, (p, leaf) => putLeaf(fresh, ['profile'].concat(p), leaf));
      firstDocs.days.forEach(d => eachLeaf(d.data, (p, leaf) => putLeaf(fresh, ['days', d.id].concat(p), leaf)));
      firstDocs.weeks.forEach(d => eachLeaf(d.data, (p, leaf) => putLeaf(fresh, ['weeks', d.id].concat(p), leaf)));
      hooks.replaceStore(fresh);
    } else {
      // Cloud is empty (first device) or this device already belongs to this
      // account: merge, then upload anything the cloud is missing or has older.
      if (cloudHasData) {
        apply('profile', null, firstDocs.profile);
        firstDocs.days.forEach(d => apply('days', d.id, d.data));
        firstDocs.weeks.forEach(d => apply('weeks', d.id, d.data));
      }
      ['profile', 'days', 'weeks'].forEach(top => {
        eachLeaf(store[top], (p, leaf) => {
          const path = [top].concat(p);
          const r = remoteAt[path.join('/')];
          if (r === undefined || r < leaf.at) push(path, leaf);
        });
      });
      hooks.onRemoteChange();
    }
    setLocal({ syncedUid: user.uid });
    if (!pending) status(navigator.onLine ? 'synced' : 'offline');
  };

  unsubs.push(fb.onSnapshot(fb.doc(db, base + 'meta/profile'), snap => {
    if (!firstLoad.profile) { firstLoad.profile = true; firstDocs.profile = snap.exists() ? snap.data() : null; maybeReconcile(); return; }
    if (snap.exists() && apply('profile', null, snap.data())) hooks.onRemoteChange();
  }, err => { console.warn('[SYSTEM] profile listen failed', err); status('error'); }));

  ['days', 'weeks'].forEach(top => {
    unsubs.push(fb.onSnapshot(fb.collection(db, base + top), snap => {
      if (!firstLoad[top]) {
        firstLoad[top] = true;
        firstDocs[top] = snap.docs.map(d => ({ id: d.id, data: d.data() }));
        maybeReconcile();
        return;
      }
      let changed = false;
      snap.docChanges().forEach(ch => { if (ch.type !== 'removed' && apply(top, ch.doc.id, ch.doc.data())) changed = true; });
      if (changed) hooks.onRemoteChange();
    }, err => { console.warn('[SYSTEM] ' + top + ' listen failed', err); status('error'); }));
  });
}
