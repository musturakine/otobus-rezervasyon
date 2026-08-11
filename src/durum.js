'use strict';
/* ==========================================================================
   Kurulum Denetimi
   --------------------------------------------------------------------------
   Sistem her açılışta gerekli dosyaların yerinde olup olmadığını kontrol eder.
   Bir dosya eksikse site komple kapanmaz; eksiği söyleyen bir sayfa gösterir.

   Neden gerekli: dosyalar GitHub'a elle yüklenirken bazen bir klasör atlanır.
   Eskiden bu durumda site hiç açılmıyor ve sebebi anlaşılmıyordu.
   ========================================================================== */
const fs = require('fs');
const path = require('path');

const KOK = path.join(__dirname, '..');
const PUBLIC = path.join(KOK, 'public');

/* Olmazsa olmaz dosyalar. Biri eksikse sistem düzgün çalışmaz. */
const ZORUNLU = [
  { yol: 'public/anasayfa.html', ne: 'Herkese açık sefer sayfası (ana sayfa)' },
  { yol: 'public/index.html', ne: 'Personel giriş ekranı' },
  { yol: 'public/app.html', ne: 'Uygulama ekranı' },
  { yol: 'public/js/app.js', ne: 'Arayüz kodu' },
  { yol: 'public/css/style.css', ne: 'Tasarım dosyası' },
  { yol: 'public/sw.js', ne: 'Telefon uygulaması desteği' },
  { yol: 'public/manifest.webmanifest', ne: 'Telefon uygulaması tanımı' },
  { yol: 'public/cevrimdisi.html', ne: 'Çevrimdışı bilgi ekranı' },
  { yol: 'src/api.js', ne: 'Sunucu servisleri' },
  { yol: 'src/db.js', ne: 'Veritabanı katmanı' },
  { yol: 'src/auth.js', ne: 'Giriş ve yetki katmanı' },
  { yol: 'src/trash.js', ne: 'Çöp kutusu' },
  { yol: 'src/events.js', ne: 'Canlı bağlantı' },
  { yol: 'src/sms.js', ne: 'SMS / WhatsApp gönderimi' }
];

/* Olmasa da çalışır, ama görüntü eksik kalır. */
const ONERILEN = [
  { yol: 'public/icons/logo-serhend.svg', ne: 'Firma logosu' },
  { yol: 'public/icons/icon-192.png', ne: 'Telefon simgesi (küçük)' },
  { yol: 'public/icons/icon-512.png', ne: 'Telefon simgesi (büyük)' },
  { yol: 'public/icons/apple-touch-icon.png', ne: 'iPhone simgesi' },
  { yol: 'public/icons/maskable-512.png', ne: 'Android simgesi' }
];

const varMi = (goreli) => fs.existsSync(path.join(KOK, goreli));

function surum() {
  try { return require('../package.json').version; } catch { return '?'; }
}

/** Sistemi baştan aşağı denetler. */
function denetle() {
  const eksikZorunlu = ZORUNLU.filter((d) => !varMi(d.yol));
  const eksikOnerilen = ONERILEN.filter((d) => !varMi(d.yol));
  return {
    surum: surum(),
    saglikli: eksikZorunlu.length === 0,
    eksikZorunlu,
    eksikOnerilen,
    toplamZorunlu: ZORUNLU.length,
    /* Eksiklerin hangi klasörlerde toplandığı — kullanıcıya "şu klasörü
       yeniden yükleyin" diyebilmek için */
    eksikKlasorler: [...new Set(
      [...eksikZorunlu, ...eksikOnerilen].map((d) => d.yol.split('/').slice(0, -1).join('/'))
    )]
  };
}

