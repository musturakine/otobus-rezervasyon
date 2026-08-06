'use strict';
/**
 * Bilet bildirimleri — SMS ve WhatsApp.
 *
 * İki çalışma şekli vardır:
 *  1) WhatsApp bağlantısı  : hiçbir abonelik gerektirmez. Arayüzde "WhatsApp'tan gönder"
 *                            düğmesi, hazır yazılmış mesajla WhatsApp'ı açar. Ücretsizdir.
 *  2) Otomatik SMS         : Netgsm / İletimerkezi / Twilio gibi bir servise abone olup
 *                            bilgilerini Ayarlar'a girdiğinizde, satış anında mesaj kendiliğinden gider.
 */

const { db } = require('./db');

/* ---------------------------- Telefon numarası ---------------------------- */
/** Türkiye numaralarını 905XXXXXXXXX biçimine çevirir. Geçersizse null döner. */
function normalizePhone(raw) {
  if (!raw) return null;
  let d = String(raw).replace(/\D/g, '');
  if (d.startsWith('0090')) d = d.slice(4);
  else if (d.startsWith('90') && d.length === 12) d = d.slice(2);
  else if (d.startsWith('0') && d.length === 11) d = d.slice(1);
  if (d.length !== 10 || d[0] !== '5') return null;   // cep telefonu 5 ile başlar
  return '90' + d;
}
const localPhone = (p) => {
  const n = normalizePhone(p);
  return n ? '0' + n.slice(2) : null;
};

/* ---------------------------- Mesaj şablonu ---------------------------- */
const VARSAYILAN_SABLON =
  'Sayin {ad}, {tarih} {saat} {kalkis}-{varis} seferi biletiniz hazir. ' +
  'Koltuk: {koltuk}, PNR: {pnr}, Plaka: {plaka}. Iyi yolculuklar. {firma}';

/** Türkçe karakterleri sadeleştirir — SMS'te karakter tasarrufu sağlar (1 SMS = 160 hane). */
function sadelestir(s) {
  const m = { ç: 'c', Ç: 'C', ğ: 'g', Ğ: 'G', ı: 'i', İ: 'I', ö: 'o', Ö: 'O', ş: 's', Ş: 'S', ü: 'u', Ü: 'U' };
  return String(s).replace(/[çÇğĞıİöÖşŞüÜ]/g, (c) => m[c]);
}

function renderTemplate(sablon, veri, sadeMi) {
  const out = String(sablon || VARSAYILAN_SABLON).replace(/\{(\w+)\}/g, (_, k) =>
    veri[k] === undefined || veri[k] === null ? '' : String(veri[k]));
  return sadeMi ? sadelestir(out) : out;
}

/** Bilet kaydından şablon değişkenlerini üretir */
function ticketVars(t, firma) {
  const [y, m, d] = String(t.depart_date || '').split('-');
  return {
    ad: t.passenger_name,
    pnr: t.pnr,
    koltuk: t.seat_no,
    kalkis: t.origin,
    varis: t.destination,
    tarih: d && m && y ? `${d}.${m}.${y}` : t.depart_date,
    saat: t.depart_time,
    plaka: t.plate || '',
    fiyat: Number(t.price || 0).toLocaleString('tr-TR') + ' TL',
    firma: (firma && firma.name) || '',
    telefon: (firma && firma.phone) || ''
  };
}

/* ---------------------------- Ayarlar ---------------------------- */
const VARSAYILAN_AYAR = {
  saglayici: 'kapali',           // kapali | netgsm | iletimerkezi | twilio | ozel
  otomatik: false,               // satış sonrası kendiliğinden gönder
  baslik: '',                    // SMS başlığı (onaylı gönderici adı)
  sablon: VARSAYILAN_SABLON,
  sade_turkce: true,
  whatsapp_aktif: true,          // arayüzdeki WhatsApp düğmesi
  whatsapp_sablon: 'Sayın {ad}, {tarih} {saat} {kalkis} - {varis} seferi biletiniz hazır.\nKoltuk: {koltuk}\nPNR: {pnr}\nPlaka: {plaka}\nİyi yolculuklar dileriz.\n{firma}',
  // sağlayıcı bilgileri
  kullanici: '', sifre: '', anahtar: '', gizli: '', gonderen: '',
  adres: ''                      // özel/webhook veya sağlayıcı adresi (boş = varsayılan)
};

