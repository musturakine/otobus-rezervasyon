/* Bildirim (SMS / WhatsApp) testleri — gerçek bir aboneliğe ihtiyaç duymaz.
   Sahte bir SMS servisi ayağa kaldırıp uçtan uca gönderimi doğrular. */
const http = require('http');
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

(async () => {
  const { normalizePhone, renderTemplate, whatsappLink, sadelestir } = require('./src/sms');

  console.log('1) Telefon numarası düzeltme');
  ok(normalizePhone('0555 111 22 33') === '905551112233', '0555 111 22 33 → 905551112233');
  ok(normalizePhone('+90 555 111 22 33') === '905551112233', '+90 555 111 22 33 → 905551112233');
  ok(normalizePhone('5551112233') === '905551112233', '5551112233 → 905551112233');
  ok(normalizePhone('90 555 111 22 33') === '905551112233', 'ülke koduyla yazım kabul edildi');
  ok(normalizePhone('0212 111 22 33') === null, 'sabit hat numarası reddedildi');
  ok(normalizePhone('555111223') === null, 'eksik haneli numara reddedildi');
  ok(normalizePhone('') === null && normalizePhone(null) === null, 'boş numara reddedildi');

  console.log('\n2) Mesaj şablonu');
  const veri = { ad: 'Ayşe Yılmaz', pnr: 'K4M2PR', koltuk: 12, kalkis: 'İstanbul', varis: 'Ankara',
                 tarih: '07.08.2026', saat: '09:00', plaka: '34 ABC 123', firma: 'ÖZ SEYAHAT' };
  const m = renderTemplate('Sayin {ad}, {koltuk} nolu koltuk. PNR {pnr}. {firma}', veri, false);
  ok(m === 'Sayin Ayşe Yılmaz, 12 nolu koltuk. PNR K4M2PR. ÖZ SEYAHAT', 'Değişkenler doğru yerleşti');
  ok(!renderTemplate('{ad} {olmayan}', veri, false).includes('{olmayan}'), 'Tanımsız değişken boş bırakıldı');
  ok(sadelestir('Şükrü Çağrı İğneada') === 'Sukru Cagri Igneada', 'Türkçe karakter sadeleştirme çalışıyor');
  ok(renderTemplate('{ad}', veri, true) === 'Ayse Yilmaz', 'Sadeleştirme şablona uygulandı');

  console.log('\n3) WhatsApp bağlantısı');
  const link = whatsappLink('0555 111 22 33', 'Merhaba dünya');
  ok(link && link.startsWith('https://wa.me/905551112233?text='), 'wa.me bağlantısı doğru üretildi');
  ok(link.includes(encodeURIComponent('Merhaba dünya')), 'Mesaj metni bağlantıya kodlandı');
  ok(whatsappLink('123', 'x') === null, 'Geçersiz numara için bağlantı üretilmedi');

  // ---- Sahte SMS servisi ----
  const gelenler = [];
  const sahte = http.createServer((req, res) => {
    let g = '';
    req.on('data', (c) => (g += c));
    req.on('end', () => {
      gelenler.push({ yol: req.url, yetki: req.headers.authorization, govde: JSON.parse(g || '{}') });
      if (req.url === '/hata') { res.writeHead(500); return res.end('servis mesgul'); }
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true }));
    });
  });
  await new Promise((r) => sahte.listen(4455, r));

  const admin = await login('admin', 'admin123');
  const acente = await login('acente1', 'acente123');

  console.log('\n4) Ayarlar ve yetki');
  let r = await call('/sms-settings', {}, acente);
  ok(r.status === 403, 'Acente bildirim ayarlarını göremedi');
  r = await call('/sms-settings', {}, admin);
  ok(r.status === 200 && r.body.settings.saglayici === 'kapali', 'Varsayılan durum: SMS kapalı, WhatsApp açık');
  ok(r.body.settings.whatsapp_aktif === true, 'WhatsApp seçeneği varsayılan olarak açık');

  r = await call('/sms-settings', { method: 'PUT', body: JSON.stringify({
    saglayici: 'ozel', adres: 'http://localhost:4455/gonder', gizli: 'gizli-anahtar',
    baslik: 'OZSEYAHAT', otomatik: false, sablon: '{ad} - {koltuk} nolu koltuk - PNR {pnr}'
  }) }, admin);
  ok(r.status === 200, 'Ayarlar kaydedildi');
  ok(r.body.settings.gizli === '••••••••', 'Şifre/anahtar arayüze maskelenerek döndü');

  console.log('\n5) Elle bilet gönderimi');
  // Telefonlu bir bilet sat
  const sat = await call('/trips/5/sell', { method: 'POST', body: JSON.stringify({
    passengers: [{ seat_no: 3, passenger_name: 'Ayse Yilmaz', gender: 'K', phone: '0555 111 22 33' }] }) }, acente);
  ok(sat.status === 200, 'Telefon bilgisiyle bilet kesildi');
  const bid = sat.body.tickets[0].id;

  r = await call('/tickets/' + bid + '/message', {}, acente);
  ok(r.status === 200 && r.body.valid_phone, 'Bilet mesajı hazırlandı');
  ok(r.body.whatsapp_link && r.body.whatsapp_link.includes('905551112233'), 'WhatsApp bağlantısı bilette hazır');
  ok(r.body.sms_text.includes('AYSE YILMAZ') || r.body.sms_text.includes('Ayse'), 'Mesajda yolcu adı var');
  ok(r.body.sms_parts >= 1, `SMS uzunluğu hesaplandı (${r.body.sms_length} karakter, ${r.body.sms_parts} SMS)`);

  const oncekiSayi = gelenler.length;
  r = await call('/tickets/' + bid + '/sms', { method: 'POST', body: '{}' }, acente);
  ok(r.status === 200, 'SMS gönderildi');
  ok(gelenler.length === oncekiSayi + 1, 'İstek SMS servisine gerçekten ulaştı');
  const son = gelenler[gelenler.length - 1];
  ok(son.govde.phone === '905551112233', 'Servise giden numara doğru biçimde: ' + son.govde.phone);
  ok(son.yetki === 'Bearer gizli-anahtar', 'Yetki anahtarı isteğe eklendi');
  ok(son.govde.text.includes('PNR'), 'Mesaj metni gönderildi: ' + JSON.stringify(son.govde.text.slice(0, 60)));

  console.log('\n6) Hatalı durumlar kayda geçiyor');
  await call('/sms-settings', { method: 'PUT', body: JSON.stringify({ adres: 'http://localhost:4455/hata' }) }, admin);
  r = await call('/tickets/' + bid + '/sms', { method: 'POST', body: '{}' }, acente);
  ok(r.status === 400 && /500/.test(r.body.error || ''), 'Servis hatası kullanıcıya bildirildi → ' + r.body.error);
  const kayitlar = (await call('/messages', {}, admin)).body;
  ok(kayitlar.some((k) => k.status === 'hata'), 'Başarısız gönderim kayda geçti');
  ok(kayitlar.some((k) => k.status === 'gonderildi'), 'Başarılı gönderim kayda geçti');

  r = await call('/tickets/' + bid + '/sms', { method: 'POST', body: JSON.stringify({ phone: '0212 555 44 33' }) }, acente);
  ok(r.status === 400 && /Geçersiz/.test(r.body.error), 'Sabit hat numarasına gönderim engellendi');

  console.log('\n7) Satış sonrası otomatik gönderim');
  await call('/sms-settings', { method: 'PUT', body: JSON.stringify({
    adres: 'http://localhost:4455/otomatik', otomatik: true }) }, admin);
  const once = gelenler.length;
  const sat2 = await call('/trips/5/sell', { method: 'POST', body: JSON.stringify({
    passengers: [
      { seat_no: 7, passenger_name: 'Mehmet Kaya', gender: 'E', phone: '0532 444 55 66' },
      { seat_no: 8, passenger_name: 'Telefonsuz Yolcu', gender: 'E' }
    ] }) }, acente);
  ok(sat2.status === 200, 'İki bilet kesildi (biri telefonsuz)');
  await new Promise((r2) => setTimeout(r2, 900));
  ok(gelenler.length === once + 1, `Sadece telefonu olan yolcuya mesaj gitti (${gelenler.length - once} mesaj)`);
  ok(gelenler[gelenler.length - 1].govde.phone === '905324445566', 'Doğru numaraya gitti');

  console.log('\n8) Deneme mesajı ve kapatma');
  r = await call('/sms-settings/test', { method: 'POST', body: JSON.stringify({ phone: '0555 999 88 77' }) }, admin);
  ok(r.status === 200, 'Yönetici deneme mesajı gönderebildi');
  r = await call('/sms-settings/test', { method: 'POST', body: JSON.stringify({ phone: 'abc' }) }, admin);
  ok(r.status === 400, 'Geçersiz numarayla deneme reddedildi');

  await call('/sms-settings', { method: 'PUT', body: JSON.stringify({ saglayici: 'kapali', otomatik: false }) }, admin);
  r = await call('/tickets/' + bid + '/sms', { method: 'POST', body: '{}' }, acente);
  ok(r.status === 400 && /kapalı/i.test(r.body.error), 'SMS kapalıyken uyarı verildi');
  r = await call('/tickets/' + bid + '/message', {}, acente);
  ok(r.body.whatsapp_link, 'SMS kapalıyken bile WhatsApp seçeneği çalışıyor');

  sahte.close();
  console.log(`\n=== SONUÇ: ${pass} başarılı, ${fail} başarısız ===`);
  process.exit(fail ? 1 : 0);
})();
