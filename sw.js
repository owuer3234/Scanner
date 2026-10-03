/* Service worker: caches the app shell (including the inline ingredient
   database) and the ZXing library so scanning + analysis work offline.
   Bump VERSION whenever you deploy changes so phones pick them up. */
const VERSION = 'v1';
const SHELL_CACHE = 'shell-' + VERSION;
const LIB_CACHE = 'lib-v1';
const API_CACHE = 'api-v1';
const IMG_CACHE = 'img-v1';
const IMG_LIMIT = 60;

const SHELL_FILES = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icon.svg',
  './icon-192.png',
  './icon-512.png',
  './icon-maskable-512.png',
  './apple-touch-icon.png',
  './zxing.min.js'
];
// Keep in sync with ZXING_SOURCES in index.html.
const ZXING_URLS = [
  'https://cdnjs.cloudflare.com/ajax/libs/zxing-js/0.21.3/zxing.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/zxing-js/0.21.3/umd/index.min.js'
];

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const shell = await caches.open(SHELL_CACHE);
    await shell.addAll(SHELL_FILES);
    const lib = await caches.open(LIB_CACHE);
    await Promise.allSettled(ZXING_URLS.map((u) => lib.add(new Request(u, { mode: 'cors' }))));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keep = [SHELL_CACHE, LIB_CACHE, API_CACHE, IMG_CACHE];
    const names = await caches.keys();
    await Promise.all(names.filter((n) => !keep.includes(n)).map((n) => caches.delete(n)));
    await self.clients.claim();
  })());
});

function isProductApi(url) {
  return /(^|\.)open(food|beauty)facts\.org$/.test(url.hostname) && url.pathname.startsWith('/api/');
}
function isProductImage(url) {
  return /^(images|static)\.open(food|beauty)facts\.org$/.test(url.hostname);
}

// Serve cached copy immediately, refresh it in the background.
async function staleWhileRevalidate(event, cacheName, cacheKey) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(cacheKey || event.request, { ignoreSearch: !!cacheKey });
  const network = fetch(event.request).then((res) => {
    if (res && res.ok) cache.put(cacheKey || event.request, res.clone());
    return res;
  }).catch(() => null);
  if (cached) {
    event.waitUntil(network);
    return cached;
  }
  return (await network) || new Response('Offline', { status: 503, statusText: 'Offline' });
}

async function cacheFirst(request, cacheName, limit) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  if (cached) return cached;
  const res = await fetch(request);
  if (res && (res.ok || res.type === 'opaque')) {
    await cache.put(request, res.clone());
    if (limit) {
      const keys = await cache.keys();
      for (let i = 0; i < keys.length - limit; i++) await cache.delete(keys[i]);
    }
  }
  return res;
}

// Live data first; fall back to the last response so previously scanned products work offline.
async function networkFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  try {
    const res = await fetch(request);
    if (res && (res.ok || res.status === 404)) cache.put(request, res.clone());
    return res;
  } catch (err) {
    const cached = await cache.match(request);
    if (cached) return cached;
    throw err;
  }
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  if (url.origin === self.location.origin) {
    if (req.mode === 'navigate') {
      event.respondWith(staleWhileRevalidate(event, SHELL_CACHE, './index.html'));
    } else {
      event.respondWith(staleWhileRevalidate(event, SHELL_CACHE));
    }
    return;
  }
  if (url.hostname === 'cdnjs.cloudflare.com') {
    event.respondWith(cacheFirst(req, LIB_CACHE));
    return;
  }
  if (isProductApi(url)) {
    event.respondWith(networkFirst(req, API_CACHE));
    return;
  }
  if (isProductImage(url)) {
    event.respondWith(cacheFirst(req, IMG_CACHE, IMG_LIMIT).catch(() => new Response('', { status: 504 })));
  }
});