/** Açılışta konsola özet yazar. */
function baslangictaBildir() {
  const d = denetle();
  if (d.saglikli) {
    if (d.eksikOnerilen.length) {
      console.log(`  ⚠  ${d.eksikOnerilen.length} görsel dosya eksik (site çalışır): ` +
        d.eksikOnerilen.map((x) => x.yol).join(', '));
    }
    return d;
  }
  console.log('');
  console.log('  ╔════════════════════════════════════════════════════════╗');
  console.log('  ║  DİKKAT: BAZI DOSYALAR EKSİK                           ║');
  console.log('  ╚════════════════════════════════════════════════════════╝');
  console.log('');
  d.eksikZorunlu.forEach((x) => console.log(`   ✗ ${x.yol}  —  ${x.ne}`));
  console.log('');
  console.log('   Muhtemel sebep: dosyalar yüklenirken bir klasör atlandı.');
  console.log('   Çözüm: şu klasör(ler)i yeniden yükleyin → ' + d.eksikKlasorler.join(', '));
  console.log('   Ayrıntı için tarayıcıdan /durum adresini açın.');
  console.log('');
  return d;
}

/* ------------------------------------------------------------------
   Tarayıcıda gösterilecek durum sayfası
------------------------------------------------------------------ */
const kacis = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

function durumSayfasi() {
  const d = denetle();
  const iyi = d.saglikli && !d.eksikOnerilen.length;

  const satir = (x, zorunlu) => `
    <tr>
      <td class="dur ${zorunlu ? 'kirmizi' : 'sari'}">${zorunlu ? 'EKSİK' : 'eksik'}</td>
      <td><code>${kacis(x.yol)}</code></td>
      <td class="ne">${kacis(x.ne)}</td>
    </tr>`;

  return `<!DOCTYPE html><html lang="tr"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Sistem Durumu — Otobüs Rezervasyon</title>
<style>
  *{box-sizing:border-box}
  body{margin:0;padding:28px 18px;background:#f4f6fb;color:#0f172a;
    font-family:"Segoe UI",Roboto,-apple-system,sans-serif;line-height:1.6}
  .sar{max-width:780px;margin:0 auto}
  .kart{background:#fff;border:1px solid #e2e8f0;border-radius:16px;padding:26px;
    box-shadow:0 4px 14px rgba(15,23,42,.06);margin-bottom:16px}
  h1{margin:0 0 6px;font-size:23px;letter-spacing:-.02em}
  h2{margin:0 0 12px;font-size:16px}
  .alt{color:#64748b;margin:0 0 20px;font-size:14px}
  .rozet{display:inline-flex;align-items:center;gap:9px;padding:11px 18px;border-radius:12px;
    font-weight:700;font-size:16px;margin-bottom:18px}
  .ok{background:#d1fae5;color:#047857}
  .hata{background:#fee2e2;color:#b91c1c}
  .uyari{background:#fef3c7;color:#92400e}
  table{width:100%;border-collapse:collapse;margin-top:10px;font-size:14px}
  td{padding:9px 8px;border-bottom:1px solid #eef2f7;vertical-align:top}
  td.dur{width:74px;font-weight:800;font-size:11px;letter-spacing:.04em;white-space:nowrap}
  .kirmizi{color:#dc2626} .sari{color:#b45309}
  .ne{color:#64748b}
  code{background:#f1f5f9;padding:2px 7px;border-radius:6px;font-size:13px}
  .cozum{background:#eff6ff;border:1px solid #bfdbfe;border-radius:12px;padding:16px 18px;margin-top:16px}
  .cozum b{color:#1e40af}
  ol{margin:10px 0 0;padding-left:20px} li{margin:6px 0}
  .bilgi{display:grid;grid-template-columns:170px 1fr;gap:6px 14px;font-size:14px}
  .bilgi div:nth-child(odd){color:#64748b}
  a.btn{display:inline-block;margin-top:14px;background:#2563eb;color:#fff;text-decoration:none;
    padding:11px 20px;border-radius:10px;font-weight:700;font-size:14px}
</style></head><body><div class="sar">

<div class="kart">
  <h1>Sistem Durumu</h1>
  <p class="alt">Bu sayfa, sistemin bütün dosyalarının sunucuya doğru yüklenip yüklenmediğini gösterir.
     Her güncellemeden sonra buraya bakmanız yeterlidir.</p>

  ${iyi
    ? '<div class="rozet ok">✓ Her şey yolunda — tüm dosyalar yerinde</div>'
    : d.saglikli
      ? '<div class="rozet uyari">⚠ Sistem çalışıyor, ama bazı görsel dosyalar eksik</div>'
      : '<div class="rozet hata">✕ Bazı dosyalar eksik — güncelleme tamamlanmamış</div>'}

  <div class="bilgi">
    <div>Sistem sürümü</div><div><b>${kacis(d.surum)}</b></div>
    <div>Denetlenen dosya</div><div>${d.toplamZorunlu} zorunlu, ${ONERILEN.length} görsel</div>
    <div>Sunucu saati</div><div>${new Date().toLocaleString('tr-TR')}</div>
  </div>
</div>

${!iyi ? `
<div class="kart">
  <h2>Eksik dosyalar</h2>
  <table>
    ${d.eksikZorunlu.map((x) => satir(x, true)).join('')}
    ${d.eksikOnerilen.map((x) => satir(x, false)).join('')}
  </table>

  <div class="cozum">
    <b>Nasıl düzeltilir?</b>
    <ol>
      <li>Bilgisayarınızdaki güncel proje klasörünü açın.</li>
      <li>Şu klasör${d.eksikKlasorler.length > 1 ? 'leri' : 'ü'} bulun:
          ${d.eksikKlasorler.map((k) => `<code>${kacis(k)}</code>`).join(', ')}</li>
      <li>GitHub deponuzda <b>Add file → Upload files</b> deyin ve
          o klasör${d.eksikKlasorler.length > 1 ? 'leri' : 'ü'} sürükleyip bırakın.</li>
      <li><b>Commit changes</b> düğmesine basın, 3–5 dakika bekleyin.</li>
      <li>Bu sayfayı yenileyin — yeşil olmalı.</li>
    </ol>
  </div>
  <a class="btn" href="/durum">Yeniden denetle</a>
</div>` : `
<div class="kart">
  <h2>Ne yapabilirsiniz?</h2>
  <p class="alt" style="margin:0">Sistem sağlıklı. Ana sayfaya veya personel girişine geçebilirsiniz.</p>
  <a class="btn" href="/">Ana sayfa</a>
  <a class="btn" href="/giris" style="background:#0f766e;margin-left:8px">Personel girişi</a>
</div>`}

</div></body></html>`;
}

