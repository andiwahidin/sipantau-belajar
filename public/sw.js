const CACHE_VERSION = 'v6';
const SHELL_CACHE = `pantaubelajar-shell-${CACHE_VERSION}`;
const RUNTIME_CACHE = `pantaubelajar-runtime-${CACHE_VERSION}`;

const APP_SHELL_ASSETS = [
  '/',
  '/index.html',
  '/siswa.html',
  '/privacy.html',
  '/style.css',
  '/style.css?v=9.0',
  '/config.js',
  '/app-guru.js',
  '/app-siswa.js',
  '/pwa.js',
  '/manifest.json',
  '/manifest-siswa.json',
  '/icon.svg',
  '/pwa-192x192.png',
  '/pwa-512x512.png',
  '/pwa-maskable-512x512.png',
  '/apple-touch-icon.png'
];

const CACHEABLE_CDN_HOSTS = new Set([
  'cdn.tailwindcss.com',
  'cdn.jsdelivr.net',
  'cdnjs.cloudflare.com',
  'fonts.googleapis.com',
  'fonts.gstatic.com'
]);

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE).then(async (cache) => {
      // Cache each asset individually so a single failure doesn't abort install
      await Promise.allSettled(
        APP_SHELL_ASSETS.map((url) => cache.add(new Request(url, { cache: 'reload' })))
      );
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== SHELL_CACHE && key !== RUNTIME_CACHE)
          .map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  let url;
  try {
    url = new URL(req.url);
  } catch {
    return;
  }

  // Never intercept Supabase API / Realtime / WebSocket / health checks
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return;
  if (url.hostname.endsWith('supabase.co')) return;
  if (url.pathname === '/health') return;

  // Same-origin App Shell: Network-First with Cache Fallback
  if (url.origin === self.location.origin) {
    event.respondWith(
      fetch(req)
        .then((networkRes) => {
          if (networkRes && networkRes.ok) {
            const copy = networkRes.clone();
            caches.open(SHELL_CACHE).then((cache) => cache.put(req, copy)).catch(() => {});
          }
          return networkRes;
        })
        .catch(async () => {
          const cached = await caches.match(req, { ignoreSearch: false });
          if (cached) return cached;

          const cachedNoSearch = await caches.match(url.pathname);
          if (cachedNoSearch) return cachedNoSearch;

          if (req.mode === 'navigate') {
            if (url.pathname.includes('siswa')) {
              return (await caches.match('/siswa.html')) || caches.match('/index.html');
            }
            return caches.match('/index.html');
          }
          return new Response('', { status: 503, statusText: 'Offline' });
        })
    );
    return;
  }

  // Safe external CDNs (Tailwind, FontAwesome, Chart.js, Supabase SDK, Fonts): Stale-While-Revalidate
  if (CACHEABLE_CDN_HOSTS.has(url.hostname)) {
    event.respondWith(
      caches.open(RUNTIME_CACHE).then(async (cache) => {
        const cached = await cache.match(req);
        const networkPromise = fetch(req)
          .then((res) => {
            if (res && (res.ok || res.type === 'opaque')) {
              cache.put(req, res.clone()).catch(() => {});
            }
            return res;
          })
          .catch(() => null);

        return cached || (await networkPromise) || new Response('', { status: 503, statusText: 'Offline' });
      })
    );
  }
});
