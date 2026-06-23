/* ================================================================
   SERVICE WORKER — PAYROLL RADJA
   Strategi: NETWORK FIRST
   Versi cache naikan setiap kali ada update aset
   ================================================================ */

const CACHE_NAME = 'payroll-radja-v2';

// Aset yang di-precache saat install SW
const PRECACHE_URLS = [
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  'https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800;900&display=swap',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css',
  'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js'
];

// ── INSTALL: precache aset statis ────────────────────────────────
self.addEventListener('install', event => {
  console.log('[SW] Installing — Network First', CACHE_NAME);
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return Promise.allSettled(
        PRECACHE_URLS.map(url =>
          fetch(url, { mode: 'no-cors' })
            .then(res => cache.put(url, res))
            .catch(err => console.warn('[SW] Precache gagal:', url, err))
        )
      );
    }).then(() => {
      console.log('[SW] Precache selesai, skipWaiting');
      return self.skipWaiting();
    })
  );
});

// ── ACTIVATE: hapus cache versi lama ─────────────────────────────
self.addEventListener('activate', event => {
  console.log('[SW] Activated:', CACHE_NAME);
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(k => k !== CACHE_NAME)
          .map(k => {
            console.log('[SW] Hapus cache lama:', k);
            return caches.delete(k);
          })
      )
    ).then(() => self.clients.claim())
  );
});

// ── FETCH: Network First ──────────────────────────────────────────
self.addEventListener('fetch', event => {
  const req = event.request;
  const url = req.url;

  // Skip non-GET
  if (req.method !== 'GET') return;

  // Skip chrome extension
  if (url.startsWith('chrome-extension://')) return;

  // Skip Firebase / Firestore — biarkan langsung ke network
  if (
    url.includes('firestore.googleapis.com') ||
    url.includes('firebase.googleapis.com') ||
    url.includes('googleapis.com/identitytoolkit') ||
    url.includes('securetoken.googleapis.com') ||
    url.includes('firebaseapp.com')
  ) return;

  event.respondWith(networkFirst(req));
});

// ── Network First Handler ─────────────────────────────────────────
async function networkFirst(request) {
  const cache = await caches.open(CACHE_NAME);

  try {
    // 1. Coba network dulu
    const networkRes = await fetch(request);

    // Simpan ke cache kalau response valid (status 200)
    if (networkRes && networkRes.status === 200) {
      cache.put(request, networkRes.clone());
    }

    return networkRes;

  } catch (err) {
    // 2. Network gagal — coba ambil dari cache
    console.warn('[SW] Network gagal, pakai cache:', request.url);
    const cached = await cache.match(request);
    if (cached) {
      console.log('[SW] Serve dari cache:', request.url);
      return cached;
    }

    // 3. Tidak ada di cache — tampilkan offline page untuk navigate request
    if (request.mode === 'navigate') {
      const offlinePage = await cache.match('./index.html');
      if (offlinePage) return offlinePage;

      return new Response(
        `<!DOCTYPE html>
        <html lang="id">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width,initial-scale=1">
          <title>Offline — Payroll Radja</title>
          <style>
            body { font-family: sans-serif; text-align: center; padding: 60px 20px;
                   background: #F1F5F9; color: #0F172A; }
            .icon { font-size: 64px; margin-bottom: 16px; }
            h2 { font-size: 22px; font-weight: 800; margin-bottom: 8px; }
            p { color: #64748B; font-size: 14px; line-height: 1.6; }
            button { margin-top: 24px; background: #0EA5E9; color: #fff;
                     border: none; border-radius: 12px; padding: 12px 28px;
                     font-size: 15px; font-weight: 700; cursor: pointer; }
          </style>
        </head>
        <body>
          <div class="icon">📶</div>
          <h2>Tidak Ada Koneksi</h2>
          <p>Aplikasi membutuhkan internet.<br>
             Coba lagi setelah koneksi tersambung.</p>
          <button onclick="location.reload()">🔄 Coba Lagi</button>
        </body>
        </html>`,
        { headers: { 'Content-Type': 'text/html; charset=utf-8' } }
      );
    }

    throw err;
  }
}