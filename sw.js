const CACHE = 'wordgrove-v29';
const SHELL = ['./','./index.html','./app.js','./sw.js','./manifest.webmanifest'];
const ASSETS = ['./audio/README.md','./bg-meadow.jpg','./bg-field.jpg','./bg-moonlit-forest.jpg','./bg-waterfall.jpg','./bg-autumn-grove.jpg','./bg-crystal-lake.jpg','./bg-misty-highlands.jpg','./bg-sunset-valley.jpg','./levels.json','./dictionary.json','./definitions.json','./icon.svg','./meadow.svg','./field.svg','./moonlit-forest.svg','./waterfall.svg','./autumn-grove.svg','./crystal-lake.svg','./misty-highlands.svg','./sunset-valley.svg'];
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

self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
});

function isShell(url) {
  const path = url.pathname.replace(/\/+$/, '') || '/';
  const name = path.split('/').pop() || 'index.html';
  return (
    path.endsWith('/') ||
    name === 'index.html' ||
    name === 'app.js' ||
    name === 'sw.js' ||
    name.startsWith('sw.js') ||
    name === 'manifest.webmanifest'
  );
}

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;

  if (isShell(url) || event.request.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        const response = await fetch(event.request, { cache: 'no-cache' });
        if (response && response.ok) {
          const cache = await caches.open(CACHE);
          cache.put(event.request, response.clone());
          // Also store clean URLs without query
          if (url.pathname.endsWith('app.js') || url.pathname.endsWith('index.html')) {
            cache.put(url.pathname, response.clone());
          }
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
