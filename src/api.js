'use strict';
const express = require('express');
const bcrypt = require('bcryptjs');
const { db, capacityOf, seatLayout, seatIndex, seatPartner, seatKind, makeBackup, BACKUP_DIR, demoSayimi } = require('./db');
const {
  sign, auth, adminOnly, log,
  loginLimiter, noteLoginFail, noteLoginOk, isSecure
} = require('./auth');
const events = require('./events');
const sms = require('./sms');
const trash = require('./trash');

const router = express.Router();

// ------------------------------------------------------------------
// Yardımcılar
// ------------------------------------------------------------------
const PNR_CHARS = 'ACDEFGHJKLMNPRTUVWXY345679';
function newPnr() {
  for (let i = 0; i < 50; i++) {
    let s = '';
    for (let j = 0; j < 6; j++) s += PNR_CHARS[Math.floor(Math.random() * PNR_CHARS.length)];
    const exists = db.prepare('SELECT 1 FROM tickets WHERE pnr = ?').get(s);
    if (!exists) return s;
  }
  return 'B' + Date.now().toString(36).toUpperCase();
}

function tripDetail(id) {
  return db
    .prepare(
      `SELECT t.*, r.origin, r.destination, r.duration_min,
              b.plate, b.name AS bus_name, b.rows_cnt, b.back_row, b.mid_door, b.mid_door_row, b.capacity
       FROM trips t
       JOIN routes r ON r.id = t.route_id
       JOIN buses  b ON b.id = t.bus_id
       WHERE t.id = ?`
    )
    .get(id);
}

function ok(res, data) { res.json(data); }
function bad(res, msg, code = 400) { res.status(code).json({ error: msg }); }

// ------------------------------------------------------------------
// Kimlik doğrulama
// ------------------------------------------------------------------
router.post('/login', loginLimiter, (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) return bad(res, 'Kullanıcı adı ve şifre gerekli.');
  const user = db.prepare('SELECT * FROM users WHERE username = ?').get(String(username).trim());
  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    noteLoginFail(req);
    return bad(res, 'Kullanıcı adı veya şifre hatalı.', 401);
  }
  if (!user.active) return bad(res, 'Hesabınız pasif durumda. Yönetici ile görüşün.', 403);
  noteLoginOk(req);

  const token = sign(user);
  res.cookie('token', token, {
    httpOnly: true, sameSite: 'lax', secure: isSecure(req), maxAge: 12 * 3600 * 1000
  });
  db.prepare('INSERT INTO logs (user_id, username, action, detail) VALUES (?,?,?,?)')
    .run(user.id, user.username, 'giris', 'Sisteme giriş yapıldı');
  ok(res, {
    token,
    user: { id: user.id, username: user.username, full_name: user.full_name, role: user.role, agency_name: user.agency_name }
  });
});

router.post('/logout', (req, res) => { res.clearCookie('token'); ok(res, { ok: true }); });

/** Varsayılan/zayıf şifre hâlâ kullanılıyor mu? (arayüzde uyarı göstermek için) */
function usingWeakPassword(user) {
  return ['admin123', 'acente123', '12345', '123456'].some((p) => bcrypt.compareSync(p, user.password_hash));
}

router.get('/me', auth, (req, res) => {
  const u = req.user;
  ok(res, {
    id: u.id, username: u.username, full_name: u.full_name, role: u.role,
    agency_name: u.agency_name, weak_password: usingWeakPassword(u)
  });
});

router.post('/me/password', auth, (req, res) => {
  const { current, next } = req.body || {};
  if (!next || next.length < 5) return bad(res, 'Yeni şifre en az 5 karakter olmalı.');
  if (!bcrypt.compareSync(current || '', req.user.password_hash)) return bad(res, 'Mevcut şifre hatalı.');
  db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(bcrypt.hashSync(next, 10), req.user.id);
  log(req, 'sifre_degistir', 'Kendi şifresini değiştirdi');
  ok(res, { ok: true });
});

/* ==================================================================
   HERKESE AÇIK UÇLAR — oturum gerektirmez
   ------------------------------------------------------------------
   Ziyaretçiler sefer ve koltuk doluluğunu görebilir; satış yapamaz.
   Yolcu adı, telefon, T.C., PNR gibi kişisel bilgiler ASLA gönderilmez.
   Sadece "bu koltuk dolu ve yolcusu bay/bayan" bilgisi paylaşılır —
   yandaki koltuğu alabilir mi bilsin diye.
================================================================== */
router.get('/public/settings', (req, res) => {
  const c = getCompany();
  /* Sistem henüz kurulmamışsa (tek yönetici, şifre hâlâ varsayılan) giriş
     ekranında ilk kurulum bilgisi gösterilir. Şifre değiştirilir değiştirilmez
     bu bilgi kaybolur. */
  let ilkKurulum = false;
  try {
    const sayi = db.prepare('SELECT COUNT(*) c FROM users').get().c;
    if (sayi === 1) {
      const yonetici = db.prepare("SELECT password_hash FROM users WHERE role='admin'").get();
      ilkKurulum = !!yonetici && bcrypt.compareSync('admin123', yonetici.password_hash);
    }
  } catch { /* önemsiz */ }

  ok(res, {
    ilk_kurulum: ilkKurulum,
    company: {
      name: c.name, slogan: c.slogan, phone: c.phone,
      address: c.address, website: c.website, logo: c.logo
    }
  });
});

router.get('/public/routes', (req, res) => {
  ok(res, db.prepare(
    `SELECT DISTINCT r.id, r.origin, r.destination
     FROM routes r JOIN trips t ON t.route_id = r.id
     WHERE r.active = 1 AND t.status = 'acik' AND t.depart_date >= date('now','localtime')
     ORDER BY r.origin, r.destination`
  ).all());
});

router.get('/public/trips', (req, res) => {
  const { date, from, to, route_id, q } = req.query;
  const where = ["t.status = 'acik'", "t.depart_date >= date('now','localtime')"];
  const params = [];
  if (date) { where.push('t.depart_date = ?'); params.push(date); }
  if (from) { where.push('t.depart_date >= ?'); params.push(from); }
  if (to) { where.push('t.depart_date <= ?'); params.push(to); }
  if (route_id) { where.push('t.route_id = ?'); params.push(Number(route_id)); }
  if (q) { where.push('(r.origin LIKE ? OR r.destination LIKE ?)'); params.push(`%${q}%`, `%${q}%`); }

  const rows = db.prepare(`
    SELECT t.id, t.depart_date, t.depart_time, t.price, t.notes,
           r.origin, r.destination, r.duration_min,
           b.name AS bus_name, b.capacity,
           (SELECT COUNT(*) FROM tickets tk WHERE tk.trip_id = t.id AND tk.status <> 'iptal') AS sold
    FROM trips t
    JOIN routes r ON r.id = t.route_id
    JOIN buses  b ON b.id = t.bus_id
    WHERE ${where.join(' AND ')}
    ORDER BY t.depart_date, t.depart_time
    LIMIT 300`).all(...params);

  // Plaka ve iç bilgiler dışarı verilmez; sadece boş koltuk sayısı
  ok(res, rows.map((t) => ({
    id: t.id, depart_date: t.depart_date, depart_time: t.depart_time,
    origin: t.origin, destination: t.destination, duration_min: t.duration_min,
    price: t.price, notes: t.notes, bus_name: t.bus_name,
    capacity: t.capacity, empty: t.capacity - t.sold
  })));
});

router.get('/public/trips/:id/seatmap', (req, res) => {
  const trip = tripDetail(Number(req.params.id));
  if (!trip || trip.status !== 'acik') return bad(res, 'Sefer bulunamadı.', 404);
  if (trip.depart_date < new Date().toLocaleDateString('en-CA')) return bad(res, 'Sefer bulunamadı.', 404);

  const dolu = new Map(db.prepare(
    "SELECT seat_no, gender FROM tickets WHERE trip_id = ? AND status <> 'iptal'"
  ).all(trip.id).map((t) => [t.seat_no, t.gender]));

  const layout = seatLayout(trip.rows_cnt, trip.back_row, trip.mid_door, trip.mid_door_row);
  const index = seatIndex(trip.rows_cnt, trip.back_row, trip.mid_door, trip.mid_door_row);

  const seats = [];
  for (let n = 1; n <= trip.capacity; n++) {
    const g = dolu.get(n) || null;
    const bilgi = index.get(n) || {};
    const es = bilgi.partner ? dolu.get(bilgi.partner) || null : null;
    seats.push({
      seat_no: n,
      kind: bilgi.kind || 'koridor',
      occupied: !!g,
      gender: g,                                  // sadece E / K — isim yok
      requires_gender: !g && es ? es : null        // boşsa ve yanı doluysa hangi cinsiyet gerekir
    });
  }

  ok(res, {
    trip: {
      id: trip.id, origin: trip.origin, destination: trip.destination,
      depart_date: trip.depart_date, depart_time: trip.depart_time,
      price: trip.price, notes: trip.notes, bus_name: trip.bus_name,
      capacity: trip.capacity, rows_cnt: trip.rows_cnt, back_row: trip.back_row,
      mid_door: trip.mid_door, mid_door_row: trip.mid_door_row
    },
    layout, seats,
    stats: { dolu: dolu.size, bos: trip.capacity - dolu.size }
  });
});

