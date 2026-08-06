'use strict';
/* ==========================================================================
   Silme ve Çöp Kutusu Testleri
   --------------------------------------------------------------------------
   Sunucu çalışırken:  node test-silme.js
   ========================================================================== */
const B = 'http://localhost:3111/api';

let gecti = 0, kaldi = 0;
const ok = (m, ek = '') => { gecti++; console.log(`  ✓ ${m}${ek ? ' → ' + ek : ''}`); };
const no = (m, ek = '') => { kaldi++; console.log(`  ✗ BAŞARISIZ: ${m}${ek ? ' → ' + ek : ''}`); };
const kontrol = (sart, m, ek) => (sart ? ok(m, ek) : no(m, ek));

async function call(yol, opts = {}, tok) {
  const res = await fetch(B + yol, {
    ...opts,
    headers: { 'Content-Type': 'application/json', ...(tok ? { Authorization: 'Bearer ' + tok } : {}), ...(opts.headers || {}) }
  });
  const body = await res.json().catch(() => ({}));
  return { status: res.status, body };
}
const login = async (u, p) => (await call('/login', { method: 'POST', body: JSON.stringify({ username: u, password: p }) })).body.token;

(async () => {
  console.log('\n═══ SİLME & ÇÖP KUTUSU TESTLERİ ═══\n');

  const admin = await login('admin', 'admin123');
  const acente = await login('acente1', 'acente123');
  if (!admin) { console.log('Yönetici girişi yapılamadı. Sunucu açık mı?'); process.exit(1); }

  /* ---------------------------------------------------------------- 1 */
  console.log('1) Yetki kontrolü');
  const trips = (await call('/trips', {}, admin)).body;
  const T = trips[0].id;

  kontrol((await call(`/trips/${T}`, { method: 'DELETE' }, acente)).status === 403,
    'Acente sefer silemedi');
  kontrol((await call('/trash', {}, acente)).status === 403,
    'Acente çöp kutusunu göremedi');
  kontrol((await call('/trash/count', {}, acente)).body.count === 0,
    'Acenteye çöp sayacı 0 döndü');

  /* ---------------------------------------------------------------- 2 */
  console.log('\n2) Silme önizlemesi (hiçbir şey silmez)');
  await call(`/trips/${T}/sell`, {
    method: 'POST',
    body: JSON.stringify({
      passengers: [
        { seat_no: 21, passenger_name: 'Silme Testi Bir', gender: 'E' },
        { seat_no: 22, passenger_name: 'Silme Testi İki', gender: 'E' }
      ],
      group: { name: 'Test Kafilesi', contact_name: 'Sorumlu' }
    })
  }, admin);

  const onizle = (await call(`/trips/${T}/silme-onizleme`, {}, admin)).body;
  kontrol(onizle.counts.tickets >= 2, 'Önizleme bilet sayısını bildirdi', onizle.counts.tickets + ' bilet');
  kontrol(onizle.counts.groups >= 1, 'Önizleme kafileyi bildirdi');
  kontrol(!!onizle.label, 'Önizleme okunur bir etiket verdi', onizle.label);
  kontrol((await call('/trips', {}, admin)).body.some((x) => x.id === T),
    'Önizleme sonrası sefer hâlâ duruyor');

  /* ---------------------------------------------------------------- 3 */
  console.log('\n3) Sefer silme → çöp kutusu');
  const biletOnce = (await call('/tickets', {}, admin)).body.length;
  const sil = (await call(`/trips/${T}`, { method: 'DELETE' }, admin)).body;
  kontrol(sil.ok === true && sil.trash_id > 0, 'Sefer silindi ve çöp numarası döndü');
  kontrol(!!sil.summary, 'Nelerin birlikte gittiği bildirildi', sil.summary);
  kontrol(!(await call('/trips', {}, admin)).body.some((x) => x.id === T), 'Sefer listeden kalktı');
  kontrol((await call('/tickets', {}, admin)).body.length < biletOnce, 'Sefere ait biletler de kalktı');

  const cop = (await call('/trash', {}, admin)).body;
  kontrol(cop.items.length === 1, 'Çöp kutusunda 1 kayıt var');
  kontrol(cop.items[0].kalan_gun === 30, 'Kalan süre 30 gün', cop.items[0].kalan_gun + ' gün');
  kontrol(cop.items[0].tur === 'Sefer', 'Tür doğru yazıldı');
  kontrol((await call('/trash/count', {}, admin)).body.count === 1, 'Sayaç 1 gösterdi');

  /* ---------------------------------------------------------------- 4 */
  console.log('\n4) Geri alma');
  const geri = (await call(`/trash/${sil.trash_id}/restore`, { method: 'POST' }, admin)).body;
  kontrol(geri.ok === true, 'Geri alma başarılı');
  kontrol((await call('/trips', {}, admin)).body.some((x) => x.id === T), 'Sefer geri geldi');

  const geriBilet = (await call('/tickets', {}, admin)).body.filter((t) => t.trip_id === T);
  kontrol(geriBilet.length >= 2, 'Biletler geri geldi', geriBilet.length + ' bilet');
  kontrol(geriBilet.some((t) => t.passenger_name.includes('SİLME')), 'Yolcu adları korundu');
  kontrol((await call('/groups', {}, admin)).body.some((g) => g.name === 'Test Kafilesi'), 'Kafile geri geldi');
  kontrol((await call('/trash', {}, admin)).body.items.length === 0, 'Çöp kutusu boşaldı');

  /* ---------------------------------------------------------------- 5 */
  console.log('\n5) Otobüs silme (seferleri de gider) ve geri alma');
  const bus = (await call('/buses', {}, admin)).body[0];
  const seferOnce = (await call('/trips', {}, admin)).body.length;
  const busSil = (await call(`/buses/${bus.id}`, { method: 'DELETE' }, admin)).body;
  kontrol(busSil.ok === true, 'Otobüs silindi');
  kontrol((await call('/trips', {}, admin)).body.length < seferOnce, 'Otobüsün seferleri de gitti');
  await call(`/trash/${busSil.trash_id}/restore`, { method: 'POST' }, admin);
  kontrol((await call('/buses', {}, admin)).body.some((b) => b.id === bus.id), 'Otobüs geri geldi');
  kontrol((await call('/trips', {}, admin)).body.length === seferOnce, 'Seferler de geri geldi');

  /* ---------------------------------------------------------------- 6 */
  console.log('\n6) Kullanıcı silme güvenliği');
  const ben = (await call('/me', {}, admin)).body;
  kontrol((await call(`/users/${ben.id}`, { method: 'DELETE' }, admin)).status === 400,
    'Yönetici kendi hesabını silemedi');

  const users = (await call('/users', {}, admin)).body;
  const digerAdmin = users.filter((u) => u.role === 'admin' && u.id !== ben.id);
  if (!digerAdmin.length) ok('Sistemde tek yönetici var — son yönetici koruması devrede');

  const ac1 = users.find((u) => u.username === 'acente1');
  const acSil = (await call(`/users/${ac1.id}`, { method: 'DELETE' }, admin)).body;
  kontrol(acSil.ok === true, 'Acente silindi');
  kontrol(!(await call('/users', {}, admin)).body.some((u) => u.id === ac1.id), 'Acente listeden kalktı');
  await call(`/trash/${acSil.trash_id}/restore`, { method: 'POST' }, admin);
  kontrol((await call('/users', {}, admin)).body.some((u) => u.id === ac1.id), 'Acente geri geldi');

  /* ---------------------------------------------------------------- 7 */
  console.log('\n7) Kalıcı silme ve boşaltma');
  const g2 = (await call('/groups', {}, admin)).body[0];
  if (g2) {
    const gSil = (await call(`/groups/${g2.id}`, { method: 'DELETE' }, admin)).body;
    kontrol(gSil.ok === true, 'Kafile silindi');
    kontrol((await call(`/trash/${gSil.trash_id}`, { method: 'DELETE' }, admin)).body.ok === true,
      'Kayıt kalıcı olarak silindi');
    kontrol((await call(`/trash/${gSil.trash_id}/restore`, { method: 'POST' }, admin)).status === 404,
      'Kalıcı silinen kayıt geri alınamıyor');
  }

  const r = (await call('/routes', {}, admin)).body[0];
  await call(`/routes/${r.id}`, { method: 'DELETE' }, admin);
  const bosalt = (await call('/trash/empty', { method: 'POST' }, admin)).body;
  kontrol(bosalt.ok === true && bosalt.count >= 1, 'Çöp kutusu boşaltıldı', bosalt.count + ' kayıt');
  kontrol((await call('/trash', {}, admin)).body.items.length === 0, 'Çöp kutusu gerçekten boş');

  /* ---------------------------------------------------------------- 8 */
  console.log('\n8) Firma kimliği');
  const kucukPng = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
  const kaydet = (await call('/settings', {
    method: 'PUT',
    body: JSON.stringify({ company: { name: 'TEST TURİZM', slogan: 'Deneme sloganı', logo: kucukPng, website: 'ornek.com' } })
  }, admin)).body;
  kontrol(kaydet.ok === true, 'Firma bilgileri logoyla kaydedildi');
  kontrol(kaydet.company.logo === kucukPng, 'Logo geri döndü');
  kontrol((await call('/public/settings')).body.company.slogan === 'Deneme sloganı',
    'Slogan giriş ekranına da geçti');
  kontrol((await call('/settings', {
    method: 'PUT', body: JSON.stringify({ company: { name: 'X', logo: 'javascript:kotu()' } })
  }, admin)).status === 400, 'Geçersiz logo reddedildi');
  kontrol((await call('/settings', {
    method: 'PUT', body: JSON.stringify({ company: { name: '' } })
  }, admin)).status === 400, 'Boş firma adı reddedildi');

  console.log(`\n═══ SONUÇ: ${gecti} başarılı, ${kaldi} başarısız ═══\n`);
  process.exit(kaldi ? 1 : 0);
})();
