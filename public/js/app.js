/* ==========================================================================
   Otobüs Rezervasyon & Satış Sistemi — Arayüz Uygulaması
   ========================================================================== */
'use strict';

/* ----------------------------- Durum & Yardımcılar ----------------------------- */
const S = {
  user: null,
  company: { name: 'REZERVASYON' },
  seatmap: null,
  selection: new Map(),   // seat_no -> {gender, passenger_name, phone, tc_no, price, payment_status}
  kafile: { on: false, mode: 'new', name: '', contact_name: '', contact_phone: '', group_id: null },
  cache: {}
};

const token = () => localStorage.getItem('token');

async function api(path, opts = {}) {
  const res = await fetch('/api' + path, {
    ...opts,
    headers: {
      'Content-Type': 'application/json',
      Authorization: 'Bearer ' + token(),
      ...(opts.headers || {})
    }
  });
  if (res.status === 401) { localStorage.clear(); location.href = '/'; throw new Error('Oturum sonlandı'); }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Bir hata oluştu.');
  return data;
}

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const TL = (n) => (Number(n) || 0).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' ₺';
const TL0 = (n) => (Number(n) || 0).toLocaleString('tr-TR', { maximumFractionDigits: 0 }) + ' ₺';
const AYLAR = ['Ocak','Şubat','Mart','Nisan','Mayıs','Haziran','Temmuz','Ağustos','Eylül','Ekim','Kasım','Aralık'];
const GUNLER = ['Pazar','Pazartesi','Salı','Çarşamba','Perşembe','Cuma','Cumartesi'];

function trDate(iso, withDay = true) {
  if (!iso) return '—';
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  return `${d} ${AYLAR[m - 1]} ${y}` + (withDay ? ` ${GUNLER[dt.getDay()]}` : '');
}
function shortDate(iso) {
  if (!iso) return '—';
  const [y, m, d] = iso.slice(0, 10).split('-');
  return `${d}.${m}.${y}`;
}
const todayISO = () => { const d = new Date(); return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10); };
const addDaysISO = (iso, n) => { const d = new Date(iso + 'T12:00:00'); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); };

const ICON = {
  panel: '<path d="M3 13h8V3H3v10zm0 8h8v-6H3v6zm10 0h8V11h-8v10zm0-18v6h8V3h-8z"/>',
  bus: '<path d="M4 17h16M6 17v2M18 17v2M5 6h14a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2zM3 10h18M9 6v4M15 6v4"/>',
  ticket: '<path d="M3 9a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2 2 2 0 0 0 0 6 2 2 0 0 1-2 2H5a2 2 0 0 1-2-2 2 2 0 0 0 0-6zM13 7v10"/>',
  users: '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>',
  chart: '<path d="M3 3v18h18M7 15l4-4 3 3 5-6"/>',
  route: '<path d="M6 3v12M6 21a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM18 9a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM18 9v6a6 6 0 0 1-6 6"/>',
  cog: '<path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06A1.65 1.65 0 0 0 15 19.4a1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.6 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09A1.65 1.65 0 0 0 15 4.6a1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9v.09c.36.14.66.4.86.72"/>',
  group: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 7a4 4 0 1 0 0 .01M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>',
  money: '<path d="M12 1v22M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  list: '<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>',
  log: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M16 13H8M16 17H8M10 9H8"/>',
  check: '<path d="M20 6L9 17l-5-5"/>',
  x: '<path d="M18 6L6 18M6 6l12 12"/>',
  warn: '<path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><path d="M12 9v4M12 17h.01"/>',
  print: '<path d="M6 9V2h12v7M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2M6 14h12v8H6z"/>',
  send: '<path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z"/>',
  bell: '<path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 0 1-3.46 0"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/>',
  empty: '<path d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"/>',
  trash: '<path d="M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6M10 11v6M14 11v6"/>',
  undo: '<path d="M3 7v6h6"/><path d="M3.5 13a9 9 0 1 0 2.1-9.4L3 7"/>',
  help: '<circle cx="12" cy="12" r="9"/><path d="M9.1 9a3 3 0 0 1 5.8 1c0 2-3 3-3 3M12 17h.01"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 16v-5M12 8h.01"/>',
  edit: '<path d="M12 20h9M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z"/>',
  star: '<path d="M12 2l3.1 6.3 6.9 1-5 4.9 1.2 6.9L12 17.8 5.8 21.1 7 14.2l-5-4.9 6.9-1L12 2z"/>'
};
const svg = (k, size = 18) =>
  `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${ICON[k] || ''}</svg>`;

/* ----------------------------- Bildirim & Modal ----------------------------- */
function toast(msg, type = 'ok', ms = 3800) {
  const el = document.createElement('div');
  el.className = 'toast ' + type;
  el.innerHTML = svg(type === 'ok' ? 'check' : type === 'err' ? 'x' : 'warn', 18) + `<div>${esc(msg)}</div>`;
  document.getElementById('toasts').appendChild(el);
  setTimeout(() => { el.style.opacity = '0'; el.style.transform = 'translateX(18px)'; el.style.transition = 'all .2s'; setTimeout(() => el.remove(), 220); }, ms);
}

function modal({ title, body, footer, wide }) {
  const root = document.getElementById('modalRoot');
  root.innerHTML = `
    <div class="modal-back" id="mback">
      <div class="modal ${wide ? 'wide' : ''}" role="dialog" aria-modal="true">
        <div class="modal-head"><h3>${title}</h3><button class="x-btn" id="mclose">${svg('x', 20)}</button></div>
        <div class="modal-body">${body}</div>
        ${footer ? `<div class="modal-foot">${footer}</div>` : ''}
      </div>
    </div>`;
  const close = () => { root.innerHTML = ''; };
  document.getElementById('mclose').onclick = close;
  document.getElementById('mback').onclick = (e) => { if (e.target.id === 'mback') close(); };
  document.addEventListener('keydown', function onEsc(e) { if (e.key === 'Escape') { close(); document.removeEventListener('keydown', onEsc); } });
  return close;
}
const closeModal = () => { document.getElementById('modalRoot').innerHTML = ''; };

function confirmBox(title, text, okLabel = 'Evet, devam et', danger = true) {
  return new Promise((resolve) => {
    const close = modal({
      title: esc(title),
      body: `<p style="margin:0;color:var(--muted)">${esc(text)}</p>`,
      footer: `<button class="btn btn-ghost" id="cno">Vazgeç</button>
               <button class="btn ${danger ? 'btn-danger' : 'btn-primary'}" id="cyes">${esc(okLabel)}</button>`
    });
    document.getElementById('cno').onclick = () => { close(); resolve(false); };
    document.getElementById('cyes').onclick = () => { close(); resolve(true); };
  });
}

/* ==========================================================================
   SİLME — çöp kutusu mantığı
   --------------------------------------------------------------------------
   Hiçbir şey anında yok olmaz. Silmeden önce kullanıcıya tam olarak neyin
   gideceği gösterilir, silindikten sonra da "Geri al" düğmesi çıkar.
   ========================================================================== */

/** Silinen kayıt için "Geri al" düğmeli bildirim. */
function geriAlBildirimi(mesaj, trashId, sonra) {
  const el = document.createElement('div');
  el.className = 'toast undo';
  el.innerHTML = `${svg('trash', 18)}
    <div style="flex:1">
      <div>${esc(mesaj)}</div>
      <div class="toast-sub">Çöp kutusunda 30 gün saklanacak.</div>
    </div>
    <button class="toast-btn">${svg('undo', 15)} Geri al</button>`;
  document.getElementById('toasts').appendChild(el);

  let kapandi = false;
  const kapat = () => {
    if (kapandi) return; kapandi = true;
    el.style.opacity = '0'; el.style.transform = 'translateX(18px)'; el.style.transition = 'all .2s';
    setTimeout(() => el.remove(), 220);
  };
  el.querySelector('.toast-btn').onclick = async () => {
    try {
      const r = await api('/trash/' + trashId + '/restore', { method: 'POST' });
      toast(`${r.tur} geri alındı: ${r.label}`);
      kapat(); sonra && sonra(); copSayisiniTazele();
    } catch (ex) { toast(ex.message, 'err', 7000); }
  };
  setTimeout(kapat, 9000);
}

/**
 * Silme akışı: önce "ne gidecek" gösterilir, onaylanırsa silinir.
 * tur: 'Sefer' gibi görünen ad · yol: '/trips' gibi API yolu
 */
async function silAkisi({ tur, yol, id, sonra }) {
  let onizleme = null;
  try { onizleme = await api(`${yol}/${id}/silme-onizleme`); }
  catch (ex) { toast(ex.message, 'err'); return; }

  const c = onizleme.counts || {};
  const birlikte = [];
  if (yol !== '/trips' && c.trips) birlikte.push(`${c.trips} sefer`);
  if (c.groups) birlikte.push(`${c.groups} kafile`);
  if (yol !== '/tickets' && c.tickets) birlikte.push(`${c.tickets} bilet`);

  const uyari = birlikte.length
    ? `<div class="warn-box">${svg('warn', 18)}
         <div><b>Bunlar da birlikte silinecek:</b><br>${birlikte.join(', ')}</div>
       </div>`
    : '';

  const onay = await new Promise((resolve) => {
    const close = modal({
      title: `${tur} silinsin mi?`,
      body: `
        <div class="del-target">${esc(onizleme.label)}</div>
        ${uyari}
        <div class="info-box">${svg('info', 18)}
          <div>Bu kayıt <b>çöp kutusuna</b> gidecek. Yanlışlıkla sildiyseniz
          30 gün içinde geri alabilirsiniz.</div>
        </div>`,
      footer: `<button class="btn btn-ghost" id="dno">Vazgeç</button>
               <button class="btn btn-danger" id="dyes">${svg('trash', 15)} Evet, sil</button>`
    });
    document.getElementById('dno').onclick = () => { close(); resolve(false); };
    document.getElementById('dyes').onclick = () => { close(); resolve(true); };
  });
  if (!onay) return;

  try {
    const r = await api(`${yol}/${id}`, { method: 'DELETE' });
    geriAlBildirimi(`${tur} silindi: ${r.label}`, r.trash_id, sonra);
    sonra && sonra();
    copSayisiniTazele();
  } catch (ex) { toast(ex.message, 'err', 7000); }
}

/** Listelerde kullanılan küçük sil düğmesi. */
const silBtn = (tur, yol, id, sonraFn = 'refreshCurrent') =>
  `<button class="btn btn-icon btn-danger-soft" title="${esc(tur)} sil"
     onclick="event.stopPropagation();silAkisi({tur:'${esc(tur)}',yol:'${yol}',id:${id},sonra:${sonraFn}})">${svg('trash', 15)}</button>`;

/** Menüdeki çöp kutusu rozetini günceller. */
async function copSayisiniTazele() {
  if (!S.user || S.user.role !== 'admin') return;
  try {
    const r = await api('/trash/count');
    S.copSayisi = r.count;
    document.querySelectorAll('.nav-item[data-page="cop"] .nav-badge').forEach((el) => {
      el.textContent = r.count || '';
      el.style.display = r.count ? '' : 'none';
    });
  } catch { /* önemsiz */ }
}

/* ==========================================================================
   FİRMA KİMLİĞİ
   ========================================================================== */

/** Seçilen resmi tarayıcıda küçültüp veri adresine (data URL) çevirir. */
function kucultResim(file, enBuyukKenar = 320) {
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onerror = reject;
    fr.onload = () => {
      const img = new Image();
      img.onerror = reject;
      img.onload = () => {
        const oran = Math.min(1, enBuyukKenar / Math.max(img.width, img.height));
        const w = Math.max(1, Math.round(img.width * oran));
        const h = Math.max(1, Math.round(img.height * oran));
        const cv = document.createElement('canvas');
        cv.width = w; cv.height = h;
        cv.getContext('2d').drawImage(img, 0, 0, w, h);
        resolve(cv.toDataURL('image/png'));
      };
      img.src = fr.result;
    };
    fr.readAsDataURL(file);
  });
}

/** Firma adı, sloganı ve logosunu arayüze işler. */
function uygulaMarka() {
  const c = S.company || {};
  const ad = document.getElementById('sideBrand');
  if (ad) ad.textContent = c.name || 'REZERVASYON';
  const sl = document.getElementById('sideSlogan');
  if (sl) { sl.textContent = c.slogan || ''; sl.style.display = c.slogan ? '' : 'none'; }
  const kutu = document.getElementById('sideLogo');
  if (kutu) {
    if (c.logo) { kutu.innerHTML = `<img src="${c.logo}" alt="">`; kutu.classList.add('has-img'); }
    else kutu.classList.remove('has-img');
  }
  document.title = (c.name ? c.name + ' — ' : '') + 'Rezervasyon Sistemi';
}

/** Yazdırma çıktılarının üst başlığı (bilet, yolcu listesi). */
function ciktiBasligi(c, altBaslik) {
  return `<div class="head">
    <div class="head-left">
      ${c.logo ? `<img class="head-logo" src="${c.logo}" alt="">` : ''}
      <div><h1>${esc(c.name || '')}</h1>
        ${c.slogan ? `<div class="head-slogan">${esc(c.slogan)}</div>` : ''}
        <h2>${esc(altBaslik)}</h2></div>
    </div>
    <div class="head-right muted">
      ${c.phone ? esc(c.phone) + '<br>' : ''}
      ${c.website ? esc(c.website) + '<br>' : ''}
      ${c.address ? esc(c.address) : ''}
    </div>
  </div>`;
}

const view = () => document.getElementById('view');
const loading = () => { view().innerHTML = '<div class="loading-box"><span class="spinner"></span> Yükleniyor…</div>'; };

/* ----------------------------- Menü ----------------------------- */
const MENU = [
  { g: 'İşlemler', items: [
    { id: 'panel', label: 'Panel', icon: 'panel' },
    { id: 'seferler', label: 'Seferler & Satış', icon: 'bus' },
    { id: 'binis', label: 'Biniş Kontrolü', icon: 'check' },
    { id: 'biletler', label: 'Biletler', icon: 'ticket' },
    { id: 'kafileler', label: 'Kafileler', icon: 'group' }
  ]},
  { g: 'Analiz', items: [
    { id: 'raporlar', label: 'Raporlar', icon: 'chart' }
  ]},
  { g: 'Tanımlar', admin: true, items: [
    { id: 'otobusler', label: 'Otobüsler', icon: 'bus' },
    { id: 'guzergahlar', label: 'Güzergahlar', icon: 'route' },
    { id: 'kullanicilar', label: 'Kullanıcılar', icon: 'users' },
    { id: 'ayarlar', label: 'Ayarlar', icon: 'cog' },
    { id: 'bildirimler', label: 'Gönderim Kayıtları', icon: 'bell' },
    { id: 'kayitlar', label: 'İşlem Kayıtları', icon: 'log' },
    { id: 'cop', label: 'Çöp Kutusu', icon: 'trash', badge: true }
  ]}
];

function renderNav() {
  const nav = document.getElementById('nav');
  const isAdmin = S.user.role === 'admin';
  nav.innerHTML = MENU.filter((g) => !g.admin || isAdmin).map((g) => `
    <div class="nav-title">${g.g}</div>
    ${g.items.map((i) => `<div class="nav-item" data-page="${i.id}">${svg(i.icon)}<span>${i.label}</span>${i.badge ? '<b class="nav-badge" style="display:none"></b>' : ''}</div>`).join('')}
  `).join('');
  nav.querySelectorAll('.nav-item').forEach((el) => {
    el.onclick = () => { location.hash = '#/' + el.dataset.page; closeSidebar(); };
  });
  copSayisiniTazele();
}
const BOTTOM = [
  { id: 'panel', label: 'Panel', icon: 'panel' },
  { id: 'seferler', label: 'Satış', icon: 'bus' },
  { id: 'binis', label: 'Biniş', icon: 'check' },
  { id: 'biletler', label: 'Biletler', icon: 'ticket' },
  { id: '__menu', label: 'Menü', icon: 'list' }
];

function renderBottomNav() {
  const el = document.getElementById('bottomNav');
  el.innerHTML = BOTTOM.map((i) => `<button data-page="${i.id}">${svg(i.icon, 21)}<span>${i.label}</span></button>`).join('');
  el.querySelectorAll('button').forEach((b) => {
    b.onclick = () => {
      if (b.dataset.page === '__menu') {
        document.getElementById('sidebar').classList.add('open');
        document.getElementById('backdrop').classList.add('show');
        return;
      }
      location.hash = '#/' + b.dataset.page;
    };
  });
}

function markNav(page) {
  document.querySelectorAll('.nav-item').forEach((el) => el.classList.toggle('active', el.dataset.page === page));
  const p = page === 'sefer' ? 'seferler' : page === 'kafile' ? 'kafileler' : page;
  document.querySelectorAll('.bottom-nav button').forEach((el) => el.classList.toggle('active', el.dataset.page === p));
}
const closeSidebar = () => {
  document.getElementById('sidebar').classList.remove('open');
  document.getElementById('backdrop').classList.remove('show');
};

/* ==========================================================================
   CANLI BAĞLANTI — diğer terminallerdeki değişiklikleri anında yansıtır
   ========================================================================== */
const LIVE = { es: null, tries: 0, online: 0 };

function liveStatus(state, text) {
  const el = document.getElementById('liveDot');
  if (!el) return;
  el.classList.remove('on', 'off');
  if (state) el.classList.add(state);
  document.getElementById('liveText').textContent = text;
  el.title = state === 'on' ? `Canlı bağlantı açık — ${LIVE.online} terminal bağlı` : 'Canlı bağlantı yok';
}

function liveConnect() {
  if (LIVE.es) { try { LIVE.es.close(); } catch {} }
  const es = new EventSource('/api/stream?token=' + encodeURIComponent(token()));
  LIVE.es = es;

  es.addEventListener('hello', (e) => {
    LIVE.tries = 0;
    LIVE.online = JSON.parse(e.data).online;
    liveStatus('on', 'canlı');
  });
  es.addEventListener('presence', (e) => {
    const d = JSON.parse(e.data);
    LIVE.online = d.count;
    liveStatus('on', d.count > 1 ? d.count + ' terminal' : 'canlı');
  });

  es.addEventListener('seat', (e) => {
    const d = JSON.parse(e.data);
    const h = location.hash;

    if (h.startsWith('#/sefer/') && +h.split('/')[2] === d.trip_id) {
      const etiket = { sell: 'koltuk sattı', cancel: 'bilet iptal etti', move: 'koltuk değiştirdi',
                       update: 'bilet güncelledi', board: 'biniş işaretledi', 'group-cancel': 'kafile iptal etti',
                       'trip-update': 'seferi güncelledi' }[d.action] || 'değişiklik yaptı';
      if (d.action !== 'board') toast(`${d.by} ${etiket}. Koltuk haritası güncellendi.`, 'warn', 4200);
      loadSeatmap(d.trip_id, false).then(() => {
        (d.seats || []).forEach((n) => {
          const el = document.querySelector(`.seat[data-seat="${n}"]`);
          if (el) { el.classList.add('just-changed'); setTimeout(() => el.classList.remove('just-changed'), 1500); }
        });
      }).catch(() => {});
      return;
    }
    if (h.startsWith('#/binis/') && +h.split('/')[2] === d.trip_id) { pageBinis(d.trip_id, true); return; }
    if (h === '#/panel' || h === '' || h === '#/') { /* panel sık değişmez, dokunma */ }
  });

  es.addEventListener('trip', () => {
    if (location.hash.startsWith('#/seferler')) {
      const btn = document.getElementById('fBtn');
      if (btn) btn.click();
    }
  });

  es.onerror = () => {
    liveStatus('off', 'bağlantı yok');
    if (es.readyState === EventSource.CLOSED) {
      LIVE.tries++;
      const bekle = Math.min(30000, 2000 * LIVE.tries);
      setTimeout(() => { if (token()) liveConnect(); }, bekle);
    }
  };
}

