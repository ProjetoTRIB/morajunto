var CACHE_NAME = 'morajunto-v3';
var STATIC_ASSETS = [
  '/',
  '/index.html',
  '/style.css?v=5003',
  '/script.js?v=5003',
  '/roommate.js?v=5003',
  '/republicas.js?v=5003',
  '/icon.svg',
  '/manifest.json'
];

// Install — cache static assets
self.addEventListener('install', function(event) {
  event.waitUntil(
    caches.open(CACHE_NAME).then(function(cache) {
      return cache.addAll(STATIC_ASSETS);
    })
  );
  self.skipWaiting();
});

// Activate — clean old caches
self.addEventListener('activate', function(event) {
  event.waitUntil(
    caches.keys().then(function(keys) {
      return Promise.all(
        keys.filter(function(k) { return k !== CACHE_NAME; })
            .map(function(k) { return caches.delete(k); })
      );
    })
  );
  self.clients.claim();
});

// Fetch — network first for API, cache first for static
self.addEventListener('fetch', function(event) {
  var url = new URL(event.request.url);

  // API calls — network only
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/uploads/')) {
    event.respondWith(fetch(event.request));
    return;
  }

  // Static assets — network first, fallback to cache
  event.respondWith(
    fetch(event.request).then(function(response) {
      if (response.ok && event.request.method === 'GET') {
        var clone = response.clone();
        caches.open(CACHE_NAME).then(function(cache) {
          cache.put(event.request, clone);
        });
      }
      return response;
    }).catch(function() {
      return caches.match(event.request).then(function(cached) {
        if (cached) return cached;
        // Offline fallback for navigation
        if (event.request.mode === 'navigate') {
          return caches.match('/index.html');
        }
      });
    })
  );
});
