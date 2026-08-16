/* Servis çalışanı — uygulama kabuğunu önbelleğe alır, çevrimdışıyken bilgi ekranı gösterir.
   API istekleri ASLA önbelleğe alınmaz; bilet/koltuk verisi her zaman sunucudan gelir.

   ÖNEMLİ: Sürüm numarası her güncellemede değişmelidir. Değişince tarayıcı
   eski önbelleği siler ve yeni dosyaları indirir. */
const SURUM = 'otobus-v2.0.0';

/* Çevrimdışıyken lazım olacak dosyalar */
const KABUK = [
  '/', '/anasayfa.html', '/index.html', '/app.html', '/cevrimdisi.html',
  '/css/style.css', '/css/tailwind.css', '/js/app.js',
  '/manifest.webmanifest',
  '/icons/icon-192.png', '/icons/icon-512.png', '/icons/apple-touch-icon.png'
];

/* Bu dosyalar HER ZAMAN önce ağdan alınır.
   Böylece sisteme yeni bir sürüm yüklendiğinde kullanıcı eski ekranda kalmaz. */
const HEP_AGDAN = /\.(?:js|css|html|webmanifest)$/i;

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(SURUM)
      .then((c) => c.addAll(KABUK))
      .then(() => self.skipWaiting())
      .catch(() => self.skipWaiting())
  );
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

  // Sayfalar ve uygulama dosyaları: önce ağ, internet yoksa önbellek
  if (e.request.mode === 'navigate' || HEP_AGDAN.test(url.pathname) || url.pathname === '/') {
    e.respondWith(
      fetch(e.request)
        .then((r) => {
          if (r && r.status === 200) {
            const kopya = r.clone();
            caches.open(SURUM).then((c) => c.put(e.request, kopya));
          }
          return r;
        })
        .catch(() => caches.match(e.request)
          .then((r) => r || (e.request.mode === 'navigate' ? caches.match('/cevrimdisi.html') : undefined)))
    );
    return;
  }

  // Resim, simge gibi değişmeyen dosyalar: önbellekten hızlı ver, arka planda tazele
  e.respondWith(
    caches.match(e.request).then((cached) => {
      const agdan = fetch(e.request).then((r) => {
        if (r && r.status === 200) { const kopya = r.clone(); caches.open(SURUM).then((c) => c.put(e.request, kopya)); }
        return r;
      }).catch(() => cached);
      return cached || agdan;
    })
  );
});