router.use(auth); // buradan sonrası oturum ister

/* ------------------------------------------------------------------
   Canlı yayın — açık olan tüm terminaller anlık haberleşir
------------------------------------------------------------------ */
router.get('/stream', (req, res) => events.addClient(req, res, req.user));

const notifySeat = (req, trip_id, action, extra) =>
  events.publish('seat', { trip_id, action, by: req.user.full_name, ...extra });
const notifyTrip = (req, action, extra) =>
  events.publish('trip', { action, by: req.user.full_name, ...extra });

// ------------------------------------------------------------------
// Kullanıcılar (sadece yönetici)
// ------------------------------------------------------------------
router.get('/users', adminOnly, (req, res) => {
  ok(res, db.prepare('SELECT id,username,full_name,role,agency_name,phone,active,created_at FROM users ORDER BY id').all());
});

router.post('/users', adminOnly, (req, res) => {
  const { username, password, full_name, role, agency_name, phone } = req.body || {};
  if (!username || !password || !full_name) return bad(res, 'Kullanıcı adı, şifre ve ad soyad zorunlu.');
  if (!['admin', 'acente'].includes(role)) return bad(res, 'Geçersiz rol.');
  if (password.length < 5) return bad(res, 'Şifre en az 5 karakter olmalı.');
  if (db.prepare('SELECT 1 FROM users WHERE username = ?').get(username)) return bad(res, 'Bu kullanıcı adı zaten kayıtlı.');
  const info = db.prepare(
    'INSERT INTO users (username,password_hash,full_name,role,agency_name,phone) VALUES (?,?,?,?,?,?)'
  ).run(username.trim(), bcrypt.hashSync(password, 10), full_name.trim(), role, agency_name || null, phone || null);
  log(req, 'kullanici_ekle', { username, role });
  ok(res, { id: info.lastInsertRowid });
});

router.put('/users/:id', adminOnly, (req, res) => {
  const id = Number(req.params.id);
  const u = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
  if (!u) return bad(res, 'Kullanıcı bulunamadı.', 404);
  const { full_name, role, agency_name, phone, active, password } = req.body || {};
  if (id === req.user.id && (active === 0 || (role && role !== 'admin')))
    return bad(res, 'Kendi hesabınızın yetkisini/durumunu değiştiremezsiniz.');
  db.prepare(
    `UPDATE users SET full_name = ?, role = ?, agency_name = ?, phone = ?, active = ? WHERE id = ?`
  ).run(full_name ?? u.full_name, role ?? u.role, agency_name ?? u.agency_name, phone ?? u.phone,
        active === undefined ? u.active : (active ? 1 : 0), id);
  if (password) {
    if (password.length < 5) return bad(res, 'Şifre en az 5 karakter olmalı.');
    db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(bcrypt.hashSync(password, 10), id);
  }
  log(req, 'kullanici_guncelle', { id });
  ok(res, { ok: true });
});

// ------------------------------------------------------------------
// Otobüsler
// ------------------------------------------------------------------
router.get('/buses', (req, res) => {
  ok(res, db.prepare('SELECT * FROM buses ORDER BY active DESC, plate').all());
});

router.post('/buses', adminOnly, (req, res) => {
  const { plate, name, rows_cnt, back_row, mid_door, mid_door_row, notes } = req.body || {};
  if (!plate || !name) return bad(res, 'Plaka ve otobüs adı zorunlu.');
  const rows = Number(rows_cnt) || 11;
  if (rows < 5 || rows > 20) return bad(res, 'Sıra sayısı 5 ile 20 arasında olmalı.');
  const br = back_row ? 1 : 0;
  const md = mid_door ? 1 : 0;
  const mdr = Number(mid_door_row) || 6;
  if (md && (mdr < 2 || mdr > rows))
    return bad(res, `Orta kapı sırası 2 ile ${rows} arasında olmalı.`);
  if (db.prepare('SELECT 1 FROM buses WHERE plate = ?').get(plate)) return bad(res, 'Bu plaka zaten kayıtlı.');
  const info = db.prepare(
    'INSERT INTO buses (plate,name,rows_cnt,back_row,mid_door,mid_door_row,capacity,notes) VALUES (?,?,?,?,?,?,?,?)'
  ).run(plate.trim().toUpperCase(), name.trim(), rows, br, md, mdr, capacityOf(rows, br, md), notes || null);
  log(req, 'otobus_ekle', { plate });
  ok(res, { id: info.lastInsertRowid });
});

router.put('/buses/:id', adminOnly, (req, res) => {
  const id = Number(req.params.id);
  const b = db.prepare('SELECT * FROM buses WHERE id = ?').get(id);
  if (!b) return bad(res, 'Otobüs bulunamadı.', 404);
  const { plate, name, rows_cnt, back_row, mid_door, mid_door_row, notes, active } = req.body || {};
  const rows = rows_cnt === undefined ? b.rows_cnt : Number(rows_cnt);
  const br = back_row === undefined ? b.back_row : (back_row ? 1 : 0);
  const md = mid_door === undefined ? b.mid_door : (mid_door ? 1 : 0);
  const mdr = mid_door_row === undefined ? b.mid_door_row : (Number(mid_door_row) || 6);
  if (rows < 5 || rows > 20) return bad(res, 'Sıra sayısı 5 ile 20 arasında olmalı.');
  if (md && (mdr < 2 || mdr > rows)) return bad(res, `Orta kapı sırası 2 ile ${rows} arasında olmalı.`);

  /* Orta kapı koltuk numaralarını kaydırır. Satılmış bilet varken değiştirmek
     yolcuların koltuk numaralarını bozar — bu yüzden engelliyoruz. */
  const kapiDegisti = md !== b.mid_door || (md && mdr !== b.mid_door_row);
  if (kapiDegisti) {
    const bilet = db.prepare(
      `SELECT COUNT(*) c FROM tickets tk JOIN trips t ON t.id = tk.trip_id
       WHERE t.bus_id = ? AND tk.status <> 'iptal'`
    ).get(id).c;
    if (bilet > 0) {
      return bad(res,
        `Bu otobüsün seferlerinde ${bilet} satılmış bilet var. Orta kapı ayarını değiştirmek ` +
        'koltuk numaralarını kaydırır ve yolcuların koltukları karışır. ' +
        'Ya önce bu biletleri iptal edin, ya da bu otobüsü yeni bir kayıt olarak ekleyin.');
    }
  }

  const newCap = capacityOf(rows, br, md);
  if (newCap < b.capacity) {
    const over = db.prepare(
      `SELECT COUNT(*) c FROM tickets tk JOIN trips t ON t.id = tk.trip_id
       WHERE t.bus_id = ? AND tk.status <> 'iptal' AND tk.seat_no > ?`
    ).get(id, newCap).c;
    if (over > 0) return bad(res, `Bu otobüsün seferlerinde ${newCap} numarasından büyük koltuklarda satılmış bilet var. Önce onları iptal edin.`);
  }
  db.prepare('UPDATE buses SET plate=?,name=?,rows_cnt=?,back_row=?,mid_door=?,mid_door_row=?,capacity=?,notes=?,active=? WHERE id=?')
    .run((plate ?? b.plate).toUpperCase(), name ?? b.name, rows, br, md, mdr, newCap, notes ?? b.notes,
         active === undefined ? b.active : (active ? 1 : 0), id);
  log(req, 'otobus_guncelle', { id });
  ok(res, { ok: true });
});

// ------------------------------------------------------------------
// Güzergahlar
// ------------------------------------------------------------------
router.get('/routes', (req, res) => {
  ok(res, db.prepare('SELECT * FROM routes ORDER BY active DESC, origin, destination').all());
});

