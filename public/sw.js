const CACHE_NAME = 'gestion-total-cache-v2';

// Self-destruct and unregister if running in development / sandbox environments
const isDevHost = self.location.hostname === 'localhost' || 
                  self.location.hostname === '127.0.0.1' || 
                  self.location.hostname.includes('run.app') ||
                  self.location.hostname.includes('webcontainer') ||
                  self.location.hostname.includes('ais-dev');

if (isDevHost) {
  self.addEventListener('install', () => {
    self.skipWaiting();
  });
  self.addEventListener('activate', (event) => {
    event.waitUntil(
      caches.keys().then((keys) => Promise.all(keys.map((k) => caches.delete(k))))
        .then(() => self.registration.unregister())
        .then(() => self.clients.matchAll())
        .then((clients) => {
          clients.forEach((client) => client.navigate(client.url));
        })
    );
  });
}

const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/logo.svg',
  '/manifest.json'
];

// Install Event
self.addEventListener('install', (event) => {
  if (isDevHost) return;
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[Service Worker] Caching app shell and core assets');
      return cache.addAll(ASSETS_TO_CACHE);
    }).then(() => self.skipWaiting())
  );
});

// Activate Event
self.addEventListener('activate', (event) => {
  if (isDevHost) return;
  event.waitUntil(
    caches.keys().then((keyList) => {
      return Promise.all(keyList.map((key) => {
        if (key !== CACHE_NAME) {
          console.log('[Service Worker] Removing old cache', key);
          return caches.delete(key);
        }
      }));
    }).then(() => self.clients.claim())
  );
});

// Fetch Event with dynamic network-first with cache-fallback strategy
self.addEventListener('fetch', (event) => {
  if (isDevHost) return;
  const url = new URL(event.request.url);

  // Strictly exclude non-GET, API routes, dev/vite assets, and external cloud services from caching
  if (
    event.request.method !== 'GET' ||
    url.pathname.startsWith('/api/') ||
    url.pathname.startsWith('/node_modules/') ||
    url.pathname.startsWith('/@') ||
    url.pathname.startsWith('/src/') ||
    url.searchParams.has('v') ||
    url.searchParams.has('t') ||
    url.hostname.includes('firestore.googleapis.com') ||
    url.hostname.includes('googleapis.com') ||
    url.hostname.includes('firebase')
  ) {
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        // Fetch fresh in background to update cache (stale-while-revalidate style)
        fetch(event.request).then((networkResponse) => {
          if (networkResponse.status === 200) {
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, networkResponse));
          }
        }).catch(() => {/* Ignore background sync failures */});
        
        return cachedResponse;
      }

      return fetch(event.request).then((response) => {
        // Cache newly fetched valid static assets (only basic successful responses)
        if (response.status === 200 && response.type === 'basic') {
          const responseToCache = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
        }
        return response;
      }).catch(() => {
        // Return index.html for navigation requests when offline (SPA routing support)
        if (event.request.mode === 'navigate') {
          return caches.match('/index.html');
        }
      });
    })
  );
});
