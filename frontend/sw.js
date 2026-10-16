// L'appli s'ouvre instantanément depuis le cache ; le réseau ne sert qu'à se mettre à jour.
const CACHE = 'avant-le-oui-v20';
const SHELL = ['./', 'index.html', 'styles.css', 'app.js', 'config.js', 'manifest.webmanifest', 'fonts/jost.woff', 'icons/icon.svg', 'icons/icon-192.png'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});

// Réseau d'abord, mais pas plus de 2 secondes : au-delà, on ouvre tout de suite depuis le cache
self.addEventListener('fetch', (e) => {
  const req = e.request;
  const url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== location.origin || url.pathname.startsWith('/api/')) return;
  const fromNetwork = fetch(req).then((res) => {
    if (res && res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); }
    return res;
  });
  const timeout = new Promise((_, reject) => setTimeout(reject, 2000));
  e.respondWith(
    Promise.race([fromNetwork, timeout]).catch(() => caches.match(req, { ignoreSearch: true }).then((r) => r || fromNetwork))
  );
});