router.post('/routes', adminOnly, (req, res) => {
  const { origin, destination, duration_min } = req.body || {};
  if (!origin || !destination) return bad(res, 'Kalkış ve varış zorunlu.');
  if (db.prepare('SELECT 1 FROM routes WHERE origin=? AND destination=?').get(origin.trim(), destination.trim()))
    return bad(res, 'Bu güzergah zaten kayıtlı.');
  const info = db.prepare('INSERT INTO routes (origin,destination,duration_min) VALUES (?,?,?)')
    .run(origin.trim(), destination.trim(), Number(duration_min) || 300);
  log(req, 'guzergah_ekle', { origin, destination });
  ok(res, { id: info.lastInsertRowid });
});

router.put('/routes/:id', adminOnly, (req, res) => {
  const r = db.prepare('SELECT * FROM routes WHERE id=?').get(Number(req.params.id));
  if (!r) return bad(res, 'Güzergah bulunamadı.', 404);
  const { origin, destination, duration_min, active } = req.body || {};
  db.prepare('UPDATE routes SET origin=?,destination=?,duration_min=?,active=? WHERE id=?')
    .run(origin ?? r.origin, destination ?? r.destination, duration_min ?? r.duration_min,
         active === undefined ? r.active : (active ? 1 : 0), r.id);
  ok(res, { ok: true });
});

// ------------------------------------------------------------------
// Seferler
// ------------------------------------------------------------------
router.get('/trips', (req, res) => {
  const { date, from, to, q, route_id, status } = req.query;
  const where = [];
  const params = [];
  if (date) { where.push('t.depart_date = ?'); params.push(date); }
  if (from) { where.push('t.depart_date >= ?'); params.push(from); }
  if (to) { where.push('t.depart_date <= ?'); params.push(to); }
  if (route_id) { where.push('t.route_id = ?'); params.push(Number(route_id)); }
  if (status) { where.push('t.status = ?'); params.push(status); }
  if (q) { where.push('(r.origin LIKE ? OR r.destination LIKE ? OR b.plate LIKE ?)'); params.push(`%${q}%`, `%${q}%`, `%${q}%`); }

  const sql = `
    SELECT t.*, r.origin, r.destination, b.plate, b.name AS bus_name, b.capacity,
           (SELECT COUNT(*) FROM tickets tk WHERE tk.trip_id = t.id AND tk.status <> 'iptal') AS sold,
           (SELECT COALESCE(SUM(tk.price),0) FROM tickets tk WHERE tk.trip_id = t.id AND tk.status <> 'iptal') AS revenue
    FROM trips t
    JOIN routes r ON r.id = t.route_id
    JOIN buses  b ON b.id = t.bus_id
    ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
    ORDER BY t.depart_date, t.depart_time`;
  ok(res, db.prepare(sql).all(...params));
});

router.post('/trips', adminOnly, (req, res) => {
  const { route_id, bus_id, depart_date, depart_time, price, notes, repeat_days } = req.body || {};
  if (!route_id || !bus_id || !depart_date || !depart_time) return bad(res, 'Güzergah, otobüs, tarih ve saat zorunlu.');
  const days = Math.min(Math.max(Number(repeat_days) || 1, 1), 60);
  const ins = db.prepare('INSERT INTO trips (route_id,bus_id,depart_date,depart_time,price,notes) VALUES (?,?,?,?,?,?)');
  const created = [];
  const base = new Date(depart_date + 'T00:00:00');
  const tx = db.transaction(() => {
    for (let i = 0; i < days; i++) {
      const d = new Date(base.getTime() + i * 86400000).toISOString().slice(0, 10);
      const dup = db.prepare('SELECT 1 FROM trips WHERE bus_id=? AND depart_date=? AND depart_time=? AND status<>\'iptal\'')
        .get(Number(bus_id), d, depart_time);
      if (dup) continue; // aynı otobüs aynı gün aynı saatte iki sefer olamaz
      created.push(ins.run(Number(route_id), Number(bus_id), d, depart_time, Number(price) || 0, notes || null).lastInsertRowid);
    }
  });
  tx();
  if (!created.length) return bad(res, 'Sefer oluşturulamadı: aynı otobüs, tarih ve saatte sefer zaten var.');
  log(req, 'sefer_ekle', { count: created.length });
  notifyTrip(req, 'create', { count: created.length });
  ok(res, { ids: created, count: created.length });
});

router.put('/trips/:id', adminOnly, (req, res) => {
  const t = db.prepare('SELECT * FROM trips WHERE id=?').get(Number(req.params.id));
  if (!t) return bad(res, 'Sefer bulunamadı.', 404);
  const { route_id, bus_id, depart_date, depart_time, price, notes, status } = req.body || {};
  if (bus_id && Number(bus_id) !== t.bus_id) {
    const sold = db.prepare("SELECT COUNT(*) c FROM tickets WHERE trip_id=? AND status<>'iptal'").get(t.id).c;
    if (sold > 0) return bad(res, 'Bilet satılmış bir seferin otobüsü değiştirilemez.');
  }
  db.prepare('UPDATE trips SET route_id=?,bus_id=?,depart_date=?,depart_time=?,price=?,notes=?,status=? WHERE id=?')
    .run(route_id ?? t.route_id, bus_id ?? t.bus_id, depart_date ?? t.depart_date, depart_time ?? t.depart_time,
         price === undefined ? t.price : Number(price), notes ?? t.notes, status ?? t.status, t.id);
  log(req, 'sefer_guncelle', { id: t.id });
  notifyTrip(req, 'update', { trip_id: t.id });
  notifySeat(req, t.id, 'trip-update', {});
  ok(res, { ok: true });
});

/* Silme uçları aşağıda "Çöp kutusu" bölümünde toplu olarak tanımlıdır. */

// ------------------------------------------------------------------
// Koltuk haritası
// ------------------------------------------------------------------
router.get('/trips/:id/seatmap', (req, res) => {
  const trip = tripDetail(Number(req.params.id));
  if (!trip) return bad(res, 'Sefer bulunamadı.', 404);

  const tickets = db.prepare(
    `SELECT tk.*, u.full_name AS sold_by_name, u.agency_name, g.name AS group_name
     FROM tickets tk
     LEFT JOIN users u  ON u.id = tk.sold_by
     LEFT JOIN groups g ON g.id = tk.group_id
     WHERE tk.trip_id = ? AND tk.status <> 'iptal'`
  ).all(trip.id);

  const bySeat = new Map(tickets.map((t) => [t.seat_no, t]));
  const layout = seatLayout(trip.rows_cnt, trip.back_row, trip.mid_door, trip.mid_door_row);

  const seats = [];
  for (let n = 1; n <= trip.capacity; n++) {
    const t = bySeat.get(n);
    const partner = seatPartner(n, trip.rows_cnt, trip.back_row, trip.mid_door, trip.mid_door_row);
    const pt = partner ? bySeat.get(partner) : null;
    seats.push({
      seat_no: n,
      kind: seatKind(n, trip.rows_cnt, trip.back_row, trip.mid_door, trip.mid_door_row),
      partner,
      // Boş koltuk için cinsiyet kısıtı: yandaki doluysa aynı cinsiyet gerekir
      requires_gender: !t && pt ? pt.gender : null,
      partner_group_id: pt ? pt.group_id : null,
      ticket: t
        ? {
            id: t.id, pnr: t.pnr, passenger_name: t.passenger_name, gender: t.gender,
            phone: t.phone, tc_no: t.tc_no, price: t.price, status: t.status,
            payment_status: t.payment_status, paid_amount: t.paid_amount, boarded: t.boarded,
            group_id: t.group_id, group_name: t.group_name, note: t.note,
            sold_by: t.sold_by, sold_by_name: t.sold_by_name, agency_name: t.agency_name,
            created_at: t.created_at,
            mine: t.sold_by === req.user.id
          }
        : null
    });
  }

  const groups = db.prepare(
    `SELECT g.*, (SELECT COUNT(*) FROM tickets tk WHERE tk.group_id=g.id AND tk.status<>'iptal') AS seat_count
     FROM groups g WHERE g.trip_id = ? ORDER BY g.id`
  ).all(trip.id);

  ok(res, {
    trip: {
      id: trip.id, origin: trip.origin, destination: trip.destination,
      depart_date: trip.depart_date, depart_time: trip.depart_time, price: trip.price,
      status: trip.status, notes: trip.notes, plate: trip.plate, bus_name: trip.bus_name,
      rows_cnt: trip.rows_cnt, back_row: trip.back_row,
      mid_door: trip.mid_door, mid_door_row: trip.mid_door_row, capacity: trip.capacity
    },
    layout, seats, groups,
    stats: {
      sold: tickets.filter((t) => t.status === 'satildi').length,
      reserved: tickets.filter((t) => t.status === 'rezerve').length,
      empty: trip.capacity - tickets.length,
      revenue: tickets.reduce((s, t) => s + t.price, 0),
      collected: tickets.reduce((s, t) => s + t.paid_amount, 0)
    }
  });
});

