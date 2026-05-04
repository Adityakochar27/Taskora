/**
 * Service worker — minimal offline shell + auto-update.
 *
 * Strategy:
 *   - HTML and JS bundles: network-first (so deploys reach users fast)
 *   - Static assets (icons, manifest): cache-first
 *   - API calls: network-only (with a fallback to cache for read GETs)
 *
 * skipWaiting + clients.claim ensure a new SW takes over the moment it's
 * installed — no need for users to close all tabs.
 */
const CACHE = 'taskflow-shell-v2';
const ASSETS = ['/manifest.json', '/favicon.svg', '/icon-192.png', '/icon-512.png'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(ASSETS).catch(() => {}))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    Promise.all([
      caches.keys().then((keys) =>
        Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
      ),
      self.clients.claim(),
    ])
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return; // ignore cross-origin

  // API: network-first, fall back to cache for offline GETs
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(request)
        .then((res) => {
          const clone = res.clone();
          caches.open(CACHE).then((c) => c.put(request, clone)).catch(() => {});
          return res;
        })
        .catch(() => caches.match(request))
    );
    return;
  }

  // HTML and JS bundles: network-first to get fresh code
  const isHTML = request.mode === 'navigate' || url.pathname.endsWith('.html');
  const isJS = url.pathname.endsWith('.js') || url.pathname.includes('/assets/');

  if (isHTML || isJS) {
    event.respondWith(
      fetch(request)
        .then((res) => {
          const clone = res.clone();
          caches.open(CACHE).then((c) => c.put(request, clone)).catch(() => {});
          return res;
        })
        .catch(() => caches.match(request).then((c) => c || caches.match('/')))
    );
    return;
  }

  // Everything else (icons, manifest, fonts): cache-first
  event.respondWith(
    caches.match(request).then((cached) => cached || fetch(request))
  );
});

// Allow the page to ask the SW to update itself immediately.
self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting();
});
