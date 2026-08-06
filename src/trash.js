'use strict';
/* ==========================================================================
   Çöp Kutusu
   --------------------------------------------------------------------------
   Silinen kayıtlar gerçekten yok edilmez. Önce kaydın (ve ona bağlı alt
   kayıtların) tam bir kopyası çıkarılır, çöp kutusuna atılır, sonra asıl
   satırlar silinir. Geri alındığında kopya aynen yerine yazılır.

   30 gün sonra çöp kutusundakiler kendiliğinden temizlenir.
   ========================================================================== */
const { db } = require('./db');

const SAKLAMA_GUN = 30;

db.exec(`
CREATE TABLE IF NOT EXISTS trash (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  entity         TEXT NOT NULL,
  entity_id      INTEGER NOT NULL,
  label          TEXT NOT NULL,
  summary        TEXT,
  payload        TEXT NOT NULL,
  deleted_by     INTEGER,
  deleted_by_name TEXT,
  deleted_at     TEXT NOT NULL DEFAULT (datetime('now','localtime')),
  expires_at     TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_trash_at ON trash(deleted_at);
`);

/* Kayıtların birbirine bağlılık sırası. Geri yüklerken bu sırayla,
   silerken tersten gidilir. Önce ebeveyn, sonra çocuk. */
const SIRA = ['users', 'buses', 'routes', 'trips', 'groups', 'tickets', 'messages'];

const TUR_ADI = {
  trip: 'Sefer',
  bus: 'Otobüs',
  route: 'Güzergah',
  ticket: 'Bilet',
  group: 'Kafile',
  user: 'Kullanıcı',
  message: 'Bildirim'
};

/* ---------------------------------------------------------------- yardımcı */
const all = (sql, ...p) => db.prepare(sql).all(...p);
const one = (sql, ...p) => db.prepare(sql).get(...p);
const inList = (arr) => arr.map(() => '?').join(',');

function ticketsOfTrips(tripIds) {
  if (!tripIds.length) return [];
  return all(`SELECT * FROM tickets WHERE trip_id IN (${inList(tripIds)})`, ...tripIds);
}
function messagesOfTickets(ticketIds) {
  if (!ticketIds.length) return [];
  return all(`SELECT * FROM messages WHERE ticket_id IN (${inList(ticketIds)})`, ...ticketIds);
}

function trArac(n, tekil) {
  return n > 0 ? `${n} ${tekil}` : null;
}