/* ==========================================================================
   SAYFA: PANEL
   ========================================================================== */
async function pagePanel() {
  loading();
  const d = await api('/dashboard');
  const doluluk = (t) => Math.round((t.sold / t.capacity) * 100);
  const maxBar = Math.max(1, ...d.last7.map((x) => x.total));

  view().innerHTML = `
    <div class="page-head">
      <div class="t">
        <h3>Merhaba, ${esc(S.user.full_name.split(' ')[0])} 👋</h3>
        <p>${trDate(d.today)} · ${S.user.role === 'admin' ? 'Yönetici görünümü' : esc(S.user.agency_name || 'Acente') + ' — kendi satışlarınız'}</p>
      </div>
      <button class="btn btn-primary" onclick="location.hash='#/seferler'">${svg('plus', 16)} Bilet sat</button>
    </div>

    <div class="stats">
      <div class="stat" style="--tint:rgba(37,99,235,.12);--tone:#2563eb">
        <div class="ico">${svg('bus', 19)}</div>
        <div class="lbl">Bugünkü sefer</div><div class="val">${d.todayTrips}</div>
        <div class="sub">satışa açık</div>
      </div>
      <div class="stat" style="--tint:rgba(14,165,164,.14);--tone:#0f766e">
        <div class="ico">${svg('ticket', 19)}</div>
        <div class="lbl">Bugün satılan</div><div class="val">${d.todaySales.c}</div>
        <div class="sub">bilet</div>
      </div>
      <div class="stat" style="--tint:rgba(5,150,105,.14);--tone:#059669">
        <div class="ico">${svg('money', 19)}</div>
        <div class="lbl">Bugünkü ciro</div><div class="val">${TL0(d.todaySales.total)}</div>
        <div class="sub">tahsil edilen ${TL0(d.todaySales.paid)}</div>
      </div>
      <div class="stat" style="--tint:rgba(124,58,237,.14);--tone:#7c3aed">
        <div class="ico">${svg('chart', 19)}</div>
        <div class="lbl">Bu ay</div><div class="val">${TL0(d.monthSales.total)}</div>
        <div class="sub">${d.monthSales.c} bilet</div>
      </div>
    </div>

    <div class="grid-2" style="gap:16px;align-items:start">
      <div class="card">
        <div class="card-head"><h4>Yaklaşan seferler</h4>
          <button class="btn btn-ghost btn-sm" onclick="location.hash='#/seferler'">Tümü</button></div>
        <div class="table-wrap">
          ${d.upcoming.length ? `<table class="tbl"><thead><tr>
            <th>Tarih / Saat</th><th>Güzergah</th><th>Doluluk</th><th></th></tr></thead><tbody>
            ${d.upcoming.map((t) => `<tr class="row-click" onclick="location.hash='#/sefer/${t.id}'">
              <td><b>${shortDate(t.depart_date)}</b><div style="color:var(--muted);font-size:12px">${t.depart_time}</div></td>
              <td><b>${esc(t.origin)} → ${esc(t.destination)}</b><div style="color:var(--muted);font-size:12px">${esc(t.plate)}</div></td>
              <td style="min-width:120px">
                <div style="display:flex;align-items:center;gap:8px">
                  <div class="progress" style="flex:1"><i style="width:${doluluk(t)}%"></i></div>
                  <span style="font-size:12px;color:var(--muted);white-space:nowrap">${t.sold}/${t.capacity}</span>
                </div>
              </td>
              <td class="num"><span class="badge">${doluluk(t)}%</span></td>
            </tr>`).join('')}
          </tbody></table>` : emptyBox('Yaklaşan sefer yok')}
        </div>
      </div>

      <div class="card card-pad">
        <h4 style="margin-bottom:4px">Son 7 gün satış</h4>
        <p style="color:var(--muted);font-size:12.5px;margin:0 0 6px">Günlük ciro (₺)</p>
        ${d.last7.length ? `<div class="mini-chart">
          ${d.last7.map((x) => `<div class="bar" style="height:${Math.max(4, (x.total / maxBar) * 100)}%" title="${shortDate(x.d)} — ${TL(x.total)} (${x.c} bilet)">
            <span>${x.d.slice(8)}</span></div>`).join('')}
        </div><div style="height:22px"></div>` : emptyBox('Bu dönemde satış yok')}
      </div>
    </div>`;
}

/**
 * Boş ekran kutusu.
 * ek.buton  : { yazi, tikla }  — yönlendiren düğme
 * ek.adimlar: ['...','...']    — ne yapılacağını anlatan numaralı liste
 */
const emptyBox = (t, s = '', ek = {}) => `<div class="empty">
  ${svg('empty', 46)}<b>${esc(t)}</b>
  ${s ? `<div style="font-size:13px">${esc(s)}</div>` : ''}
  ${ek.adimlar && ek.adimlar.length
    ? `<ol class="empty-steps">${ek.adimlar.map((a) => `<li>${a}</li>`).join('')}</ol>` : ''}
  ${ek.buton ? `<div class="empty-action">
      <button class="btn btn-primary" onclick="${ek.buton.tikla}">${svg('plus', 16)} ${esc(ek.buton.yazi)}</button>
    </div>` : ''}
</div>`;

/* ==========================================================================
   EKRANDA YOL GÖSTERME
   --------------------------------------------------------------------------
   Her sayfada "burada ne yapılır" açıklaması. Kullanıcı kapatınca bir daha
   çıkmaz, ama Ayarlar'dan hepsi birden geri açılabilir.
   ========================================================================== */
const IPUCU_ANAHTAR = 'ipucu-kapali';
const kapaliIpuclari = () => { try { return JSON.parse(localStorage.getItem(IPUCU_ANAHTAR) || '[]'); } catch { return []; } };

function ipucuKapat(id) {
  const l = kapaliIpuclari();
  if (!l.includes(id)) l.push(id);
  localStorage.setItem(IPUCU_ANAHTAR, JSON.stringify(l));
  const el = document.getElementById('ipucu-' + id);
  if (el) el.remove();
}
function tumIpuclariniAc() {
  localStorage.removeItem(IPUCU_ANAHTAR);
  toast('Tüm açıklamalar yeniden gösterilecek.');
}

/** Sayfa başına açıklama kutusu üretir. */
function ipucu(id, baslik, metin) {
  if (kapaliIpuclari().includes(id)) return '';
  return `<div class="tip-box" id="ipucu-${id}">
    ${svg('help', 18)}
    <div style="flex:1"><b>${esc(baslik)}</b><br>${metin}</div>
    <button class="tip-close" title="Bu açıklamayı bir daha gösterme" onclick="ipucuKapat('${id}')">${svg('x', 15)}</button>
  </div>`;
}

/** Başlık yanındaki soru işareti — üzerine gelince açıklama gösterir. */
const yardim = (metin) => `<span class="help-dot" title="${esc(metin)}">${svg('help')}</span>`;

/* ---- İlk giriş karşılaması: sistemi hiç görmemiş kişiye yol haritası ---- */
const KARSILAMA_ANAHTAR = 'karsilama-gosterildi';

function karsilamaGoster(zorla) {
  if (!zorla && localStorage.getItem(KARSILAMA_ANAHTAR)) return;
  localStorage.setItem(KARSILAMA_ANAHTAR, '1');
  const yonetici = S.user.role === 'admin';

  const adimlar = yonetici ? [
    ['route',  'Güzergahları girin',  'Hangi şehirler arasında çalışıyorsunuz? Gidiş ve dönüş ayrı ayrı eklenir.', '#/guzergahlar'],
    ['bus',    'Otobüsleri tanıtın',  'Plaka ve kaç sıra koltuk olduğunu yazın; kapasiteyi sistem hesaplar.', '#/otobusler'],
    ['clock',  'Sefer açın',          'Tarih, saat ve fiyat verin. İsterseniz "30 gün tekrarla" deyip bir ayı tek seferde doldurun.', '#/seferler'],
    ['ticket', 'Bilet satmaya başlayın', 'Sefere tıklayın, koltuk haritasından boş koltuk seçin, yolcuyu yazın.', '#/seferler']
  ] : [
    ['bus',    'Sefer seçin',    'Seferler ekranından satış yapacağınız seferi bulun ve tıklayın.', '#/seferler'],
    ['ticket', 'Koltuk seçin',   'Boş koltuklara tıklayın, yolcu adını ve cinsiyetini girin.', '#/seferler'],
    ['send',   'Bileti gönderin','Satıştan sonra yolcuya WhatsApp veya SMS ile bilet gönderebilirsiniz.', '#/biletler'],
    ['check',  'Biniş kontrolü', 'Kalkış anında yolcuları listeden tek tek işaretleyin.', '#/binis']
  ];

  modal({
    wide: true,
    title: `Hoş geldiniz, ${esc(S.user.full_name.split(' ')[0])} 👋`,
    body: `
      <p style="margin:0 0 18px;color:var(--muted)">
        ${yonetici
          ? 'Sistemi ilk kez kullanıyorsunuz. Aşağıdaki dört adımı sırayla yaparsanız bilet satmaya hazır olursunuz.'
          : 'Bilet satışına başlamak için bilmeniz gereken her şey aşağıda.'}
      </p>
      <div class="tour-list">
        ${adimlar.map(([ikon, baslik, aciklama, yol], i) => `
          <div class="tour-step" onclick="closeModal();location.hash='${yol}'">
            <div class="tour-num">${i + 1}</div>
            <div class="tour-ico">${svg(ikon, 20)}</div>
            <div><b>${esc(baslik)}</b><div>${esc(aciklama)}</div></div>
          </div>`).join('')}
      </div>
      ${yonetici ? `<div class="warn-box" style="margin:16px 0 0">${svg('warn', 18)}
        <div><b>Önce şunu yapın:</b> Ayarlar ekranından <b>şifrenizi değiştirin</b> ve
        firma adınızı/logonuzu girin. Sistem internete açık olduğu için bu önemli.</div></div>` : ''}
      <div class="tip-box" style="margin:14px 0 0">${svg('help', 18)}
        <div>Her ekranda böyle gri açıklama kutuları göreceksiniz. Okuyup kapattığınızda bir daha
        çıkmazlar. Hepsini geri açmak isterseniz <b>Ayarlar → Yardım</b> bölümünü kullanın.</div></div>`,
    footer: `<button class="btn btn-primary" onclick="closeModal()">Anladım, başlayalım</button>`
  });
}

/* ==========================================================================
   SAYFA: SEFERLER
   ========================================================================== */
async function pageSeferler() {
  loading();
  const [routes, buses] = await Promise.all([api('/routes'), api('/buses')]);
  S.cache.routes = routes; S.cache.buses = buses;
  const isAdmin = S.user.role === 'admin';

  view().innerHTML = `
    <div class="page-head">
      <div class="t"><h3>Seferler & Koltuk Satışı</h3><p>Sefer seçin, koltuk haritasından satış yapın.</p></div>
      ${isAdmin ? `<button class="btn btn-primary" id="newTrip">${svg('plus', 16)} Yeni sefer</button>` : ''}
    </div>

    ${ipucu('seferler', 'Burada ne yapılır?',
      'Aşağıdaki listeden bir <b>sefere tıklayın</b>, otobüsün koltuk haritası açılır. ' +
      'Boş koltuklara tıklayıp yolcu bilgilerini girerek bilet satarsınız. ' +
      (isAdmin ? 'Yeni sefer açmak için sağ üstteki <b>Yeni sefer</b> düğmesini kullanın.' : ''))}

    <div class="card card-pad" style="margin-bottom:16px">
      <div class="filters" style="margin:0">
        <div class="field"><label>Tarihten</label><input type="date" class="input" id="fFrom" value="${todayISO()}"></div>
        <div class="field"><label>Tarihe</label><input type="date" class="input" id="fTo" value="${addDaysISO(todayISO(), 14)}"></div>
        <div class="field"><label>Güzergah</label>
          <select class="input" id="fRoute"><option value="">Tümü</option>
            ${routes.map((r) => `<option value="${r.id}">${esc(r.origin)} → ${esc(r.destination)}</option>`).join('')}
          </select></div>
        <div class="field" style="flex:1"><label>Ara (plaka / şehir)</label><input class="input" id="fQ" placeholder="örn. Ankara veya 34 ABC"></div>
        <button class="btn btn-primary" id="fBtn">${svg('search', 16)} Listele</button>
      </div>
    </div>

    <div id="tripList"><div class="loading-box"><span class="spinner"></span></div></div>`;

  const load = async () => {
    const box = document.getElementById('tripList');
    box.innerHTML = '<div class="loading-box"><span class="spinner"></span></div>';
    const p = new URLSearchParams();
    const f = document.getElementById('fFrom').value, t = document.getElementById('fTo').value;
    if (f) p.set('from', f); if (t) p.set('to', t);
    const rid = document.getElementById('fRoute').value; if (rid) p.set('route_id', rid);
    const q = document.getElementById('fQ').value.trim(); if (q) p.set('q', q);
    const trips = await api('/trips?' + p.toString());

    if (!trips.length) {
      box.innerHTML = `<div class="card">${emptyBox(
        'Bu tarihlerde sefer yok',
        'Aradığınız sefer görünmüyorsa şunları deneyin:',
        {
          adimlar: [
            'Yukarıdaki <b>tarih aralığını</b> genişletin (örneğin bitiş tarihini ileri alın).',
            'Güzergah seçiliyse <b>Tümü</b> yapın.',
            'Arama kutusunu boşaltın.'
          ],
          buton: isAdmin ? { yazi: 'Yeni sefer oluştur', tikla: "document.getElementById('newTrip').click()" } : null
        })}</div>`;
      return;
    }

    const byDate = {};
    trips.forEach((t) => { (byDate[t.depart_date] = byDate[t.depart_date] || []).push(t); });

    box.innerHTML = Object.keys(byDate).sort().map((date) => `
      <div style="margin-bottom:18px">
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:9px">
          <h4 style="font-size:14.5px">${trDate(date)}</h4>
          <span class="badge">${byDate[date].length} sefer</span>
        </div>
        <div class="card"><div class="table-wrap"><table class="tbl"><thead><tr>
          <th>Saat</th><th>Güzergah</th><th>Otobüs</th><th>Doluluk</th><th class="num">Fiyat</th>
          <th class="num">Ciro</th><th>Durum</th><th></th></tr></thead><tbody>
          ${byDate[date].map((t) => {
            const pct = Math.round((t.sold / t.capacity) * 100);
            return `<tr class="row-click" onclick="location.hash='#/sefer/${t.id}'">
              <td><b style="font-size:15px">${t.depart_time}</b></td>
              <td><b>${esc(t.origin)} → ${esc(t.destination)}</b></td>
              <td>${esc(t.plate)}<div style="color:var(--muted);font-size:12px">${esc(t.bus_name)}</div></td>
              <td style="min-width:130px"><div style="display:flex;align-items:center;gap:8px">
                <div class="progress" style="flex:1"><i style="width:${pct}%"></i></div>
                <span style="font-size:12px;color:var(--muted);white-space:nowrap">${t.sold}/${t.capacity}</span></div></td>
              <td class="num">${TL0(t.price)}</td>
              <td class="num"><b>${TL0(t.revenue)}</b></td>
              <td>${tripBadge(t.status)}</td>
              <td class="num"><div class="row-actions">
                <span class="btn btn-soft btn-sm">Koltuklar →</span>
                ${isAdmin ? `<button class="btn btn-icon" title="Seferi düzenle"
                    onclick="event.stopPropagation();tripModal(${JSON.stringify(t).replace(/"/g, '&quot;')}, refreshCurrent)">${svg('edit', 15)}</button>` : ''}
                ${isAdmin ? silBtn('Sefer', '/trips', t.id) : ''}
              </div></td>
            </tr>`;
          }).join('')}
        </tbody></table></div></div>
      </div>`).join('');
  };

  document.getElementById('fBtn').onclick = load;
  ['fFrom','fTo','fRoute'].forEach(id => document.getElementById(id).onchange = load);
  document.getElementById('fQ').onkeydown = (e) => { if (e.key === 'Enter') load(); };
  if (isAdmin) document.getElementById('newTrip').onclick = () => tripModal(null, load);
  load();
}

const tripBadge = (s) => s === 'acik' ? '<span class="badge badge-green">Açık</span>'
  : s === 'kapali' ? '<span class="badge badge-amber">Kapalı</span>'
  : '<span class="badge badge-red">İptal</span>';

