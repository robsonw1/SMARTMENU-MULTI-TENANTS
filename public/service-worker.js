// Cache versioning - v4: Dynamic manifest via Edge Function
const CACHE_VERSION = 'forneiro-eden-v4';
const MANIFEST_CACHE = 'manifest-cache-v4'; // Separate cache for dynamic manifest
const CACHE_URLS = [
  '/',
  '/index.html',
  // ✅ REMOVED /manifest.json - now dynamic via Edge Function
];

// ✅ Detectar tenant slug do hostname
function getTenantSlugFromHostname() {
  try {
    const hostname = self.location.hostname;
    // Formato: {slug}.app.aezap.site ou {slug}.aezap.site
    const match = hostname.match(/^([a-z0-9-]+)\./i);
    if (match && match[1] && match[1] !== 'app') {
      return match[1];
    }
  } catch (error) {
    console.warn('[SW] Erro ao detectar hostname:', error);
  }
  return null;
}

// ✅ Buscar manifest dinâmico da Edge Function
async function fetchDynamicManifest(slug) {
  try {
    const url = `https://towmfxficdkrgfwghcer.supabase.co/functions/v1/get-manifest?tenant_id=${encodeURIComponent(slug)}`;
    console.log(`[SW] 📡 Buscando manifest dinâmico: ${slug}`);
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response || response.status !== 200) {
      console.warn(`[SW] ⚠️ Manifest fetch failed: ${response.status}`);
      return null;
    }

    console.log(`[SW] ✅ Manifest dinâmico recebido`);
    return response;
  } catch (error) {
    console.warn('[SW] ❌ Erro ao buscar manifest dinâmico:', error);
    return null;
  }
}

// Install: cache assets (SEM manifest.json)
self.addEventListener('install', (event) => {
  console.log('[SW] Installing service worker v4...');
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) => {
      console.log('[SW] ✅ Cache v4 opened');
      return cache.addAll(CACHE_URLS).catch((error) => {
        console.warn('[SW] ⚠️ Some assets could not be cached:', error);
        return Promise.resolve();
      });
    })
  );
  self.skipWaiting();
});

// Activate: cleanup old caches
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating service worker v4...');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          // Keep v4 caches, delete everything else
          if (cacheName !== CACHE_VERSION && cacheName !== MANIFEST_CACHE) {
            console.log('[SW] Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// ✅ SPECIAL: Intercept /manifest.json and call Edge Function
self.addEventListener('fetch', (event) => {
  // Skip non-GET requests
  if (event.request.method !== 'GET') return;

  // 🔥 SPECIAL HANDLING: /manifest.json (DYNAMIC)
  if (event.request.url.endsWith('/manifest.json') || event.request.url.includes('/manifest.json')) {
    event.respondWith(
      (async () => {
        const slug = getTenantSlugFromHostname();
        
        if (!slug) {
          console.log('[SW] ⚠️ Could not detect slug, returning fallback');
          // Fallback: return minimal manifest
          return new Response(
            JSON.stringify({
              "name": "Pizzaria Forneiro Eden",
              "short_name": "Forneiro Eden",
              "start_url": "/",
              "display": "standalone",
              "icons": []
            }),
            { headers: { 'Content-Type': 'application/json' } }
          );
        }

        try {
          // Try to fetch dynamic manifest from Edge Function
          const dynamicResponse = await fetchDynamicManifest(slug);
          if (dynamicResponse) {
            // Cache the dynamic manifest
            const cache = await caches.open(MANIFEST_CACHE);
            await cache.put(event.request, dynamicResponse.clone());
            console.log('[SW] 💾 Manifest dinâmico cacheado');
            return dynamicResponse;
          }
        } catch (error) {
          console.warn('[SW] Erro ao buscar manifest dinâmico:', error);
        }

        // Fallback: try cached manifest
        const cached = await caches.match(event.request);
        if (cached) {
          console.log('[SW] 📦 Retornando manifest cacheado');
          return cached;
        }

        // Last resort: return minimal manifest
        console.log('[SW] 📄 Retornando manifest minimal');
        return new Response(
          JSON.stringify({
            "name": "Pizzaria Forneiro Eden",
            "short_name": "Forneiro Eden",
            "start_url": "/",
            "display": "standalone",
            "icons": []
          }),
          { headers: { 'Content-Type': 'application/json' } }
        );
      })()
    );
    return;
  }

  // Skip APIs - let browser handle without caching
  if (event.request.url.includes('/api/') || event.request.url.includes('supabase') || event.request.url.includes('/functions/')) {
    return;
  }

  // Skip chrome-extension URLs and other non-http protocols
  if (!event.request.url.startsWith('http://') && !event.request.url.startsWith('https://')) {
    console.warn('[SW] Skipping non-http request:', event.request.url);
    return;
  }

  // 📱 Normal fetch: network-first, fallback to cache
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
