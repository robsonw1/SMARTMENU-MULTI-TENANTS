// Cache versioning
const CACHE_VERSION = 'forneiro-eden-v1';
const CACHE_URLS = [
  '/',
  '/index.html',
  '/manifest.json',
];

// Install: cache assets
self.addEventListener('install', (event) => {
  console.log('[SW] Installing service worker...');
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) => {
      console.log('[SW] ✅ Cache opened');
      return cache.addAll(CACHE_URLS).catch((error) => {
        console.warn('[SW] ⚠️ Some assets could not be cached:', error);
        // Não falha se alguns assets não conseguir cachear
        return Promise.resolve();
      });
    })
  );
  self.skipWaiting();
});

// Activate: cleanup old caches
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating service worker...');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_VERSION) {
            console.log('[SW] Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// Fetch: network-first, fallback to cache
self.addEventListener('fetch', (event) => {
  // Skip non-GET requests
  if (event.request.method !== 'GET') return;

  // Skip some URLs that shouldn't be cached
  if (event.request.url.includes('/api/') || event.request.url.includes('supabase')) {
    return; // Let network handle it without caching
  }

  // Skip chrome-extension URLs and other non-http protocols
  if (!event.request.url.startsWith('http://') && !event.request.url.startsWith('https://')) {
    console.warn('[SW] Skipping non-http request:', event.request.url);
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // Only cache successful responses
        if (!response || response.status !== 200) {
          return response;
        }

        // Clone the response before caching
        const clonedResponse = response.clone();
        caches.open(CACHE_VERSION).then((cache) => {
          cache.put(event.request, clonedResponse).catch((error) => {
            console.warn('[SW] Cache.put error:', error.message);
          });
        });
        return response;
      })
      .catch((error) => {
        console.warn('[SW] Fetch failed:', error.message);
        // Network failed, try cache
        return caches.match(event.request).then((cachedResponse) => {
          return (
            cachedResponse ||
            new Response('Offline - recurso não disponível', {
              status: 503,
              statusText: 'Service Unavailable',
            })
          );
        });
      })
  );
});

// Push notification received
self.addEventListener('push', (event) => {
  if (!event.data) {
    console.log('[SW] Push event without data');
    return;
  }

  let notificationData = {};

  try {
    notificationData = event.data.json();
  } catch {
    notificationData = {
      title: 'Notificação',
      body: event.data.text(),
    };
  }

  console.log('[SW] 🔔 Push notification received:', notificationData);

  const options = {
    icon: '/manifest.json width=192 height=192',
    badge: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96"><circle cx="48" cy="48" r="48" fill="%23ff9500"/></svg>',
    tag: notificationData.tag || 'forneiro-eden-notification',
    requireInteraction: notificationData.requireInteraction ?? false,
    data: notificationData.data || {},
    actions: notificationData.actions || [],
  };

  event.waitUntil(
    self.registration.showNotification(notificationData.title || 'Forneiro Eden', options)
  );
});

// Notification click handler
self.addEventListener('notificationclick', (event) => {
  console.log('[SW] 📲 Notification clicked:', event.notification.tag);
  event.notification.close();

  const urlToOpen = event.notification.data.url || '/';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // Procurar janela já aberta
      for (let client of clientList) {
        if (client.url === urlToOpen && 'focus' in client) {
          return client.focus();
        }
      }
      // Abrir nova janela se não houver
      if (self.clients.openWindow) {
        return self.clients.openWindow(urlToOpen);
      }
    })
  );
});

// Notification close handler
self.addEventListener('notificationclose', (event) => {
  console.log('[SW] 🚫 Notification dismissed:', event.notification.tag);
});

console.log('[SW] Service Worker loaded');
