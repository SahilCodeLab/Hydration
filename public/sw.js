self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open('pani-piyo-v1').then((cache) => {
      return cache.addAll([
        '/subscribe.html',
        '/manifest.json',
        '/icons/icon-144.png',
        '/icons/icon-512.png',
      ]);
    })
  );
});

self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request).then((response) => {
      return response || fetch(event.request);
    })
  );
});