// ------------------------------------------------------------------
// Bilet satışı (tekli / kafile) — cinsiyet kuralı + koltuk kilidi
// ------------------------------------------------------------------
router.post('/trips/:id/sell', (req, res) => {
  const trip = tripDetail(Number(req.params.id));
  if (!trip) return bad(res, 'Sefer bulunamadı.', 404);
  if (trip.status !== 'acik') return bad(res, 'Bu sefer satışa kapalı.');

  const body = req.body || {};
  const passengers = Array.isArray(body.passengers) ? body.passengers : [];
  if (!passengers.length) return bad(res, 'En az bir yolcu girmelisiniz.');
  if (passengers.length > trip.capacity) return bad(res, 'Koltuk sayısından fazla yolcu.');

  const overrideGender = !!body.override_gender && req.user.role === 'admin';
  const status = ['satildi', 'rezerve'].includes(body.status) ? body.status : 'satildi';

  // Girdi doğrulama
  const seen = new Set();
  for (const p of passengers) {
    const s = Number(p.seat_no);
    if (!Number.isInteger(s) || s < 1 || s > trip.capacity) return bad(res, `Geçersiz koltuk numarası: ${p.seat_no}`);
    if (seen.has(s)) return bad(res, `${s} numaralı koltuk listede birden fazla kez var.`);
    seen.add(s);
    if (!p.passenger_name || !String(p.passenger_name).trim()) return bad(res, `${s} numaralı koltuk için yolcu adı zorunlu.`);
    if (!['E', 'K'].includes(p.gender)) return bad(res, `${s} numaralı koltuk için cinsiyet seçilmeli.`);
    if (p.tc_no && !/^\d{11}$/.test(String(p.tc_no))) return bad(res, `${s} numaralı koltukta T.C. kimlik no 11 haneli olmalı.`);
  }

  try {
    const result = db.transaction(() => {
      // Kafile kaydı
      let groupId = body.group_id ? Number(body.group_id) : null;
      if (body.group && body.group.name) {
        groupId = db.prepare(
          'INSERT INTO groups (trip_id,name,contact_name,contact_phone,note,created_by) VALUES (?,?,?,?,?,?)'
        ).run(trip.id, String(body.group.name).trim(), body.group.contact_name || null,
              body.group.contact_phone || null, body.group.note || null, req.user.id).lastInsertRowid;
      }
      if (groupId) {
        const g = db.prepare('SELECT * FROM groups WHERE id=? AND trip_id=?').get(groupId, trip.id);
        if (!g) throw new Error('Kafile kaydı bulunamadı.');
      }

      // Mevcut aktif biletler (işlem içinde tekrar okunur)
      const active = db.prepare("SELECT * FROM tickets WHERE trip_id=? AND status<>'iptal'").all(trip.id);
      const occupied = new Map(active.map((t) => [t.seat_no, t]));

      // Dolu koltuk kontrolü
      for (const p of passengers) {
        const s = Number(p.seat_no);
        if (occupied.has(s)) throw new Error(`${s} numaralı koltuk az önce satıldı. Lütfen koltuk haritasını yenileyin.`);
      }

      // Cinsiyet kuralı: yan yana koltuklarda farklı cinsiyet (aynı kafile hariç)
      if (!overrideGender) {
        const pending = new Map(passengers.map((p) => [Number(p.seat_no), p]));
        for (const p of passengers) {
          const s = Number(p.seat_no);
          const partner = seatPartner(s, trip.rows_cnt, trip.back_row, trip.mid_door, trip.mid_door_row);
          if (!partner) continue;

          const np = pending.get(partner);
          if (np) { // ikisi de bu satışta -> aynı kafile içinde sayılır
            if (np.gender !== p.gender && !groupId)
              throw new Error(`${s} ve ${partner} numaralı koltuklar yan yana; farklı cinsiyette yolcular ancak aynı kafile/aile altında oturabilir.`);
            continue;
          }
          const op = occupied.get(partner);
          if (op && op.gender !== p.gender) {
            if (!(groupId && op.group_id === groupId))
              throw new Error(`${s} numaralı koltuğun yanındaki ${partner} numaralı koltukta ${op.gender === 'E' ? 'bay' : 'bayan'} yolcu var. Yan yana farklı cinsiyet satılamaz.`);
          }
        }
      }

      const ins = db.prepare(
        `INSERT INTO tickets (pnr,trip_id,seat_no,passenger_name,gender,tc_no,phone,price,status,
                              payment_status,paid_amount,group_id,sold_by,note)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`
      );
      const created = [];
      for (const p of passengers) {
        const price = p.price === undefined || p.price === '' ? trip.price : Number(p.price);
        const payment_status = ['odendi', 'odenmedi', 'kismi'].includes(p.payment_status) ? p.payment_status : 'odenmedi';
        const paid = payment_status === 'odendi' ? price : Number(p.paid_amount) || 0;
        const pnr = newPnr();
        const info = ins.run(pnr, trip.id, Number(p.seat_no), String(p.passenger_name).trim().toLocaleUpperCase('tr-TR'),
          p.gender, p.tc_no || null, p.phone || null, price, status, payment_status, paid,
          groupId, req.user.id, p.note || null);
        created.push({ id: info.lastInsertRowid, pnr, seat_no: Number(p.seat_no) });
      }
      return { tickets: created, group_id: groupId };
    })();

    log(req, 'bilet_sat', { trip_id: trip.id, seats: result.tickets.map((t) => t.seat_no), group_id: result.group_id });
    notifySeat(req, trip.id, 'sell', { seats: result.tickets.map((t) => t.seat_no) });

    // Otomatik bilet mesajı — satışı bekletmemek için arka planda gönderilir
    const smsAyar = sms.getSmsSettings();
    if (smsAyar.otomatik && smsAyar.saglayici !== 'kapali') {
      const firma = getCompany();
      setImmediate(async () => {
        for (const ct of result.tickets) {
          try {
            const tam = ticketForMessage(ct.id);
            if (!tam || !sms.normalizePhone(tam.phone)) continue;
            await sms.sendSms({
              ticket_id: tam.id, phone: tam.phone,
              text: sms.buildTicketMessage(tam, firma, 'sms'), user_id: req.user.id
            });
          } catch { /* mesaj hatası satışı etkilemez, kaydı messages tablosunda tutulur */ }
        }
      });
    }

    ok(res, result);
  } catch (e) {
    if (String(e.message).includes('UNIQUE'))
      return bad(res, 'Seçtiğiniz koltuklardan biri başka bir kullanıcı tarafından satıldı. Haritayı yenileyin.');
    return bad(res, e.message);
  }
});

// ------------------------------------------------------------------
// Bilet işlemleri
// ------------------------------------------------------------------
function canTouch(req, ticket) {
  return req.user.role === 'admin' || ticket.sold_by === req.user.id;
}

router.get('/tickets', (req, res) => {
  const { q, from, to, trip_id, status, mine } = req.query;
  const where = [];
  const params = [];
  if (req.user.role !== 'admin' || mine === '1') { where.push('tk.sold_by = ?'); params.push(req.user.id); }
  if (trip_id) { where.push('tk.trip_id = ?'); params.push(Number(trip_id)); }
  if (status) { where.push('tk.status = ?'); params.push(status); }
  if (from) { where.push('t.depart_date >= ?'); params.push(from); }
  if (to) { where.push('t.depart_date <= ?'); params.push(to); }
  if (q) { where.push('(tk.passenger_name LIKE ? OR tk.pnr LIKE ? OR tk.phone LIKE ? OR tk.tc_no LIKE ?)');
           params.push(`%${q}%`, `%${q}%`, `%${q}%`, `%${q}%`); }
  const sql = `
    SELECT tk.*, t.depart_date, t.depart_time, r.origin, r.destination, b.plate,
           u.full_name AS sold_by_name, u.agency_name, g.name AS group_name
    FROM tickets tk
    JOIN trips t ON t.id = tk.trip_id
    JOIN routes r ON r.id = t.route_id
    JOIN buses b ON b.id = t.bus_id
    LEFT JOIN users u ON u.id = tk.sold_by
    LEFT JOIN groups g ON g.id = tk.group_id
    ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
    ORDER BY tk.id DESC LIMIT 500`;
  ok(res, db.prepare(sql).all(...params));
});

