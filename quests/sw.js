// Retired: this app moved into THE SYSTEM at ../
// Clear the old cache, remove this worker, and send open windows to the new app.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k.startsWith('quests-')).map(k => caches.delete(k)));
    await self.registration.unregister();
    const wins = await self.clients.matchAll({ type: 'window' });
    wins.forEach(w => w.navigate(new URL('../', self.registration.scope).href));
  })());
});
