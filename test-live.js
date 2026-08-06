/* İki terminal aynı anda: canlı koltuk güncellemesi ve mobil kontrolleri */
const { chromium } = require('playwright');
const B = 'http://localhost:3111';

(async () => {
  const browser = await chromium.launch();
  const hatalar = [];
  const shot = (p, n) => p.screenshot({ path: `/tmp/shots2/${n}.png`, fullPage: false });

  async function girisYap(ctx, u, p) {
    const page = await ctx.newPage();
    page.on('pageerror', (e) => hatalar.push(`[${u}] ${e.message}`));
    page.on('console', (m) => { if (m.type() === 'error' && !/ERR_TUNNEL|fonts/.test(m.text())) hatalar.push(`[${u}] ${m.text()}`); });
    await page.goto(B + '/');
    await page.fill('#username', u); await page.fill('#password', p);
    await page.click('#loginBtn'); await page.waitForURL('**/app.html');
    await page.waitForTimeout(1200);
    return page;
  }

  // TERMİNAL 1 — yönetici (masaüstü)
  const c1 = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'tr-TR' });
  const t1 = await girisYap(c1, 'admin', 'admin123');

  // TERMİNAL 2 — acente (telefon)
  const c2 = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: 'tr-TR', isMobile: true, hasTouch: true });
  const t2 = await girisYap(c2, 'acente1', 'acente123');

  // İkisi de aynı seferi açsın
  await t1.goto(B + '/app.html#/sefer/4'); await t1.waitForTimeout(1400);
  await t2.goto(B + '/app.html#/sefer/4'); await t2.waitForTimeout(1600);

  const canli1 = await t1.locator('#liveDot').getAttribute('class');
  const canli2 = await t2.locator('#liveDot').getAttribute('class');
  console.log('Canlı bağlantı — terminal1:', canli1, '| terminal2:', canli2);
  console.log('Görünen terminal sayısı:', await t1.locator('#liveText').textContent());

  await shot(t2, '01-mobil-koltuk-once');

  // Terminal 2'deki 12 numaralı koltuk boş mu?
  const oncekiSinif = await t2.locator('.seat[data-seat="12"]').getAttribute('class');
  console.log('Terminal2 — 12 nolu koltuk (satış öncesi):', oncekiSinif.trim());

  // TERMİNAL 1 SATIŞ YAPIYOR
  await t1.click('.seat[data-seat="12"]');
  await t1.waitForTimeout(400);
  await t1.fill('input[data-f="passenger_name"][data-seat="12"]', 'Canli Test Yolcu');
  await t1.click('#sellBtn');
  await t1.waitForTimeout(2600);

  // TERMİNAL 2 KENDİLİĞİNDEN GÜNCELLENDİ Mİ?
  const sonrakiSinif = await t2.locator('.seat[data-seat="12"]').getAttribute('class');
  console.log('Terminal2 — 12 nolu koltuk (satış sonrası, dokunulmadan):', sonrakiSinif.trim());
  const guncellendi = /male|female/.test(sonrakiSinif) && !/empty-seat/.test(sonrakiSinif);
  console.log(guncellendi ? '✓ CANLI GÜNCELLEME ÇALIŞTI' : '✗ CANLI GÜNCELLEME ÇALIŞMADI');
  await shot(t2, '02-mobil-koltuk-sonra');

  // İptal de yayılıyor mu?
  await t1.click('.seat[data-seat="12"]'); await t1.waitForTimeout(900);
  await t1.click('#btnCancel'); await t1.waitForTimeout(500);
  await t1.click('#cyes'); await t1.waitForTimeout(2400);
  const iptalSonrasi = await t2.locator('.seat[data-seat="12"]').getAttribute('class');
  console.log('Terminal2 — iptal sonrası:', iptalSonrasi.trim(), /empty-seat/.test(iptalSonrasi) ? '✓ boşaldı' : '✗ boşalmadı');

  // Mobil: alt menü var mı, biniş ekranı çalışıyor mu
  const altMenu = await t2.locator('.bottom-nav').isVisible();
  console.log('Mobil alt menü görünür:', altMenu);
  await t2.click('.bottom-nav button[data-page="binis"]');
  await t2.waitForTimeout(1500);
  await shot(t2, '03-mobil-binis-liste');
  const satirVar = await t2.locator('tbody tr').count();
  if (satirVar) {
    await t2.locator('tbody tr').first().click();
    await t2.waitForTimeout(1500);
    await shot(t2, '04-mobil-binis-detay');
    const yolcu = await t2.locator('.board-row').count();
    console.log('Biniş ekranındaki yolcu sayısı:', yolcu);
    if (yolcu) {
      await t2.locator('.board-row').first().click();
      await t2.waitForTimeout(900);
      const isaretli = await t2.locator('.board-row').first().getAttribute('class');
      console.log('Yolcuya dokununca bindi işaretlendi:', /done/.test(isaretli) ? '✓' : '✗');
      await shot(t2, '05-mobil-binis-isaretli');
    }
  }

  // Manifest PWA dosyaları
  for (const yol of ['/manifest.webmanifest', '/sw.js', '/icons/icon-192.png', '/cevrimdisi.html']) {
    const r = await t1.request.get(B + yol);
    console.log(`${yol} → ${r.status()}`);
  }

  // Güvenlik başlıkları
  const r = await t1.request.get(B + '/app.html');
  const h = r.headers();
  console.log('Güvenlik başlıkları:', ['x-content-type-options','x-frame-options','content-security-policy']
    .map((k) => k + '=' + (h[k] ? '✓' : '✗')).join(' '));

  // Giriş deneme sınırı
  let kilit = null;
  for (let i = 0; i < 10; i++) {
    const rr = await t1.request.post(B + '/api/login', { data: { username: 'admin', password: 'yanlis' + i } });
    if (rr.status() === 429) { kilit = i + 1; break; }
  }
  console.log('Kaba kuvvet koruması:', kilit ? `✓ ${kilit}. denemede kilitlendi` : '✗ kilitlenmedi');

  // Masaüstü ekranları
  await t1.goto(B + '/app.html#/ayarlar'); await t1.waitForTimeout(1600);
  await shot(t1, '06-ayarlar-yedek');
  await t1.goto(B + '/app.html#/sefer/4'); await t1.waitForTimeout(1400);
  await shot(t1, '07-masaustu-koltuk');

  console.log('\n--- JS HATALARI ---');
  console.log(hatalar.length ? [...new Set(hatalar)].join('\n') : 'Hata yok ✓');
  await browser.close();
})();