function tripModal(trip, after) {
  const routes = S.cache.routes || [], buses = (S.cache.buses || []).filter((b) => b.active || (trip && b.id === trip.bus_id));
  const close = modal({
    title: trip ? 'Seferi düzenle' : 'Yeni sefer oluştur',
    body: `
      <div class="field"><label>Güzergah *</label><select class="input" id="tRoute">
        ${routes.map((r) => `<option value="${r.id}" ${trip && trip.route_id === r.id ? 'selected' : ''}>${esc(r.origin)} → ${esc(r.destination)}</option>`).join('')}
      </select></div>
      <div class="field"><label>Otobüs *</label><select class="input" id="tBus">
        ${buses.map((b) => `<option value="${b.id}" ${trip && trip.bus_id === b.id ? 'selected' : ''}>${esc(b.plate)} — ${esc(b.name)} (${b.capacity} koltuk)</option>`).join('')}
      </select></div>
      <div class="grid-3">
        <div class="field"><label>Tarih *</label><input type="date" class="input" id="tDate" value="${trip ? trip.depart_date : todayISO()}"></div>
        <div class="field"><label>Saat *</label><input type="time" class="input" id="tTime" value="${trip ? trip.depart_time : '09:00'}"></div>
        <div class="field"><label>Fiyat (₺) *</label><input type="number" min="0" step="10" class="input" id="tPrice" value="${trip ? trip.price : 850}"></div>
      </div>
      ${trip ? `<div class="field"><label>Durum</label><select class="input" id="tStatus">
          <option value="acik" ${trip.status === 'acik' ? 'selected' : ''}>Açık (satış yapılabilir)</option>
          <option value="kapali" ${trip.status === 'kapali' ? 'selected' : ''}>Kapalı (satışa kapalı)</option>
          <option value="iptal" ${trip.status === 'iptal' ? 'selected' : ''}>İptal</option>
        </select></div>`
      : `<div class="field"><label>Kaç gün tekrarlansın?</label>
          <input type="number" min="1" max="60" class="input" id="tRepeat" value="1">
          <div style="font-size:12px;color:var(--muted);margin-top:5px">1 = sadece seçilen gün. Örn. 30 yazarsanız 30 gün boyunca her gün aynı saatte sefer oluşturulur.</div></div>`}
      <div class="field"><label>Not</label><input class="input" id="tNotes" value="${trip ? esc(trip.notes || '') : ''}" placeholder="örn. Gece seferi, ikramlı"></div>`,
    footer: `<button class="btn btn-ghost" onclick="closeModal()">Vazgeç</button>
             <button class="btn btn-primary" id="tSave">${trip ? 'Kaydet' : 'Oluştur'}</button>`
  });

  document.getElementById('tSave').onclick = async (e) => {
    const b = {
      route_id: +document.getElementById('tRoute').value,
      bus_id: +document.getElementById('tBus').value,
      depart_date: document.getElementById('tDate').value,
      depart_time: document.getElementById('tTime').value,
      price: +document.getElementById('tPrice').value,
      notes: document.getElementById('tNotes').value
    };
    if (trip) b.status = document.getElementById('tStatus').value;
    else b.repeat_days = +document.getElementById('tRepeat').value;
    e.target.disabled = true;
    try {
      const r = await api(trip ? '/trips/' + trip.id : '/trips', { method: trip ? 'PUT' : 'POST', body: JSON.stringify(b) });
      toast(trip ? 'Sefer güncellendi.' : `${r.count} sefer oluşturuldu.`);
      close(); after && after();
    } catch (ex) { toast(ex.message, 'err'); e.target.disabled = false; }
  };
}

/* ==========================================================================
   SAYFA: SEFER DETAY — KOLTUK HARİTASI & SATIŞ
   ========================================================================== */
async function pageSefer(id) {
  loading();
  S.selection = new Map();
  S.kafile = { on: false, mode: 'new', name: '', contact_name: '', contact_phone: '', group_id: null };
  await loadSeatmap(id, true);
}

async function loadSeatmap(id, full) {
  const d = await api('/trips/' + id + '/seatmap');
  S.seatmap = d;
  // Artık dolu olan seçili koltukları temizle
  for (const seatNo of [...S.selection.keys()]) {
    const s = d.seats.find((x) => x.seat_no === seatNo);
    if (!s || s.ticket) S.selection.delete(seatNo);
  }
  if (full) renderSeferShell(d); else { renderSeats(); renderSellPanel(); renderSeferStats(); }
}

function renderSeferShell(d) {
  const t = d.trip, isAdmin = S.user.role === 'admin';
  view().innerHTML = `
    <div class="page-head no-print">
      <button class="btn btn-ghost btn-sm" onclick="location.hash='#/seferler'">← Seferler</button>
      <div class="t">
        <h3>${esc(t.origin)} → ${esc(t.destination)}</h3>
        <p>${trDate(t.depart_date)} · ${t.depart_time} · ${esc(t.plate)} (${esc(t.bus_name)}) · Bilet ${TL0(t.price)} ${tripBadge(t.status)}</p>
      </div>
      <button class="btn btn-soft btn-sm" id="manifestBtn">${svg('list', 15)} Yolcu listesi</button>
      ${isAdmin ? `<button class="btn btn-soft btn-sm" id="editTrip">Seferi düzenle</button>` : ''}
    </div>

    <div id="seferStats" class="stats no-print" style="grid-template-columns:repeat(auto-fit,minmax(150px,1fr))"></div>

    <div class="seat-layout">
      <div>
        <div class="bus-shell">
          <div class="bus-body">
            <div class="bus-front">
              <div class="wheel">${svg('cog', 17)}</div>
              <div style="font-size:11px;color:var(--muted);font-weight:700">ŞOFÖR</div>
              <div class="door">KAPI</div>
            </div>
            <div id="seatGrid"></div>
          </div>
          <div class="legend">
            <span class="l-empty"><i></i>Boş</span>
            <span class="l-male"><i></i>Bay</span>
            <span class="l-female"><i></i>Bayan</span>
            <span class="l-res"><i></i>Opsiyon</span>
            <span class="l-sel"><i></i>Seçili</span>
            <span class="l-grp"><i></i>Kafile</span>
          </div>
          <div style="font-size:11.5px;color:var(--faint);margin-top:8px;line-height:1.5">
            Boş koltuğa tıklayarak seçin, dolu koltuğa tıklayarak bilet detayını açın.
          </div>
        </div>
      </div>
      <div class="sell-panel" id="sellPanel"></div>
    </div>`;

  document.getElementById('manifestBtn').onclick = () => printManifest(t.id);
  if (isAdmin) document.getElementById('editTrip').onclick = async () => {
    if (!S.cache.routes) { S.cache.routes = await api('/routes'); S.cache.buses = await api('/buses'); }
    const full = { ...t, route_id: null, bus_id: null };
    const trips = await api('/trips?from=' + t.depart_date + '&to=' + t.depart_date);
    const cur = trips.find((x) => x.id === t.id);
    tripModal({ ...cur }, () => loadSeatmap(t.id, true));
  };

  renderSeats(); renderSellPanel(); renderSeferStats();
}

function renderSeferStats() {
  const d = S.seatmap, st = d.stats, cap = d.trip.capacity;
  const pct = Math.round(((st.sold + st.reserved) / cap) * 100);
  document.getElementById('seferStats').innerHTML = `
    <div class="stat" style="--tint:rgba(37,99,235,.12);--tone:#2563eb"><div class="lbl">Doluluk</div>
      <div class="val">${pct}%</div><div class="sub">${st.sold + st.reserved}/${cap} koltuk</div></div>
    <div class="stat" style="--tint:rgba(5,150,105,.14);--tone:#059669"><div class="lbl">Satılan</div>
      <div class="val">${st.sold}</div><div class="sub">kesin bilet</div></div>
    <div class="stat" style="--tint:rgba(217,119,6,.14);--tone:#d97706"><div class="lbl">Opsiyonlu</div>
      <div class="val">${st.reserved}</div><div class="sub">rezerve</div></div>
    <div class="stat" style="--tint:rgba(100,116,139,.14);--tone:#64748b"><div class="lbl">Boş</div>
      <div class="val">${st.empty}</div><div class="sub">koltuk</div></div>
    <div class="stat" style="--tint:rgba(124,58,237,.14);--tone:#7c3aed"><div class="lbl">Ciro</div>
      <div class="val" style="font-size:20px">${TL0(st.revenue)}</div><div class="sub">tahsil ${TL0(st.collected)}</div></div>`;
}

/** Bir koltuk için izin verilen cinsiyet (null = serbest) */
function forcedGender(seat) {
  if (!seat.requires_gender) return null;
  // Kafile modunda, yandaki yolcu aynı kafiledeyse serbest
  if (S.kafile.on) {
    if (S.kafile.mode === 'exist' && S.kafile.group_id && +S.kafile.group_id === seat.partner_group_id) return null;
    if (S.kafile.mode === 'new' && S.selection.has(seat.partner)) return null;
  }
  // Yan koltuk da bu satışta seçiliyse ve kafile açıksa serbest
  if (S.kafile.on && S.selection.has(seat.partner)) return null;
  return seat.requires_gender;
}

function renderSeats() {
  const d = S.seatmap;
  const seatByNo = new Map(d.seats.map((s) => [s.seat_no, s]));
  const html = d.layout.map((row) => {
    const cells = row.seats.map((n) => {
      if (n === null) return '<div class="aisle">▮</div>';
      const s = seatByNo.get(n);
      if (!s) return '<div></div>';
      return seatHtml(s);
    }).join('');
    return `<div class="seat-row ${row.type === 'back' ? 'back' : ''}">${cells}</div>`;
  }).join('');
  document.getElementById('seatGrid').innerHTML = html;

  document.querySelectorAll('.seat').forEach((el) => {
    el.onclick = () => onSeatClick(+el.dataset.seat);
  });
}

function seatHtml(s) {
  const sel = S.selection.get(s.seat_no);
  let cls = 'seat ', label = '', gicon = '', who = '';
  if (sel) {
    cls += 'selected';
    gicon = sel.gender === 'E' ? 'B' : 'BY';
    who = sel.passenger_name ? esc(sel.passenger_name.split(' ')[0]) : 'Seçili';
  } else if (s.ticket) {
    cls += s.ticket.status === 'rezerve' ? 'reserved' : (s.ticket.gender === 'E' ? 'male' : 'female');
    if (s.ticket.group_id) cls += ' in-group';
    who = esc(s.ticket.passenger_name.split(' ')[0]);
    gicon = s.ticket.gender === 'E' ? 'B' : 'BY';
  } else {
    cls += 'empty-seat';
    const fg = forcedGender(s);
    if (fg) { gicon = fg === 'E' ? 'B?' : 'BY?'; }
  }
  const title = s.ticket
    ? `${s.seat_no} — ${s.ticket.passenger_name} (${s.ticket.gender === 'E' ? 'Bay' : 'Bayan'})${s.ticket.group_name ? ' · ' + s.ticket.group_name : ''}`
    : `${s.seat_no} — Boş (${s.kind})`;
  return `<div class="${cls}" data-seat="${s.seat_no}" title="${esc(title)}">
    <span>${s.seat_no}</span>${who ? `<span class="who">${who}</span>` : ''}
    ${gicon ? `<span class="gicon">${gicon}</span>` : ''}</div>`;
}

function onSeatClick(no) {
  const d = S.seatmap;
  const s = d.seats.find((x) => x.seat_no === no);
  if (!s) return;
  if (s.ticket) { ticketModal(s.ticket.id); return; }
  if (d.trip.status !== 'acik') { toast('Bu sefer satışa kapalı.', 'warn'); return; }

  if (S.selection.has(no)) { S.selection.delete(no); }
  else {
    const fg = forcedGender(s);
    S.selection.set(no, {
      gender: fg || 'E', passenger_name: '', phone: '', tc_no: '',
      price: d.trip.price, payment_status: 'odenmedi'
    });
  }
  renderSeats(); renderSellPanel();
}

/* ----------------------------- Satış paneli ----------------------------- */
function renderSellPanel() {
  const d = S.seatmap;
  const sel = [...S.selection.entries()].sort((a, b) => a[0] - b[0]);
  const panel = document.getElementById('sellPanel');
  if (!panel) return;

  if (!sel.length) {
    panel.innerHTML = `<div class="card card-pad">
      <h4 style="margin-bottom:6px">Bilet satışı</h4>
      <p style="color:var(--muted);font-size:13px;margin:0 0 14px">Soldaki koltuk haritasından boş koltuk seçin. Birden fazla koltuk seçerek kafile satışı yapabilirsiniz.</p>
      ${d.groups.length ? `<h4 style="font-size:13.5px;margin:16px 0 8px">Bu seferdeki kafileler</h4>
        <div style="display:flex;flex-direction:column;gap:8px">
          ${d.groups.map((g) => `<div style="display:flex;align-items:center;gap:10px;padding:10px;border:1px solid var(--border);border-radius:10px;background:var(--surface-2)">
            <span class="badge badge-violet">${g.seat_count} koltuk</span>
            <div style="flex:1;min-width:0"><b style="font-size:13px">${esc(g.name)}</b>
              <div style="font-size:11.5px;color:var(--muted)">${esc(g.contact_name || '')} ${esc(g.contact_phone || '')}</div></div>
            <button class="btn btn-ghost btn-sm" onclick="location.hash='#/kafile/${g.id}'">Detay</button>
          </div>`).join('')}
        </div>` : ''}
    </div>`;
    return;
  }

  const total = sel.reduce((s, [, v]) => s + (Number(v.price) || 0), 0);
  panel.innerHTML = `
    <div class="card">
      <div class="card-head">
        <h4>Seçili koltuklar <span class="badge badge-green">${sel.length}</span></h4>
        <button class="btn btn-ghost btn-sm" id="clearSel">Temizle</button>
      </div>
      <div class="card-pad">

        <label style="display:flex;align-items:center;gap:10px;padding:11px 13px;border:1.5px solid ${S.kafile.on ? 'var(--group)' : 'var(--border)'};
               border-radius:10px;cursor:pointer;background:${S.kafile.on ? 'var(--group-bg)' : 'var(--surface-2)'};margin-bottom:14px">
          <input type="checkbox" id="kafileChk" ${S.kafile.on ? 'checked' : ''} style="width:17px;height:17px;accent-color:#7c3aed">
          <div style="flex:1">
            <b style="font-size:13.5px">Kafile / grup satışı</b>
            <div style="font-size:11.5px;color:var(--muted)">Aynı grup içinde bay–bayan yan yana oturabilir.</div>
          </div>
        </label>

        ${S.kafile.on ? kafileFormHtml(d) : ''}

        <div class="sel-list">
          ${sel.map(([no, v]) => selRowHtml(no, v)).join('')}
        </div>

        <div class="total-box">
          <div><div class="lbl">Toplam</div><div style="font-size:11.5px;color:#9fb6dc">${sel.length} bilet</div></div>
          <div class="amt">${TL(total)}</div>
        </div>

        <div class="grid-2" style="gap:10px">
          <div class="field" style="margin:0"><label>Bilet durumu</label>
            <select class="input" id="sellStatus">
              <option value="satildi">Satıldı (kesin)</option>
              <option value="rezerve">Opsiyon / Rezerve</option>
            </select></div>
          <div class="field" style="margin:0"><label>Tahsilat</label>
            <select class="input" id="sellPay">
              <option value="odenmedi">Ödenmedi</option>
              <option value="odendi">Ödendi (tamamı)</option>
            </select></div>
        </div>

        <button class="btn btn-primary btn-block" id="sellBtn" style="margin-top:14px;padding:12px">
          ${svg('ticket', 17)} ${sel.length} bileti kes
        </button>
        <div id="sellWarn" style="margin-top:10px"></div>
      </div>
    </div>`;

  bindSellPanel();
}

function kafileFormHtml(d) {
  return `
    <div style="border:1px solid var(--border);border-radius:10px;padding:13px;margin-bottom:14px;background:var(--surface-2)">
      <div class="pill-tabs" style="margin-bottom:12px">
        <button data-kmode="new" class="${S.kafile.mode === 'new' ? 'active' : ''}">Yeni kafile</button>
        <button data-kmode="exist" class="${S.kafile.mode === 'exist' ? 'active' : ''}" ${d.groups.length ? '' : 'disabled'}>Mevcut kafileye ekle</button>
      </div>
      ${S.kafile.mode === 'new' ? `
        <div class="field" style="margin-bottom:10px"><label>Kafile adı *</label>
          <input class="input" id="kName" value="${esc(S.kafile.name)}" placeholder="örn. Yılmaz Ailesi / Bursa Umre Grubu"></div>
        <div class="grid-2">
          <div class="field" style="margin:0"><label>Yetkili kişi</label>
            <input class="input" id="kContact" value="${esc(S.kafile.contact_name)}" placeholder="Ad Soyad"></div>
          <div class="field" style="margin:0"><label>Telefon</label>
            <input class="input" id="kPhone" value="${esc(S.kafile.contact_phone)}" placeholder="05xx xxx xx xx"></div>
        </div>`
      : `<div class="field" style="margin:0"><label>Kafile seçin</label>
          <select class="input" id="kGroup">
            <option value="">— seçiniz —</option>
            ${d.groups.map((g) => `<option value="${g.id}" ${+S.kafile.group_id === g.id ? 'selected' : ''}>${esc(g.name)} (${g.seat_count} koltuk)</option>`).join('')}
          </select></div>`}
    </div>`;
}

function selRowHtml(no, v) {
  const seat = S.seatmap.seats.find((s) => s.seat_no === no);
  const fg = forcedGender(seat);
  return `
    <div class="sel-row" data-row="${no}">
      <div class="sr-head">
        <div class="seat-tag">${no}</div>
        <div class="gender-toggle">
          <button data-g="E" data-seat="${no}" class="${v.gender === 'E' ? 'on-m' : ''}" ${fg === 'K' ? 'disabled' : ''}>Bay</button>
          <button data-g="K" data-seat="${no}" class="${v.gender === 'K' ? 'on-f' : ''}" ${fg === 'E' ? 'disabled' : ''}>Bayan</button>
        </div>
        <div style="flex:1"></div>
        <button class="x-btn" data-del="${no}" title="Kaldır">${svg('x', 16)}</button>
      </div>
      ${fg ? `<div style="font-size:11.5px;color:var(--hold);margin-bottom:8px;display:flex;gap:5px;align-items:flex-start">
        ${svg('warn', 13)}<span>Yan koltukta ${fg === 'E' ? 'bay' : 'bayan'} yolcu var, cinsiyet kilitli. Aile/kafile ise üstteki kutuyu işaretleyin.</span></div>` : ''}
      <div class="field" style="margin-bottom:8px">
        <input class="input" data-f="passenger_name" data-seat="${no}" value="${esc(v.passenger_name)}" placeholder="Yolcu adı soyadı *">
      </div>
      <div class="grid-2" style="gap:8px">
        <input class="input" data-f="phone" data-seat="${no}" value="${esc(v.phone)}" placeholder="Telefon">
        <input class="input" data-f="tc_no" data-seat="${no}" value="${esc(v.tc_no)}" placeholder="T.C. Kimlik No" inputmode="numeric" maxlength="11">
      </div>
      <div style="display:flex;align-items:center;gap:8px;margin-top:8px">
        <span style="font-size:12px;color:var(--muted);white-space:nowrap">Ücret</span>
        <input class="input" type="number" min="0" step="10" data-f="price" data-seat="${no}" value="${v.price}" style="max-width:130px">
      </div>
    </div>`;
}

