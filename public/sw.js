const VERSION = 'slr-v1.1.0';
const SHELL = `${VERSION}-shell`;
const RUNTIME = `${VERSION}-runtime`;
const APP_SHELL = ['/', '/index.html', '/demo/', '/demo/index.html', '/offline.html', '/offline.css', '/privacy/', '/terms/', '/404.html', '/robots.txt', '/sitemap.xml', '/manifest.webmanifest', '/assets/icon.svg', '/assets/icon-192.png', '/assets/icon-512.png', '/assets/receiving-run.webp', '/assets/social-preview.webp'];

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const isUpdate = Boolean(self.registration.active);
    const cache = await caches.open(SHELL);
    await cache.addAll(APP_SHELL);
    const index = await fetch('/index.html');
    const html = await index.clone().text();
    const builtAssets = [...html.matchAll(/(?:src|href)="(\/assets\/[^"]+)"/g)].map((match) => match[1]);
    await cache.put('/index.html', index);
    await cache.addAll([...new Set(builtAssets)]);
    if (isUpdate) {
      const clients = await self.clients.matchAll({ includeUncontrolled: true });
      clients.forEach((client) => client.postMessage({ type: 'UPDATE_AVAILABLE' }));
    }
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((key) => ![SHELL, RUNTIME].includes(key)).map((key) => caches.delete(key)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (url.origin !== location.origin) return;
  if (event.request.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        const response = await fetch(event.request);
        const cache = await caches.open(RUNTIME);
        cache.put(event.request, response.clone());
        return response;
      } catch {
        return (await caches.match(event.request)) || (await caches.match('/index.html')) || caches.match('/offline.html');
      }
    })());
    return;
  }
  event.respondWith((async () => {
    const cached = await caches.match(url.pathname);
    if (cached) return cached;
    try {
      const response = await fetch(event.request);
      if (response.ok) (await caches.open(RUNTIME)).put(event.request, response.clone());
      return response;
    } catch { return new Response('', { status: 504, statusText: 'Offline' }); }
  })());
});
