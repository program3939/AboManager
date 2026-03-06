const CACHE = 'aboradar1209-cache-v1';
const ASSETS = ['./', './index.html', './styles.css', './app.js', './manifest.json', './1209.png'];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
  );
  self.clients.claim();
});

self.addEventListener('fetch', event => {
  event.respondWith(caches.match(event.request).then(res => res || fetch(event.request)));
});

self.addEventListener('message', event => {
  if (event.data?.type === 'CHECK_NOW') {
    self.registration.showNotification('AboRadar 1209', {
      body: 'Reminder-System aktiv. Echte Web-Pushes im Hintergrund brauchen später einen Server, weil Browser gern unnötig kompliziert sind.',
      icon: '1209.png',
      badge: '1209.png'
    });
  }
});