function bindSellPanel() {
  const rerender = () => { renderSeats(); renderSellPanel(); };

  document.getElementById('clearSel').onclick = () => { S.selection.clear(); rerender(); };

  document.getElementById('kafileChk').onchange = (e) => {
    S.kafile.on = e.target.checked;
    if (S.kafile.on && !S.seatmap.groups.length) S.kafile.mode = 'new';
    rerender();
  };
  document.querySelectorAll('[data-kmode]').forEach((b) => {
    b.onclick = () => { if (b.disabled) return; S.kafile.mode = b.dataset.kmode; rerender(); };
  });
  const kn = document.getElementById('kName'); if (kn) kn.oninput = (e) => S.kafile.name = e.target.value;
  const kc = document.getElementById('kContact'); if (kc) kc.oninput = (e) => S.kafile.contact_name = e.target.value;
  const kp = document.getElementById('kPhone'); if (kp) kp.oninput = (e) => S.kafile.contact_phone = e.target.value;
  const kg = document.getElementById('kGroup'); if (kg) kg.onchange = (e) => { S.kafile.group_id = e.target.value; rerender(); };

  document.querySelectorAll('[data-g]').forEach((b) => {
    b.onclick = () => {
      if (b.disabled) return;
      const no = +b.dataset.seat;
      S.selection.get(no).gender = b.dataset.g;
      rerender();
    };
  });
  document.querySelectorAll('[data-del]').forEach((b) => {
    b.onclick = () => { S.selection.delete(+b.dataset.del); rerender(); };
  });
  document.querySelectorAll('[data-f]').forEach((inp) => {
    inp.oninput = (e) => {
      const no = +e.target.dataset.seat, f = e.target.dataset.f;
      const v = S.selection.get(no); if (!v) return;
      v[f] = f === 'tc_no' ? e.target.value.replace(/\D/g, '') : e.target.value;
      if (f === 'tc_no') e.target.value = v[f];
      if (f === 'passenger_name') {
        const el = document.querySelector(`.seat[data-seat="${no}"] .who`);
        const seatEl = document.querySelector(`.seat[data-seat="${no}"]`);
        if (seatEl) {
          const first = (v.passenger_name || 'Seçili').split(' ')[0];
          if (el) el.textContent = first;
        }
      }
      if (f === 'price') updateTotal();
    };
  });

  document.getElementById('sellBtn').onclick = doSell;
  updateTotal();
}

function updateTotal() {
  const total = [...S.selection.values()].reduce((s, v) => s + (Number(v.price) || 0), 0);
  const el = document.querySelector('.total-box .amt');
  if (el) el.textContent = TL(total);
}

async function doSell(e) {
  const sel = [...S.selection.entries()].sort((a, b) => a[0] - b[0]);
  const warn = document.getElementById('sellWarn');
  warn.innerHTML = '';

  for (const [no, v] of sel) {
    if (!v.passenger_name.trim()) { warn.innerHTML = `<div class="badge badge-red">${no} numaralı koltuk için yolcu adı girin.</div>`; return; }
    if (v.tc_no && v.tc_no.length !== 11) { warn.innerHTML = `<div class="badge badge-red">${no} numaralı koltukta T.C. no 11 haneli olmalı.</div>`; return; }
  }
  if (S.kafile.on && S.kafile.mode === 'new' && !S.kafile.name.trim()) {
    warn.innerHTML = '<div class="badge badge-red">Kafile adı girin.</div>'; return;
  }
  if (S.kafile.on && S.kafile.mode === 'exist' && !S.kafile.group_id) {
    warn.innerHTML = '<div class="badge badge-red">Mevcut kafilelerden birini seçin.</div>'; return;
  }

  const payAll = document.getElementById('sellPay').value;
  const body = {
    status: document.getElementById('sellStatus').value,
    passengers: sel.map(([no, v]) => ({
      seat_no: no, passenger_name: v.passenger_name.trim(), gender: v.gender,
      phone: v.phone || null, tc_no: v.tc_no || null, price: Number(v.price) || 0,
      payment_status: payAll
    }))
  };
  if (S.kafile.on) {
    if (S.kafile.mode === 'new') body.group = { name: S.kafile.name.trim(), contact_name: S.kafile.contact_name, contact_phone: S.kafile.contact_phone };
    else body.group_id = +S.kafile.group_id;
  }

  e.target.disabled = true;
  e.target.innerHTML = '<span class="spinner" style="border-top-color:#fff"></span> Kesiliyor…';
  try {
    const r = await api('/trips/' + S.seatmap.trip.id + '/sell', { method: 'POST', body: JSON.stringify(body) });
    toast(`${r.tickets.length} bilet başarıyla kesildi.`);
    const ids = r.tickets.map((t) => t.id);
    S.selection.clear();
    S.kafile = { on: false, mode: 'new', name: '', contact_name: '', contact_phone: '', group_id: null };
    await loadSeatmap(S.seatmap.trip.id, false);
    printTickets(ids, true);
  } catch (ex) {
    toast(ex.message, 'err', 6000);
    warn.innerHTML = `<div class="badge badge-red" style="white-space:normal;text-align:left">${esc(ex.message)}</div>`;
    e.target.disabled = false;
    e.target.innerHTML = svg('ticket', 17) + ` ${sel.length} bileti kes`;
    await loadSeatmap(S.seatmap.trip.id, false);
  }
}

/* ----------------------------- Bilet detay modalı ----------------------------- */
async function ticketModal(id) {
  const t = await api('/tickets/' + id);
  const canEdit = S.user.role === 'admin' || t.sold_by === S.user.id;
  const close = modal({
    title: `Bilet — ${esc(t.pnr)}`,
    body: `
      <div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:16px">
        <span class="badge ${t.gender === 'E' ? 'badge-blue' : 'badge-pink'}">${t.seat_no} · ${t.gender === 'E' ? 'Bay' : 'Bayan'}</span>
        <span class="badge ${t.status === 'satildi' ? 'badge-green' : t.status === 'rezerve' ? 'badge-amber' : 'badge-red'}">
          ${t.status === 'satildi' ? 'Satıldı' : t.status === 'rezerve' ? 'Opsiyon' : 'İptal'}</span>
        <span class="badge ${t.payment_status === 'odendi' ? 'badge-green' : t.payment_status === 'kismi' ? 'badge-amber' : 'badge-red'}">
          ${t.payment_status === 'odendi' ? 'Ödendi' : t.payment_status === 'kismi' ? 'Kısmi ödeme' : 'Ödenmedi'}</span>
        ${t.group_name ? `<span class="badge badge-violet">${esc(t.group_name)}</span>` : ''}
        ${t.boarded ? '<span class="badge badge-green">Bindi</span>' : ''}
      </div>

      <div style="background:var(--surface-2);border:1px solid var(--border);border-radius:12px;padding:14px;margin-bottom:16px;font-size:13.5px">
        <b style="font-size:15px">${esc(t.origin)} → ${esc(t.destination)}</b><br>
        <span style="color:var(--muted)">${trDate(t.depart_date)} · ${t.depart_time} · ${esc(t.plate)}</span><br>
        <span style="color:var(--muted)">Satan: ${esc(t.sold_by_name || '-')}${t.agency_name ? ' (' + esc(t.agency_name) + ')' : ''} · ${esc(t.created_at)}</span>
      </div>

      ${t.status === 'iptal' ? '<div class="badge badge-red">Bu bilet iptal edilmiştir.</div>' : `
      <div class="field"><label>Yolcu adı soyadı</label>
        <input class="input" id="edName" value="${esc(t.passenger_name)}" ${canEdit ? '' : 'disabled'}></div>
      <div class="grid-2">
        <div class="field"><label>Telefon</label><input class="input" id="edPhone" value="${esc(t.phone || '')}" ${canEdit ? '' : 'disabled'}></div>
        <div class="field"><label>T.C. Kimlik No</label><input class="input" id="edTc" value="${esc(t.tc_no || '')}" ${canEdit ? '' : 'disabled'}></div>
      </div>
      <div class="grid-3">
        <div class="field"><label>Ücret (₺)</label><input type="number" class="input" id="edPrice" value="${t.price}" ${canEdit ? '' : 'disabled'}></div>
        <div class="field"><label>Tahsilat</label><select class="input" id="edPay" ${canEdit ? '' : 'disabled'}>
          <option value="odenmedi" ${t.payment_status === 'odenmedi' ? 'selected' : ''}>Ödenmedi</option>
          <option value="kismi" ${t.payment_status === 'kismi' ? 'selected' : ''}>Kısmi</option>
          <option value="odendi" ${t.payment_status === 'odendi' ? 'selected' : ''}>Ödendi</option>
        </select></div>
        <div class="field"><label>Durum</label><select class="input" id="edStatus" ${canEdit ? '' : 'disabled'}>
          <option value="satildi" ${t.status === 'satildi' ? 'selected' : ''}>Satıldı</option>
          <option value="rezerve" ${t.status === 'rezerve' ? 'selected' : ''}>Opsiyon</option>
        </select></div>
      </div>
      <div class="field"><label>Alınan tutar (₺)</label><input type="number" class="input" id="edPaid" value="${t.paid_amount}" ${canEdit ? '' : 'disabled'}></div>
      <div class="field"><label>Not</label><input class="input" id="edNote" value="${esc(t.note || '')}" ${canEdit ? '' : 'disabled'}></div>
      `}`,
    footer: t.status === 'iptal' ? `<button class="btn btn-ghost" onclick="closeModal()">Kapat</button>` : `
      <button class="btn btn-soft" id="btnMsg">${svg('send', 15)} Bilet gönder</button>
      <button class="btn btn-soft" id="btnPrint">${svg('print', 15)} Yazdır</button>
      ${canEdit ? `<button class="btn btn-soft" id="btnMove">Koltuk değiştir</button>` : ''}
      ${canEdit ? `<button class="btn btn-danger" id="btnCancel">Bileti iptal et</button>` : ''}
      ${canEdit ? `<button class="btn btn-primary" id="btnSave">Kaydet</button>` : ''}`,
    wide: false
  });

  if (t.status === 'iptal') return;
  document.getElementById('btnPrint').onclick = () => printTickets([t.id]);
  document.getElementById('btnMsg').onclick = () => { close(); messageModal(t.id); };
  if (!canEdit) return;

  document.getElementById('btnSave').onclick = async (e) => {
    e.target.disabled = true;
    try {
      await api('/tickets/' + t.id, { method: 'PUT', body: JSON.stringify({
        passenger_name: document.getElementById('edName').value,
        phone: document.getElementById('edPhone').value,
        tc_no: document.getElementById('edTc').value,
        price: +document.getElementById('edPrice').value,
        payment_status: document.getElementById('edPay').value,
        paid_amount: +document.getElementById('edPaid').value,
        status: document.getElementById('edStatus').value,
        note: document.getElementById('edNote').value
      })});
      toast('Bilet güncellendi.'); close(); refreshCurrent();
    } catch (ex) { toast(ex.message, 'err'); e.target.disabled = false; }
  };

  document.getElementById('btnCancel').onclick = async () => {
    close();
    if (!await confirmBox('Bileti iptal et', `${t.seat_no} numaralı koltuktaki ${t.passenger_name} adlı yolcunun bileti iptal edilecek. Koltuk boşa çıkacak.`, 'Evet, iptal et')) return;
    try { await api('/tickets/' + t.id + '/cancel', { method: 'POST', body: '{}' }); toast('Bilet iptal edildi.'); refreshCurrent(); }
    catch (ex) { toast(ex.message, 'err'); }
  };

  document.getElementById('btnMove').onclick = async () => {
    const empties = S.seatmap ? S.seatmap.seats.filter((s) => !s.ticket).map((s) => s.seat_no) : [];
    close();
    const c2 = modal({
      title: 'Koltuk değiştir',
      body: `<div class="field"><label>Yeni koltuk numarası</label>
        <select class="input" id="mvSeat">${empties.map((n) => `<option value="${n}">${n}</option>`).join('')}</select>
        ${empties.length ? '' : '<div class="badge badge-red" style="margin-top:8px">Boş koltuk yok.</div>'}</div>`,
      footer: `<button class="btn btn-ghost" onclick="closeModal()">Vazgeç</button>
               <button class="btn btn-primary" id="mvOk" ${empties.length ? '' : 'disabled'}>Taşı</button>`
    });
    document.getElementById('mvOk').onclick = async () => {
      try {
        await api('/tickets/' + t.id + '/move', { method: 'POST', body: JSON.stringify({ seat_no: +document.getElementById('mvSeat').value }) });
        toast('Koltuk değiştirildi.'); c2(); refreshCurrent();
      } catch (ex) { toast(ex.message, 'err'); }
    };
  };
}

/* ----------------------------- Bilet gönderme modalı ----------------------------- */
async function messageModal(ticketId) {
  let d;
  try { d = await api('/tickets/' + ticketId + '/message'); }
  catch (ex) { return toast(ex.message, 'err'); }

  const gecmis = d.history.length ? `
    <div style="margin-top:16px;border-top:1px solid var(--border);padding-top:12px">
      <div style="font-size:12px;color:var(--muted);font-weight:700;margin-bottom:6px">GEÇMİŞ GÖNDERİMLER</div>
      ${d.history.map((h) => `<div style="display:flex;gap:8px;align-items:center;font-size:12.5px;margin-bottom:4px">
        <span class="badge ${h.status === 'gonderildi' ? 'badge-green' : 'badge-red'}">${h.status === 'gonderildi' ? 'Gönderildi' : 'Hata'}</span>
        <span style="color:var(--muted)">${esc(h.created_at)}</span>
        ${h.error ? `<span style="color:var(--danger);font-size:11.5px">${esc(h.error.slice(0, 70))}</span>` : ''}
      </div>`).join('')}
    </div>` : '';

  const close = modal({
    title: 'Bileti yolcuya gönder',
    body: `
      <div class="field"><label>Cep telefonu</label>
        <input class="input" id="msgPhone" value="${esc(d.phone || '')}" placeholder="0555 111 22 33" inputmode="tel">
      </div>

      <div class="field"><label>Mesaj</label>
        <textarea class="input" id="msgText" rows="4">${esc(d.sms_text)}</textarea>
        <div style="font-size:11.5px;color:var(--muted);margin-top:5px" id="msgSay">
          ${d.sms_length} karakter · ${d.sms_parts} SMS
        </div>
      </div>

      <div style="display:grid;gap:9px;margin-top:6px">
        <button class="btn btn-accent btn-block" id="btnWa" ${d.whatsapp_enabled ? '' : 'disabled'} style="padding:12px">
          WhatsApp'tan gönder <span style="opacity:.8;font-weight:500">— ücretsiz</span>
        </button>
        <button class="btn btn-primary btn-block" id="btnSms" ${d.sms_enabled ? '' : 'disabled'} style="padding:12px">
          SMS gönder ${d.sms_enabled ? '' : '<span style="opacity:.8;font-weight:500">— servis tanımlı değil</span>'}
        </button>
      </div>
      ${!d.sms_enabled ? `<div style="font-size:12px;color:var(--muted);margin-top:10px">
        Otomatik SMS için Ayarlar → Bildirimler bölümünden bir SMS servisi tanımlayın.
        WhatsApp seçeneği abonelik gerektirmez, hemen kullanabilirsiniz.</div>` : ''}
      ${gecmis}`,
    footer: `<button class="btn btn-ghost" onclick="closeModal()">Kapat</button>`
  });

  const txt = document.getElementById('msgText');
  const tel = document.getElementById('msgPhone');
  txt.oninput = () => {
    const n = txt.value.length;
    document.getElementById('msgSay').textContent = `${n} karakter · ${Math.max(1, Math.ceil(n / 160))} SMS`;
  };

  // Numara yazıldıkça uyarıyı güncelle (telefonsuz bilette de gönderilebilsin)
  const uyari = document.createElement('div');
  uyari.style.cssText = 'font-size:12px;color:var(--hold);margin-top:5px';
  tel.parentElement.appendChild(uyari);
  const telKontrol = () => {
    const gecerli = !!waLink(tel.value, 'x');
    uyari.textContent = tel.value.trim() && !gecerli
      ? 'Cep telefonu 05XX ile başlamalı ve 11 haneli olmalı.'
      : (!tel.value.trim() ? 'Göndermek için numara girin.' : '');
  };
  tel.oninput = telKontrol;
  telKontrol();

  document.getElementById('btnWa').onclick = () => {
    const tel = document.getElementById('msgPhone').value;
    const link = waLink(tel, txt.value);
    if (!link) return toast('Geçerli bir cep telefonu numarası girin.', 'err');
    window.open(link, '_blank');
    close();
  };

  document.getElementById('btnSms').onclick = async (e) => {
    e.target.disabled = true;
    e.target.innerHTML = '<span class="spinner" style="border-top-color:#fff"></span> Gönderiliyor…';
    try {
      await api('/tickets/' + ticketId + '/sms', { method: 'POST', body: JSON.stringify({
        phone: document.getElementById('msgPhone').value, text: txt.value }) });
      toast('SMS gönderildi.'); close();
    } catch (ex) {
      toast(ex.message, 'err', 7000);
      e.target.disabled = false; e.target.textContent = 'SMS gönder';
    }
  };
}

/** Sunucuya gitmeden WhatsApp bağlantısı üretir */
function waLink(phone, text) {
  let n = String(phone || '').replace(/\D/g, '');
  if (n.startsWith('0090')) n = n.slice(4);
  else if (n.startsWith('90') && n.length === 12) n = n.slice(2);
  else if (n.startsWith('0') && n.length === 11) n = n.slice(1);
  if (n.length !== 10 || n[0] !== '5') return null;
  return `https://wa.me/90${n}?text=${encodeURIComponent(text)}`;
}

function refreshCurrent() {
  const h = location.hash;
  if (h.startsWith('#/sefer/')) loadSeatmap(+h.split('/')[2], false);
  else if (h.startsWith('#/binis/')) pageBinis(+h.split('/')[2]);
  else router();
}

/* ==========================================================================
   SAYFA: BİLETLER
   ========================================================================== */
