'use strict';
const path = require('path');
const fs = require('fs');
const express = require('express');
const cookieParser = require('cookie-parser');
const api = require('./src/api');
const { startAutoBackup, DATA_DIR } = require('./src/db');
const { otomatikTemizlikBaslat } = require('./src/trash');
const { securityHeaders, forceHttps } = require('./src/auth');
const durum = require('./src/durum');

const app = express();
const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || '0.0.0.0';

app.set('trust proxy', 1);     // Render / Nginx gibi vekil sunucular arkasında doğru IP ve https tespiti
app.disable('x-powered-by');

app.use(forceHttps);
app.use(securityHeaders);
app.use(express.json({ limit: '1mb' }));
app.use(cookieParser());

// Servis çalışanı her zaman taze olmalı, aksi halde güncellemeler kullanıcıya ulaşmaz
app.get('/sw.js', (req, res) => {
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.sendFile(path.join(__dirname, 'public', 'sw.js'));
});

/* Kurulum denetimi — hangi dosyalar yerinde, hangileri eksik */
app.get('/durum', (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  res.type('html').send(durum.durumSayfasi());
});

/* Dosya varsa gönderir; yoksa siteyi çökertmek yerine yedek sayfayı gösterir.
   Böylece eksik bir dosya yüzünden sistem komple erişilemez hale gelmez. */
function guvenliGonder(dosya, yedek) {
  const tam = path.join(__dirname, 'public', dosya);
  return (req, res) => {
    if (fs.existsSync(tam)) return res.sendFile(tam);
    console.warn(`  ⚠  ${dosya} bulunamadı — yedek sayfa gösteriliyor.`);
    res.status(200).type('html').send(yedek());
  };
}

/* Ana sayfa herkese açık sefer listesidir; personel girişi /giris adresindedir. */
app.get('/', guvenliGonder('anasayfa.html', durum.yedekAnasayfa));
/* Giriş ekranı eksikse yedek sayfa yerine doğrudan durum raporunu göster —
   "personel girişine gidin" demek anlamsız olurdu. */
app.get(['/giris', '/giris.html'], guvenliGonder('index.html', durum.durumSayfasi));

app.use(express.static(path.join(__dirname, 'public'), {
  extensions: ['html'],
  setHeaders: (res, filePath) => {
    if (/\.(css|js|png|svg|webmanifest)$/.test(filePath)) {
      res.setHeader('Cache-Control', 'public, max-age=3600');
    }
  }
}));

app.use('/api', api);

app.get('/saglik', (req, res) => {
  const d = durum.denetle();
  res.json({
    ok: d.saglikli,
    surum: d.surum,
    eksik: d.eksikZorunlu.map((x) => x.yol),
    eksik_gorsel: d.eksikOnerilen.map((x) => x.yol),
    time: new Date().toISOString()
  });
});

// Bilinmeyen API yolları
app.use('/api', (req, res) => res.status(404).json({ error: 'Bulunamadı.' }));

// Bilinmeyen adresler ana sayfaya düşer
app.use(guvenliGonder('anasayfa.html', durum.yedekAnasayfa));

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Sunucu hatası: ' + err.message });
});

const server = app.listen(PORT, HOST, () => {
  startAutoBackup();
  otomatikTemizlikBaslat();
  const d = durum.baslangictaBildir();
  console.log(`
  ╔══════════════════════════════════════════════════╗
  ║   OTOBÜS REZERVASYON VE SATIŞ SİSTEMİ            ║
  ╚══════════════════════════════════════════════════╝

  ▸ Adres      : http://localhost:${PORT}
  ▸ Veri klasörü: ${DATA_DIR}
  ▸ Ortam      : ${process.env.NODE_ENV || 'geliştirme'}
  ▸ Sürüm      : ${d.surum}  ${d.saglikli ? '✓ tüm dosyalar yerinde' : '✗ EKSİK DOSYA VAR → /durum'}

  Aynı ağdaki telefonlardan girmek için bu bilgisayarın
  yerel IP adresini kullanın (örn. http://192.168.1.25:${PORT})

  Kapatmak için: Ctrl + C
`);
});

// Canlı yayın bağlantıları uzun ömürlüdür; zaman aşımını kapat
server.keepAliveTimeout = 76000;
server.headersTimeout = 80000;
server.requestTimeout = 0;

function shutdown(sig) {
  console.log(`\n  ${sig} alındı, sunucu kapatılıyor…`);
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 4000).unref();
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
