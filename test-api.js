/* Kural ve güvenlik testleri */
const B = 'http://localhost:3111/api';
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log('  ✓', m); } else { fail++; console.log('  ✗ BAŞARISIZ:', m); } };

async function call(path, opts = {}, token) {
  const r = await fetch(B + path, {
    ...opts,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) }
  });
  return { status: r.status, body: await r.json().catch(() => ({})) };
}
const login = async (u, p) => (await call('/login', { method: 'POST', body: JSON.stringify({ username: u, password: p }) })).body.token;

const { hazirla } = require('./test-kurulum');

(async () => {
  const kur = await hazirla();               // testler kendi verisini oluşturur
  const admin = kur.admin, ac1 = kur.acente1, ac2 = kur.acente2;
  ok(!!admin && !!ac1 && !!ac2, 'Giriş: admin ve iki acente token aldı');
  ok(!(await login('admin', 'yanlis')), 'Yanlış şifre reddedildi');

  const T = kur.seferler.bos;                // testler için ayrılmış boş sefer

  console.log('\n1) Cinsiyet kuralı');
  let r = await call(`/trips/${T}/sell`, { method: 'POST', body: JSON.stringify({
    passengers: [{ seat_no: 1, passenger_name: 'Ahmet Bay', gender: 'E' }] }) }, ac1);
  ok(r.status === 200, '1 nolu koltuğa bay satıldı');

  r = await call(`/trips/${T}/sell`, { method: 'POST', body: JSON.stringify({
    passengers: [{ seat_no: 2, passenger_name: 'Ayse Bayan', gender: 'K' }] }) }, ac1);
  ok(r.status === 400 && /farklı cinsiyet|Yan yana/i.test(r.body.error), 'Yandaki 2 nolu koltuğa bayan satışı ENGELLENDİ → ' + r.body.error);

  r = await call(`/trips/${T}/sell`, { method: 'POST', body: JSON.stringify({
    passengers: [{ seat_no: 2, passenger_name: 'Mustafa Bay', gender: 'E' }] }) }, ac1);
  ok(r.status === 200, 'Yandaki koltuğa aynı cinsiyet satılabildi');

  r = await call(`/trips/${T}/sell`, { method: 'POST', body: JSON.stringify({
    passengers: [{ seat_no: 3, passenger_name: 'Zeynep H', gender: 'K' }] }) }, ac1);
  ok(r.status === 200, 'Koridorun diğer tarafındaki 3 nolu koltuğa bayan satılabildi (kural sadece yan yana)');

  console.log('\n2) Kafile içinde karışık cinsiyet');
  r = await call(`/trips/${T}/sell`, { method: 'POST', body: JSON.stringify({
    group: { name: 'Kaya Ailesi', contact_name: 'Ali Kaya' },
    passengers: [
      { seat_no: 5, passenger_name: 'Ali Kaya', gender: 'E' },
      { seat_no: 6, passenger_name: 'Elif Kaya', gender: 'K' }
    ] }) }, ac1);
  ok(r.status === 200, 'Aynı kafiledeki bay-bayan yan yana OTURABİLDİ');
  const gid = r.body.group_id;

  r = await call(`/trips/${T}/sell`, { method: 'POST', body: JSON.stringify({
    group_id: gid, passengers: [{ seat_no: 7, passenger_name: 'Can Kaya', gender: 'E' }] }) }, ac1);
  ok(r.status === 200, 'Mevcut kafileye koltuk eklendi');
  r = await call(`/trips/${T}/sell`, { method: 'POST', body: JSON.stringify({
    passengers: [{ seat_no: 8, passenger_name: 'Yabanci Bayan', gender: 'K' }] }) }, ac2);
  ok(r.status === 400, 'Kafile dışından biri, kafile üyesinin yanına farklı cinsiyette oturamadı');

  console.log('\n3) Çift satış / koltuk kilidi');
  r = await call(`/trips/${T}/sell`, { method: 'POST', body: JSON.stringify({
    passengers: [{ seat_no: 1, passenger_name: 'Ikinci Kisi', gender: 'E' }] }) }, ac2);
  ok(r.status === 400 && /satıldı/i.test(r.body.error), 'Dolu koltuk ikinci kez satılamadı → ' + r.body.error);

  const par = await Promise.all([1, 2, 3, 4, 5].map(() =>
    call(`/trips/${T}/sell`, { method: 'POST', body: JSON.stringify({
      passengers: [{ seat_no: 20, passenger_name: 'Yaris', gender: 'E' }] }) }, ac2)));
  ok(par.filter((x) => x.status === 200).length === 1, `Aynı koltuğa 5 eşzamanlı istekten yalnızca 1'i başarılı (${par.filter(x=>x.status===200).length})`);

  console.log('\n4) Rol ve veri izolasyonu');
  r = await call('/users', {}, ac1);
  ok(r.status === 403, 'Acente kullanıcı listesini göremedi');
  r = await call('/buses', { method: 'POST', body: JSON.stringify({ plate: '99 XX 99', name: 'Test' }) }, ac1);
  ok(r.status === 403, 'Acente otobüs ekleyemedi');
  r = await call('/tickets', {}, ac2);
  ok(r.body.every((t) => t.sold_by !== null && t.passenger_name !== 'Ahmet Bay'), 'Acente2 yalnızca kendi biletlerini gördü (' + r.body.length + ' kayıt)');
  const t1 = (await call('/tickets', {}, ac1)).body.find((t) => t.seat_no === 1 && t.trip_id === T);
  r = await call('/tickets/' + t1.id, { method: 'PUT', body: JSON.stringify({ passenger_name: 'Hack' }) }, ac2);
  ok(r.status === 403, 'Acente2, Acente1\'in biletini düzenleyemedi');
  r = await call('/tickets/' + t1.id, { method: 'PUT', body: JSON.stringify({ passenger_name: 'Duzeltilmis Ad' }) }, admin);
  ok(r.status === 200, 'Yönetici her bileti düzenleyebildi');
  r = await call('/tickets', {}, admin);
  ok(r.body.length >= 7, 'Yönetici tüm biletleri gördü (' + r.body.length + ')');

  console.log('\n5) İptal → koltuk boşalıyor');
  r = await call('/tickets/' + t1.id + '/cancel', { method: 'POST', body: '{}' }, admin);
  ok(r.status === 200, 'Bilet iptal edildi');
  const sm = (await call(`/trips/${T}/seatmap`, {}, admin)).body;
  ok(!sm.seats.find((s) => s.seat_no === 1).ticket, 'İptal sonrası 1 nolu koltuk boşaldı');
  r = await call(`/trips/${T}/sell`, { method: 'POST', body: JSON.stringify({
    passengers: [{ seat_no: 1, passenger_name: 'Yeni Yolcu', gender: 'E' }] }) }, ac2);
  ok(r.status === 200, 'Boşalan koltuk tekrar satılabildi');

  console.log('\n6) Doğrulamalar');
  r = await call(`/trips/${T}/sell`, { method: 'POST', body: JSON.stringify({
    passengers: [{ seat_no: 999, passenger_name: 'X', gender: 'E' }] }) }, ac1);
  ok(r.status === 400, 'Kapasite dışı koltuk reddedildi');
  r = await call(`/trips/${T}/sell`, { method: 'POST', body: JSON.stringify({
    passengers: [{ seat_no: 30, passenger_name: 'X', gender: 'E', tc_no: '123' }] }) }, ac1);
  ok(r.status === 400 && /11 haneli/.test(r.body.error), 'Hatalı T.C. no reddedildi');
  r = await call(`/trips/${T}/sell`, { method: 'POST', body: JSON.stringify({
    passengers: [{ seat_no: 31, passenger_name: '', gender: 'E' }] }) }, ac1);
  ok(r.status === 400, 'Boş yolcu adı reddedildi');
  r = await call('/trips/999/seatmap', {}, ac1);
  ok(r.status === 404, 'Olmayan sefer 404 döndü');
  r = await call('/tickets', {});
  ok(r.status === 401, 'Tokensız istek 401 döndü');

  console.log('\n7) Kafile toplu iptal');
  r = await call('/groups/' + gid + '/cancel', { method: 'POST', body: '{}' }, ac1);
  ok(r.status === 200 && r.body.cancelled === 3, 'Kafiledeki 3 biletin tamamı iptal edildi');

  console.log('\n8) Raporlar & manifest');
  r = await call('/reports/sales', {}, admin);
  ok(r.status === 200 && r.body.summary, 'Yönetici raporu geldi (' + r.body.summary.c + ' bilet, ' + r.body.summary.total + ' ₺)');
  r = await call('/reports/sales', {}, ac1);
  ok(r.body.bySeller.length <= 1, 'Acente raporunda sadece kendi satışı var');
  r = await call(`/trips/${T}/manifest`, {}, admin);
  ok(r.status === 200 && Array.isArray(r.body.passengers), 'Yolcu listesi (manifest) alındı — ' + r.body.passengers.length + ' yolcu');
  r = await call('/dashboard', {}, ac1);
  ok(r.status === 200, 'Panel verisi geldi');

  console.log(`\n=== SONUÇ: ${pass} başarılı, ${fail} başarısız ===`);
  process.exit(fail ? 1 : 0);
})();