async function pageBiletler() {
  loading();
  view().innerHTML = `
    <div class="page-head"><div class="t"><h3>Biletler</h3>
      <p>${S.user.role === 'admin' ? 'Tüm satışlar' : 'Kendi satışlarınız'} — PNR, ad, telefon veya T.C. ile arayın.</p></div></div>

    ${ipucu('biletler', 'Bilet üzerinde ne yapabilirsiniz?',
      'Listeden bir <b>bilete tıklayın</b>; yolcu bilgilerini düzeltebilir, tahsilat durumunu ' +
      'değiştirebilir, bileti iptal edebilir veya yolcuya WhatsApp/SMS ile gönderebilirsiniz. ' +
      'Yazıcı simgesi bileti çıktı almak içindir.')}
    <div class="card card-pad" style="margin-bottom:16px">
      <div class="filters" style="margin:0">
        <div class="field" style="flex:1;min-width:200px"><label>Ara</label>
          <input class="input" id="bQ" placeholder="PNR, yolcu adı, telefon…"></div>
        <div class="field"><label>Kalkış (başlangıç)</label><input type="date" class="input" id="bFrom"></div>
        <div class="field"><label>Kalkış (bitiş)</label><input type="date" class="input" id="bTo"></div>
        <div class="field"><label>Durum</label><select class="input" id="bStatus">
          <option value="">Tümü</option><option value="satildi">Satıldı</option>
          <option value="rezerve">Opsiyon</option><option value="iptal">İptal</option></select></div>
        <button class="btn btn-primary" id="bBtn">${svg('search', 16)} Ara</button>
      </div>
    </div>
    <div id="bList"><div class="loading-box"><span class="spinner"></span></div></div>`;

  const load = async () => {
    const p = new URLSearchParams();
    ['bQ:q', 'bFrom:from', 'bTo:to', 'bStatus:status'].forEach((pair) => {
      const [el, key] = pair.split(':');
      const v = document.getElementById(el).value.trim();
      if (v) p.set(key, v);
    });
    const box = document.getElementById('bList');
    box.innerHTML = '<div class="loading-box"><span class="spinner"></span></div>';
    const list = await api('/tickets?' + p.toString());
    if (!list.length) { box.innerHTML = `<div class="card">${emptyBox('Bilet bulunamadı')}</div>`; return; }
    box.innerHTML = `<div class="card"><div class="table-wrap"><table class="tbl"><thead><tr>
      <th>PNR</th><th>Yolcu</th><th>Sefer</th><th>Koltuk</th><th class="num">Ücret</th>
      <th>Tahsilat</th><th>Durum</th><th>Satan</th><th></th></tr></thead><tbody>
      ${list.map((t) => `<tr class="row-click" onclick="ticketModal(${t.id})">
        <td><code style="font-weight:700">${esc(t.pnr)}</code></td>
        <td><b>${esc(t.passenger_name)}</b>
          <div style="font-size:11.5px;color:var(--muted)">${t.gender === 'E' ? 'Bay' : 'Bayan'}${t.group_name ? ' · ' + esc(t.group_name) : ''}</div></td>
        <td>${esc(t.origin)} → ${esc(t.destination)}
          <div style="font-size:11.5px;color:var(--muted)">${shortDate(t.depart_date)} ${t.depart_time}</div></td>
        <td><span class="badge ${t.gender === 'E' ? 'badge-blue' : 'badge-pink'}">${t.seat_no}</span></td>
        <td class="num">${TL0(t.price)}</td>
        <td><span class="badge ${t.payment_status === 'odendi' ? 'badge-green' : t.payment_status === 'kismi' ? 'badge-amber' : 'badge-red'}">
          ${t.payment_status === 'odendi' ? 'Ödendi' : t.payment_status === 'kismi' ? 'Kısmi' : 'Ödenmedi'}</span></td>
        <td>${t.status === 'satildi' ? '<span class="badge badge-green">Satıldı</span>' : t.status === 'rezerve' ? '<span class="badge badge-amber">Opsiyon</span>' : '<span class="badge badge-red">İptal</span>'}</td>
        <td style="font-size:12px;color:var(--muted)">${esc(t.sold_by_name || '-')}</td>
        <td class="num"><div class="row-actions">
          <button class="btn btn-icon" title="Bileti yazdır" onclick="event.stopPropagation();printTickets([${t.id}])">${svg('print', 15)}</button>
          ${S.user.role === 'admin' ? silBtn('Bilet', '/tickets', t.id) : ''}
        </div></td>
      </tr>`).join('')}
    </tbody></table></div></div>`;
  };
  document.getElementById('bBtn').onclick = load;
  document.getElementById('bQ').onkeydown = (e) => { if (e.key === 'Enter') load(); };
  ['bFrom','bTo','bStatus'].forEach(id => document.getElementById(id).onchange = load);
  load();
}

/* ==========================================================================
   SAYFA: BİNİŞ KONTROLÜ (şoför / peron görevlisi — telefon için)
   ========================================================================== */
async function pageBinisListe() {
  loading();
  const today = todayISO();
  const trips = await api('/trips?from=' + today + '&to=' + addDaysISO(today, 2) + '&status=acik');
  view().innerHTML = `
    <div class="page-head"><div class="t"><h3>Biniş Kontrolü</h3>
      <p>Sefer seçin, yolcuya dokunarak bindi işaretleyin. Telefonda kullanmak için tasarlandı.</p></div></div>
    ${trips.length ? `<div class="card"><div class="table-wrap"><table class="tbl"><thead><tr>
      <th>Kalkış</th><th>Güzergah</th><th>Otobüs</th><th class="num">Yolcu</th><th></th></tr></thead><tbody>
      ${trips.map((t) => `<tr class="row-click" onclick="location.hash='#/binis/${t.id}'">
        <td><b>${shortDate(t.depart_date)}</b><div style="color:var(--muted);font-size:12px">${t.depart_time}</div></td>
        <td><b>${esc(t.origin)} → ${esc(t.destination)}</b></td>
        <td>${esc(t.plate)}</td>
        <td class="num"><span class="badge badge-blue">${t.sold}</span></td>
        <td class="num"><span class="btn btn-soft btn-sm">Aç →</span></td></tr>`).join('')}
    </tbody></table></div></div>` : `<div class="card">${emptyBox('Yaklaşan sefer yok', 'Bugün ve sonraki 2 gün için açık sefer bulunamadı.')}</div>`}`;
}

async function pageBinis(tripId, sessiz) {
  if (!sessiz) loading();
  const d = await api('/trips/' + tripId + '/manifest');
  const t = d.trip;
  const bindi = d.passengers.filter((p) => p.boarded).length;
  const kalan = d.passengers.length - bindi;
  const q = (document.getElementById('binisQ') || {}).value || '';

  view().innerHTML = `
    <div class="page-head no-print">
      <button class="btn btn-ghost btn-sm" onclick="location.hash='#/binis'">← Seferler</button>
      <div class="t"><h3>${esc(t.origin)} → ${esc(t.destination)}</h3>
        <p>${trDate(t.depart_date)} · ${t.depart_time} · ${esc(t.plate)}</p></div>
      <button class="btn btn-soft btn-sm" onclick="printManifest(${t.id})">${svg('print', 15)} Listeyi yazdır</button>
    </div>

    <div class="card" style="overflow:hidden">
      <div class="board-bar">
        <div class="badges">
          <span class="badge badge-green">${bindi} bindi</span>
          <span class="badge ${kalan ? 'badge-amber' : 'badge-green'}">${kalan} bekliyor</span>
          <span class="badge">${d.passengers.length} toplam</span>
        </div>
        <input class="input" id="binisQ" placeholder="Yolcu ara…" value="${esc(q)}">
      </div>
      <div id="binisListe"></div>
    </div>`;

  const ciz = () => {
    const ara = document.getElementById('binisQ').value.trim().toLocaleLowerCase('tr-TR');
    const list = d.passengers.filter((p) =>
      !ara || p.passenger_name.toLocaleLowerCase('tr-TR').includes(ara) ||
      String(p.seat_no) === ara || (p.phone || '').includes(ara));
    document.getElementById('binisListe').innerHTML = list.length ? list.map((p) => `
      <div class="board-row ${p.boarded ? 'done' : ''}" data-tid="${p.id}">
        <div class="board-seat ${p.gender === 'E' ? 'm' : 'f'}">${p.seat_no}</div>
        <div class="bmain">
          <div class="bname">${esc(p.passenger_name)}</div>
          <div class="bsub">${p.gender === 'E' ? 'Bay' : 'Bayan'}${p.phone ? ' · ' + esc(p.phone) : ''}${p.group_name ? ' · ' + esc(p.group_name) : ''}${p.payment_status !== 'odendi' ? ' · <span style="color:var(--danger);font-weight:700">ÖDENMEDİ</span>' : ''}</div>
        </div>
        <div class="board-check">${svg('check', 17)}</div>
      </div>`).join('') : emptyBox('Yolcu bulunamadı');

    document.querySelectorAll('.board-row').forEach((row) => {
      row.onclick = async () => {
        const id = +row.dataset.tid;
        const p = d.passengers.find((x) => x.id === id);
        row.classList.toggle('done');
        try {
          const r = await api('/tickets/' + id + '/board', { method: 'POST', body: JSON.stringify({ boarded: p.boarded ? 0 : 1 }) });
          p.boarded = r.boarded;
          if (navigator.vibrate) navigator.vibrate(18);
          const b = d.passengers.filter((x) => x.boarded).length;
          document.querySelector('.board-bar .badge.badge-green').textContent = b + ' bindi';
          const k = d.passengers.length - b;
          const el2 = document.querySelectorAll('.board-bar .badge')[1];
          el2.textContent = k + ' bekliyor';
          el2.className = 'badge ' + (k ? 'badge-amber' : 'badge-green');
        } catch (ex) { row.classList.toggle('done'); toast(ex.message, 'err'); }
      };
    });
  };
  document.getElementById('binisQ').oninput = ciz;
  ciz();
}

/* ==========================================================================
   SAYFA: KAFİLELER
   ========================================================================== */
async function pageKafileler() {
  loading();
  const list = await api('/groups');
  view().innerHTML = `
    <div class="page-head"><div class="t"><h3>Kafileler</h3>
      <p>Grup rezervasyonları, toplu tahsilat durumu ve yolcu listeleri.</p></div></div>

    ${ipucu('kafileler', 'Kafile nedir?',
      'Bir düğün, okul gezisi veya tur grubu gibi <b>birlikte seyahat eden yolcuları</b> tek kayıt ' +
      'altında toplar. Böylece toplam tutarı, ne kadar tahsil edildiğini ve kalan borcu tek ekranda ' +
      'görürsünüz. Kafile oluşturmak için sefer ekranında birden fazla koltuk seçip ' +
      '<b>"Kafile / grup satışı"</b> kutusunu işaretleyin.')}
    ${list.length ? `<div class="card"><div class="table-wrap"><table class="tbl"><thead><tr>
      <th>Kafile</th><th>Sefer</th><th>Koltuk</th><th class="num">Tutar</th><th class="num">Tahsil</th>
      <th class="num">Kalan</th><th>Yetkili</th><th></th></tr></thead><tbody>
      ${list.map((g) => `<tr class="row-click" onclick="location.hash='#/kafile/${g.id}'">
        <td><b>${esc(g.name)}</b><div style="font-size:11.5px;color:var(--muted)">${esc(g.created_by_name || '')}</div></td>
        <td>${esc(g.origin)} → ${esc(g.destination)}<div style="font-size:11.5px;color:var(--muted)">${shortDate(g.depart_date)} ${g.depart_time}</div></td>
        <td><span class="badge badge-violet">${g.seat_count}</span></td>
        <td class="num">${TL0(g.total)}</td>
        <td class="num">${TL0(g.paid)}</td>
        <td class="num">${g.total - g.paid > 0 ? `<b style="color:var(--danger)">${TL0(g.total - g.paid)}</b>` : '<span class="badge badge-green">Tamam</span>'}</td>
        <td style="font-size:12.5px">${esc(g.contact_name || '-')}<div style="font-size:11.5px;color:var(--muted)">${esc(g.contact_phone || '')}</div></td>
        <td class="num"><div class="row-actions">
          <span class="btn btn-soft btn-sm">Detay →</span>
          ${S.user.role === 'admin' ? silBtn('Kafile', '/groups', g.id, 'pageKafileler') : ''}
        </div></td>
      </tr>`).join('')}
    </tbody></table></div></div>` : `<div class="card">${emptyBox('Henüz kafile kaydı yok', 'Sefer ekranında birden fazla koltuk seçip "Kafile / grup satışı" kutusunu işaretleyin.')}</div>`}`;
}

async function pageKafile(id) {
  loading();
  const g = await api('/groups/' + id);
  const total = g.tickets.reduce((s, t) => s + t.price, 0);
  const paid = g.tickets.reduce((s, t) => s + t.paid_amount, 0);
  const canEdit = S.user.role === 'admin' || g.created_by === S.user.id;

  view().innerHTML = `
    <div class="page-head no-print">
      <button class="btn btn-ghost btn-sm" onclick="location.hash='#/kafileler'">← Kafileler</button>
      <div class="t"><h3>${esc(g.name)}</h3>
        <p>${esc(g.origin)} → ${esc(g.destination)} · ${trDate(g.depart_date)} ${g.depart_time} · ${esc(g.plate)}</p></div>
      <button class="btn btn-soft btn-sm" onclick="printTickets([${g.tickets.map(t => t.id).join(',')}])">${svg('print', 15)} Biletleri yazdır</button>
      <button class="btn btn-soft btn-sm" onclick="location.hash='#/sefer/${g.trip_id}'">Koltuk haritası</button>
      ${canEdit ? `<button class="btn btn-danger btn-sm" id="cancelGroup">Kafileyi iptal et</button>` : ''}
    </div>

    <div class="stats" style="grid-template-columns:repeat(auto-fit,minmax(160px,1fr))">
      <div class="stat"><div class="lbl">Koltuk</div><div class="val">${g.tickets.length}</div></div>
      <div class="stat"><div class="lbl">Toplam tutar</div><div class="val" style="font-size:21px">${TL0(total)}</div></div>
      <div class="stat"><div class="lbl">Tahsil edilen</div><div class="val" style="font-size:21px;color:var(--ok)">${TL0(paid)}</div></div>
      <div class="stat"><div class="lbl">Kalan</div><div class="val" style="font-size:21px;color:${total - paid > 0 ? 'var(--danger)' : 'var(--ok)'}">${TL0(total - paid)}</div></div>
    </div>

    <div class="card">
      <div class="card-head"><h4>Yolcular</h4>
        <span style="font-size:12.5px;color:var(--muted)">Yetkili: ${esc(g.contact_name || '-')} ${esc(g.contact_phone || '')}</span></div>
      <div class="table-wrap"><table class="tbl"><thead><tr>
        <th>Koltuk</th><th>Yolcu</th><th>Cinsiyet</th><th>Telefon</th><th class="num">Ücret</th><th>Tahsilat</th><th>PNR</th></tr></thead><tbody>
        ${g.tickets.map((t) => `<tr class="row-click" onclick="ticketModal(${t.id})">
          <td><span class="badge ${t.gender === 'E' ? 'badge-blue' : 'badge-pink'}">${t.seat_no}</span></td>
          <td><b>${esc(t.passenger_name)}</b></td>
          <td>${t.gender === 'E' ? 'Bay' : 'Bayan'}</td>
          <td>${esc(t.phone || '-')}</td>
          <td class="num">${TL0(t.price)}</td>
          <td><span class="badge ${t.payment_status === 'odendi' ? 'badge-green' : 'badge-red'}">${t.payment_status === 'odendi' ? 'Ödendi' : t.payment_status === 'kismi' ? 'Kısmi' : 'Ödenmedi'}</span></td>
          <td><code>${esc(t.pnr)}</code></td>
        </tr>`).join('')}
      </tbody></table></div>
    </div>`;

  if (canEdit) document.getElementById('cancelGroup').onclick = async () => {
    if (!await confirmBox('Kafileyi iptal et', `"${g.name}" kafilesindeki ${g.tickets.length} biletin tamamı iptal edilecek.`, 'Evet, tümünü iptal et')) return;
    try { const r = await api('/groups/' + g.id + '/cancel', { method: 'POST', body: '{}' });
      toast(`${r.cancelled} bilet iptal edildi.`); pageKafile(id); }
    catch (ex) { toast(ex.message, 'err'); }
  };
}

/* ==========================================================================
   SAYFA: RAPORLAR
   ========================================================================== */
async function pageRaporlar() {
  loading();
  const users = S.user.role === 'admin' ? await api('/users') : [];
  view().innerHTML = `
    <div class="page-head"><div class="t"><h3>Satış Raporları</h3>
      <p>Dönem seçin; satıcı, güzergah ve gün bazında kırılım alın.</p></div>
      <button class="btn btn-soft btn-sm no-print" onclick="window.print()">${svg('print', 15)} Yazdır</button></div>
    <div class="card card-pad no-print" style="margin-bottom:16px">
      <div class="filters" style="margin:0">
        <div class="field"><label>Başlangıç</label><input type="date" class="input" id="rFrom" value="${addDaysISO(todayISO(), -29)}"></div>
        <div class="field"><label>Bitiş</label><input type="date" class="input" id="rTo" value="${todayISO()}"></div>
        ${S.user.role === 'admin' ? `<div class="field"><label>Satıcı</label><select class="input" id="rUser">
          <option value="">Tümü</option>${users.map((u) => `<option value="${u.id}">${esc(u.full_name)}${u.agency_name ? ' — ' + esc(u.agency_name) : ''}</option>`).join('')}
        </select></div>` : ''}
        <button class="btn btn-primary" id="rBtn">Raporu getir</button>
      </div>
    </div>
    <div id="rOut"><div class="loading-box"><span class="spinner"></span></div></div>`;

  const load = async () => {
    const p = new URLSearchParams({ from: document.getElementById('rFrom').value, to: document.getElementById('rTo').value });
    const ru = document.getElementById('rUser'); if (ru && ru.value) p.set('user_id', ru.value);
    const out = document.getElementById('rOut');
    out.innerHTML = '<div class="loading-box"><span class="spinner"></span></div>';
    const d = await api('/reports/sales?' + p.toString());
    const maxD = Math.max(1, ...d.byDay.map((x) => x.total));

    out.innerHTML = `
      <div class="stats">
        <div class="stat" style="--tint:rgba(37,99,235,.12)"><div class="lbl">Bilet</div><div class="val">${d.summary.c}</div><div class="sub">${shortDate(d.from)} – ${shortDate(d.to)}</div></div>
        <div class="stat" style="--tint:rgba(5,150,105,.14)"><div class="lbl">Toplam ciro</div><div class="val">${TL0(d.summary.total)}</div></div>
        <div class="stat" style="--tint:rgba(14,165,164,.14)"><div class="lbl">Tahsil edilen</div><div class="val">${TL0(d.summary.paid)}</div></div>
        <div class="stat" style="--tint:rgba(220,38,38,.12)"><div class="lbl">Tahsil edilmemiş</div>
          <div class="val" style="color:var(--danger)">${TL0(d.summary.total - d.summary.paid)}</div>
          <div class="sub">${d.unpaid.length} bilet</div></div>
      </div>

      ${d.byDay.length ? `<div class="card card-pad" style="margin-bottom:16px">
        <h4 style="margin-bottom:12px">Günlük satış</h4>
        <div class="mini-chart" style="height:140px">
          ${d.byDay.map((x) => `<div class="bar" style="height:${Math.max(3, (x.total / maxD) * 100)}%" title="${shortDate(x.d)} — ${TL(x.total)} (${x.c} bilet)"><span>${x.d.slice(8)}</span></div>`).join('')}
        </div><div style="height:22px"></div></div>` : ''}

      <div class="grid-2" style="gap:16px;align-items:start">
        <div class="card"><div class="card-head"><h4>Satıcıya göre</h4></div>
          <div class="table-wrap"><table class="tbl"><thead><tr><th>Satıcı</th><th class="num">Bilet</th><th class="num">Ciro</th><th class="num">Tahsil</th></tr></thead><tbody>
          ${d.bySeller.map((r) => `<tr><td><b>${esc(r.seller)}</b><div style="font-size:11.5px;color:var(--muted)">${esc(r.agency)}</div></td>
            <td class="num">${r.c}</td><td class="num"><b>${TL0(r.total)}</b></td><td class="num">${TL0(r.paid)}</td></tr>`).join('') || '<tr><td colspan="4" style="color:var(--faint)">Kayıt yok</td></tr>'}
          </tbody></table></div></div>

        <div class="card"><div class="card-head"><h4>Güzergaha göre</h4></div>
          <div class="table-wrap"><table class="tbl"><thead><tr><th>Güzergah</th><th class="num">Bilet</th><th class="num">Ciro</th></tr></thead><tbody>
          ${d.byRoute.map((r) => `<tr><td>${esc(r.route)}</td><td class="num">${r.c}</td><td class="num"><b>${TL0(r.total)}</b></td></tr>`).join('') || '<tr><td colspan="3" style="color:var(--faint)">Kayıt yok</td></tr>'}
          </tbody></table></div></div>
      </div>

      ${d.unpaid.length ? `<div class="card" style="margin-top:16px">
        <div class="card-head"><h4>Tahsil edilmemiş biletler</h4><span class="badge badge-red">${d.unpaid.length}</span></div>
        <div class="table-wrap"><table class="tbl"><thead><tr><th>PNR</th><th>Yolcu</th><th>Sefer</th><th>Koltuk</th>
          <th class="num">Ücret</th><th class="num">Alınan</th><th class="num">Kalan</th><th>Satan</th></tr></thead><tbody>
          ${d.unpaid.map((r) => `<tr class="row-click" onclick="ticketModal(${r.id})"><td><code>${esc(r.pnr)}</code></td>
            <td>${esc(r.passenger_name)}</td><td>${esc(r.origin)} → ${esc(r.destination)}<div style="font-size:11.5px;color:var(--muted)">${shortDate(r.depart_date)}</div></td>
            <td>${r.seat_no}</td><td class="num">${TL0(r.price)}</td><td class="num">${TL0(r.paid_amount)}</td>
            <td class="num"><b style="color:var(--danger)">${TL0(r.price - r.paid_amount)}</b></td><td style="font-size:12px">${esc(r.seller)}</td></tr>`).join('')}
        </tbody></table></div></div>` : ''}`;
  };
  document.getElementById('rBtn').onclick = load;
  load();
}