router.get('/tickets/:id', (req, res) => {
  const t = db.prepare(
    `SELECT tk.*, t.depart_date, t.depart_time, t.id AS trip_id, r.origin, r.destination,
            b.plate, b.name AS bus_name, u.full_name AS sold_by_name, u.agency_name, g.name AS group_name
     FROM tickets tk
     JOIN trips t ON t.id = tk.trip_id
     JOIN routes r ON r.id = t.route_id
     JOIN buses b ON b.id = t.bus_id
     LEFT JOIN users u ON u.id = tk.sold_by
     LEFT JOIN groups g ON g.id = tk.group_id
     WHERE tk.id = ?`
  ).get(Number(req.params.id));
  if (!t) return bad(res, 'Bilet bulunamadı.', 404);
  ok(res, t);
});

router.put('/tickets/:id', (req, res) => {
  const t = db.prepare('SELECT * FROM tickets WHERE id=?').get(Number(req.params.id));
  if (!t) return bad(res, 'Bilet bulunamadı.', 404);
  if (!canTouch(req, t)) return bad(res, 'Bu bilet başka bir kullanıcıya ait.', 403);
  if (t.status === 'iptal') return bad(res, 'İptal edilmiş bilet düzenlenemez.');

  const { passenger_name, phone, tc_no, price, payment_status, paid_amount, status, note, gender } = req.body || {};
  if (gender && gender !== t.gender) {
    // cinsiyet değişirse yan koltuk kuralını tekrar kontrol et
    const trip = tripDetail(t.trip_id);
    const partner = seatPartner(t.seat_no, trip.rows_cnt, trip.back_row, trip.mid_door, trip.mid_door_row);
    if (partner) {
      const op = db.prepare("SELECT * FROM tickets WHERE trip_id=? AND seat_no=? AND status<>'iptal'").get(t.trip_id, partner);
      if (op && op.gender !== gender && !(t.group_id && op.group_id === t.group_id))
        return bad(res, `Yandaki ${partner} numaralı koltukta farklı cinsiyette yolcu var, değişiklik yapılamaz.`);
    }
  }
  const newPrice = price === undefined ? t.price : Number(price);
  const ps = payment_status ?? t.payment_status;
  const paid = ps === 'odendi' ? newPrice : (paid_amount === undefined ? t.paid_amount : Number(paid_amount));
  db.prepare(
    `UPDATE tickets SET passenger_name=?,gender=?,phone=?,tc_no=?,price=?,payment_status=?,paid_amount=?,status=?,note=?
     WHERE id=?`
  ).run((passenger_name ?? t.passenger_name).toLocaleUpperCase('tr-TR'), gender ?? t.gender, phone ?? t.phone,
        tc_no ?? t.tc_no, newPrice, ps, paid,
        status && ['satildi', 'rezerve'].includes(status) ? status : t.status, note ?? t.note, t.id);
  log(req, 'bilet_guncelle', { id: t.id });
  notifySeat(req, t.trip_id, 'update', { seats: [t.seat_no] });
  ok(res, { ok: true });
});

router.post('/tickets/:id/cancel', (req, res) => {
  const t = db.prepare('SELECT * FROM tickets WHERE id=?').get(Number(req.params.id));
  if (!t) return bad(res, 'Bilet bulunamadı.', 404);
  if (!canTouch(req, t)) return bad(res, 'Bu bilet başka bir kullanıcıya ait.', 403);
  if (t.status === 'iptal') return bad(res, 'Bilet zaten iptal edilmiş.');
  db.prepare("UPDATE tickets SET status='iptal', cancelled_at=datetime('now','localtime'), note=? WHERE id=?")
    .run(req.body && req.body.reason ? String(req.body.reason) : t.note, t.id);
  log(req, 'bilet_iptal', { id: t.id, seat: t.seat_no });
  notifySeat(req, t.trip_id, 'cancel', { seats: [t.seat_no] });
  ok(res, { ok: true });
});

router.post('/tickets/:id/board', (req, res) => {
  const t = db.prepare('SELECT * FROM tickets WHERE id=?').get(Number(req.params.id));
  if (!t) return bad(res, 'Bilet bulunamadı.', 404);
  if (t.status === 'iptal') return bad(res, 'İptal edilmiş bilet.');
  const v = req.body && req.body.boarded !== undefined ? (req.body.boarded ? 1 : 0) : (t.boarded ? 0 : 1);
  db.prepare('UPDATE tickets SET boarded=? WHERE id=?').run(v, t.id);
  notifySeat(req, t.trip_id, 'board', { seats: [t.seat_no], boarded: v });
  ok(res, { boarded: v });
});

/** Koltuk değiştirme */
router.post('/tickets/:id/move', (req, res) => {
  const t = db.prepare('SELECT * FROM tickets WHERE id=?').get(Number(req.params.id));
  if (!t) return bad(res, 'Bilet bulunamadı.', 404);
  if (!canTouch(req, t)) return bad(res, 'Bu bilet başka bir kullanıcıya ait.', 403);
  if (t.status === 'iptal') return bad(res, 'İptal edilmiş bilet taşınamaz.');
  const target = Number(req.body && req.body.seat_no);
  const trip = tripDetail(t.trip_id);
  if (!Number.isInteger(target) || target < 1 || target > trip.capacity) return bad(res, 'Geçersiz koltuk numarası.');
  const busy = db.prepare("SELECT 1 FROM tickets WHERE trip_id=? AND seat_no=? AND status<>'iptal'").get(t.trip_id, target);
  if (busy) return bad(res, 'Hedef koltuk dolu.');
  const partner = seatPartner(target, trip.rows_cnt, trip.back_row, trip.mid_door, trip.mid_door_row);
  if (partner) {
    const op = db.prepare("SELECT * FROM tickets WHERE trip_id=? AND seat_no=? AND status<>'iptal'").get(t.trip_id, partner);
    if (op && op.gender !== t.gender && !(t.group_id && op.group_id === t.group_id) && req.user.role !== 'admin')
      return bad(res, `${target} numaralı koltuğun yanında farklı cinsiyette yolcu var.`);
  }
  db.prepare('UPDATE tickets SET seat_no=? WHERE id=?').run(target, t.id);
  log(req, 'koltuk_degistir', { id: t.id, from: t.seat_no, to: target });
  notifySeat(req, t.trip_id, 'move', { seats: [t.seat_no, target] });
  ok(res, { ok: true });
});

// ------------------------------------------------------------------
// Kafileler
// ------------------------------------------------------------------
router.get('/groups', (req, res) => {
  const { trip_id, q } = req.query;
  const where = [];
  const params = [];
  if (trip_id) { where.push('g.trip_id = ?'); params.push(Number(trip_id)); }
  if (q) { where.push('(g.name LIKE ? OR g.contact_name LIKE ? OR g.contact_phone LIKE ?)'); params.push(`%${q}%`, `%${q}%`, `%${q}%`); }
  ok(res, db.prepare(`
    SELECT g.*, t.depart_date, t.depart_time, r.origin, r.destination, b.plate,
           (SELECT COUNT(*) FROM tickets tk WHERE tk.group_id=g.id AND tk.status<>'iptal') AS seat_count,
           (SELECT COALESCE(SUM(tk.price),0) FROM tickets tk WHERE tk.group_id=g.id AND tk.status<>'iptal') AS total,
           (SELECT COALESCE(SUM(tk.paid_amount),0) FROM tickets tk WHERE tk.group_id=g.id AND tk.status<>'iptal') AS paid,
           u.full_name AS created_by_name
    FROM groups g
    JOIN trips t ON t.id=g.trip_id
    JOIN routes r ON r.id=t.route_id
    JOIN buses b ON b.id=t.bus_id
    LEFT JOIN users u ON u.id=g.created_by
    ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
    ORDER BY t.depart_date DESC, g.id DESC LIMIT 300`).all(...params));
});