function getSmsSettings() {
  const row = db.prepare("SELECT value FROM settings WHERE key='sms'").get();
  return { ...VARSAYILAN_AYAR, ...(row ? JSON.parse(row.value) : {}) };
}
function saveSmsSettings(obj) {
  const mevcut = getSmsSettings();
  const yeni = { ...mevcut, ...obj };
  db.prepare('INSERT OR REPLACE INTO settings (key,value) VALUES (?,?)').run('sms', JSON.stringify(yeni));
  return yeni;
}
/** Arayüze giderken şifreleri gizle */
function maskSettings(a) {
  const gizle = (v) => (v ? '••••••••' : '');
  return { ...a, sifre: gizle(a.sifre), gizli: gizle(a.gizli), anahtar: a.anahtar ? a.anahtar : '' };
}

/* ---------------------------- Sağlayıcılar ---------------------------- */
const VARSAYILAN_ADRES = {
  netgsm: 'https://api.netgsm.com.tr/sms/rest/v2/send',
  iletimerkezi: 'https://api.iletimerkezi.com/v1/send-sms/json'
};

async function istek(url, opts, ms = 15000) {
  const c = new AbortController();
  const t = setTimeout(() => c.abort(), ms);
  try {
    const r = await fetch(url, { ...opts, signal: c.signal });
    const govde = await r.text();
    return { ok: r.ok, status: r.status, body: govde };
  } finally { clearTimeout(t); }
}

async function gonderNetgsm(a, telefon, metin) {
  const url = a.adres || VARSAYILAN_ADRES.netgsm;
  const kimlik = Buffer.from(`${a.kullanici}:${a.sifre}`).toString('base64');
  const r = await istek(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Basic ' + kimlik },
    body: JSON.stringify({
      msgheader: a.baslik || a.gonderen,
      encoding: 'TR',
      messages: [{ msg: metin, no: telefon.slice(2) }]  // Netgsm 5XXXXXXXXX bekler
    })
  });
  let ref = null, hata = null;
  try {
    const j = JSON.parse(r.body);
    ref = j.jobid || j.jobID || (j.data && j.data.jobid) || null;
    if (j.code && String(j.code) !== '00' && String(j.code) !== '0') hata = `Netgsm kodu ${j.code}: ${j.description || ''}`;
  } catch { if (!r.ok) hata = 'Beklenmeyen yanıt: ' + r.body.slice(0, 200); }
  if (!r.ok && !hata) hata = `HTTP ${r.status}: ${r.body.slice(0, 200)}`;
  if (hata) throw new Error(hata);
  return ref;
}

async function gonderIletimerkezi(a, telefon, metin) {
  const url = a.adres || VARSAYILAN_ADRES.iletimerkezi;
  const r = await istek(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      request: {
        authentication: { key: a.anahtar, hash: a.gizli },
        order: {
          sender: a.baslik || a.gonderen,
          iys: '0',                       // bilgilendirme mesajı
          message: { text: metin, receipents: { number: [telefon] } }
        }
      }
    })
  });
  let ref = null;
  try {
    const j = JSON.parse(r.body);
    const kod = j.response && j.response.status && j.response.status.code;
    if (String(kod) !== '200') throw new Error(`İletiMerkezi kodu ${kod}: ${j.response.status.message}`);
    ref = j.response.order && j.response.order.id;
  } catch (e) {
    if (e.message.startsWith('İletiMerkezi')) throw e;
    throw new Error(`HTTP ${r.status}: ${r.body.slice(0, 200)}`);
  }
  return ref;
}