/* ==========================================================================
   TANIM SAYFALARI (yönetici)
   ========================================================================== */
async function pageOtobusler() {
  loading();
  const list = await api('/buses');
  S.cache.buses = list;
  view().innerHTML = `
    <div class="page-head"><div class="t"><h3>Otobüsler</h3><p>2+2 koltuk düzeni. Sıra sayısı ve arka 5'li sıra seçeneğine göre kapasite hesaplanır.</p></div>
      <button class="btn btn-primary" id="newBus">${svg('plus', 16)} Yeni otobüs</button></div>

    ${ipucu('otobusler', 'Otobüs nasıl eklenir?',
      'Koltuk sayısını tek tek girmenize gerek yok. Sadece <b>kaç sıra</b> olduğunu yazın ' +
      '(her sıra 2+2 = 4 koltuk) ve <b>arka sırada 5 koltuk</b> olup olmadığını seçin. ' +
      'Sistem toplam kapasiteyi kendisi hesaplar. Örnek: 10 sıra + arka sıra = 45 koltuk.')}

    ${!list.length ? `<div class="card">${emptyBox('Henüz otobüs eklenmemiş',
        'Sefer açabilmek için önce en az bir otobüs tanımlamanız gerekiyor.',
        { buton: { yazi: 'İlk otobüsü ekle', tikla: "document.getElementById('newBus').click()" } })}</div>` : ''}
    <div class="card" ${!list.length ? 'style="display:none"' : ''}><div class="table-wrap"><table class="tbl"><thead><tr>
      <th>Plaka</th><th>Model / Ad</th><th class="num">Sıra</th><th>Arka 5'li</th><th class="num">Kapasite</th><th>Özellikler</th><th>Durum</th><th></th>
    </tr></thead><tbody>
      ${list.map((b) => `<tr><td><b>${esc(b.plate)}</b></td><td>${esc(b.name)}</td>
        <td class="num">${b.rows_cnt}</td><td>${b.back_row ? '<span class="badge badge-green">Var</span>' : '<span class="badge">Yok</span>'}</td>
        <td class="num"><b>${b.capacity}</b></td><td style="font-size:12.5px;color:var(--muted)">${esc(b.notes || '-')}</td>
        <td>${b.active ? '<span class="badge badge-green">Aktif</span>' : '<span class="badge badge-red">Pasif</span>'}</td>
        <td class="num"><div class="row-actions">
          <button class="btn btn-soft btn-sm" onclick="busModal(${b.id})">Düzenle</button>
          ${silBtn('Otobüs', '/buses', b.id, 'pageOtobusler')}
        </div></td></tr>`).join('')}
    </tbody></table></div></div>`;
  document.getElementById('newBus').onclick = () => busModal(null);
}

function busModal(id) {
  const b = id ? (S.cache.buses || []).find((x) => x.id === id) : null;
  const close = modal({
    title: b ? 'Otobüsü düzenle' : 'Yeni otobüs',
    body: `
      <div class="grid-2">
        <div class="field"><label>Plaka *</label><input class="input" id="buPlate" value="${b ? esc(b.plate) : ''}" placeholder="34 ABC 123"></div>
        <div class="field"><label>Model / Ad *</label><input class="input" id="buName" value="${b ? esc(b.name) : ''}" placeholder="Mercedes Travego"></div>
      </div>
      <div class="grid-2">
        <div class="field"><label>Sıra sayısı (her sıra 2+2 = 4 koltuk)</label><input type="number" min="5" max="20" class="input" id="buRows" value="${b ? b.rows_cnt : 10}"></div>
        <div class="field"><label>Arka sıra 5 koltuk</label><select class="input" id="buBack">
          <option value="1" ${!b || b.back_row ? 'selected' : ''}>Var (+5 koltuk)</option>
          <option value="0" ${b && !b.back_row ? 'selected' : ''}>Yok</option></select></div>
      </div>
      <div class="badge badge-blue" id="buCap" style="margin-bottom:12px"></div>
      <div class="field"><label>Özellikler / not</label><input class="input" id="buNotes" value="${b ? esc(b.notes || '') : ''}" placeholder="Klima, WiFi, ikram"></div>
      ${b ? `<div class="field"><label>Durum</label><select class="input" id="buActive">
        <option value="1" ${b.active ? 'selected' : ''}>Aktif</option><option value="0" ${!b.active ? 'selected' : ''}>Pasif</option></select></div>` : ''}`,
    footer: `<button class="btn btn-ghost" onclick="closeModal()">Vazgeç</button>
             <button class="btn btn-primary" id="buSave">Kaydet</button>`
  });
  const calc = () => {
    const r = +document.getElementById('buRows').value, bk = +document.getElementById('buBack').value;
    document.getElementById('buCap').textContent = `Toplam kapasite: ${r * 4 + (bk ? 5 : 0)} koltuk (${r} sıra × 4${bk ? ' + arka sıra 5' : ''})`;
  };
  document.getElementById('buRows').oninput = calc;
  document.getElementById('buBack').onchange = calc;
  calc();
  document.getElementById('buSave').onclick = async (e) => {
    e.target.disabled = true;
    const body = {
      plate: document.getElementById('buPlate').value, name: document.getElementById('buName').value,
      rows_cnt: +document.getElementById('buRows').value, back_row: +document.getElementById('buBack').value,
      notes: document.getElementById('buNotes').value
    };
    if (b) body.active = +document.getElementById('buActive').value;
    try { await api(b ? '/buses/' + b.id : '/buses', { method: b ? 'PUT' : 'POST', body: JSON.stringify(body) });
      toast('Kaydedildi.'); close(); pageOtobusler(); }
    catch (ex) { toast(ex.message, 'err'); e.target.disabled = false; }
  };
}

async function pageGuzergahlar() {
  loading();
  const list = await api('/routes');
  S.cache.routes = list;
  view().innerHTML = `
    <div class="page-head"><div class="t"><h3>Güzergahlar</h3><p>Kalkış–varış çiftleri. Her yön ayrı kayıttır.</p></div>
      <button class="btn btn-primary" id="newRoute">${svg('plus', 16)} Yeni güzergah</button></div>

    ${ipucu('guzergahlar', 'Gidiş ve dönüş ayrı ayrı eklenir',
      'İstanbul → Ankara ile Ankara → İstanbul <b>iki ayrı güzergahtır</b>. ' +
      'Her iki yönde de sefer yapıyorsanız ikisini de eklemelisiniz.')}

    ${!list.length ? `<div class="card">${emptyBox('Henüz güzergah eklenmemiş',
        'Sefer açabilmek için önce hangi şehirler arasında çalıştığınızı tanımlayın.',
        { buton: { yazi: 'İlk güzergahı ekle', tikla: "document.getElementById('newRoute').click()" } })}</div>` : ''}
    <div class="card" ${!list.length ? 'style="display:none"' : ''}><div class="table-wrap"><table class="tbl"><thead><tr>
      <th>Kalkış</th><th>Varış</th><th class="num">Süre</th><th>Durum</th><th></th></tr></thead><tbody>
      ${list.map((r) => `<tr><td><b>${esc(r.origin)}</b></td><td><b>${esc(r.destination)}</b></td>
        <td class="num">${Math.floor(r.duration_min / 60)} sa ${r.duration_min % 60} dk</td>
        <td>${r.active ? '<span class="badge badge-green">Aktif</span>' : '<span class="badge badge-red">Pasif</span>'}</td>
        <td class="num"><div class="row-actions">
          <button class="btn btn-soft btn-sm" onclick="routeModal(${r.id})">Düzenle</button>
          ${silBtn('Güzergah', '/routes', r.id, 'pageGuzergahlar')}
        </div></td></tr>`).join('')}
    </tbody></table></div></div>`;
  document.getElementById('newRoute').onclick = () => routeModal(null);
}

function routeModal(id) {
  const r = id ? (S.cache.routes || []).find((x) => x.id === id) : null;
  const close = modal({
    title: r ? 'Güzergahı düzenle' : 'Yeni güzergah',
    body: `<div class="grid-2">
        <div class="field"><label>Kalkış *</label><input class="input" id="roO" value="${r ? esc(r.origin) : ''}" placeholder="İstanbul"></div>
        <div class="field"><label>Varış *</label><input class="input" id="roD" value="${r ? esc(r.destination) : ''}" placeholder="Ankara"></div></div>
      <div class="field"><label>Tahmini süre (dakika)</label><input type="number" class="input" id="roM" value="${r ? r.duration_min : 300}"></div>
      ${r ? `<div class="field"><label>Durum</label><select class="input" id="roA">
        <option value="1" ${r.active ? 'selected' : ''}>Aktif</option><option value="0" ${!r.active ? 'selected' : ''}>Pasif</option></select></div>` : ''}`,
    footer: `<button class="btn btn-ghost" onclick="closeModal()">Vazgeç</button><button class="btn btn-primary" id="roSave">Kaydet</button>`
  });
  document.getElementById('roSave').onclick = async (e) => {
    e.target.disabled = true;
    const body = { origin: document.getElementById('roO').value, destination: document.getElementById('roD').value, duration_min: +document.getElementById('roM').value };
    if (r) body.active = +document.getElementById('roA').value;
    try { await api(r ? '/routes/' + r.id : '/routes', { method: r ? 'PUT' : 'POST', body: JSON.stringify(body) });
      toast('Kaydedildi.'); close(); pageGuzergahlar(); }
    catch (ex) { toast(ex.message, 'err'); e.target.disabled = false; }
  };
}

async function pageKullanicilar() {
  loading();
  const list = await api('/users');
  S.cache.users = list;
  view().innerHTML = `
    <div class="page-head"><div class="t"><h3>Kullanıcılar</h3>
      <p>Yönetici her şeyi görür; acente yalnızca kendi sattığı biletleri görür ve düzenler.</p></div>
      <button class="btn btn-primary" id="newUser">${svg('plus', 16)} Yeni kullanıcı</button></div>

    ${ipucu('kullanicilar', 'İki tür kullanıcı var',
      '<b>Yönetici:</b> her şeyi görür, sefer açar, siler, ayarları değiştirir.<br>' +
      '<b>Acente:</b> sadece bilet satar ve <b>kendi sattığı</b> biletleri görür. ' +
      'Başkasının satışını göremez, sefer açamaz, silemez.<br>' +
      'Bir personel işten ayrılırsa hesabı silmek yerine <b>Pasif</b> yapmanız yeterli — ' +
      'geçmiş satışları kayıtta kalır.')}
    <div class="card"><div class="table-wrap"><table class="tbl"><thead><tr>
      <th>Kullanıcı</th><th>Ad Soyad</th><th>Acente</th><th>Telefon</th><th>Rol</th><th>Durum</th><th></th></tr></thead><tbody>
      ${list.map((u) => `<tr><td><code style="font-weight:700">${esc(u.username)}</code></td><td><b>${esc(u.full_name)}</b></td>
        <td>${esc(u.agency_name || '-')}</td><td>${esc(u.phone || '-')}</td>
        <td>${u.role === 'admin' ? '<span class="badge badge-violet">Yönetici</span>' : '<span class="badge badge-blue">Acente</span>'}</td>
        <td>${u.active ? '<span class="badge badge-green">Aktif</span>' : '<span class="badge badge-red">Pasif</span>'}</td>
        <td class="num"><div class="row-actions">
          <button class="btn btn-soft btn-sm" onclick="userModal(${u.id})">Düzenle</button>
          ${u.id === S.user.id
            ? `<button class="btn btn-icon" disabled title="Kendi hesabınızı silemezsiniz">${svg('trash', 15)}</button>`
            : silBtn('Kullanıcı', '/users', u.id, 'pageKullanicilar')}
        </div></td></tr>`).join('')}
    </tbody></table></div></div>`;
  document.getElementById('newUser').onclick = () => userModal(null);
}

function userModal(id) {
  const u = id ? (S.cache.users || []).find((x) => x.id === id) : null;
  const close = modal({
    title: u ? 'Kullanıcıyı düzenle' : 'Yeni kullanıcı',
    body: `
      <div class="grid-2">
        <div class="field"><label>Kullanıcı adı *</label>
          <input class="input" id="usU" value="${u ? esc(u.username) : ''}" ${u ? 'disabled' : ''} placeholder="acente3"></div>
        <div class="field"><label>${u ? 'Yeni şifre (boş = değişmez)' : 'Şifre *'}</label>
          <input class="input" id="usP" type="text" placeholder="en az 5 karakter"></div>
      </div>
      <div class="field"><label>Ad Soyad *</label><input class="input" id="usN" value="${u ? esc(u.full_name) : ''}"></div>
      <div class="grid-2">
        <div class="field"><label>Rol *</label><select class="input" id="usR">
          <option value="acente" ${u && u.role === 'acente' ? 'selected' : ''}>Acente (kendi satışları)</option>
          <option value="admin" ${u && u.role === 'admin' ? 'selected' : ''}>Yönetici (tam yetki)</option></select></div>
        <div class="field"><label>Acente / şube adı</label><input class="input" id="usA" value="${u ? esc(u.agency_name || '') : ''}"></div>
      </div>
      <div class="grid-2">
        <div class="field"><label>Telefon</label><input class="input" id="usT" value="${u ? esc(u.phone || '') : ''}"></div>
        ${u ? `<div class="field"><label>Durum</label><select class="input" id="usAc">
          <option value="1" ${u.active ? 'selected' : ''}>Aktif</option><option value="0" ${!u.active ? 'selected' : ''}>Pasif</option></select></div>` : '<div></div>'}
      </div>`,
    footer: `<button class="btn btn-ghost" onclick="closeModal()">Vazgeç</button><button class="btn btn-primary" id="usSave">Kaydet</button>`
  });
  document.getElementById('usSave').onclick = async (e) => {
    e.target.disabled = true;
    const body = {
      full_name: document.getElementById('usN').value, role: document.getElementById('usR').value,
      agency_name: document.getElementById('usA').value, phone: document.getElementById('usT').value
    };
    const pw = document.getElementById('usP').value;
    if (u) { if (pw) body.password = pw; body.active = +document.getElementById('usAc').value; }
    else { body.username = document.getElementById('usU').value; body.password = pw; }
    try { await api(u ? '/users/' + u.id : '/users', { method: u ? 'PUT' : 'POST', body: JSON.stringify(body) });
      toast('Kaydedildi.'); close(); pageKullanicilar(); }
    catch (ex) { toast(ex.message, 'err'); e.target.disabled = false; }
  };
}