router.get('/groups/:id', (req, res) => {
  const g = db.prepare(`
    SELECT g.*, t.depart_date, t.depart_time, r.origin, r.destination, b.plate, b.name AS bus_name
    FROM groups g JOIN trips t ON t.id=g.trip_id
    JOIN routes r ON r.id=t.route_id JOIN buses b ON b.id=t.bus_id WHERE g.id=?`).get(Number(req.params.id));
  if (!g) return bad(res, 'Kafile bulunamadı.', 404);
  g.tickets = db.prepare("SELECT * FROM tickets WHERE group_id=? AND status<>'iptal' ORDER BY seat_no").all(g.id);
  ok(res, g);
});

router.put('/groups/:id', (req, res) => {
  const g = db.prepare('SELECT * FROM groups WHERE id=?').get(Number(req.params.id));
  if (!g) return bad(res, 'Kafile bulunamadı.', 404);
  if (req.user.role !== 'admin' && g.created_by !== req.user.id) return bad(res, 'Yetkiniz yok.', 403);
  const { name, contact_name, contact_phone, note } = req.body || {};
  db.prepare('UPDATE groups SET name=?,contact_name=?,contact_phone=?,note=? WHERE id=?')
    .run(name ?? g.name, contact_name ?? g.contact_name, contact_phone ?? g.contact_phone, note ?? g.note, g.id);
  ok(res, { ok: true });
});

router.post('/groups/:id/cancel', (req, res) => {
  const g = db.prepare('SELECT * FROM groups WHERE id=?').get(Number(req.params.id));
  if (!g) return bad(res, 'Kafile bulunamadı.', 404);
  if (req.user.role !== 'admin' && g.created_by !== req.user.id) return bad(res, 'Yetkiniz yok.', 403);
  const info = db.prepare(
    "UPDATE tickets SET status='iptal', cancelled_at=datetime('now','localtime') WHERE group_id=? AND status<>'iptal'"
  ).run(g.id);
  log(req, 'kafile_iptal', { id: g.id, count: info.changes });
  notifySeat(req, g.trip_id, 'group-cancel', { group_id: g.id, count: info.changes });
  ok(res, { cancelled: info.changes });
});

// ------------------------------------------------------------------
// Yolcu listesi (manifest)
// ------------------------------------------------------------------
router.get('/trips/:id/manifest', (req, res) => {
  const trip = tripDetail(Number(req.params.id));
  if (!trip) return bad(res, 'Sefer bulunamadı.', 404);
  const rows = db.prepare(`
    SELECT tk.seat_no, tk.pnr, tk.passenger_name, tk.gender, tk.phone, tk.tc_no, tk.price,
           tk.status, tk.payment_status, tk.paid_amount, tk.boarded, tk.id,
           g.name AS group_name, u.full_name AS sold_by_name, u.agency_name
    FROM tickets tk
    LEFT JOIN groups g ON g.id = tk.group_id
    LEFT JOIN users u ON u.id = tk.sold_by
    WHERE tk.trip_id=? AND tk.status<>'iptal'
    ORDER BY tk.seat_no`).all(trip.id);
  ok(res, { trip, passengers: rows, company: getCompany() });
});

// ------------------------------------------------------------------
// Raporlar & panel
// ------------------------------------------------------------------
router.get('/dashboard', (req, res) => {
  const today = new Date().toISOString().slice(0, 10);
  const mine = req.user.role === 'admin' ? '' : 'AND tk.sold_by = ' + req.user.id;

  const todayTrips = db.prepare(`
    SELECT COUNT(*) c FROM trips WHERE depart_date = ? AND status='acik'`).get(today).c;
  const todaySales = db.prepare(`
    SELECT COUNT(*) c, COALESCE(SUM(tk.price),0) total, COALESCE(SUM(tk.paid_amount),0) paid
    FROM tickets tk WHERE date(tk.created_at) = ? AND tk.status<>'iptal' ${mine}`).get(today);
  const monthSales = db.prepare(`
    SELECT COUNT(*) c, COALESCE(SUM(tk.price),0) total
    FROM tickets tk WHERE strftime('%Y-%m', tk.created_at) = strftime('%Y-%m','now','localtime')
      AND tk.status<>'iptal' ${mine}`).get();
  const upcoming = db.prepare(`
    SELECT t.id, t.depart_date, t.depart_time, r.origin, r.destination, b.plate, b.capacity,
           (SELECT COUNT(*) FROM tickets tk WHERE tk.trip_id=t.id AND tk.status<>'iptal') sold
    FROM trips t JOIN routes r ON r.id=t.route_id JOIN buses b ON b.id=t.bus_id
    WHERE t.depart_date >= ? AND t.status='acik'
    ORDER BY t.depart_date, t.depart_time LIMIT 8`).all(today);
  const last7 = db.prepare(`
    SELECT date(tk.created_at) d, COUNT(*) c, COALESCE(SUM(tk.price),0) total
    FROM tickets tk
    WHERE tk.status<>'iptal' AND date(tk.created_at) >= date('now','localtime','-6 days') ${mine}
    GROUP BY d ORDER BY d`).all();

  ok(res, { today, todayTrips, todaySales, monthSales, upcoming, last7, role: req.user.role });
});

router.get('/reports/sales', (req, res) => {
  const from = req.query.from || new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
  const to = req.query.to || new Date().toISOString().slice(0, 10);
  const where = ["tk.status<>'iptal'", 'date(tk.created_at) BETWEEN ? AND ?'];
  const params = [from, to];
  if (req.user.role !== 'admin') { where.push('tk.sold_by = ?'); params.push(req.user.id); }
  else if (req.query.user_id) { where.push('tk.sold_by = ?'); params.push(Number(req.query.user_id)); }

  const base = `FROM tickets tk
    JOIN trips t ON t.id=tk.trip_id
    JOIN routes r ON r.id=t.route_id
    LEFT JOIN users u ON u.id=tk.sold_by
    WHERE ${where.join(' AND ')}`;

  ok(res, {
    from, to,
    summary: db.prepare(`SELECT COUNT(*) c, COALESCE(SUM(tk.price),0) total,
      COALESCE(SUM(tk.paid_amount),0) paid ${base}`).get(...params),
    bySeller: db.prepare(`SELECT COALESCE(u.full_name,'-') seller, COALESCE(u.agency_name,'-') agency,
      COUNT(*) c, COALESCE(SUM(tk.price),0) total, COALESCE(SUM(tk.paid_amount),0) paid
      ${base} GROUP BY tk.sold_by ORDER BY total DESC`).all(...params),
    byRoute: db.prepare(`SELECT r.origin || ' → ' || r.destination route, COUNT(*) c,
      COALESCE(SUM(tk.price),0) total ${base} GROUP BY r.id ORDER BY total DESC`).all(...params),
    byDay: db.prepare(`SELECT date(tk.created_at) d, COUNT(*) c, COALESCE(SUM(tk.price),0) total
      ${base} GROUP BY d ORDER BY d`).all(...params),
    unpaid: db.prepare(`SELECT tk.id, tk.pnr, tk.passenger_name, tk.seat_no, tk.price, tk.paid_amount,
      t.depart_date, r.origin, r.destination, COALESCE(u.full_name,'-') seller
      ${base} AND tk.payment_status <> 'odendi' ORDER BY t.depart_date LIMIT 200`).all(...params)
  });
});

router.get('/logs', adminOnly, (req, res) => {
  ok(res, db.prepare('SELECT * FROM logs ORDER BY id DESC LIMIT 300').all());
});

