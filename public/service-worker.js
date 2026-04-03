// Cache versioning
const CACHE_VERSION = 'forneiro-eden-v3';
const MANIFEST_CACHE = 'manifest-cache-v3';
const MANIFEST_CACHE_TIME = 30 * 60 * 1000; // 30 minutos

const CACHE_URLS = [
  '/',
  '/index.html',
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

// ✅ Fetch manifest dinâmico via Edge Function
async function fetchDynamicManifest(slug) {
  try {
    console.log(`[SW] 📡 Buscando manifest dinâmico para slug: ${slug}`);
    const response = await fetch(`https://towmfxficdkrgfwghcer.supabase.co/functions/v1/get-manifest?tenant_id=${encodeURIComponent(slug)}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response || response.status !== 200) {
      throw new Error(`Manifest fetch failed: ${response.status}`);
    }

    console.log(`[SW] ✅ Manifest dinâmico recebido`);
    return response;
  } catch (error) {
    console.warn('[SW] ❌ Erro ao buscar manifest dinâmico:', error);
    return null;
  }
}

// ✅ Gerenciar cache de manifest com timestamp
async function getCachedManifest() {
  const cache = await caches.open(MANIFEST_CACHE);
  return cache.match('/manifest.json');
}

async function setCachedManifest(response) {
  const cache = await caches.open(MANIFEST_CACHE);
  await cache.put('/manifest.json', response);
}

// Install: cache assets
self.addEventListener('install', (event) => {
  console.log('[SW] Installing service worker...');
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) => {
      console.log('[SW] ✅ Cache opened');
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
  console.log('[SW] Activating service worker...');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
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

// Fetch: network-first, fallback to cache
self.addEventListener('fetch', (event) => {
  // Skip non-GET requests
  if (event.request.method !== 'GET') return;

  // 🔥 PRIORIDADE MÁXIMA: Requisições de navegação (app launch em mobile)
  // Quando usuário clica no ícone da app instalada, precisa servir index.html IMEDIATAMENTE
  if (event.request.mode === 'navigate' || event.request.destination === 'document') {
    event.respondWith(
      (async () => {
        try {
          // 1️⃣ Tentar ir para rede primeiro (app sempre atualizada)
          const networkResponse = await Promise.race([
            fetch(event.request),
            new Promise((_, reject) => setTimeout(() => reject(new Error('Network timeout')), 3000))
          ]);
          
          if (networkResponse.ok) {
            console.log('[SW] ⚡ Navegação servida da rede (rápida)');
            return networkResponse;
          }
        } catch (networkError) {
          console.warn('[SW] ⚠️ Rede lenta ou offline para navegação:', networkError.message);
        }
        
        // 2️⃣ Se rede falhou/lenta, servir index.html do cache IMEDIATAMENTE
        try {
          const cachedIndex = await caches.match('/index.html');
          if (cachedIndex) {
            console.log('[SW] 📦 Navegação servida do cache (fallback rápido)');
            return cachedIndex;
          }
        } catch (cacheError) {
          console.warn('[SW] ⚠️ Erro ao acessar cache:', cacheError);
        }
        
        // 3️⃣ Último recurso: retornar página offline
        return new Response(
          '<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Carregando...</title><style>body{background:#000;color:#fff;display:flex;align-items:center;justify-content:center;height:100vh;font-family:system-ui}div{text-align:center}</style></head><body><div><h1>⏳</h1><p>Carregando aplicação...</p></body></html>',
          { status: 200, headers: { 'Content-Type': 'text/html' } }
        );
      })()
    );
    return;
  }

  // 🔥 SPECIAL HANDLING: /manifest.json (dinâmico)
  if (event.request.url.includes('/manifest.json')) {
    event.respondWith(
      (async () => {
        const slug = getTenantSlugFromHostname();
        
        if (!slug) {
          console.log('[SW] ⚠️ Não foi possível detectar slug, usando manifest.json estático');
          return fetch('/manifest.json');
        }

        try {
          // Tentar buscar manifest dinâmico
          const dynamicResponse = await fetchDynamicManifest(slug);
          if (dynamicResponse) {
            // Cache o manifest dinâmico
            await setCachedManifest(dynamicResponse.clone());
            console.log('[SW] 💾 Manifest dinâmico cacheado');
            return dynamicResponse;
          }
        } catch (error) {
          console.warn('[SW] Erro ao buscar manifest dinâmico:', error);
        }

        // Fallback: usar manifest cacheado ou estático
        const cached = await getCachedManifest();
        if (cached) {
          console.log('[SW] 📦 Retornando manifest cacheado');
          return cached;
        }

        console.log('[SW] 📄 Retornando manifest.json estático');
        return fetch('/manifest.json');
      })()
    );
    return;
  }

  // Skip caching for Supabase APIs (let browser handle, don't block)
  if (event.request.url.includes('/functions/v1/') || event.request.url.includes('supabase')) {
    event.respondWith(
      fetch(event.request).catch(() => {
        // Se falhar, tenta cache, senão retorna erro
        return caches.match(event.request).catch(() => {
          return new Response('Network error', { status: 0 });
        });
      })
    );
    return;
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
    icon: '/logo-192.png',
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
