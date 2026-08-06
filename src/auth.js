'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const { db, DATA_DIR } = require('./db');

/* ------------------------------------------------------------------
   Oturum anahtarı
   Ortam değişkeni verilmemişse rastgele üretip data klasörüne yazar.
   Böylece sunucu yeniden başlatıldığında kimse dışarı atılmaz ve
   varsayılan/tahmin edilebilir bir anahtar kullanılmamış olur.
------------------------------------------------------------------ */
function resolveSecret() {
  if (process.env.JWT_SECRET && process.env.JWT_SECRET.length >= 16) return process.env.JWT_SECRET;
  const file = path.join(DATA_DIR, '.oturum-anahtari');
  try {
    if (fs.existsSync(file)) return fs.readFileSync(file, 'utf8').trim();
    const s = crypto.randomBytes(48).toString('hex');
    fs.writeFileSync(file, s, { mode: 0o600 });
    console.log('  ℹ  JWT_SECRET tanımlı değildi; rastgele bir anahtar üretilip data klasörüne kaydedildi.');
    return s;
  } catch {
    console.warn('  ⚠  Anahtar dosyası yazılamadı; geçici anahtar kullanılıyor (yeniden başlatınca oturumlar kapanır).');
    return crypto.randomBytes(48).toString('hex');
  }
}

const SECRET = resolveSecret();
const TOKEN_TTL = '12h';

function sign(user) {
  return jwt.sign(
    { id: user.id, username: user.username, role: user.role, full_name: user.full_name },
    SECRET,
    { expiresIn: TOKEN_TTL }
  );
}

function readToken(req) {
  const h = req.headers.authorization;
  if (h && h.startsWith('Bearer ')) return h.slice(7);
  if (req.cookies && req.cookies.token) return req.cookies.token;
  if (req.query && req.query.token) return req.query.token; // EventSource için
  return null;
}

function auth(req, res, next) {
  const token = readToken(req);
  if (!token) return res.status(401).json({ error: 'Oturum bulunamadı. Lütfen giriş yapın.' });
  try {
    const payload = jwt.verify(token, SECRET);
    const user = db.prepare('SELECT * FROM users WHERE id = ? AND active = 1').get(payload.id);
    if (!user) return res.status(401).json({ error: 'Kullanıcı pasif veya silinmiş.' });
    req.user = user;
    next();
  } catch {
    return res.status(401).json({ error: 'Oturum süresi doldu. Tekrar giriş yapın.' });
  }
}

function adminOnly(req, res, next) {
  if (req.user.role !== 'admin')
    return res.status(403).json({ error: 'Bu işlem için yönetici yetkisi gerekiyor.' });
  next();
}

function log(req, action, detail) {
  try {
    db.prepare('INSERT INTO logs (user_id, username, action, detail) VALUES (?,?,?,?)').run(
      req.user ? req.user.id : null,
      req.user ? req.user.username : null,
      action,
      typeof detail === 'string' ? detail : JSON.stringify(detail)
    );
  } catch { /* log hatası akışı bozmasın */ }
}

/* ------------------------------------------------------------------
   Giriş deneme sınırı — kaba kuvvet (brute force) saldırısına karşı
------------------------------------------------------------------ */
const attempts = new Map(); // anahtar -> { n, until }
const WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 8;

function clientIp(req) {
  const fwd = req.headers['x-forwarded-for'];
  return (fwd ? String(fwd).split(',')[0] : req.socket.remoteAddress || '').trim();
}

function loginLimiter(req, res, next) {
  const key = clientIp(req) + '|' + String((req.body && req.body.username) || '').toLowerCase();
  const rec = attempts.get(key);
  const now = Date.now();
  if (rec && rec.until > now && rec.n >= MAX_ATTEMPTS) {
    const dk = Math.ceil((rec.until - now) / 60000);
    return res.status(429).json({
      error: `Çok fazla hatalı giriş denemesi. Güvenlik için ${dk} dakika sonra tekrar deneyin.`
    });
  }
  if (rec && rec.until <= now) attempts.delete(key);
  req._loginKey = key;
  next();
}

function noteLoginFail(req) {
  const key = req._loginKey;
  if (!key) return;
  const rec = attempts.get(key) || { n: 0, until: Date.now() + WINDOW_MS };
  rec.n += 1;
  rec.until = Date.now() + WINDOW_MS;
  attempts.set(key, rec);
}
function noteLoginOk(req) { if (req._loginKey) attempts.delete(req._loginKey); }

// Eski kayıtları periyodik temizle
setInterval(() => {
  const now = Date.now();
  for (const [k, v] of attempts) if (v.until <= now) attempts.delete(k);
}, 10 * 60 * 1000).unref();

/* ------------------------------------------------------------------
   Güvenlik başlıkları + https yönlendirmesi
------------------------------------------------------------------ */
function securityHeaders(req, res, next) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('Referrer-Policy', 'same-origin');
  res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
  res.setHeader('Content-Security-Policy',
    "default-src 'self'; " +
    "script-src 'self' 'unsafe-inline'; " +
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; " +
    "font-src 'self' https://fonts.gstatic.com data:; " +
    "img-src 'self' data:; " +
    "connect-src 'self'; " +
    "frame-ancestors 'self'; base-uri 'self'; form-action 'self'");
  if (isSecure(req)) res.setHeader('Strict-Transport-Security', 'max-age=15552000; includeSubDomains');
  next();
}

function isSecure(req) {
  return req.secure || String(req.headers['x-forwarded-proto'] || '').split(',')[0] === 'https';
}

function forceHttps(req, res, next) {
  const enabled = process.env.FORCE_HTTPS === '1' || process.env.NODE_ENV === 'production';
  if (enabled && !isSecure(req) && req.method === 'GET' && req.hostname !== 'localhost') {
    return res.redirect(301, 'https://' + req.headers.host + req.originalUrl);
  }
  next();
}

module.exports = {
  sign, auth, adminOnly, log, SECRET,
  loginLimiter, noteLoginFail, noteLoginOk,
  securityHeaders, forceHttps, isSecure, clientIp
};