async function pageAyarlar() {
  loading();
  const s = await api('/settings');
  view().innerHTML = `
    <div class="page-head"><div class="t"><h3>Ayarlar</h3><p>Firma bilgileri bilet ve yolcu listesi çıktılarında görünür.</p></div></div>
    <div class="grid-2" style="gap:16px;align-items:start">
      <div class="card card-pad">
        <h4 style="margin-bottom:6px">Firma kimliği</h4>
        <p style="color:var(--muted);font-size:13px;margin:0 0 14px">
          Buradaki bilgiler giriş ekranında, sol menüde, biletlerde ve yolcu listelerinde görünür.</p>

        <label style="display:block;font-size:12.5px;font-weight:600;color:var(--muted);margin-bottom:6px">Logo</label>
        <div class="logo-picker">
          <div class="logo-preview" id="logoPrev">
            ${s.company.logo ? `<img src="${esc(s.company.logo)}" alt="Logo">`
              : `<span>Logo<br>yok</span>`}
          </div>
          <div style="flex:1">
            <input type="file" id="logoFile" accept="image/png,image/jpeg,image/webp" hidden>
            <div style="display:flex;gap:8px;flex-wrap:wrap">
              <button class="btn btn-soft btn-sm" id="logoPick">Resim seç</button>
              <button class="btn btn-ghost btn-sm" id="logoClear" ${s.company.logo ? '' : 'style="display:none"'}>Kaldır</button>
            </div>
            <div style="font-size:12px;color:var(--muted);margin-top:7px">
              PNG veya JPG. Kare veya yatay olması en iyi sonucu verir; sistem küçültmeyi kendisi yapar.</div>
          </div>
        </div>

        <div class="field"><label>Firma adı *</label><input class="input" id="coName" value="${esc(s.company.name || '')}" placeholder="ÖZ TURAKİNE TURİZM"></div>
        <div class="field"><label>Slogan / alt başlık</label><input class="input" id="coSlogan" value="${esc(s.company.slogan || '')}" placeholder="Güvenli ve konforlu yolculuk"></div>
        <div class="grid-2">
          <div class="field"><label>Telefon</label><input class="input" id="coPhone" value="${esc(s.company.phone || '')}" placeholder="0850 000 00 00"></div>
          <div class="field"><label>İnternet adresi</label><input class="input" id="coWeb" value="${esc(s.company.website || '')}" placeholder="turakine.com.tr"></div>
        </div>
        <div class="field"><label>Adres</label><input class="input" id="coAddr" value="${esc(s.company.address || '')}" placeholder="Otogar / İstanbul"></div>
        <div class="field"><label>Vergi dairesi / no (bilet altında görünür)</label>
          <input class="input" id="coTax" value="${esc(s.company.tax_info || '')}" placeholder="Bakırköy V.D. 1234567890"></div>
        <div class="field"><label>Bilet alt yazısı</label>
          <textarea class="input" id="coNote" rows="2" placeholder="Yolcularımızın kalkış saatinden 15 dakika önce peronda bulunmaları rica olunur.">${esc(s.company.ticket_note || '')}</textarea></div>
        <button class="btn btn-primary" id="coSave">Kaydet</button>
      </div>
      <div style="display:flex;flex-direction:column;gap:16px">
        <div class="card card-pad">
          <h4 style="margin-bottom:6px">Yardım</h4>
          <p style="color:var(--muted);font-size:13px;margin:0 0 12px">
            Ekranlardaki açıklama kutularını kapattıysanız buradan hepsini geri getirebilirsiniz.</p>
          <div style="display:flex;gap:8px;flex-wrap:wrap">
            <button class="btn btn-soft btn-sm" onclick="tumIpuclariniAc()">${svg('help', 15)} Açıklamaları geri aç</button>
            <button class="btn btn-soft btn-sm" onclick="karsilamaGoster(true)">${svg('star', 15)} Karşılama turunu göster</button>
          </div>
        </div>

        <div class="card card-pad">
          <h4 style="margin-bottom:14px">Şifremi değiştir</h4>
          ${S.user.weak_password ? `<div class="badge badge-red" style="margin-bottom:12px;white-space:normal;text-align:left">
            Hâlâ varsayılan şifreyi kullanıyorsunuz. Sistem internete açıksa lütfen hemen değiştirin.</div>` : ''}
          <div class="field"><label>Mevcut şifre</label><input type="password" class="input" id="pwOld"></div>
          <div class="field"><label>Yeni şifre</label><input type="password" class="input" id="pwNew"></div>
          <button class="btn btn-soft" id="pwSave">Şifreyi güncelle</button>
        </div>

        ${S.user.role === 'admin' ? `
        <div class="card card-pad">
          <h4 style="margin-bottom:6px">Yedekleme</h4>
          <p style="color:var(--muted);font-size:13px;margin:0 0 12px">
            Sistem her gün otomatik yedek alır ve son 14 yedeği saklar. Buradan anlık yedek de indirebilirsiniz —
            inen dosyayı güvenli bir yerde saklayın, tüm bilet ve sefer kayıtlarınız içindedir.</p>
          <button class="btn btn-primary" id="dlBackup">Şimdi yedek indir</button>
          <div id="backupList" style="margin-top:14px"></div>
        </div>

        <div class="card card-pad">
          <h4 style="margin-bottom:12px">Sistem durumu</h4>
          <div id="sysBox" style="font-size:13.5px;color:var(--muted)">Yükleniyor…</div>
        </div>` : ''}
      </div>
    </div>

    ${S.user.role === 'admin' ? `<div class="card card-pad" style="margin-top:16px" id="smsCard">
      <div class="loading-box"><span class="spinner"></span></div>
    </div>` : ''}`;
  /* ---- Logo seçimi: tarayıcıda küçültülür, sunucuya küçük hâli gider ---- */
  let yeniLogo = s.company.logo || '';
  document.getElementById('logoPick').onclick = () => document.getElementById('logoFile').click();
  document.getElementById('logoFile').onchange = async (ev) => {
    const f = ev.target.files && ev.target.files[0];
    if (!f) return;
    if (!/^image\//.test(f.type)) { toast('Lütfen bir resim dosyası seçin.', 'err'); return; }
    try {
      yeniLogo = await kucultResim(f, 320);
      document.getElementById('logoPrev').innerHTML = `<img src="${yeniLogo}" alt="Logo">`;
      document.getElementById('logoClear').style.display = '';
      toast('Logo seçildi. Kaydet düğmesine basmayı unutmayın.', 'warn');
    } catch { toast('Resim okunamadı. Başka bir dosya deneyin.', 'err'); }
  };
  document.getElementById('logoClear').onclick = () => {
    yeniLogo = '';
    document.getElementById('logoPrev').innerHTML = '<span>Logo<br>yok</span>';
    document.getElementById('logoClear').style.display = 'none';
  };

  document.getElementById('coSave').onclick = async (e) => {
    e.target.disabled = true;
    const company = {
      name: document.getElementById('coName').value,
      slogan: document.getElementById('coSlogan').value,
      phone: document.getElementById('coPhone').value,
      website: document.getElementById('coWeb').value,
      address: document.getElementById('coAddr').value,
      tax_info: document.getElementById('coTax').value,
      ticket_note: document.getElementById('coNote').value,
      logo: yeniLogo
    };
    try {
      const r = await api('/settings', { method: 'PUT', body: JSON.stringify({ company }) });
      S.company = r.company || company;
      uygulaMarka();
      toast('Firma bilgileri kaydedildi.');
    } catch (ex) { toast(ex.message, 'err', 6000); }
    e.target.disabled = false;
  };
  document.getElementById('pwSave').onclick = async (e) => {
    e.target.disabled = true;
    try { await api('/me/password', { method: 'POST', body: JSON.stringify({
      current: document.getElementById('pwOld').value, next: document.getElementById('pwNew').value }) });
      toast('Şifreniz değiştirildi.'); S.user.weak_password = false;
      document.getElementById('pwOld').value = ''; document.getElementById('pwNew').value = ''; }
    catch (ex) { toast(ex.message, 'err'); }
    e.target.disabled = false;
  };

  if (S.user.role !== 'admin') return;

  document.getElementById('dlBackup').onclick = () => {
    toast('Yedek hazırlanıyor, indirme birazdan başlayacak…');
    location.href = '/api/backup?token=' + encodeURIComponent(token());
  };

  api('/backups').then((list) => {
    const box = document.getElementById('backupList');
    if (!box) return;
    box.innerHTML = list.length
      ? `<div style="font-size:12.5px;color:var(--muted);margin-bottom:6px">Sunucudaki otomatik yedekler:</div>
         <div style="display:flex;flex-wrap:wrap;gap:6px">${list.slice(0, 8).map((b) =>
           `<span class="badge">${esc(b.name.replace('otobus-', '').replace('.db', ''))} · ${(b.size / 1024).toFixed(0)} KB</span>`).join('')}</div>`
      : '<div style="font-size:12.5px;color:var(--faint)">Henüz otomatik yedek alınmadı.</div>';
  }).catch(() => {});

  renderSmsCard();

  api('/system').then((s) => {
    const box = document.getElementById('sysBox');
    if (!box) return;
    box.innerHTML = `
      <div style="display:grid;gap:7px">
        <div>🔗 <b>${s.online}</b> terminal şu an bağlı</div>
        <div>👤 ${s.counts.users} aktif kullanıcı · 🚌 ${s.counts.trips} açık sefer · 🎫 ${s.counts.tickets} geçerli bilet</div>
        <div>🔒 Bağlantı: ${s.secure ? '<b style="color:var(--ok)">güvenli (https)</b>' : '<b style="color:var(--hold)">şifresiz (http)</b> — internete açıksa https kurun'}</div>
        <div style="color:var(--faint);font-size:12px">Sunucu ${new Date(s.started).toLocaleString('tr-TR')} tarihinden beri çalışıyor · Node ${esc(s.node)}</div>
      </div>`;
  }).catch(() => {});
}

/* ----------------------------- Bildirim ayarları ----------------------------- */
const SAGLAYICI_ALAN = {
  kapali: [],
  netgsm: [
    { k: 'kullanici', l: 'Netgsm kullanıcı no', ipucu: 'Abonelik numaranız (örn. 850XXXXXXX)' },
    { k: 'sifre', l: 'API şifresi', tip: 'password', ipucu: 'Netgsm panelinden aldığınız API şifresi' },
    { k: 'baslik', l: 'SMS başlığı', ipucu: 'Onaylı gönderici adınız (örn. OZSEYAHAT)' },
    { k: 'adres', l: 'API adresi (isteğe bağlı)', ipucu: 'Boş bırakırsanız varsayılan adres kullanılır' }
  ],
  iletimerkezi: [
    { k: 'anahtar', l: 'API Key', ipucu: 'İletiMerkezi panelinden alınır' },
    { k: 'gizli', l: 'API Hash', tip: 'password', ipucu: 'İletiMerkezi panelinden alınır' },
    { k: 'baslik', l: 'SMS başlığı', ipucu: 'Onaylı gönderici adınız' }
  ],
  twilio: [
    { k: 'kullanici', l: 'Account SID' },
    { k: 'sifre', l: 'Auth Token', tip: 'password' },
    { k: 'gonderen', l: 'Gönderen numara', ipucu: 'Twilio numaranız, +1... biçiminde' }
  ],
  ozel: [
    { k: 'adres', l: 'Servis adresi (URL)', ipucu: 'Sisteminiz buraya {phone, text, sender} gönderir' },
    { k: 'gizli', l: 'Yetki anahtarı (isteğe bağlı)', tip: 'password' },
    { k: 'baslik', l: 'Gönderici adı' }
  ]
};

async function renderSmsCard() {
  const kart = document.getElementById('smsCard');
  if (!kart) return;
  const { settings: a } = await api('/sms-settings');

  const alanlar = (SAGLAYICI_ALAN[a.saglayici] || []).map((f) => `
    <div class="field"><label>${f.l}</label>
      <input class="input" data-sms="${f.k}" type="${f.tip || 'text'}" value="${esc(a[f.k] || '')}">
      ${f.ipucu ? `<div style="font-size:11.5px;color:var(--muted);margin-top:4px">${f.ipucu}</div>` : ''}
    </div>`).join('');

  kart.innerHTML = `
    <h4 style="margin-bottom:6px">${svg('bell', 16)} Bildirimler — bileti yolcuya gönderme</h4>
    <p style="color:var(--muted);font-size:13px;margin:0 0 16px">
      Satış sonrası yolcuya koltuk ve PNR bilgisini iletir.
      <b>WhatsApp seçeneği ücretsizdir ve hemen çalışır</b>; SMS için bir servise abone olmanız gerekir.</p>

    <div style="background:var(--surface-2);border:1px solid var(--border);border-radius:12px;padding:14px;margin-bottom:16px">
      <label style="display:flex;align-items:center;gap:10px;cursor:pointer">
        <input type="checkbox" id="waAktif" ${a.whatsapp_aktif ? 'checked' : ''} style="width:17px;height:17px;accent-color:#0ea5a4">
        <div><b style="font-size:13.5px">WhatsApp düğmesi açık</b>
          <div style="font-size:11.5px;color:var(--muted)">Bilet ekranında "WhatsApp'tan gönder" düğmesi görünür. Abonelik ve ücret gerektirmez.</div></div>
      </label>
      <div class="field" style="margin:12px 0 0"><label>WhatsApp mesaj şablonu</label>
        <textarea class="input" id="waSablon" rows="4">${esc(a.whatsapp_sablon)}</textarea></div>
    </div>

    <div class="grid-2">
      <div class="field"><label>SMS servisi</label>
        <select class="input" id="smsSaglayici">
          <option value="kapali" ${a.saglayici === 'kapali' ? 'selected' : ''}>Kapalı (sadece WhatsApp)</option>
          <option value="netgsm" ${a.saglayici === 'netgsm' ? 'selected' : ''}>Netgsm</option>
          <option value="iletimerkezi" ${a.saglayici === 'iletimerkezi' ? 'selected' : ''}>İletiMerkezi</option>
          <option value="twilio" ${a.saglayici === 'twilio' ? 'selected' : ''}>Twilio (yurt dışı)</option>
          <option value="ozel" ${a.saglayici === 'ozel' ? 'selected' : ''}>Özel servis (kendi adresim)</option>
        </select></div>
      <div class="field"><label>Satış sonrası otomatik SMS</label>
        <select class="input" id="smsOtomatik" ${a.saglayici === 'kapali' ? 'disabled' : ''}>
          <option value="0" ${!a.otomatik ? 'selected' : ''}>Hayır, elle göndereyim</option>
          <option value="1" ${a.otomatik ? 'selected' : ''}>Evet, bilet kesilince gitsin</option>
        </select></div>
    </div>

    ${alanlar}

    ${a.saglayici !== 'kapali' ? `
      <div class="field"><label>SMS şablonu</label>
        <textarea class="input" id="smsSablon" rows="3">${esc(a.sablon)}</textarea>
        <div style="font-size:11.5px;color:var(--muted);margin-top:5px" id="smsSay"></div></div>
      <label style="display:flex;align-items:center;gap:9px;margin-bottom:14px;cursor:pointer;font-size:13px">
        <input type="checkbox" id="smsSade" ${a.sade_turkce ? 'checked' : ''} style="width:16px;height:16px">
        Türkçe karakterleri sadeleştir (ş→s, ı→i) — SMS başına 160 yerine 70 karaktere düşmeyi önler
      </label>` : ''}

    <div style="background:var(--surface-2);border-radius:10px;padding:11px 13px;font-size:12px;color:var(--muted);margin-bottom:14px">
      <b style="color:var(--text)">Kullanılabilir alanlar:</b>
      {ad} {pnr} {koltuk} {kalkis} {varis} {tarih} {saat} {plaka} {fiyat} {firma} {telefon}
    </div>

    <div style="display:flex;gap:10px;flex-wrap:wrap">
      <button class="btn btn-primary" id="smsKaydet">Kaydet</button>
      ${a.saglayici !== 'kapali' ? `<button class="btn btn-soft" id="smsTest">Deneme SMS'i gönder</button>` : ''}
      <button class="btn btn-ghost" onclick="location.hash='#/bildirimler'">Gönderim kayıtları →</button>
    </div>`;

  const say = () => {
    const el = document.getElementById('smsSablon');
    if (!el) return;
    const n = el.value.length;
    document.getElementById('smsSay').textContent =
      `Şablon ${n} karakter — değişkenler dolunca uzayacaktır. 160 karakteri aşan her parça ayrı SMS ücretlendirilir.`;
  };
  const sab = document.getElementById('smsSablon');
  if (sab) { sab.oninput = say; say(); }

  document.getElementById('smsSaglayici').onchange = async (e) => {
    await api('/sms-settings', { method: 'PUT', body: JSON.stringify({ saglayici: e.target.value }) });
    renderSmsCard();
  };

  document.getElementById('smsKaydet').onclick = async (e) => {
    e.target.disabled = true;
    const govde = {
      saglayici: document.getElementById('smsSaglayici').value,
      otomatik: document.getElementById('smsOtomatik').value === '1',
      whatsapp_aktif: document.getElementById('waAktif').checked,
      whatsapp_sablon: document.getElementById('waSablon').value
    };
    const s = document.getElementById('smsSablon');
    if (s) { govde.sablon = s.value; govde.sade_turkce = document.getElementById('smsSade').checked; }
    document.querySelectorAll('[data-sms]').forEach((el) => { govde[el.dataset.sms] = el.value; });
    try { await api('/sms-settings', { method: 'PUT', body: JSON.stringify(govde) }); toast('Bildirim ayarları kaydedildi.'); renderSmsCard(); }
    catch (ex) { toast(ex.message, 'err'); e.target.disabled = false; }
  };

  const testBtn = document.getElementById('smsTest');
  if (testBtn) testBtn.onclick = () => {
    const close = modal({
      title: 'Deneme SMS\'i',
      body: `<p style="color:var(--muted);margin:0 0 14px;font-size:13.5px">
               Ayarların doğru olduğunu anlamak için kendi numaranıza kısa bir mesaj gönderin.
               Bu gönderim servisinizden kredi düşer.</p>
             <div class="field"><label>Cep telefonu</label>
               <input class="input" id="testTel" placeholder="0555 111 22 33"></div>`,
      footer: `<button class="btn btn-ghost" onclick="closeModal()">Vazgeç</button>
               <button class="btn btn-primary" id="testGo">Gönder</button>`
    });
    document.getElementById('testGo').onclick = async (ev) => {
      ev.target.disabled = true;
      try {
        await api('/sms-settings/test', { method: 'POST', body: JSON.stringify({ phone: document.getElementById('testTel').value }) });
        toast('Deneme mesajı gönderildi. Telefonunuzu kontrol edin.'); close();
      } catch (ex) { toast(ex.message, 'err', 8000); ev.target.disabled = false; }
    };
  };
}

async function pageBildirimler() {
  loading();
  const list = await api('/messages');
  view().innerHTML = `
    <div class="page-head"><div class="t"><h3>Gönderim Kayıtları</h3>
      <p>Yolculara gönderilen bilet mesajları ve sonuçları.</p></div>
      <button class="btn btn-soft btn-sm" onclick="location.hash='#/ayarlar'">Bildirim ayarları</button></div>
    ${list.length ? `<div class="card"><div class="table-wrap"><table class="tbl"><thead><tr>
      <th>Zaman</th><th>Yolcu</th><th>Numara</th><th>Kanal</th><th>Durum</th><th>Mesaj / hata</th><th>Gönderen</th><th></th>
    </tr></thead><tbody>
      ${list.map((m) => `<tr>
        <td style="white-space:nowrap">${esc(m.created_at)}</td>
        <td>${m.passenger_name ? `<b>${esc(m.passenger_name)}</b><div style="font-size:11.5px;color:var(--muted)">Koltuk ${m.seat_no}</div>` : '<span style="color:var(--faint)">—</span>'}</td>
        <td>${esc(m.phone)}</td>
        <td><span class="badge">${m.channel === 'sms' ? 'SMS' : esc(m.channel)}</span></td>
        <td>${m.status === 'gonderildi' ? '<span class="badge badge-green">Gönderildi</span>'
             : m.status === 'hata' ? '<span class="badge badge-red">Hata</span>' : '<span class="badge badge-amber">Bekliyor</span>'}</td>
        <td style="max-width:340px;font-size:12px;color:var(--muted)">${esc(m.error || m.body).slice(0, 120)}</td>
        <td style="font-size:12px">${esc(m.by_name || '-')}</td>
        <td class="num">${silBtn('Bildirim', '/messages', m.id, 'pageBildirimler')}</td>
      </tr>`).join('')}
    </tbody></table></div></div>` : `<div class="card">${emptyBox('Henüz mesaj gönderilmedi',
      'Bilet ekranındaki "Bilet gönder" düğmesinden WhatsApp veya SMS ile gönderebilirsiniz.')}</div>`}`;
}

async function pageKayitlar() {
  loading();
  const list = await api('/logs');
  const AD = { giris: 'Giriş', bilet_sat: 'Bilet satışı', bilet_iptal: 'Bilet iptali', bilet_guncelle: 'Bilet güncelleme',
    sefer_ekle: 'Sefer ekleme', sefer_guncelle: 'Sefer güncelleme', sefer_sil: 'Sefer silme', otobus_ekle: 'Otobüs ekleme',
    otobus_guncelle: 'Otobüs güncelleme', guzergah_ekle: 'Güzergah ekleme', kullanici_ekle: 'Kullanıcı ekleme',
    kullanici_guncelle: 'Kullanıcı güncelleme', kafile_iptal: 'Kafile iptali', koltuk_degistir: 'Koltuk değişimi', sifre_degistir: 'Şifre değişimi' };
  view().innerHTML = `
    <div class="page-head"><div class="t"><h3>İşlem Kayıtları</h3><p>Son 300 işlem.</p></div></div>
    <div class="card"><div class="table-wrap"><table class="tbl"><thead><tr>
      <th>Zaman</th><th>Kullanıcı</th><th>İşlem</th><th>Detay</th></tr></thead><tbody>
      ${list.map((l) => `<tr><td style="white-space:nowrap">${esc(l.created_at)}</td><td><b>${esc(l.username || '-')}</b></td>
        <td><span class="badge">${esc(AD[l.action] || l.action)}</span></td>
        <td style="font-size:12px;color:var(--muted);max-width:420px;overflow:hidden;text-overflow:ellipsis">${esc(l.detail || '')}</td></tr>`).join('')}
    </tbody></table></div></div>`;
}

/* ==========================================================================
   YAZDIRMA
   ========================================================================== */
function printWindow(title, inner) {
  const w = window.open('', '_blank', 'width=900,height=700');
  if (!w) { toast('Tarayıcı yeni pencereyi engelledi. Açılır pencerelere izin verin.', 'warn', 6000); return; }
  w.document.write(`<!DOCTYPE html><html lang="tr"><head><meta charset="utf-8"><title>${title}</title>
    <style>
      *{box-sizing:border-box} body{font-family:"Segoe UI",Arial,sans-serif;margin:0;padding:18px;color:#0f172a;font-size:12.5px}
      h1{font-size:17px;margin:0 0 3px} h2{font-size:14px;margin:0 0 12px;color:#475569;font-weight:600}
      table{width:100%;border-collapse:collapse;margin-top:10px}
      th{background:#f1f5f9;text-align:left;padding:7px 9px;font-size:10.5px;text-transform:uppercase;letter-spacing:.05em;border-bottom:2px solid #cbd5e1}
      td{padding:7px 9px;border-bottom:1px solid #e2e8f0}
      .r{text-align:right} .muted{color:#64748b}
      .head{display:flex;justify-content:space-between;align-items:flex-start;gap:16px;border-bottom:2.5px solid #0b1f3a;padding-bottom:10px;margin-bottom:14px}
      .head-left{display:flex;align-items:center;gap:13px}
      .head-logo{max-width:74px;max-height:56px;object-fit:contain}
      .head-slogan{font-size:11px;color:#64748b;margin:1px 0 3px;letter-spacing:.02em}
      .head-right{text-align:right;font-size:11.5px;line-height:1.5}
      .tick{border:1.5px dashed #94a3b8;border-radius:10px;padding:12px 14px;margin-bottom:10px;page-break-inside:avoid;display:flex;gap:14px}
      .tick .seat{width:62px;flex-shrink:0;text-align:center;border-right:1.5px dashed #cbd5e1;padding-right:12px}
      .tick .seat b{display:block;font-size:26px;line-height:1.1}
      .tick .seat span{font-size:9.5px;color:#64748b;text-transform:uppercase;letter-spacing:.06em}
      .tick .info{flex:1} .tick .info b{font-size:14px}
      .kv{display:flex;flex-wrap:wrap;gap:14px;margin-top:5px;font-size:11.5px;color:#475569}
      .kv i{font-style:normal;color:#94a3b8}
      .foot{margin-top:16px;font-size:10.5px;color:#94a3b8;border-top:1px solid #e2e8f0;padding-top:8px}
      @media print{body{padding:0}@page{margin:12mm}}
    </style></head><body>${inner}
    <script>window.onload=()=>{window.print()}<\/script></body></html>`);
  w.document.close();
}

async function printManifest(tripId) {
  try {
    const d = await api('/trips/' + tripId + '/manifest');
    const t = d.trip, c = d.company;
    const bay = d.passengers.filter((p) => p.gender === 'E').length;
    const inner = `
      ${ciktiBasligi(c, 'YOLCU LİSTESİ')}
      <table style="margin-bottom:6px"><tr>
        <td><b style="font-size:15px">${esc(t.origin)} → ${esc(t.destination)}</b></td>
        <td>${trDate(t.depart_date)} · <b>${t.depart_time}</b></td>
        <td>Plaka: <b>${esc(t.plate)}</b></td>
        <td class="r">Yolcu: <b>${d.passengers.length}</b> / ${t.capacity} (${bay} bay, ${d.passengers.length - bay} bayan)</td>
      </tr></table>
      <table><thead><tr><th style="width:42px">Klt</th><th>Yolcu Adı Soyadı</th><th style="width:52px">Cins.</th>
        <th style="width:100px">Telefon</th><th style="width:100px">T.C. No</th><th>Kafile</th>
        <th style="width:70px" class="r">Ücret</th><th style="width:66px">Tahsilat</th><th style="width:44px">İmza</th></tr></thead><tbody>
        ${d.passengers.map((p) => `<tr>
          <td><b>${p.seat_no}</b></td><td><b>${esc(p.passenger_name)}</b></td>
          <td>${p.gender === 'E' ? 'Bay' : 'Bayan'}</td><td>${esc(p.phone || '')}</td><td>${esc(p.tc_no || '')}</td>
          <td class="muted">${esc(p.group_name || '')}</td><td class="r">${TL0(p.price)}</td>
          <td>${p.payment_status === 'odendi' ? 'Ödendi' : p.payment_status === 'kismi' ? 'Kısmi' : 'Ödenmedi'}</td><td></td></tr>`).join('')}
      </tbody></table>
      <div class="foot">Bu liste ${new Date().toLocaleString('tr-TR')} tarihinde oluşturulmuştur. Kaptan / görevli imzası: ______________________</div>`;
    printWindow('Yolcu Listesi', inner);
  } catch (ex) { toast(ex.message, 'err'); }
}

async function printTickets(ids, silentIfEmpty) {
  if (!ids || !ids.length) return;
  try {
    const [tickets, s] = await Promise.all([Promise.all(ids.map((id) => api('/tickets/' + id))), api('/settings')]);
    const c = s.company;
    const inner = `
      ${ciktiBasligi(c, 'YOLCU BİLETİ')}
      ${tickets.map((t) => `<div class="tick">
        <div class="seat"><b>${t.seat_no}</b><span>Koltuk</span></div>
        <div class="info">
          <b>${esc(t.passenger_name)}</b> <span class="muted">(${t.gender === 'E' ? 'Bay' : 'Bayan'})</span>
          <div style="font-size:13px;margin-top:3px"><b>${esc(t.origin)} → ${esc(t.destination)}</b> · ${trDate(t.depart_date)} · <b>${t.depart_time}</b></div>
          <div class="kv">
            <span><i>PNR:</i> <b>${esc(t.pnr)}</b></span>
            <span><i>Plaka:</i> ${esc(t.plate)}</span>
            ${t.phone ? `<span><i>Tel:</i> ${esc(t.phone)}</span>` : ''}
            ${t.tc_no ? `<span><i>T.C.:</i> ${esc(t.tc_no)}</span>` : ''}
            ${t.group_name ? `<span><i>Kafile:</i> ${esc(t.group_name)}</span>` : ''}
            <span><i>Ücret:</i> <b>${TL(t.price)}</b></span>
            <span><i>Durum:</i> ${t.status === 'rezerve' ? 'OPSİYON' : 'SATILDI'} / ${t.payment_status === 'odendi' ? 'ÖDENDİ' : t.payment_status === 'kismi' ? 'KISMİ' : 'ÖDENMEDİ'}</span>
          </div>
          <div class="kv" style="font-size:10.5px"><span>Düzenleyen: ${esc(t.sold_by_name || '')}${t.agency_name ? ' — ' + esc(t.agency_name) : ''} · ${esc(t.created_at)}</span></div>
        </div></div>`).join('')}
      <div class="foot">${esc(c.ticket_note || '')}${c.tax_info ? `<div style="margin-top:3px">${esc(c.tax_info)}</div>` : ''}</div>`;
    printWindow('Bilet', inner);
  } catch (ex) { if (!silentIfEmpty) toast(ex.message, 'err'); }
}

/* ==========================================================================
   YÖNLENDİRİCİ
   ========================================================================== */
const TITLES = { panel: 'Panel', seferler: 'Seferler & Satış', sefer: 'Koltuk Haritası', biletler: 'Biletler',
  kafileler: 'Kafileler', kafile: 'Kafile Detayı', raporlar: 'Raporlar', otobusler: 'Otobüsler',
  guzergahlar: 'Güzergahlar', kullanicilar: 'Kullanıcılar', ayarlar: 'Ayarlar', kayitlar: 'İşlem Kayıtları',
  binis: 'Biniş Kontrolü', bildirimler: 'Gönderim Kayıtları', cop: 'Çöp Kutusu' };

/* ==========================================================================
   SAYFA: ÇÖP KUTUSU
   ========================================================================== */
async function pageCopKutusu() {
  loading();
  const d = await api('/trash');
  const list = d.items || [];
  S.copSayisi = list.length;

  view().innerHTML = `
    <div class="page-head">
      <div class="t"><h3>Çöp Kutusu</h3>
        <p>Silinen kayıtlar burada ${d.saklama_gun} gün bekler. Yanlışlıkla sildiyseniz tek tıkla geri alabilirsiniz.</p></div>
      ${list.length ? `<button class="btn btn-danger-soft" id="emptyAll">${svg('trash', 16)} Çöp kutusunu boşalt</button>` : ''}
    </div>

    <div class="info-box" style="margin-bottom:16px">${svg('info', 18)}
      <div><b>Nasıl çalışır?</b> Sistemde bir şey sildiğinizde hemen yok olmaz, buraya gelir.
      ${d.saklama_gun} gün içinde <b>Geri al</b> derseniz her şey (bağlı biletler dahil) aynen yerine döner.
      Süre dolunca kendiliğinden temizlenir.</div>
    </div>

    ${list.length ? `<div class="card"><div class="table-wrap"><table class="tbl"><thead><tr>
      <th>Tür</th><th>Ne silindi</th><th>Birlikte gidenler</th><th>Silen</th><th>Ne zaman</th><th>Kalan süre</th><th></th>
    </tr></thead><tbody>
      ${list.map((x) => `<tr>
        <td><span class="badge badge-violet">${esc(x.tur)}</span></td>
        <td><b>${esc(x.label)}</b></td>
        <td style="font-size:12.5px;color:var(--muted)">${esc(x.summary || '—')}</td>
        <td style="font-size:12.5px">${esc(x.deleted_by_name || '—')}</td>
        <td style="white-space:nowrap;font-size:12.5px">${esc(x.deleted_at)}</td>
        <td><span class="badge ${x.kalan_gun <= 3 ? 'badge-red' : x.kalan_gun <= 7 ? 'badge-amber' : 'badge-green'}">${x.kalan_gun} gün</span></td>
        <td class="num"><div class="row-actions">
          <button class="btn btn-primary btn-sm" onclick="copGeriAl(${x.id})">${svg('undo', 14)} Geri al</button>
          <button class="btn btn-icon btn-danger-soft" title="Kalıcı olarak sil" onclick="copKaliciSil(${x.id})">${svg('trash', 15)}</button>
        </div></td>
      </tr>`).join('')}
    </tbody></table></div></div>`
    : `<div class="card">${emptyBox('Çöp kutusu boş', 'Sildiğiniz kayıtlar burada görünür ve geri alınabilir.')}</div>`}`;

  const btn = document.getElementById('emptyAll');
  if (btn) btn.onclick = async () => {
    const onay = await confirmBox(
      'Çöp kutusu tamamen boşaltılsın mı?',
      `${list.length} kayıt kalıcı olarak silinecek. Bu işlemin geri dönüşü YOKTUR.`,
      'Evet, kalıcı olarak sil');
    if (!onay) return;
    try { const r = await api('/trash/empty', { method: 'POST' }); toast(`${r.count} kayıt kalıcı olarak silindi.`); pageCopKutusu(); copSayisiniTazele(); }
    catch (ex) { toast(ex.message, 'err'); }
  };
}

async function copGeriAl(id) {
  try {
    const r = await api('/trash/' + id + '/restore', { method: 'POST' });
    toast(`${r.tur} geri alındı: ${r.label}`);
    pageCopKutusu(); copSayisiniTazele();
  } catch (ex) { toast(ex.message, 'err', 8000); }
}

async function copKaliciSil(id) {
  const onay = await confirmBox(
    'Kalıcı olarak silinsin mi?',
    'Bu kayıt tamamen yok edilecek ve bir daha geri alınamayacak.',
    'Evet, kalıcı olarak sil');
  if (!onay) return;
  try { await api('/trash/' + id, { method: 'DELETE' }); toast('Kalıcı olarak silindi.'); pageCopKutusu(); copSayisiniTazele(); }
  catch (ex) { toast(ex.message, 'err'); }
}

async function router() {
  const parts = (location.hash || '#/panel').replace(/^#\//, '').split('/');
  const page = parts[0] || 'panel';
  const arg = parts[1];
  document.getElementById('pageTitle').textContent = TITLES[page] || 'Panel';
  markNav(page);
  const adminPages = ['otobusler', 'guzergahlar', 'kullanicilar', 'kayitlar', 'bildirimler', 'cop'];
  if (adminPages.includes(page) && S.user.role !== 'admin') { toast('Bu sayfa için yetkiniz yok.', 'err'); location.hash = '#/panel'; return; }
  try {
    switch (page) {
      case 'panel': return await pagePanel();
      case 'seferler': return await pageSeferler();
      case 'sefer': return await pageSefer(+arg);
      case 'binis': return arg ? await pageBinis(+arg) : await pageBinisListe();
      case 'biletler': return await pageBiletler();
      case 'kafileler': return await pageKafileler();
      case 'kafile': return await pageKafile(+arg);
      case 'raporlar': return await pageRaporlar();
      case 'otobusler': return await pageOtobusler();
      case 'guzergahlar': return await pageGuzergahlar();
      case 'kullanicilar': return await pageKullanicilar();
      case 'ayarlar': return await pageAyarlar();
      case 'bildirimler': return await pageBildirimler();
      case 'kayitlar': return await pageKayitlar();
      case 'cop': return await pageCopKutusu();
      default: location.hash = '#/panel';
    }
  } catch (ex) {
    view().innerHTML = `<div class="card">${emptyBox('Sayfa yüklenemedi', ex.message)}</div>`;
    toast(ex.message, 'err');
  }
}

/* ==========================================================================
   BAŞLATMA
   ========================================================================== */
(async function init() {
  if (!token()) { location.href = '/'; return; }
  try {
    S.user = await api('/me');
    const s = await api('/settings').catch(() => ({ company: { name: 'REZERVASYON' } }));
    S.company = s.company;
  } catch { localStorage.clear(); location.href = '/'; return; }

  const theme = localStorage.getItem('theme') || 'light';
  document.documentElement.setAttribute('data-theme', theme);

  uygulaMarka();
  document.getElementById('whoName').textContent = S.user.full_name;
  document.getElementById('whoRole').textContent = S.user.role === 'admin' ? 'Yönetici' : (S.user.agency_name || 'Acente');
  document.getElementById('avatar').textContent = S.user.full_name.split(' ').map((x) => x[0]).slice(0, 2).join('').toLocaleUpperCase('tr-TR');
  document.title = (S.company.name || 'Otobüs') + ' — Rezervasyon';

  renderNav();
  renderBottomNav();
  liveConnect();

  if (S.user.weak_password) {
    setTimeout(() => toast('Güvenlik: varsayılan şifreyi kullanıyorsunuz. Ayarlar sayfasından değiştirin.', 'warn', 9000), 1200);
  }

  document.getElementById('logoutBtn').onclick = async () => {
    if (!await confirmBox('Çıkış yap', 'Oturumunuzu kapatmak istediğinize emin misiniz?', 'Çıkış yap', false)) return;
    await api('/logout', { method: 'POST', body: '{}' }).catch(() => {});
    localStorage.clear(); location.href = '/';
  };
  document.getElementById('hamburger').onclick = () => {
    document.getElementById('sidebar').classList.toggle('open');
    document.getElementById('backdrop').classList.toggle('show');
  };
  document.getElementById('backdrop').onclick = closeSidebar;
  document.getElementById('refreshBtn').onclick = () => refreshCurrent();
  document.getElementById('themeBtn').onclick = () => {
    const cur = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', cur);
    localStorage.setItem('theme', cur);
  };

  window.addEventListener('hashchange', router);

  // Sekme tekrar öne geldiğinde tazele (telefonda uygulamayı kapatıp açınca)
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible') return;
    if (!LIVE.es || LIVE.es.readyState === EventSource.CLOSED) liveConnect();
    if (location.hash.startsWith('#/sefer/')) loadSeatmap(+location.hash.split('/')[2], false).catch(() => {});
  });
  window.addEventListener('online', () => { liveConnect(); toast('Bağlantı geri geldi.', 'ok'); });
  window.addEventListener('offline', () => { liveStatus('off', 'çevrimdışı'); toast('İnternet bağlantısı kesildi. Satış yapmayın.', 'err', 8000); });

  router();
  setTimeout(() => karsilamaGoster(false), 700);
})();

/* ==========================================================================
   TELEFONA KURULUM (ana ekrana ekle) & SERVİS ÇALIŞANI
   ========================================================================== */
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  });
}

let kurulumOlayi = null;
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  kurulumOlayi = e;
  if (localStorage.getItem('kurulumGizle') === '1') return;
  if (window.matchMedia('(display-mode: standalone)').matches) return;
  const bar = document.getElementById('installBar');
  if (!bar) return;
  setTimeout(() => { bar.hidden = false; }, 2500);
  document.getElementById('installYes').onclick = async () => {
    bar.hidden = true;
    kurulumOlayi.prompt();
    const sonuc = await kurulumOlayi.userChoice.catch(() => ({}));
    if (sonuc && sonuc.outcome === 'accepted') toast('Uygulama ana ekranınıza eklendi.');
    kurulumOlayi = null;
  };
  document.getElementById('installNo').onclick = () => {
    bar.hidden = true;
    localStorage.setItem('kurulumGizle', '1');
  };
});

window.addEventListener('appinstalled', () => {
  const bar = document.getElementById('installBar');
  if (bar) bar.hidden = true;
});

// Global erişim (satır içi onclick'ler için)
window.ticketModal = ticketModal;
window.closeModal = closeModal;
window.printTickets = printTickets;
window.busModal = busModal;
window.routeModal = routeModal;
window.userModal = userModal;
window.messageModal = messageModal;
window.printManifest = printManifest;