async function gonderTwilio(a, telefon, metin) {
  const sid = a.kullanici, token = a.sifre;
  const url = `https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(sid)}/Messages.json`;
  const govde = new URLSearchParams({ To: '+' + telefon, From: a.gonderen, Body: metin });
  const r = await istek(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: 'Basic ' + Buffer.from(`${sid}:${token}`).toString('base64')
    },
    body: govde.toString()
  });
  const j = JSON.parse(r.body || '{}');
  if (!r.ok) throw new Error(j.message || `HTTP ${r.status}`);
  return j.sid || null;
}

async function gonderOzel(a, telefon, metin) {
  if (!a.adres) throw new Error('Özel servis için adres (URL) girilmemiş.');
  const r = await istek(a.adres, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(a.gizli ? { Authorization: 'Bearer ' + a.gizli } : {}) },
    body: JSON.stringify({ phone: telefon, text: metin, sender: a.baslik || a.gonderen })
  });
  if (!r.ok) throw new Error(`HTTP ${r.status}: ${r.body.slice(0, 200)}`);
  return null;
}

const SAGLAYICILAR = {
  netgsm: gonderNetgsm,
  iletimerkezi: gonderIletimerkezi,
  twilio: gonderTwilio,
  ozel: gonderOzel
};

/* ---------------------------- Gönderim ---------------------------- */
/** Tek bir mesajı gönderir ve kaydını tutar. Hata fırlatmaz, sonucu döner. */
async function sendSms({ ticket_id, phone, text, user_id }) {
  const a = getSmsSettings();
  const tel = normalizePhone(phone);
  const kayit = db.prepare(
    `INSERT INTO messages (ticket_id, phone, channel, body, status, provider, created_by)
     VALUES (?,?,?,?,?,?,?)`
  ).run(ticket_id || null, phone || '', 'sms', text, 'bekliyor', a.saglayici, user_id || null);
  const id = kayit.lastInsertRowid;

  const bitir = (durum, hata, ref) => {
    db.prepare("UPDATE messages SET status=?, error=?, provider_ref=?, sent_at=datetime('now','localtime') WHERE id=?")
      .run(durum, hata || null, ref || null, id);
    return { id, ok: durum === 'gonderildi', error: hata || null };
  };

  if (a.saglayici === 'kapali') return bitir('hata', 'SMS gönderimi kapalı. Ayarlar → Bildirimler bölümünden açın.');
  if (!tel) return bitir('hata', 'Geçersiz cep telefonu numarası: ' + (phone || 'boş'));
  if (!SAGLAYICILAR[a.saglayici]) return bitir('hata', 'Tanımsız servis: ' + a.saglayici);
  if (!a.baslik && !a.gonderen) return bitir('hata', 'SMS başlığı (gönderici adı) girilmemiş.');

  try {
    const ref = await SAGLAYICILAR[a.saglayici](a, tel, text);
    return bitir('gonderildi', null, ref);
  } catch (e) {
    return bitir('hata', e.message.slice(0, 400));
  }
}

/** Bilet için mesaj metnini üretir (SMS veya WhatsApp) */
function buildTicketMessage(ticket, firma, kanal) {
  const a = getSmsSettings();
  const veri = ticketVars(ticket, firma);
  return kanal === 'whatsapp'
    ? renderTemplate(a.whatsapp_sablon, veri, false)
    : renderTemplate(a.sablon, veri, a.sade_turkce);
}

/** WhatsApp'ta açılacak hazır bağlantı (abonelik gerekmez) */
function whatsappLink(phone, text) {
  const tel = normalizePhone(phone);
  if (!tel) return null;
  return `https://wa.me/${tel}?text=${encodeURIComponent(text)}`;
}

module.exports = {
  normalizePhone, localPhone, renderTemplate, ticketVars,
  getSmsSettings, saveSmsSettings, maskSettings, VARSAYILAN_AYAR, VARSAYILAN_SABLON,
  sendSms, buildTicketMessage, whatsappLink, sadelestir
};
