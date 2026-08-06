# İsimtescil Alan Adını Sisteme Bağlama

Bu rehber, isimtescil.net'ten aldığınız alan adını (`siteniz.com`) otobüs
rezervasyon sisteminize bağlamak içindir.

**Ön şart:** Sistem önce Render'a yüklenmiş ve `xxxx.onrender.com` adresinde
çalışıyor olmalı. Henüz yapmadıysanız önce KURULUM rehberindeki adımları
tamamlayın — alan adı bağlama en son adımdır.

---

## 1. Adım — Render tarafında alan adını tanıtın

1. Render panelinde servisinize tıklayın (`otobus-rezervasyon`)
2. Sol menüden **Settings**
3. Aşağı inip **Custom Domains** bölümünü bulun
4. **+ Add Custom Domain** → `siteniz.com` yazın → Save
5. Aynı işlemi tekrarlayıp `www.siteniz.com` de ekleyin

Render şimdi size eklemeniz gereken DNS kayıtlarını gösterecek ve
"Verifying..." / "DNS update needed" yazacak. Bu normaldir — 2. adımı
yapınca düzelecek. Ekrandaki `xxxx.onrender.com` adresini bir yere not edin.

---

## 2. Adım — İsimtescil'de DNS kayıtlarını girin

1. isimtescil.net → **Üye Girişi**
2. **Domainlerim** → `siteniz.com` yanındaki **Yönet**
3. **DNS Yönetimi** (hosting de aldıysanız: Hybrid Panel → Hostinglere
   Atanmış Domainlerim → domain → DNS → DNS Listesi)

Burada iki kayıt ekleyeceksiniz:

### A kaydı (ana adres)

| Alan | Değer |
|---|---|
| Tür | **A** |
| İsim / Host | `@` (boş bırakılıyorsa boş bırakın) |
| Değer / Hedef | `216.24.57.1` |
| TTL | 3600 (varsayılan) |

### CNAME kaydı (www'lu adres)

| Alan | Değer |
|---|---|
| Tür | **CNAME** |
| İsim / Host | `www` |
| Değer / Hedef | `xxxx.onrender.com` (Render'ın verdiği adres) |
| TTL | 3600 |

### Silinmesi gerekenler

- Listede **AAAA** kaydı varsa **silin**. Render IPv6 kullanmıyor, bu kayıt
  sitenin açılmamasına yol açar.
- `@` veya `www` için **başka bir A / CNAME kaydı** varsa (park sayfası,
  "yapım aşamasında" sayfası) onları da silin. Aynı isimde iki kayıt olamaz.

---

## 3. Adım — Bekleyin ve doğrulayın

DNS değişikliği yayılması **10 dakika ile 1 saat** arası sürer (nadiren
24 saat). Sonra Render → Settings → Custom Domains bölümünde:

- Alan adının yanında **Verified** ✓ yazmalı
- Kısa süre sonra **Certificate Issued** ✓ (ücretsiz SSL, otomatik)

İkisi de yeşil olunca `https://siteniz.com` adresi sisteminizi açacaktır.

---

## Sık yapılan hatalar

**❌ İsimtescil'in "Web Yönlendirme" / "URL Yönlendirme" özelliğini
kullanmayın.** Bu, alan adını çerçeve içinde başka adrese yönlendirir; SSL
sertifikası alınamaz ve girişler bozulur. Yukarıdaki A + CNAME yöntemini
kullanın.

**❌ Nameserver'ları değiştirmeyin.** Alan adının nameserver'ları
isimtescil'de kalmalı (`ns1.isimtescil.net` gibi), aksi halde girdiğiniz DNS
kayıtları hiçbir işe yaramaz. Panelde nameserver kısmı başka bir firmayı
gösteriyorsa DNS kayıtlarını o firmada girmeniz gerekir.

**❌ Sistemde ayar değiştirmenize gerek yok.** Uygulama hangi alan adından
açıldığını kendiliğinden algılar. Bilet bağlantıları, QR kodlar ve WhatsApp
mesajları yeni adresi otomatik kullanır.

---

## Kontrol listesi

- [ ] Render'da site `xxxx.onrender.com` üzerinden açılıyor
- [ ] Render → Custom Domains'e `siteniz.com` ve `www.siteniz.com` eklendi
- [ ] İsimtescil'de A kaydı: `@` → `216.24.57.1`
- [ ] İsimtescil'de CNAME kaydı: `www` → `xxxx.onrender.com`
- [ ] Eski AAAA / park kayıtları silindi
- [ ] Render'da **Verified** ve **Certificate Issued** yeşil
- [ ] `https://siteniz.com` açılıyor, tarayıcıda kilit simgesi görünüyor
