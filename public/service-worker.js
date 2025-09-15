// PDF Compressor PWA Service Worker
// Version: 1.0.1

const VERSION = '1.0.1';
const BASE_PATH = new URL('./', self.location).pathname; // e.g., '/subpath/' or '/'
const OFFLINE_URL = BASE_PATH + 'offline.html';
const CACHE_NAME = `pdf-compressor-v${VERSION}`;

const urlsToCache = [
  BASE_PATH,
  BASE_PATH + 'index.html',
  OFFLINE_URL,
  BASE_PATH + 'manifest.json',
];

self.addEventListener('install', event => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      try {
        await cache.addAll(urlsToCache);
      } catch (_) {
        // Ignore pre-cache failures; runtime fetch handler provides fallbacks
      }
      self.skipWaiting();
    })()
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys.map(key =>
          key === CACHE_NAME ? Promise.resolve() : caches.delete(key)
        )
      );
      self.clients.claim();
    })()
  );
});

self.addEventListener('fetch', event => {
  const { request } = event;

  // Handle navigation requests: online-first with offline fallback
  if (request.mode === 'navigate') {
    event.respondWith(
      (async () => {
        try {
          const response = await fetch(request);
          return response;
        } catch (_) {
          const cached = await caches.match(OFFLINE_URL);
          return cached || new Response('Offline', { status: 503 });
        }
      })()
    );
    return;
  }

  // For other requests: cache-first, then network
  event.respondWith(
    (async () => {
      const cached = await caches.match(request);
      if (cached) return cached;
      try {
        return await fetch(request);
      } catch (_) {
        return cached || Response.error();
      }
    })()
  );
});
