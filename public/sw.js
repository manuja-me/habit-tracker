const CACHE_NAME = 'zenith-cache-v2';
const PUBLIC_ASSETS = new Set(['/manifest.webmanifest', '/icon-192.png', '/icon-512.png', '/apple-icon.png']);

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    // Keep an anonymous app shell for offline navigation.
    await cache.addAll(['/', ...PUBLIC_ASSETS].map((path) =>
      new Request(new URL(path, self.location.origin), { credentials: 'omit', cache: 'reload' })
    ));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((key) => key.startsWith('zenith-cache-') && key !== CACHE_NAME)
      .map((key) => caches.delete(key)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin) return;

  if (request.mode === 'navigate' && url.pathname === '/') {
    event.respondWith(fetch(request).catch(async () =>
      (await caches.match('/', { cacheName: CACHE_NAME })) || Response.error()
    ));
    return;
  }

  if (!url.pathname.startsWith('/_next/static/') && !PUBLIC_ASSETS.has(url.pathname)) return;
  event.respondWith((async () => {
    const cached = await caches.match(request, { cacheName: CACHE_NAME });
    if (cached) return cached;

    const response = await fetch(request);
    if (response.ok && !response.redirected) {
      const cache = await caches.open(CACHE_NAME);
      await cache.put(request, response.clone()).catch(() => {});
    }
    return response;
  })());
});