/* ------------------------------------------------------------------
   Ana sayfa eksikse gösterilecek yedek sayfa
   Site hiç açılmamaktansa, sorunu anlatan bir sayfa göstermek yeğdir.
------------------------------------------------------------------ */
function yedekAnasayfa() {
  const d = denetle();
  return `<!DOCTYPE html><html lang="tr"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Sistem hazırlanıyor</title>
<style>
  body{margin:0;min-height:100vh;display:grid;place-items:center;padding:24px;
    background:linear-gradient(155deg,#0b1f3a,#12325f);color:#fff;
    font-family:"Segoe UI",Roboto,-apple-system,sans-serif;line-height:1.6}
  .kutu{max-width:520px;background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.16);
    border-radius:20px;padding:34px;text-align:center;backdrop-filter:blur(8px)}
  h1{margin:0 0 12px;font-size:24px}
  p{color:#c3d5f0;margin:0 0 10px;font-size:15px}
  .kucuk{font-size:13px;color:#8ea6cc;margin-top:18px}
  a{display:inline-block;margin:16px 6px 0;background:#0ea5a4;color:#fff;text-decoration:none;
    padding:11px 20px;border-radius:11px;font-weight:700;font-size:14px}
  a.ikinci{background:rgba(255,255,255,.14)}
</style></head><body>
  <div class="kutu">
    <div style="font-size:42px;margin-bottom:8px">🛠️</div>
    <h1>Sistem şu an hazırlanıyor</h1>
    <p>Güncelleme sırasında bazı dosyalar sunucuya ulaşmamış. Sistem çalışıyor,
       sadece bu sayfanın dosyası eksik.</p>
    <p><b style="color:#fff">Personel girişi çalışmaya devam ediyor.</b></p>
    <a href="/giris">Personel girişi</a>
    <a class="ikinci" href="/durum">Ne eksik, göster</a>
    <div class="kucuk">Sürüm ${kacis(d.surum)} · ${d.eksikZorunlu.length} dosya eksik</div>
  </div>
</body></html>`;
}

module.exports = { denetle, baslangictaBildir, durumSayfasi, yedekAnasayfa, ZORUNLU, ONERILEN };
