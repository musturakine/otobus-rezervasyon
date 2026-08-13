'use strict';
/* ==========================================================================
   Herkese Açık Sayfa & Orta Kapı Testleri
   --------------------------------------------------------------------------
   Sunucu çalışırken:  node test-acik.js

   En kritik nokta: dışarıdan giren biri yolcu adı, telefon, T.C. veya PNR
   göremeyecek ve hiçbir şekilde satış/değişiklik yapamayacak.
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

const { hazirla } = require('./test-kurulum');

(async () => {
  console.log('\n═══ HERKESE AÇIK SAYFA & ORTA KAPI TESTLERİ ═══\n');
  const kur = await hazirla();
  const admin = kur.admin;
  if (!admin) { console.log('Yönetici girişi yapılamadı. Sunucu açık mı?'); process.exit(1); }

  /* ---------------------------------------------------------------- 1 */
  console.log('1) Orta kapılı koltuk düzeni');
  const bus = (await call('/buses', {}, admin)).body.find((b) => b.id === kur.otobusler.bus1);
  kontrol(!!bus, 'Orta kapılı otobüs tanımlı', bus ? bus.plate : '');
  if (bus) {
    const beklenen = bus.rows_cnt * 4 + (bus.back_row ? 5 : 0) - 2;
    kontrol(bus.capacity === beklenen, 'Kapasite kapı için 2 eksik hesaplandı', `${bus.capacity} = ${beklenen}`);
    kontrol(bus.mid_door_row === 6, 'Kapı 6. sırada', bus.mid_door_row + '. sıra');
  }

  const trip = { id: kur.seferler.kapili };
  const harita = (await call(`/trips/${trip.id}/seatmap`, {}, admin)).body;
  const kapiSira = harita.layout.find((r) => r.type === 'door');
  kontrol(!!kapiSira, 'Koltuk planında kapı sırası var');
  kontrol(kapiSira && kapiSira.seats.filter((s) => typeof s === 'number').length === 2,
    'Kapı sırasında sadece 2 koltuk var', kapiSira ? kapiSira.seats.join(',') : '');
  kontrol(kapiSira && kapiSira.seats[0] === 21 && kapiSira.seats[1] === 22,
    'Numaralandırma kesintisiz: kapı sırası 21-22');

  const yirmiUc = harita.layout.find((r) => r.type === 'row' && r.seats[0] === 23);
  kontrol(!!yirmiUc, 'Kapıdan sonraki sıra 23 ile devam ediyor');
  const es21 = harita.seats.find((s) => s.seat_no === 21);
  kontrol(es21 && es21.partner === 22, 'Kapı sırasındaki 21 ile 22 yan yana sayılıyor');
  const es22 = harita.seats.find((s) => s.seat_no === 22);
  kontrol(es22 && es22.partner === 21, '22 numaranın eşi 21');
  kontrol(harita.seats.length === bus.capacity, 'Koltuk sayısı kapasiteye eşit', harita.seats.length + '');

  /* ---------------------------------------------------------------- 2 */
  console.log('\n2) Satılmış bilet varken orta kapı kilitli');
  await call(`/trips/${trip.id}/sell`, {
    method: 'POST',
    body: JSON.stringify({
      passengers: [{ seat_no: 21, passenger_name: 'Kapı Testi', gender: 'E', phone: '05559998877', tc_no: '11122233344' }]
    })
  }, admin);
  const kilit = await call(`/buses/${bus.id}`, { method: 'PUT', body: JSON.stringify({ mid_door: 0 }) }, admin);
  kontrol(kilit.status === 400, 'Biletli otobüste orta kapı değiştirilemedi');
  kontrol(/koltuk numaralarını kaydırır/i.test(kilit.body.error || ''), 'Sebep açıkça anlatıldı');
  const halaVar = (await call('/buses', {}, admin)).body.find((b) => b.id === bus.id);
  kontrol(halaVar.mid_door === 1, 'Ayar değişmedi, olduğu gibi kaldı');

  /* ---------------------------------------------------------------- 3 */
  console.log('\n3) Herkese açık uçlar — şifresiz erişim');
  const firma = await call('/public/settings');
  kontrol(firma.status === 200 && !!firma.body.company.name, 'Firma bilgisi şifresiz alınabiliyor', firma.body.company.name);
  kontrol(!!firma.body.company.logo, 'Logo geliyor');

  const guzergah = await call('/public/routes');
  kontrol(guzergah.status === 200 && Array.isArray(guzergah.body), 'Güzergah listesi şifresiz alınabiliyor', guzergah.body.length + ' güzergah');

  const seferler = await call('/public/trips');
  kontrol(seferler.status === 200 && seferler.body.length > 0, 'Sefer listesi şifresiz alınabiliyor', seferler.body.length + ' sefer');
  kontrol(seferler.body.every((t) => typeof t.empty === 'number'), 'Boş koltuk sayısı bildiriliyor');
  kontrol(seferler.body.every((t) => !('plate' in t)), 'Plaka dışarı verilmiyor');

  /* ---------------------------------------------------------------- 4 */
  console.log('\n4) Kişisel bilgi sızıntısı kontrolü (EN ÖNEMLİ)');
  const acikHarita = await call(`/public/trips/${trip.id}/seatmap`);
  kontrol(acikHarita.status === 200, 'Koltuk planı şifresiz görüntülenebiliyor');

  const metin = JSON.stringify(acikHarita.body);
  const yasakli = [
    ['Kapı Testi', 'yolcu adı'], ['05559998877', 'telefon'], ['11122233344', 'T.C. no'],
    ['passenger_name', 'yolcu adı alanı'], ['"pnr"', 'PNR alanı'], ['"phone"', 'telefon alanı'],
    ['tc_no', 'T.C. alanı'], ['sold_by', 'satıcı bilgisi'], ['plate', 'plaka'], ['paid_amount', 'tahsilat']
  ];
  const sizan = yasakli.filter(([k]) => metin.includes(k));
  kontrol(sizan.length === 0, 'Hiçbir kişisel bilgi sızmıyor',
    sizan.length ? 'SIZDI: ' + sizan.map(([, ad]) => ad).join(', ') : 'temiz');

  const dolu = acikHarita.body.seats.find((s) => s.occupied);
  kontrol(dolu && dolu.gender === 'E', 'Dolu koltuğun sadece cinsiyeti paylaşılıyor');
  kontrol(dolu && Object.keys(dolu).length === 5, 'Koltuk nesnesinde fazladan alan yok', Object.keys(dolu).join(','));
  const bosYan = acikHarita.body.seats.find((s) => s.seat_no === 22);
  kontrol(bosYan && bosYan.requires_gender === 'E', 'Yandaki koltuk için cinsiyet uyarısı veriliyor');

  /* ---------------------------------------------------------------- 5 */
  console.log('\n5) Ziyaretçi hiçbir şey yapamıyor');
  const denemeler = [
    ['Satış', await call(`/trips/${trip.id}/sell`, { method: 'POST', body: JSON.stringify({ passengers: [{ seat_no: 30, passenger_name: 'Davetsiz', gender: 'E' }] }) })],
    ['Bilet listesi', await call('/tickets')],
    ['Sefer silme', await call(`/trips/${trip.id}`, { method: 'DELETE' })],
    ['Kullanıcı listesi', await call('/users')],
    ['Ayar değiştirme', await call('/settings', { method: 'PUT', body: JSON.stringify({ company: { name: 'HACK' } }) })],
    ['Çöp kutusu', await call('/trash')],
    ['Yolcu listesi', await call(`/trips/${trip.id}/manifest`)],
    ['İşlem kayıtları', await call('/logs')]
  ];
  denemeler.forEach(([ad, r]) => kontrol(r.status === 401 || r.status === 403, `${ad} engellendi`, r.status + ''));

  const sonrasi = (await call('/tickets', {}, admin)).body.filter((t) => t.passenger_name === 'DAVETSİZ');
  kontrol(sonrasi.length === 0, 'Ziyaretçinin satış denemesi kayda geçmedi');

  /* ---------------------------------------------------------------- 6 */
  console.log('\n6) Sadece uygun seferler görünüyor');
  const kapatilan = (await call('/trips', {}, admin)).body.find((t) => t.id !== trip.id);
  await call(`/trips/${kapatilan.id}`, { method: 'PUT', body: JSON.stringify({ status: 'kapali' }) }, admin);
  const yeniListe = (await call('/public/trips')).body;
  kontrol(!yeniListe.some((t) => t.id === kapatilan.id), 'Satışa kapalı sefer açık listede görünmüyor');
  kontrol((await call(`/public/trips/${kapatilan.id}/seatmap`)).status === 404,
    'Kapalı seferin koltuk planı açılmıyor');
  await call(`/trips/${kapatilan.id}`, { method: 'PUT', body: JSON.stringify({ status: 'acik' }) }, admin);

  kontrol((await call('/public/trips/999999/seatmap')).status === 404, 'Olmayan sefer 404 döndü');

  /* ---------------------------------------------------------------- 7 */
  console.log('\n7) Kurulum denetimi (eksik dosya koruması)');
  const saglik = await (await fetch('http://localhost:3111/saglik')).json();
  kontrol(saglik.ok === true, 'Sağlık kontrolü tüm dosyaları yerinde buldu');
  kontrol(!!saglik.surum, 'Sürüm numarası bildiriliyor', saglik.surum);
  kontrol(Array.isArray(saglik.eksik) && saglik.eksik.length === 0, 'Eksik dosya yok');

  const durumSayfa = await fetch('http://localhost:3111/durum');
  const durumMetin = await durumSayfa.text();
  kontrol(durumSayfa.status === 200, 'Durum sayfası açılıyor');
  kontrol(/Her şey yolunda/.test(durumMetin), 'Durum sayfası yeşil rapor veriyor');
  kontrol(durumMetin.includes(saglik.surum), 'Durum sayfasında sürüm görünüyor');

  /* ---------------------------------------------------------------- 8 */
  console.log('\n8) Sistem örnek veri ile gelmiyor');
  const demo = (await call('/demo', {}, admin)).body;
  kontrol(demo.varMi === false, 'Kurulumda hiç örnek (demo) kayıt yok');
  kontrol(demo.toplam === 0, 'Örnek kayıt sayısı sıfır', demo.toplam + '');
  const temiz = (await call('/demo/temizle', { method: 'POST' }, admin)).body;
  kontrol(temiz.ok === true && temiz.silinen === 0, 'Temizlenecek örnek kayıt bulunamadı');

  console.log(`\n═══ SONUÇ: ${gecti} başarılı, ${kaldi} başarısız ═══\n`);
  process.exit(kaldi ? 1 : 0);
})();