// ------------------------------------------------------------------
// Ayarlar
// ------------------------------------------------------------------
function getCompany() {
  const row = db.prepare("SELECT value FROM settings WHERE key='company'").get();
  const c = row ? JSON.parse(row.value) : {};
  return {
    name: c.name || 'FİRMA ADI',
    slogan: c.slogan || '',
    phone: c.phone || '',
    address: c.address || '',
    website: c.website || '',
    tax_info: c.tax_info || '',
    logo: c.logo || '',
    ticket_note: c.ticket_note ||
      'Yolcularımızın kalkış saatinden 15 dakika önce peronda bulunmaları rica olunur. İyi yolculuklar dileriz.'
  };
}
router.get('/settings', (req, res) => ok(res, { company: getCompany() }));
router.put('/settings', adminOnly, (req, res) => {
  const c = req.body && req.body.company;
  if (!c || !c.name || !String(c.name).trim()) return bad(res, 'Firma adı zorunlu.');

  const metin = (v, max) => String(v ?? '').trim().slice(0, max);
  /* Logo ya sistemle gelen bir dosya yolu, ya da yöneticinin yüklediği resim verisidir. */
  const logo = String(c.logo ?? '');
  if (logo) {
    const yerelDosya = /^\/icons\/[A-Za-z0-9._-]+\.(png|jpg|jpeg|webp|svg)$/.test(logo);
    const veriAdresi = /^data:image\/(png|jpeg|jpg|webp|gif|svg\+xml);base64,/.test(logo);
    if (!yerelDosya && !veriAdresi)
      return bad(res, 'Logo geçerli bir resim dosyası olmalı (PNG, JPG veya WEBP).');
    if (veriAdresi && logo.length > 400 * 1024)
      return bad(res, 'Logo dosyası çok büyük. Lütfen daha küçük bir resim seçin (en fazla ~300 KB).');
  }

  const temiz = {
    name: metin(c.name, 80),
    slogan: metin(c.slogan, 90),
    phone: metin(c.phone, 40),
    address: metin(c.address, 160),
    website: metin(c.website, 80),
    tax_info: metin(c.tax_info, 120),
    ticket_note: metin(c.ticket_note, 300),
    logo
  };
  db.prepare('INSERT OR REPLACE INTO settings (key,value) VALUES (?,?)').run('company', JSON.stringify(temiz));
  log(req, 'ayar_guncelle', 'Firma bilgileri güncellendi');
  ok(res, { ok: true, company: temiz });
});

/* ------------------------------------------------------------------
   Bilet bildirimleri (SMS / WhatsApp)
------------------------------------------------------------------ */
function ticketForMessage(id) {
  return db.prepare(
    `SELECT tk.*, t.depart_date, t.depart_time, r.origin, r.destination, b.plate
     FROM tickets tk
     JOIN trips t  ON t.id = tk.trip_id
     JOIN routes r ON r.id = t.route_id
     JOIN buses b  ON b.id = t.bus_id
     WHERE tk.id = ?`
  ).get(id);
}

/** Bir bilet için hazır mesaj metni ve WhatsApp bağlantısı */
router.get('/tickets/:id/message', (req, res) => {
  const t = ticketForMessage(Number(req.params.id));
  if (!t) return bad(res, 'Bilet bulunamadı.', 404);
  const a = sms.getSmsSettings();
  const firma = getCompany();
  const smsMetin = sms.buildTicketMessage(t, firma, 'sms');
  const waMetin = sms.buildTicketMessage(t, firma, 'whatsapp');
  ok(res, {
    phone: t.phone,
    valid_phone: !!sms.normalizePhone(t.phone),
    sms_text: smsMetin,
    sms_length: smsMetin.length,
    sms_parts: Math.max(1, Math.ceil(smsMetin.length / 160)),
    sms_enabled: a.saglayici !== 'kapali',
    whatsapp_enabled: !!a.whatsapp_aktif,
    whatsapp_link: sms.whatsappLink(t.phone, waMetin),
    history: db.prepare('SELECT id,channel,status,error,created_at FROM messages WHERE ticket_id=? ORDER BY id DESC LIMIT 5').all(t.id)
  });
});

/** SMS gönder (elle) */
router.post('/tickets/:id/sms', async (req, res) => {
  const t = ticketForMessage(Number(req.params.id));
  if (!t) return bad(res, 'Bilet bulunamadı.', 404);
  if (req.user.role !== 'admin' && t.sold_by !== req.user.id) return bad(res, 'Bu bilet başka bir kullanıcıya ait.', 403);
  const metin = (req.body && req.body.text) || sms.buildTicketMessage(t, getCompany(), 'sms');
  const telefon = (req.body && req.body.phone) || t.phone;
  const r = await sms.sendSms({ ticket_id: t.id, phone: telefon, text: metin, user_id: req.user.id });
  log(req, 'sms_gonder', { ticket: t.id, ok: r.ok });
  if (!r.ok) return bad(res, r.error || 'SMS gönderilemedi.');
  ok(res, { ok: true, id: r.id });
});

/** Bildirim ayarları */
router.get('/sms-settings', adminOnly, (req, res) => {
  ok(res, { settings: sms.maskSettings(sms.getSmsSettings()), default_template: sms.VARSAYILAN_SABLON });
});

router.put('/sms-settings', adminOnly, (req, res) => {
  const gelen = { ...(req.body || {}) };
  // Maskelenmiş alanlar geri gönderildiyse eskisini koru
  ['sifre', 'gizli'].forEach((k) => { if (gelen[k] === '••••••••') delete gelen[k]; });
  const izinli = ['saglayici', 'otomatik', 'baslik', 'sablon', 'sade_turkce', 'whatsapp_aktif',
                  'whatsapp_sablon', 'kullanici', 'sifre', 'anahtar', 'gizli', 'gonderen', 'adres'];
  const temiz = {};
  izinli.forEach((k) => { if (gelen[k] !== undefined) temiz[k] = gelen[k]; });
  const yeni = sms.saveSmsSettings(temiz);
  log(req, 'sms_ayar', { saglayici: yeni.saglayici, otomatik: !!yeni.otomatik });
  ok(res, { settings: sms.maskSettings(yeni) });
});

/** Deneme mesajı */
router.post('/sms-settings/test', adminOnly, async (req, res) => {
  const tel = req.body && req.body.phone;
  if (!sms.normalizePhone(tel)) return bad(res, 'Geçerli bir cep telefonu numarası girin (örn. 0555 111 22 33).');
  const firma = getCompany();
  const metin = sms.sadelestir(`${firma.name || 'Rezervasyon sistemi'} - deneme mesaji. Kurulum basarili.`);
  const r = await sms.sendSms({ phone: tel, text: metin, user_id: req.user.id });
  if (!r.ok) return bad(res, r.error || 'Gönderilemedi.');
  ok(res, { ok: true });
});

/** Gönderim kayıtları */
router.get('/messages', adminOnly, (req, res) => {
  ok(res, db.prepare(
    `SELECT m.*, tk.passenger_name, tk.seat_no, u.full_name AS by_name
     FROM messages m
     LEFT JOIN tickets tk ON tk.id = m.ticket_id
     LEFT JOIN users u ON u.id = m.created_by
     ORDER BY m.id DESC LIMIT 200`).all());
});

/* ------------------------------------------------------------------
   Yedekleme (yönetici)
------------------------------------------------------------------ */
const fs = require('fs');
const pathMod = require('path');

router.get('/backup', adminOnly, async (req, res) => {
  try {
    const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
    const file = await makeBackup('indirilen-' + stamp);
    log(req, 'yedek_indir', stamp);
    res.download(file, `otobus-yedek-${stamp}.db`, () => {
      // indirme sonrası geçici kopyayı sil (günlük yedekler ayrı tutulur)
      fs.unlink(file, () => {});
    });
  } catch (e) { bad(res, 'Yedek alınamadı: ' + e.message, 500); }
});

router.get('/backups', adminOnly, (req, res) => {
  try {
    if (!fs.existsSync(BACKUP_DIR)) return ok(res, []);
    ok(res, fs.readdirSync(BACKUP_DIR).filter((f) => f.endsWith('.db')).map((f) => {
      const st = fs.statSync(pathMod.join(BACKUP_DIR, f));
      return { name: f, size: st.size, date: new Date(st.mtimeMs).toISOString() };
    }).sort((a, b) => b.date.localeCompare(a.date)));
  } catch { ok(res, []); }
});

/* ------------------------------------------------------------------
   Sistem durumu (yönetici) — kaç terminal bağlı, veri boyutu
------------------------------------------------------------------ */
router.get('/system', adminOnly, (req, res) => {
  const counts = {
    users: db.prepare('SELECT COUNT(*) c FROM users WHERE active=1').get().c,
    trips: db.prepare("SELECT COUNT(*) c FROM trips WHERE status='acik'").get().c,
    tickets: db.prepare("SELECT COUNT(*) c FROM tickets WHERE status<>'iptal'").get().c
  };
  ok(res, {
    online: events.onlineCount(),
    counts,
    surum: require('../package.json').version,
    started: new Date(Date.now() - process.uptime() * 1000).toISOString(),
    node: process.version,
    secure: isSecure(req)
  });
});

