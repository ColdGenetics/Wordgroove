const CACHE = 'wordgrove-v9';
const FILES = ['./','./index.html','./app.js','./levels.json','./dictionary.json','./definitions.json','./manifest.webmanifest','./icon.svg','./meadow.svg','./field.svg','./moonlit-forest.svg','./waterfall.svg','./autumn-grove.svg','./crystal-lake.svg','./misty-highlands.svg','./sunset-valley.svg'];
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
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  // Let external APIs (dictionary lookups) bypass the service worker entirely
  if (url.origin !== self.location.origin) return;
  event.respondWith((async () => {
    const cached = await caches.match(event.request);
    if (cached) return cached;
    try {
      const response = await fetch(event.request);
      if (response.ok) {
        const cache = await caches.open(CACHE);
        cache.put(event.request, response.clone());
      }
      return response;
    } catch {
      return (await caches.match(event.request)) || (await caches.match('./index.html'));
    }
  })());
});
