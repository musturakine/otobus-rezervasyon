'use strict';
const path = require('path');
const express = require('express');
const cookieParser = require('cookie-parser');
const api = require('./src/api');
const { startAutoBackup, DATA_DIR } = require('./src/db');
const { securityHeaders, forceHttps } = require('./src/auth');

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

app.use(express.static(path.join(__dirname, 'public'), {
  extensions: ['html'],
  setHeaders: (res, filePath) => {
    if (/\.(css|js|png|svg|webmanifest)$/.test(filePath)) {
      res.setHeader('Cache-Control', 'public, max-age=3600');
    }
  }
}));

app.use('/api', api);

app.get('/saglik', (req, res) => res.json({ ok: true, time: new Date().toISOString() }));

// Bilinmeyen API yolları
app.use('/api', (req, res) => res.status(404).json({ error: 'Bulunamadı.' }));

// SPA fallback
app.use((req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Sunucu hatası: ' + err.message });
});

const server = app.listen(PORT, HOST, () => {
  startAutoBackup();
  console.log(`
  ╔══════════════════════════════════════════════════╗
  ║   OTOBÜS REZERVASYON VE SATIŞ SİSTEMİ            ║
  ╚══════════════════════════════════════════════════╝

  ▸ Adres      : http://localhost:${PORT}
  ▸ Veri klasörü: ${DATA_DIR}
  ▸ Ortam      : ${process.env.NODE_ENV || 'geliştirme'}

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