/** Silinecek kaydı ve ona bağlı her şeyi toplar. */
function topla(entity, id) {
  const t = { users: [], buses: [], routes: [], trips: [], groups: [], tickets: [], messages: [] };
  const refs = { tickets_sold_by: [], groups_created_by: [], messages_created_by: [] };
  let label = '';

  if (entity === 'trip') {
    const trip = one(
      `SELECT t.*, r.origin, r.destination, b.plate FROM trips t
       JOIN routes r ON r.id=t.route_id JOIN buses b ON b.id=t.bus_id WHERE t.id=?`, id);
    if (!trip) return null;
    label = `${trip.origin} → ${trip.destination} · ${trip.depart_date} ${trip.depart_time} · ${trip.plate}`;
    t.trips = all('SELECT * FROM trips WHERE id=?', id);
    t.groups = all('SELECT * FROM groups WHERE trip_id=?', id);
    t.tickets = ticketsOfTrips([id]);
    t.messages = messagesOfTickets(t.tickets.map((x) => x.id));

  } else if (entity === 'bus') {
    const bus = one('SELECT * FROM buses WHERE id=?', id);
    if (!bus) return null;
    label = `${bus.plate} · ${bus.name}`;
    t.buses = [bus];
    t.trips = all('SELECT * FROM trips WHERE bus_id=?', id);
    const tripIds = t.trips.map((x) => x.id);
    t.groups = tripIds.length ? all(`SELECT * FROM groups WHERE trip_id IN (${inList(tripIds)})`, ...tripIds) : [];
    t.tickets = ticketsOfTrips(tripIds);
    t.messages = messagesOfTickets(t.tickets.map((x) => x.id));

  } else if (entity === 'route') {
    const r = one('SELECT * FROM routes WHERE id=?', id);
    if (!r) return null;
    label = `${r.origin} → ${r.destination}`;
    t.routes = [r];
    t.trips = all('SELECT * FROM trips WHERE route_id=?', id);
    const tripIds = t.trips.map((x) => x.id);
    t.groups = tripIds.length ? all(`SELECT * FROM groups WHERE trip_id IN (${inList(tripIds)})`, ...tripIds) : [];
    t.tickets = ticketsOfTrips(tripIds);
    t.messages = messagesOfTickets(t.tickets.map((x) => x.id));

  } else if (entity === 'group') {
    const g = one(
      `SELECT g.*, r.origin, r.destination, tr.depart_date FROM groups g
       JOIN trips tr ON tr.id=g.trip_id JOIN routes r ON r.id=tr.route_id WHERE g.id=?`, id);
    if (!g) return null;
    label = `${g.name} · ${g.origin} → ${g.destination} · ${g.depart_date}`;
    t.groups = all('SELECT * FROM groups WHERE id=?', id);
    t.tickets = all('SELECT * FROM tickets WHERE group_id=?', id);
    t.messages = messagesOfTickets(t.tickets.map((x) => x.id));

  } else if (entity === 'ticket') {
    const tk = one(
      `SELECT tk.*, r.origin, r.destination, tr.depart_date FROM tickets tk
       JOIN trips tr ON tr.id=tk.trip_id JOIN routes r ON r.id=tr.route_id WHERE tk.id=?`, id);
    if (!tk) return null;
    label = `${tk.pnr} · ${tk.passenger_name} · ${tk.seat_no} nolu koltuk · ${tk.origin} → ${tk.destination}`;
    t.tickets = all('SELECT * FROM tickets WHERE id=?', id);
    t.messages = messagesOfTickets([id]);

  } else if (entity === 'user') {
    const u = one('SELECT * FROM users WHERE id=?', id);
    if (!u) return null;
    label = `${u.full_name} (${u.username})`;
    t.users = [u];
    refs.tickets_sold_by = all('SELECT id FROM tickets WHERE sold_by=?', id).map((x) => x.id);
    refs.groups_created_by = all('SELECT id FROM groups WHERE created_by=?', id).map((x) => x.id);
    refs.messages_created_by = all('SELECT id FROM messages WHERE created_by=?', id).map((x) => x.id);

  } else if (entity === 'message') {
    const m = one('SELECT * FROM messages WHERE id=?', id);
    if (!m) return null;
    label = `${m.phone} · ${m.channel === 'whatsapp' ? 'WhatsApp' : 'SMS'}`;
    t.messages = [m];

  } else {
    return null;
  }

  const ozet = [
    trArac(t.trips.length, 'sefer'),
    trArac(t.groups.length, 'kafile'),
    trArac(t.tickets.length, 'bilet'),
    trArac(t.messages.length, 'bildirim')
  ].filter(Boolean);

  // Kendisi zaten label'da yazıyor, özet sadece "birlikte gidenler" için
  const kendi = { trip: 'trips', bus: 'buses', route: 'routes', group: 'groups', ticket: 'tickets', user: 'users', message: 'messages' }[entity];
  const ozetTemiz = ozet.filter((s) => {
    if (kendi === 'trips' && s.endsWith('sefer')) return false;
    if (kendi === 'groups' && s.endsWith('kafile')) return false;
    if (kendi === 'tickets' && s.endsWith('bilet')) return false;
    if (kendi === 'messages' && s.endsWith('bildirim')) return false;
    return true;
  });

  return {
    label,
    summary: ozetTemiz.length ? ozetTemiz.join(', ') + ' birlikte silindi' : null,
    payload: { tables: t, refs },
    counts: {
      trips: t.trips.length, groups: t.groups.length,
      tickets: t.tickets.length, messages: t.messages.length
    }
  };
}

/** Silme öncesi kullanıcıya ne gideceğini söylemek için (hiçbir şey silmez). */
function onizle(entity, id) {
  const snap = topla(entity, id);
  if (!snap) return null;
  return { label: snap.label, counts: snap.counts, tur: TUR_ADI[entity] || entity };
}

/** Kaydı çöp kutusuna taşır. */
function sil(entity, id, user) {
  const snap = topla(entity, id);
  if (!snap) { const e = new Error(`${TUR_ADI[entity] || 'Kayıt'} bulunamadı.`); e.code = 404; throw e; }

  const tx = db.transaction(() => {
    const exp = one(`SELECT datetime('now','localtime','+${SAKLAMA_GUN} days') d`).d;
    const info = db.prepare(
      `INSERT INTO trash (entity, entity_id, label, summary, payload, deleted_by, deleted_by_name, expires_at)
       VALUES (?,?,?,?,?,?,?,?)`
    ).run(entity, id, snap.label, snap.summary, JSON.stringify(snap.payload),
          user?.id ?? null, user?.full_name ?? null, exp);

    // Kullanıcı silinirken bağlı kayıtların sahipliği boşaltılır
    if (entity === 'user') {
      db.prepare('UPDATE tickets  SET sold_by=NULL    WHERE sold_by=?').run(id);
      db.prepare('UPDATE groups   SET created_by=NULL WHERE created_by=?').run(id);
      db.prepare('UPDATE messages SET created_by=NULL WHERE created_by=?').run(id);
    }

    // Çocuktan ebeveyne doğru sil
    const tables = snap.payload.tables;
    for (const tablo of [...SIRA].reverse()) {
      const rows = tables[tablo];
      if (!rows || !rows.length) continue;
      const ids = rows.map((r) => r.id);
      db.prepare(`DELETE FROM ${tablo} WHERE id IN (${inList(ids)})`).run(...ids);
    }
    return info.lastInsertRowid;
  });

  const trashId = tx();
  return { trash_id: trashId, label: snap.label, summary: snap.summary, counts: snap.counts };
}

