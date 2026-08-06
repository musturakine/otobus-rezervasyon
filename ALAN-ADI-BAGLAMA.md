# turakine.com.tr Adresini Sisteme Bağlama

Bu rehber size özel hazırlandı. Gerçek adresleriniz yazılı, örnek değil.

**Sisteminizin şu anki adresi:** https://otobus-rezervasyon.onrender.com
**Bağlayacağımız adres:** turakine.com.tr

---

## 1. BÖLÜM — Render tarafı

1. Render'da sisteminizin sayfasını açın (`otobus-rezervasyon`)
2. Sol menüden **Settings**
3. Sayfayı aşağı kaydırın, **Custom Domains** bölümünü bulun
4. **+ Add Custom Domain** butonuna basın
5. Kutuya şunu yazın ve kaydedin:

   ```
   turakine.com.tr
   ```

6. Tekrar **+ Add Custom Domain** basın, bu sefer şunu yazın:

   ```
   www.turakine.com.tr
   ```

Kaydettikten sonra Render iki adresin de yanında turuncu/gri renkte
**"DNS update needed"** veya **"Verifying"** yazacak.

**Bu normaldir, hata değildir.** 2. bölümü yapınca yeşile dönecek.

---

## 2. BÖLÜM — İsimtescil tarafı

1. isimtescil.net'te **Domainlerim** listesinde `turakine.com.tr` satırını bulun
2. Satırın en sağındaki **dişli (⚙) simgesine** tıklayın
3. Açılan menüden **DNS Yönetimi** (veya "DNS Ayarları") seçin

Şimdi iki kayıt ekleyeceksiniz.

### 1. Kayıt — A kaydı

| Kutu adı | Yazılacak |
|---|---|
| Tür / Type | **A** |
| İsim / Host / Alan Adı | `@` — kabul etmezse boş bırakın |
| Değer / Hedef / IP | `216.24.57.1` |
| TTL | 3600 (varsayılan kalsın) |

**Kaydet** deyin.

### 2. Kayıt — CNAME kaydı

| Kutu adı | Yazılacak |
|---|---|
| Tür / Type | **CNAME** |
| İsim / Host | `www` |
| Değer / Hedef | `otobus-rezervasyon.onrender.com` |
| TTL | 3600 (varsayılan kalsın) |

**Kaydet** deyin.

> Hedefi yazarken başına `https://` KOYMAYIN. Sonuna nokta koymanız
> gerekebilir, panel kendi ekliyorsa karışmayın.

### Silinecekler

Listede şunlar varsa **silin**:

- Herhangi bir **AAAA** kaydı
- `@` veya `www` için **zaten var olan** başka A / CNAME kaydı
  (genelde isimtescil'in park sayfasına gider)

Aynı isimde iki kayıt olamaz, eskisi durursa yenisi çalışmaz.

---

## 3. BÖLÜM — Bekleme

DNS değişikliğinin yayılması **10 dakika – 1 saat** sürer.

Render → Settings → Custom Domains sayfasını arada bir yenileyin:

- `turakine.com.tr` → **Verified** ✓
- Biraz sonra → **Certificate Issued** ✓ (ücretsiz SSL, kendiliğinden)

İkisi de yeşil olunca **https://turakine.com.tr** sisteminizi açacak.

---

## Dikkat edilecekler

**❌ "Web Yönlendirme" / "URL Yönlendirme" kullanmayın.**
İsimtescil panelinde böyle bir menü var ve kolay görünüyor. Ama o yöntemle
SSL sertifikası alınamaz, güvenli bağlantı olmaz, girişler bozulur.
Yukarıdaki A + CNAME yöntemi doğru olan.

**❌ Nameserver'ları değiştirmeyin.**
Alan adının nameserver'ları isimtescil'de kalmalı. Değiştirirseniz
girdiğiniz DNS kayıtları işe yaramaz.

**✅ Sistemde ayar yapmanıza gerek yok.**
Program hangi adresten açıldığını kendisi anlıyor. Biletler, QR kodlar ve
WhatsApp mesajları yeni adresi otomatik kullanacak.

**ℹ️ Eski adres de çalışmaya devam eder.**
`otobus-rezervasyon.onrender.com` kapanmaz. Yedek olarak elinizde kalır.

---

## Kontrol listesi

- [ ] Render → Custom Domains'e `turakine.com.tr` eklendi
- [ ] Render → Custom Domains'e `www.turakine.com.tr` eklendi
- [ ] İsimtescil'de A kaydı: `@` → `216.24.57.1`
- [ ] İsimtescil'de CNAME kaydı: `www` → `otobus-rezervasyon.onrender.com`
- [ ] Eski AAAA / park kayıtları silindi
- [ ] Render'da **Verified** yeşil
- [ ] Render'da **Certificate Issued** yeşil
- [ ] https://turakine.com.tr açılıyor, adres çubuğunda kilit simgesi var

---

## Bundan sonra yapılacak (unutmayın)

Sistem artık internete açık. Gerçek kullanıma geçmeden önce:

- [ ] Yönetici şifresini değiştirin
- [ ] Demo hesaplarını kapatın
- [ ] Kendi acente kullanıcılarınızı ekleyin
