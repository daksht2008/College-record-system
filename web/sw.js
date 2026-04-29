// EduSync Service Worker - Offline-First Architecture
const CACHE_VERSION = 'edusync-v1';
const CACHE_ASSETS = CACHE_VERSION + '-assets';
const CACHE_DYNAMIC = CACHE_VERSION + '-dynamic';

const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/dashboard.html',
  '/admin.html',
  '/files.html',
  '/app.js',
  '/styles.css',
  '/manifest.json'
];

// Install Event - Cache Static Assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_ASSETS).then((cache) => {
      return cache.addAll(STATIC_ASSETS).catch(err => {
        console.log('Partial cache failed:', err);
        return cache.addAll(STATIC_ASSETS.filter(url => url !== '/'));
      });
    }).then(() => self.skipWaiting())
  );
});

// Activate Event - Clean Old Caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_ASSETS && cacheName !== CACHE_DYNAMIC) {
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch Event - Network First with Cache Fallback
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests and external URLs
  if (request.method !== 'GET') {
    return;
  }

  // API calls - Network first, cache fallback
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const cache = caches.open(CACHE_DYNAMIC);
            cache.then(c => c.put(request, response.clone()));
          }
          return response;
        })
        .catch(() => {
          // Return cached version if network fails
          return caches.match(request);
        })
    );
  } else {
    // Static assets - Cache first, network fallback
    event.respondWith(
      caches.match(request).then((cachedResponse) => {
        return cachedResponse || fetch(request).then((response) => {
          // Cache new assets
          if (response.ok && !url.pathname.includes('node_modules')) {
            caches.open(CACHE_DYNAMIC).then(c => c.put(request, response.clone()));
          }
          return response;
        }).catch(() => {
          // Return a fallback page if both cache and network fail
          if (request.destination === 'document') {
            return caches.match('/index.html');
          }
        });
      })
    );
  }
});

// Background Sync - Sync attendance when back online
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-attendance') {
    event.waitUntil(
      self.clients.matchAll().then((clients) => {
        clients.forEach((client) => {
          client.postMessage({
            type: 'SYNC_ATTENDANCE',
            payload: {}
          });
        });
      })
    );
  }
});
