'use strict';
/* ==========================================================================
   Test Verisi Hazırlığı
   --------------------------------------------------------------------------
   Sistem artık boş kurulduğu için testler kendi verisini kendisi oluşturur.
   Böylece gerçek kurulumda örnek kayıt bulunmaz, testler yine de çalışır.
   ========================================================================== */
const B = 'http://localhost:3111/api';

async function call(yol, opts = {}, tok) {
  const res = await fetch(B + yol, {
    ...opts,
    headers: { 'Content-Type': 'application/json', ...(tok ? { Authorization: 'Bearer ' + tok } : {}), ...(opts.headers || {}) }
  });
  return { status: res.status, body: await res.json().catch(() => ({})) };
}

const giris = async (u, p) =>
  (await call('/login', { method: 'POST', body: JSON.stringify({ username: u, password: p }) })).body.token;

const gun = (n) => {
  const d = new Date(Date.now() + n * 86400000);
  return new Date(d - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
};

/**
 * Testler için gereken kullanıcı, otobüs, güzergah ve seferleri oluşturur.
 * Zaten varsa yeniden oluşturmaz.
 */
async function hazirla() {
  const admin = await giris('admin', 'admin123');
  if (!admin) throw new Error('Yönetici girişi yapılamadı. Sunucu açık mı, şifre varsayılan mı?');

  /* ---- Acente hesapları ---- */
  const kullanicilar = (await call('/users', {}, admin)).body;
  const kullaniciEkle = async (username, full_name, agency_name) => {
    if (kullanicilar.some((u) => u.username === username)) return;
    await call('/users', {
      method: 'POST',
      body: JSON.stringify({ username, password: 'acente123', full_name, role: 'acente', agency_name })
    }, admin);
  };
  await kullaniciEkle('test_acente1', 'Test Acente Bir', 'Test Turizm A');
  await kullaniciEkle('test_acente2', 'Test Acente İki', 'Test Turizm B');

  /* ---- Otobüsler ---- */
  const otobusler = (await call('/buses', {}, admin)).body;
  const otobusEkle = async (plate, name, rows_cnt, back_row, mid_door) => {
    const varOlan = otobusler.find((b) => b.plate === plate);
    if (varOlan) return varOlan.id;
    const r = await call('/buses', {
      method: 'POST',
      body: JSON.stringify({ plate, name, rows_cnt, back_row, mid_door, mid_door_row: 6 })
    }, admin);
    return r.body.id;
  };
  const bus1 = await otobusEkle('34 TST 001', 'Test Otobüs A', 10, 1, 1);  // orta kapılı, 43 koltuk
  const bus2 = await otobusEkle('34 TST 002', 'Test Otobüs B', 11, 1, 1);  // orta kapılı, 47 koltuk
  const bus3 = await otobusEkle('34 TST 003', 'Test Otobüs C', 13, 0, 0);  // kapısız, 52 koltuk

  /* ---- Güzergahlar ---- */
  const guzergahlar = (await call('/routes', {}, admin)).body;
  const guzergahEkle = async (origin, destination, dk) => {
    const varOlan = guzergahlar.find((r) => r.origin === origin && r.destination === destination);
    if (varOlan) return varOlan.id;
    const r = await call('/routes', {
      method: 'POST', body: JSON.stringify({ origin, destination, duration_min: dk })
    }, admin);
    return r.body.id;
  };
  const rotaA = await guzergahEkle('Testkent', 'Denemeşehir', 330);
  const rotaB = await guzergahEkle('Denemeşehir', 'Testkent', 330);
  const rotaC = await guzergahEkle('Testkent', 'Örnekova', 420);

  /* ---- Seferler ---- */
  const mevcut = (await call('/trips', {}, admin)).body;
  const seferEkle = async (route_id, bus_id, tarih, saat, fiyat) => {
    const varOlan = mevcut.find((t) => t.bus_id === bus_id && t.depart_date === tarih && t.depart_time === saat);
    if (varOlan) return varOlan.id;
    const r = await call('/trips', {
      method: 'POST',
      body: JSON.stringify({ route_id, bus_id, depart_date: tarih, depart_time: saat, price: fiyat })
    }, admin);
    return (r.body.ids && r.body.ids[0]) || null;
  };

  const seferler = {
    /* Satış kuralları burada denenir — boş kalmalı */
    bos: await seferEkle(rotaA, bus3, gun(1), '09:00', 850),
    /* Orta kapı denemeleri burada */
    kapili: await seferEkle(rotaA, bus1, gun(2), '10:00', 850),
    ek1: await seferEkle(rotaB, bus2, gun(2), '14:30', 850),
    ek2: await seferEkle(rotaC, bus3, gun(3), '21:00', 1150),
    ek3: await seferEkle(rotaA, bus1, gun(4), '08:00', 900)
  };

  return {
    admin,
    acente1: await giris('test_acente1', 'acente123'),
    acente2: await giris('test_acente2', 'acente123'),
    otobusler: { bus1, bus2, bus3 },
    guzergahlar: { rotaA, rotaB, rotaC },
    seferler
  };
}

module.exports = { hazirla, call, giris, gun, B };
