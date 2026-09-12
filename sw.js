const CACHE = 'smp-shell-v3';
const SHELL = ['./index.html', './site.css', './appearance.js', './404.html', './not-found.css'];
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith('smp-shell-') && key !== CACHE).map(key => caches.delete(key)))).then(() => clients.claim()));
});
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  const shellURLs = SHELL.map(file => new URL(file, self.registration.scope).href);
  if (event.request.method !== 'GET' || (event.request.mode !== 'navigate' && !shellURLs.includes(url.href))) return;
  event.respondWith(fetch(event.request).then(response => {
    if (response.ok) {
      const copy = response.clone();
      event.waitUntil(caches.open(CACHE).then(cache => cache.put(event.request, copy)));
    }
    return response;
  }).catch(async () => (await caches.match(event.request)) || (event.request.mode === 'navigate' ? caches.match('./index.html') : Response.error())));
});
