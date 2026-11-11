const CACHE = 'wordgrove-v15';
const SHELL = ['./','./index.html','./app.js','./sw.js','./manifest.webmanifest'];
const ASSETS = ['./levels.json','./dictionary.json','./definitions.json','./icon.svg','./meadow.svg','./field.svg','./moonlit-forest.svg','./waterfall.svg','./autumn-grove.svg','./crystal-lake.svg','./misty-highlands.svg','./sunset-valley.svg'];
const FILES = SHELL.concat(ASSETS);

self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(FILES)));
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(key => key !== CACHE).map(key => caches.delete(key)));
    await self.clients.claim();
  })());
});

function isShell(url) {
  const path = url.pathname.replace(/\/+$/, '') || '/';
  const base = self.registration.scope.replace(self.location.origin, '').replace(/\/+$/, '') || '';
  const rel = path.startsWith(base) ? path.slice(base.length) || '/' : path;
  const name = rel.split('/').pop() || 'index.html';
  return (
    rel === '/' ||
    name === 'index.html' ||
    name === 'app.js' ||
    name === 'sw.js' ||
    name === 'manifest.webmanifest'
  );
}

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;

  // App shell: network-first so a normal reopen picks up new builds.
  // Offline fallback uses cache. Progress lives in localStorage, not the SW cache.
  if (isShell(url) || event.request.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        const response = await fetch(event.request);
        if (response && response.ok) {
          const cache = await caches.open(CACHE);
          cache.put(event.request, response.clone());
        }
        return response;
      } catch {
        return (await caches.match(event.request)) ||
               (await caches.match('./index.html')) ||
               (await caches.match('./'));
      }
    })());
    return;
  }

  // Static puzzle data / art: cache-first, refresh in background
  event.respondWith((async () => {
    const cached = await caches.match(event.request);
    const network = fetch(event.request).then(response => {
      if (response && response.ok) {
        caches.open(CACHE).then(cache => cache.put(event.request, response.clone()));
      }
      return response;
    }).catch(() => null);
    return cached || (await network) || (await caches.match('./index.html'));
  })());
});
