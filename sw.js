/**
 * Navodaya Open 2026 - Progressive Web App Service Worker
 * Provides offline caching, lightning-fast loads, and seamless app installation.
 */

const CACHE_NAME = 'navo-open-v2026.2';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/style.css',
  '/app.js',
  '/manifest.json',
  '/favicon.png',
  '/fav_icon.png',
  '/favicon.ico',
  '/navodaya_open_logo.png',
  '/admin',
  '/admin/index.html',
  '/admin/admin.css',
  '/admin/admin.js',
  '/admin/admin.webmanifest',
  'https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800&family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css',
  'https://res.cloudinary.com/dfciyxbjo/image/upload/v1789324461/logo_open_ralqqy.png',
  'https://res.cloudinary.com/dfciyxbjo/image/upload/v1789506116/fav_icon_x5apkk.png'
];

// Install Event: Pre-cache essential app shell assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return Promise.allSettled(
        STATIC_ASSETS.map((url) =>
          fetch(url, { mode: url.startsWith('http') ? 'cors' : 'same-origin' })
            .then((response) => {
              if (response.ok) {
                return cache.put(url, response);
              }
            })
            .catch(() => {})
        )
      );
    }).then(() => self.skipWaiting())
  );
});

// Activate Event: Clean up legacy caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch Event: Stale-While-Revalidate for UI/Assets, Network-First for API
self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // Ignore non-GET requests (e.g. POST registrations)
  if (req.method !== 'GET') {
    return;
  }

  // Handle API requests: Network-First with Cache Fallback
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(req)
        .then((networkRes) => {
          if (networkRes.ok) {
            const resClone = networkRes.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(req, resClone));
          }
          return networkRes;
        })
        .catch(() => {
          return caches.match(req);
        })
    );
    return;
  }

  // Handle Static & External Assets: Stale-While-Revalidate
  event.respondWith(
    caches.match(req).then((cachedRes) => {
      const fetchPromise = fetch(req)
        .then((networkRes) => {
          if (networkRes && networkRes.status === 200) {
            const resClone = networkRes.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(req, resClone));
          }
          return networkRes;
        })
        .catch(() => {
          // If network fails and no cache exists for HTML page, fallback to cached page
          if (req.headers.get('accept')?.includes('text/html')) {
            if (url.pathname.startsWith('/admin')) {
              return caches.match('/admin/index.html') || caches.match('/admin');
            }
            return caches.match('/index.html') || caches.match('/');
          }
        });

      return cachedRes || fetchPromise;
    })
  );
});

// Listen for message to activate new worker immediately
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
