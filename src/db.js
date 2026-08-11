'use strict';
const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '..', 'data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const db = new Database(path.join(DATA_DIR, 'otobus.db'));
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  username      TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  full_name     TEXT NOT NULL,
  role          TEXT NOT NULL CHECK (role IN ('admin','acente')),
  agency_name   TEXT,
  phone         TEXT,
  active        INTEGER NOT NULL DEFAULT 1,
  created_at    TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);

CREATE TABLE IF NOT EXISTS buses (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  plate     TEXT NOT NULL UNIQUE,
  name      TEXT NOT NULL,
  rows_cnt  INTEGER NOT NULL DEFAULT 11,
  back_row  INTEGER NOT NULL DEFAULT 1,   -- 1 ise en arkada 5'li sıra var
  capacity  INTEGER NOT NULL,
  notes     TEXT,
  active    INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS routes (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  origin       TEXT NOT NULL,
  destination  TEXT NOT NULL,
  duration_min INTEGER NOT NULL DEFAULT 300,
  active       INTEGER NOT NULL DEFAULT 1,
  UNIQUE (origin, destination)
);

CREATE TABLE IF NOT EXISTS trips (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  route_id     INTEGER NOT NULL REFERENCES routes(id),
  bus_id       INTEGER NOT NULL REFERENCES buses(id),
  depart_date  TEXT NOT NULL,          -- YYYY-MM-DD
  depart_time  TEXT NOT NULL,          -- HH:MM
  price        REAL NOT NULL DEFAULT 0,
  status       TEXT NOT NULL DEFAULT 'acik' CHECK (status IN ('acik','kapali','iptal')),
  notes        TEXT,
  created_at   TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);
CREATE INDEX IF NOT EXISTS idx_trips_date ON trips(depart_date);

CREATE TABLE IF NOT EXISTS groups (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  trip_id       INTEGER NOT NULL REFERENCES trips(id),
  name          TEXT NOT NULL,
  contact_name  TEXT,
  contact_phone TEXT,
  note          TEXT,
  created_by    INTEGER REFERENCES users(id),
  created_at    TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);

CREATE TABLE IF NOT EXISTS tickets (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  pnr            TEXT NOT NULL UNIQUE,
  trip_id        INTEGER NOT NULL REFERENCES trips(id),
  seat_no        INTEGER NOT NULL,
  passenger_name TEXT NOT NULL,
  gender         TEXT NOT NULL CHECK (gender IN ('E','K')),
  tc_no          TEXT,
  phone          TEXT,
  price          REAL NOT NULL DEFAULT 0,
  status         TEXT NOT NULL DEFAULT 'satildi' CHECK (status IN ('satildi','rezerve','iptal')),
  payment_status TEXT NOT NULL DEFAULT 'odenmedi' CHECK (payment_status IN ('odendi','odenmedi','kismi')),
  paid_amount    REAL NOT NULL DEFAULT 0,
  boarded        INTEGER NOT NULL DEFAULT 0,
  group_id       INTEGER REFERENCES groups(id),
  sold_by        INTEGER REFERENCES users(id),
  note           TEXT,
  created_at     TEXT NOT NULL DEFAULT (datetime('now','localtime')),
  cancelled_at   TEXT
);

-- Ayni seferde ayni koltuk sadece bir kez aktif olabilir (iptaller haric)
CREATE UNIQUE INDEX IF NOT EXISTS uq_seat_active
  ON tickets(trip_id, seat_no) WHERE status <> 'iptal';
CREATE INDEX IF NOT EXISTS idx_tickets_trip ON tickets(trip_id);

CREATE TABLE IF NOT EXISTS logs (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    INTEGER,
  username   TEXT,
  action     TEXT NOT NULL,
  detail     TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);

CREATE TABLE IF NOT EXISTS settings (
  key   TEXT PRIMARY KEY,
  value TEXT
);

-- Gönderilen bilet bildirimleri (SMS / WhatsApp)
CREATE TABLE IF NOT EXISTS messages (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  ticket_id    INTEGER REFERENCES tickets(id),
  phone        TEXT NOT NULL,
  channel      TEXT NOT NULL DEFAULT 'sms',
  body         TEXT NOT NULL,
  status       TEXT NOT NULL DEFAULT 'bekliyor' CHECK (status IN ('bekliyor','gonderildi','hata')),
  provider     TEXT,
  provider_ref TEXT,
  error        TEXT,
  created_by   INTEGER REFERENCES users(id),
  created_at   TEXT NOT NULL DEFAULT (datetime('now','localtime')),
  sent_at      TEXT
);
CREATE INDEX IF NOT EXISTS idx_messages_ticket ON messages(ticket_id);
`);

/* ------------------------------------------------------------------
   Sürüm yükseltmeleri
   Eski bir veritabanı üzerine yeni sürüm kurulduğunda eksik sütunları
   sessizce ekler. Var olan veriye dokunmaz.
------------------------------------------------------------------ */
function sutunEkle(tablo, sutun, tanim) {
  const varMi = db.prepare(`PRAGMA table_info(${tablo})`).all().some((c) => c.name === sutun);
  if (!varMi) db.exec(`ALTER TABLE ${tablo} ADD COLUMN ${sutun} ${tanim}`);
}
sutunEkle('buses', 'mid_door', 'INTEGER NOT NULL DEFAULT 0');   // orta kapı var mı
sutunEkle('buses', 'mid_door_row', 'INTEGER NOT NULL DEFAULT 6'); // kaçıncı sırada

// ---------- Koltuk düzeni yardımcıları (2+2) ----------
/**
 * rows    : 2+2 düzeninde normal sıra sayısı (her sıra 4 koltuk)
 * backRow : en arkada 5 koltuklu sıra var mı (+5 koltuk)
 * midDoor : orta kapı var mı (kapı olan sırada sağ taraftaki 2 koltuk yoktur, −2 koltuk)
 * Örn: 10 sıra + arka sıra = 45 koltuk; orta kapılı hâli 43 koltuk
 */
function capacityOf(rows, backRow, midDoor) {
  return rows * 4 + (backRow ? 5 : 0) - (midDoor ? 2 : 0);
}

/**
 * 2+2 düzende koltuk yerleşimi.
 * Her sıra: [sol-pencere, sol-koridor] koridor [sağ-koridor, sağ-pencere]
 * Orta kapı sırasında sağ taraf kapıdır: [sol-pencere, sol-koridor] koridor [KAPI]
 * Numaralandırma kesintisizdir; kapı sırasında sadece 2 numara harcanır.
 * Arka sıra (back_row) varsa 5 koltuk yan yana.
 */
function seatLayout(rows, backRow, midDoor, midDoorRow) {
  const kapiSira = Math.min(Math.max(Number(midDoorRow) || 6, 1), rows);
  const layout = [];
  let n = 1;
  for (let r = 1; r <= rows; r++) {
    if (midDoor && r === kapiSira) {
      layout.push({ type: 'door', seats: [n, n + 1, null, 'kapi', 'kapi'] });
      n += 2;
    } else {
      layout.push({ type: 'row', seats: [n, n + 1, null, n + 2, n + 3] });
      n += 4;
    }
  }
  if (backRow) {
    layout.push({ type: 'back', seats: [n, n + 1, n + 2, n + 3, n + 4] });
  }
  return layout;
}

/**
 * Koltuk numarasından eş koltuğu ve koltuk tipini çıkarır.
 * Yerleşimden türetilir, böylece orta kapı numaraları kaydırsa da doğru çalışır.
 */
function seatIndex(rows, backRow, midDoor, midDoorRow) {
  const harita = new Map();
  for (const sira of seatLayout(rows, backRow, midDoor, midDoorRow)) {
    if (sira.type === 'back') {
      // Arka 5'li sırada yan koltuk kuralı uygulanmaz
      for (const s of sira.seats) harita.set(s, { partner: null, kind: 'arka' });
      continue;
    }
    const [a, b, , c, d] = sira.seats;
    harita.set(a, { partner: b, kind: 'pencere' });
    harita.set(b, { partner: a, kind: 'koridor' });
    if (typeof c === 'number' && typeof d === 'number') {
      harita.set(c, { partner: d, kind: 'koridor' });
      harita.set(d, { partner: c, kind: 'pencere' });
    }
  }
  return harita;
}

/** Yan koltuk eşi. Arka 5'li sırada ve tek kalan koltuklarda null döner. */
function seatPartner(seatNo, rows, backRow, midDoor, midDoorRow) {
  const k = seatIndex(rows, backRow, midDoor, midDoorRow).get(Number(seatNo));
  return k ? k.partner : null;
}

/** Koltuk tipi etiketi: pencere / koridor / arka */
function seatKind(seatNo, rows, backRow, midDoor, midDoorRow) {
  const k = seatIndex(rows, backRow, midDoor, midDoorRow).get(Number(seatNo));
  return k ? k.kind : 'koridor';
}

/* ------------------------------------------------------------------
   Varsayılan firma kimliği
   Logo, ayrı bir dosyaya bağımlı kalmasın diye doğrudan gömülüdür.
   Yönetici Ayarlar ekranından kendi logosunu yükleyerek değiştirebilir.
------------------------------------------------------------------ */
const LOGO_DOSYASI = path.join(__dirname, '..', 'public', 'icons', 'logo-serhend.svg');
let LOGO_VERISI = '';
try {
  LOGO_VERISI = 'data:image/svg+xml;base64,' + fs.readFileSync(LOGO_DOSYASI).toString('base64');
} catch { /* logo dosyası yoksa logosuz devam */ }

const VARSAYILAN_FIRMA = {
  name: 'SERHEND TURİZM',
  slogan: 'Güvenli ve konforlu yolculuk',
  phone: '',
  address: '',
  website: '',
  tax_info: '',
  ticket_note: 'Yolcularımızın kalkış saatinden 15 dakika önce peronda bulunmaları rica olunur. İyi yolculuklar dileriz.',
  logo: LOGO_VERISI
};

/* Daha önce kurulmuş sistemlerde: firma bilgisi hiç ayarlanmadıysa ya da
   eski tanıtım değerleri duruyorsa yeni kimliği yerleştir.
   Yönetici kendi bilgilerini girdiyse ASLA üzerine yazma. */
function firmaKimligiGuncelle() {
  const satir = db.prepare("SELECT value FROM settings WHERE key='company'").get();
  if (!satir) {
    db.prepare('INSERT INTO settings (key,value) VALUES (?,?)').run('company', JSON.stringify(VARSAYILAN_FIRMA));
    return;
  }
  let mevcut = {};
  try { mevcut = JSON.parse(satir.value) || {}; } catch { mevcut = {}; }
  const dokunulmamis = !mevcut.name || ['ÖZ SEYAHAT TURİZM', 'FİRMA ADI', 'REZERVASYON'].includes(mevcut.name);
  if (!dokunulmamis) {
    // Firma adı özelleştirilmiş; sadece logosu hiç yoksa varsayılanı koy
    if (!mevcut.logo && LOGO_VERISI) {
      db.prepare('UPDATE settings SET value=? WHERE key=?')
        .run(JSON.stringify({ ...mevcut, logo: LOGO_VERISI }), 'company');
    }
    return;
  }
  db.prepare('UPDATE settings SET value=? WHERE key=?')
    .run(JSON.stringify({ ...VARSAYILAN_FIRMA, ...(mevcut.phone ? { phone: mevcut.phone } : {}) }), 'company');
}

// ---------- Seed ----------
function seed() {
  const count = db.prepare('SELECT COUNT(*) c FROM users').get().c;
  if (count > 0) return;

  const insUser = db.prepare(
    `INSERT INTO users (username, password_hash, full_name, role, agency_name, phone)
     VALUES (?,?,?,?,?,?)`
  );
  insUser.run('admin', bcrypt.hashSync('admin123', 10), 'Sistem Yöneticisi', 'admin', 'Merkez', '0555 000 00 00');
  insUser.run('acente1', bcrypt.hashSync('acente123', 10), 'Ahmet Yılmaz', 'acente', 'Yılmaz Turizm', '0555 111 11 11');
  insUser.run('acente2', bcrypt.hashSync('acente123', 10), 'Ayşe Demir', 'acente', 'Demir Seyahat', '0555 222 22 22');

  const insBus = db.prepare(
    'INSERT INTO buses (plate, name, rows_cnt, back_row, mid_door, mid_door_row, capacity, notes) VALUES (?,?,?,?,?,?,?,?)'
  );
  // Orta kapılı (6. sırada) — 10 sıra + arka sıra − kapı = 43 koltuk
  insBus.run('34 ABC 123', 'Mercedes Travego', 10, 1, 1, 6, capacityOf(10, 1, 1), 'Klima, WiFi, İkram, orta kapı');
  insBus.run('06 XYZ 456', 'Setra S 517', 11, 1, 1, 6, capacityOf(11, 1, 1), 'Klima, USB priz, orta kapı');
  insBus.run('35 KFL 789', 'Neoplan Tourliner', 13, 0, 0, 6, capacityOf(13, 0, 0), 'Kafile otobüsü, orta kapısız');

  const insRoute = db.prepare('INSERT INTO routes (origin, destination, duration_min) VALUES (?,?,?)');
  insRoute.run('İstanbul', 'Ankara', 330);
  insRoute.run('Ankara', 'İstanbul', 330);
  insRoute.run('İstanbul', 'İzmir', 420);
  insRoute.run('İzmir', 'Antalya', 450);

  const today = new Date();
  const d = (offset) => {
    const x = new Date(today.getTime() + offset * 86400000);
    return x.toISOString().slice(0, 10);
  };
  const insTrip = db.prepare(
    'INSERT INTO trips (route_id, bus_id, depart_date, depart_time, price, notes) VALUES (?,?,?,?,?,?)'
  );
  insTrip.run(1, 1, d(0), '09:00', 850, '');
  insTrip.run(1, 2, d(0), '14:30', 850, '');
  insTrip.run(2, 1, d(1), '10:00', 850, '');
  insTrip.run(3, 2, d(1), '21:00', 1150, 'Gece seferi');
  insTrip.run(3, 3, d(2), '08:00', 1150, 'Kafile için ayrıldı');
  insTrip.run(4, 3, d(3), '07:30', 1400, '');

  db.prepare('INSERT OR REPLACE INTO settings (key,value) VALUES (?,?)').run(
    'company', JSON.stringify(VARSAYILAN_FIRMA)
  );
}

seed();
firmaKimligiGuncelle();

/* ------------------------------------------------------------------
   Yedekleme
   Günde bir kez otomatik yedek alır, son 14 yedeği saklar.
   Yönetici panelinden de anlık yedek indirilebilir.
------------------------------------------------------------------ */
const BACKUP_DIR = path.join(DATA_DIR, 'yedekler');

async function makeBackup(label) {
  if (!fs.existsSync(BACKUP_DIR)) fs.mkdirSync(BACKUP_DIR, { recursive: true });
  const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
  const file = path.join(BACKUP_DIR, `otobus-${label || stamp}.db`);
  await db.backup(file); // çalışırken de tutarlı kopya alır
  return file;
}

function pruneBackups(keep = 14) {
  try {
    const files = fs.readdirSync(BACKUP_DIR)
      .filter((f) => f.endsWith('.db'))
      .map((f) => ({ f, t: fs.statSync(path.join(BACKUP_DIR, f)).mtimeMs }))
      .sort((a, b) => b.t - a.t);
    files.slice(keep).forEach((x) => fs.unlinkSync(path.join(BACKUP_DIR, x.f)));
  } catch { /* yok say */ }
}

function startAutoBackup() {
  const run = async () => {
    try {
      const today = new Date().toISOString().slice(0, 10);
      const target = path.join(BACKUP_DIR, `otobus-${today}.db`);
      if (!fs.existsSync(target)) { await makeBackup(today); pruneBackups(); }
    } catch (e) { console.warn('  ⚠  Otomatik yedek alınamadı:', e.message); }
  };
  run();
  setInterval(run, 6 * 3600 * 1000).unref();
}

module.exports = {
  db, DATA_DIR, BACKUP_DIR,
  capacityOf, seatLayout, seatIndex, seatPartner, seatKind,
  makeBackup, pruneBackups, startAutoBackup
};