/* ==================================================================
   Çöp kutusu — silme, geri alma, kalıcı silme
   ------------------------------------------------------------------
   Hiçbir silme işlemi veriyi anında yok etmez. Kayıt önce çöp
   kutusuna taşınır, 30 gün boyunca oradan geri alınabilir.
================================================================== */
const TURLER = {
  trip:    { yol: 'trips',    ad: 'Sefer' },
  bus:     { yol: 'buses',    ad: 'Otobüs' },
  route:   { yol: 'routes',   ad: 'Güzergah' },
  ticket:  { yol: 'tickets',  ad: 'Bilet' },
  group:   { yol: 'groups',   ad: 'Kafile' },
  user:    { yol: 'users',    ad: 'Kullanıcı' },
  message: { yol: 'messages', ad: 'Bildirim' }
};

/** Silmeden önce "ne gidecek" bilgisini döner — hiçbir şey silmez. */
function onizleUcu(entity) {
  return (req, res) => {
    const bilgi = trash.onizle(entity, Number(req.params.id));
    if (!bilgi) return bad(res, `${TURLER[entity].ad} bulunamadı.`, 404);
    ok(res, bilgi);
  };
}

function silmeUcu(entity, ekKontrol) {
  return (req, res) => {
    const id = Number(req.params.id);
    if (ekKontrol) {
      const hata = ekKontrol(req, id);
      if (hata) return bad(res, hata);
    }
    try {
      const sonuc = trash.sil(entity, id, req.user);
      log(req, `${entity}_sil`, { id, label: sonuc.label });
      if (entity === 'trip' || entity === 'bus' || entity === 'route') notifyTrip(req, 'delete', { id });
      ok(res, { ok: true, ...sonuc, geri_alinabilir: true });
    } catch (e) {
      bad(res, e.message || 'Silinemedi.', e.code || 400);
    }
  };
}

for (const [entity, bilgi] of Object.entries(TURLER)) {
  router.get(`/${bilgi.yol}/:id/silme-onizleme`, adminOnly, onizleUcu(entity));
}

router.delete('/trips/:id',    adminOnly, silmeUcu('trip'));
router.delete('/groups/:id',   adminOnly, silmeUcu('group'));
router.delete('/tickets/:id',  adminOnly, silmeUcu('ticket'));
router.delete('/messages/:id', adminOnly, silmeUcu('message'));
router.delete('/routes/:id',   adminOnly, silmeUcu('route'));
router.delete('/buses/:id',    adminOnly, silmeUcu('bus'));

router.delete('/users/:id', adminOnly, silmeUcu('user', (req, id) => {
  if (id === req.user.id) return 'Kendi hesabınızı silemezsiniz. Başka bir yönetici silebilir.';
  const u = db.prepare('SELECT * FROM users WHERE id=?').get(id);
  if (!u) return null; // 404'ü silme katmanı versin
  if (u.role === 'admin') {
    const kalan = db.prepare("SELECT COUNT(*) c FROM users WHERE role='admin' AND active=1 AND id<>?").get(id).c;
    if (kalan === 0) return 'Sistemdeki son yöneticiyi silemezsiniz. Önce başka bir yönetici hesabı açın.';
  }
  return null;
}));

/* ------------------------------------------------------------------
   Örnek (demo) veri temizliği
   Sistemin eski sürümleri tanıtım amaçlı örnek otobüs, güzergah, sefer ve
   acente hesabı ile geliyordu. Bunlar firmanın kendi kayıtları değildir.
   Buradan tek tuşla temizlenir — hepsi çöp kutusuna gider, geri alınabilir.
------------------------------------------------------------------ */
router.get('/demo', adminOnly, (req, res) => {
  const d = demoSayimi();
  ok(res, {
    varMi: d.varMi,
    toplam: d.toplam,
    otobusler: d.otobusler.map((b) => `${b.plate} — ${b.name}`),
    guzergahlar: d.guzergahlar.map((r) => `${r.origin} → ${r.destination}`),
    kullanicilar: d.kullanicilar.map((u) => `${u.full_name} (${u.username})`),
    seferSayisi: d.seferSayisi,
    biletSayisi: d.biletSayisi
  });
});

router.post('/demo/temizle', adminOnly, (req, res) => {
  const d = demoSayimi();
  if (!d.varMi) return ok(res, { ok: true, silinen: 0, mesaj: 'Temizlenecek örnek kayıt yok.' });

  const silinenler = [];
  const dene = (tur, id) => {
    try { silinenler.push(trash.sil(tur, id, req.user)); } catch { /* zaten gitmişse atla */ }
  };

  /* Otobüs ve güzergah silinince bağlı seferler de birlikte gider */
  d.otobusler.forEach((b) => dene('bus', b.id));
  d.guzergahlar.forEach((r) => dene('route', r.id));
  d.kullanicilar.forEach((u) => { if (u.id !== req.user.id) dene('user', u.id); });

  log(req, 'demo_temizle', `${silinenler.length} örnek kayıt çöp kutusuna taşındı`);
  notifyTrip(req, 'delete', {});
  ok(res, {
    ok: true,
    silinen: silinenler.length,
    biletVardi: d.biletSayisi,
    etiketler: silinenler.map((s) => s.label)
  });
});

/* ------------------------------------------------------------------
   Toplu sefer silme
   "30 gün tekrarla" ile açılmış onlarca seferi tek tek silmek zor.
   Buradan işaretlenenler bir kerede çöp kutusuna taşınır.
------------------------------------------------------------------ */
router.post('/trips/toplu-sil', adminOnly, (req, res) => {
  const idler = Array.isArray(req.body && req.body.ids) ? req.body.ids.map(Number).filter(Boolean) : [];
  if (!idler.length) return bad(res, 'Silinecek sefer seçilmedi.');
  if (idler.length > 400) return bad(res, 'Tek seferde en fazla 400 sefer silinebilir.');

  const silinen = [];
  const hatalar = [];
  for (const id of idler) {
    try { silinen.push(trash.sil('trip', id, req.user)); }
    catch (e) { hatalar.push({ id, hata: e.message }); }
  }

  const bilet = silinen.reduce((s, x) => s + (x.counts ? x.counts.tickets : 0), 0);
  log(req, 'sefer_toplu_sil', `${silinen.length} sefer, ${bilet} bilet`);
  notifyTrip(req, 'delete', { count: silinen.length });

  ok(res, {
    ok: true,
    silinen: silinen.length,
    bilet,
    trash_ids: silinen.map((x) => x.trash_id),
    atlanan: hatalar.length
  });
});

/** Birden fazla çöp kaydını tek hamlede geri alır (toplu silmenin geri alınması). */
router.post('/trash/toplu-geri-al', adminOnly, (req, res) => {
  const idler = Array.isArray(req.body && req.body.ids) ? req.body.ids.map(Number).filter(Boolean) : [];
  if (!idler.length) return bad(res, 'Geri alınacak kayıt seçilmedi.');

  let basarili = 0;
  const hatalar = [];
  /* Ebeveyn kayıtlar önce dönmeli; çöp numarası küçük olan önce eklenmiştir */
  for (const id of idler.slice().sort((a, b) => a - b)) {
    try { trash.geriAl(id); basarili++; }
    catch (e) { hatalar.push(e.message); }
  }
  log(req, 'cop_toplu_geri_al', `${basarili} kayıt`);
  notifyTrip(req, 'restore', {});
  ok(res, { ok: true, geri_alinan: basarili, hata: hatalar.length, ilkHata: hatalar[0] || null });
});

router.get('/trash', adminOnly, (req, res) => {
  ok(res, { saklama_gun: trash.SAKLAMA_GUN, items: trash.listele() });
});

router.get('/trash/count', (req, res) => {
  ok(res, { count: req.user.role === 'admin' ? trash.sayi() : 0 });
});

router.post('/trash/:id/restore', adminOnly, (req, res) => {
  try {
    const sonuc = trash.geriAl(Number(req.params.id));
    log(req, 'cop_geri_al', sonuc.label);
    notifyTrip(req, 'restore', {});
    ok(res, { ok: true, ...sonuc });
  } catch (e) { bad(res, e.message, e.code || 400); }
});

router.delete('/trash/:id', adminOnly, (req, res) => {
  try {
    const sonuc = trash.kaliciSil(Number(req.params.id));
    log(req, 'cop_kalici_sil', sonuc.label);
    ok(res, { ok: true, ...sonuc });
  } catch (e) { bad(res, e.message, e.code || 400); }
});

router.post('/trash/empty', adminOnly, (req, res) => {
  const n = trash.bosalt();
  log(req, 'cop_bosalt', `${n} kayıt kalıcı silindi`);
  ok(res, { ok: true, count: n });
});

module.exports = router;
