// ============================================
// SERVICE WORKER - RADJA PRODUCTION PWA
// ============================================

const CACHE_NAME = 'radja-production-v4';
const STATIC_CACHE = 'radja-static-v4';
const BASE = '/inventory';

const STATIC_ASSETS = [
    BASE + '/manifest.json',
    BASE + '/icon-192.png',
    BASE + '/icon-512.png'
];

// ===== INSTALL =====
self.addEventListener('install', event => {
    console.log('[SW] Installing v4...');
    event.waitUntil(
        caches.open(STATIC_CACHE).then(cache => {
            console.log('[SW] Caching static assets');
            return cache.addAll(STATIC_ASSETS);
        }).then(() => self.skipWaiting())
    );
});

// ===== ACTIVATE =====
self.addEventListener('activate', event => {
    console.log('[SW] Activating v4...');
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames
                    .filter(name => name !== CACHE_NAME && name !== STATIC_CACHE)
                    .map(name => {
                        console.log('[SW] Deleting old cache:', name);
                        return caches.delete(name);
                    })
            );
        }).then(() => self.clients.claim())
    );
});

// ===== FETCH =====
self.addEventListener('fetch', event => {
    const { request } = event;
    const url = new URL(request.url);

    // index.html — SELALU dari network, jangan pernah cache
    if (url.pathname === BASE + '/' || url.pathname === BASE + '/index.html' || url.pathname === BASE) {
        event.respondWith(fetch(request));
        return;
    }

    // Supabase API — selalu dari network
    if (url.hostname.includes('supabase.co')) {
        event.respondWith(
            fetch(request).catch(() => {
                return new Response(
                    JSON.stringify({ error: 'Offline - tidak dapat terhubung ke database' }),
                    { headers: { 'Content-Type': 'application/json' } }
                );
            })
        );
        return;
    }

    // CDN assets — cache first
    if (url.hostname.includes('cdn.') || url.hostname.includes('cdnjs.') || url.hostname.includes('jsdelivr.') || url.hostname.includes('fonts.')) {
        event.respondWith(
            caches.match(request).then(cached => {
                if (cached) return cached;
                return fetch(request).then(response => {
                    const clone = response.clone();
                    caches.open(STATIC_CACHE).then(cache => cache.put(request, clone));
                    return response;
                });
            })
        );
        return;
    }

    // File lain — network first
    event.respondWith(
        fetch(request)
            .then(response => {
                if (response.status === 200) {
                    const clone = response.clone();
                    caches.open(CACHE_NAME).then(cache => cache.put(request, clone));
                }
                return response;
            })
            .catch(() => caches.match(request))
    );
});