/** Çöp kutusundaki kaydı yerine geri koyar. */
function geriAl(trashId) {
  const row = one('SELECT * FROM trash WHERE id=?', trashId);
  if (!row) { const e = new Error('Çöp kutusunda böyle bir kayıt yok.'); e.code = 404; throw e; }

  const payload = JSON.parse(row.payload);
  const tables = payload.tables || {};
  const refs = payload.refs || {};

  const tx = db.transaction(() => {
    for (const tablo of SIRA) {
      const rows = tables[tablo];
      if (!rows || !rows.length) continue;
      for (const r of rows) {
        const cols = Object.keys(r);
        db.prepare(
          `INSERT INTO ${tablo} (${cols.join(',')}) VALUES (${cols.map(() => '?').join(',')})`
        ).run(...cols.map((c) => r[c]));
      }
    }
    if (refs.tickets_sold_by?.length) {
      db.prepare(`UPDATE tickets SET sold_by=? WHERE id IN (${inList(refs.tickets_sold_by)})`)
        .run(row.entity_id, ...refs.tickets_sold_by);
    }
    if (refs.groups_created_by?.length) {
      db.prepare(`UPDATE groups SET created_by=? WHERE id IN (${inList(refs.groups_created_by)})`)
        .run(row.entity_id, ...refs.groups_created_by);
    }
    if (refs.messages_created_by?.length) {
      db.prepare(`UPDATE messages SET created_by=? WHERE id IN (${inList(refs.messages_created_by)})`)
        .run(row.entity_id, ...refs.messages_created_by);
    }
    db.prepare('DELETE FROM trash WHERE id=?').run(trashId);
  });

  try {
    tx();
  } catch (err) {
    const m = String(err.message || '');
    let mesaj = 'Geri alınamadı.';
    if (m.includes('FOREIGN KEY')) {
      mesaj = 'Geri alınamadı: bu kaydın bağlı olduğu otobüs, güzergah veya sefer de silinmiş. ' +
              'Önce onu çöp kutusundan geri alın, sonra bunu deneyin.';
    } else if (m.includes('uq_seat_active')) {
      mesaj = 'Geri alınamadı: o koltuk bu arada başkasına satılmış. Önce yeni bileti iptal edin.';
    } else if (m.includes('UNIQUE') && m.includes('users.username')) {
      mesaj = 'Geri alınamadı: aynı kullanıcı adıyla yeni bir hesap açılmış.';
    } else if (m.includes('UNIQUE') && m.includes('buses.plate')) {
      mesaj = 'Geri alınamadı: aynı plakayla yeni bir otobüs eklenmiş.';
    } else if (m.includes('UNIQUE') && m.includes('routes')) {
      mesaj = 'Geri alınamadı: aynı güzergah yeniden eklenmiş.';
    } else if (m.includes('UNIQUE')) {
      mesaj = 'Geri alınamadı: aynı bilgilerle yeni bir kayıt oluşturulmuş.';
    }
    const e = new Error(mesaj);
    e.code = 409;
    throw e;
  }

  return { entity: row.entity, label: row.label, tur: TUR_ADI[row.entity] || row.entity };
}

/** Çöp kutusundan kalıcı olarak siler (geri dönüşü yok). */
function kaliciSil(trashId) {
  const row = one('SELECT * FROM trash WHERE id=?', trashId);
  if (!row) { const e = new Error('Çöp kutusunda böyle bir kayıt yok.'); e.code = 404; throw e; }
  db.prepare('DELETE FROM trash WHERE id=?').run(trashId);
  return { label: row.label };
}

function bosalt() {
  const n = one('SELECT COUNT(*) c FROM trash').c;
  db.prepare('DELETE FROM trash').run();
  return n;
}

function listele() {
  return all(
    `SELECT id, entity, entity_id, label, summary, deleted_by_name, deleted_at, expires_at,
            MAX(0, CAST(CEIL(julianday(expires_at) - julianday('now','localtime')) AS INTEGER)) AS kalan_gun
     FROM trash ORDER BY deleted_at DESC`
  ).map((r) => ({ ...r, tur: TUR_ADI[r.entity] || r.entity }));
}

function sayi() {
  return one('SELECT COUNT(*) c FROM trash').c;
}

/** Süresi dolanları temizler. */
function temizle() {
  const info = db.prepare(`DELETE FROM trash WHERE expires_at <= datetime('now','localtime')`).run();
  return info.changes;
}

function otomatikTemizlikBaslat() {
  const calistir = () => {
    try {
      const n = temizle();
      if (n) console.log(`  🗑  Çöp kutusundan süresi dolan ${n} kayıt temizlendi.`);
    } catch (e) { console.warn('  ⚠  Çöp kutusu temizlenemedi:', e.message); }
  };
  calistir();
  setInterval(calistir, 6 * 3600 * 1000).unref();
}

module.exports = {
  SAKLAMA_GUN, TUR_ADI,
  onizle, sil, geriAl, kaliciSil, bosalt, listele, sayi, temizle, otomatikTemizlikBaslat
};
