/* Offline support for the web version (the Android app doesn't use it).
   Publishing (scraper/publish_catalogs.py) names VERSION after the app's files,
   so a change reaches phones as an update; by hand, bump it when they change. */
const VERSION = 'segue-994a194f724e';
const SHELL = ['./', 'index.html', 'app.css', 'js/core.js', 'js/i18n.js', 'js/rec.js', 'js/series.js', 'js/views.js', 'js/onboard.js', 'manifest.webmanifest',
  'icons/icon.svg', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/apple-touch-icon.png'];
const COVERS = 'segue-covers';
const FONTS = 'segue-fonts';
// Cover and poster hosts used by the catalogs.
const IMAGE_HOSTS = ['covers.openlibrary.org', 's4.anilist.co', 'static.tvmaze.com', 'image.tmdb.org', 'images.igdb.com',
  'cf.geekdo-images.com', 'coverartarchive.org', 'archive.org', 'assets.hardcover.app'];

self.addEventListener('install', e => {
  // Straight from the server, not the browser's cache, so an update gets the new files.
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(SHELL.map(u => new Request(u, { cache: 'reload' })))).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(
    keys.filter(k => (k.startsWith('ledger-') || k.startsWith('segue-')) && ![VERSION, COVERS, FONTS].includes(k)).map(k => caches.delete(k))
  )).then(() => self.clients.claim()));
});

async function networkFirst(req) {
  const cache = await caches.open(VERSION);
  try {
    const res = await fetch(req, { cache: 'no-cache' });
    if (res.ok) cache.put(req, res.clone());
    return res;
  } catch (e) {
    const hit = await cache.match(req, { ignoreSearch: true });
    if (hit) return hit;
    throw e;
  }
}

async function cacheFirst(req, name) {
  const cache = await caches.open(name);
  const hit = await cache.match(req);
  if (hit) return hit;
  const res = await fetch(req);
  if (res.ok || res.type === 'opaque') cache.put(req, res.clone());
  return res;
}

async function staleWhileRevalidate(req) {
  const cache = await caches.open(VERSION);
  const hit = await cache.match(req, { ignoreSearch: true });
  const fresh = fetch(req).then(res => { if (res.ok) cache.put(req, res.clone()); return res; }).catch(() => hit);
  return hit || fresh;
}

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin === location.origin) {
    if (url.pathname.includes('/data/')) return e.respondWith(networkFirst(req));
    if (url.pathname.includes('/covers/')) return e.respondWith(cacheFirst(req, COVERS));
    if (req.mode === 'navigate') return e.respondWith(networkFirst(new Request('index.html')).catch(() => caches.match('index.html')));
    return e.respondWith(staleWhileRevalidate(req));
  }
  if (IMAGE_HOSTS.some(h => url.hostname === h || url.hostname.endsWith('.' + h))) return e.respondWith(cacheFirst(req, COVERS).catch(() => Response.error()));
});
