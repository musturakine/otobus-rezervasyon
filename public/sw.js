/* Servis çalışanı — uygulama kabuğunu önbelleğe alır, çevrimdışıyken bilgi ekranı gösterir.
   API istekleri ASLA önbelleğe alınmaz; bilet/koltuk verisi her zaman sunucudan gelir. */
const SURUM = 'otobus-v1.1.0';
const KABUK = [
  '/', '/index.html', '/app.html', '/cevrimdisi.html',
  '/css/style.css', '/js/app.js',
  '/manifest.webmanifest',
  '/icons/icon-192.png', '/icons/icon-512.png', '/icons/apple-touch-icon.png'
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(SURUM).then((c) => c.addAll(KABUK)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((ks) => Promise.all(ks.filter((k) => k !== SURUM).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('message', (e) => { if (e.data === 'guncelle') self.skipWaiting(); });

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return;

  // API ve canlı yayın: her zaman ağdan, önbelleğe alınmaz
  if (url.pathname.startsWith('/api/') || url.pathname === '/saglik') return;

  // Sayfa istekleri: önce ağ, olmazsa önbellek, o da yoksa çevrimdışı ekranı
  if (e.request.mode === 'navigate') {
    e.respondWith(
      fetch(e.request)
        .then((r) => { const cp = r.clone(); caches.open(SURUM).then((c) => c.put(e.request, cp)); return r; })
        .catch(() => caches.match(e.request).then((r) => r || caches.match('/cevrimdisi.html')))
    );
    return;
  }

  // Statik dosyalar: önbellekten hızlı ver, arka planda tazele
  e.respondWith(
    caches.match(e.request).then((cached) => {
      const net = fetch(e.request).then((r) => {
        if (r && r.status === 200) { const cp = r.clone(); caches.open(SURUM).then((c) => c.put(e.request, cp)); }
        return r;
      }).catch(() => cached);
      return cached || net;
    })
  );
});
