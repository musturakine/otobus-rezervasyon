# Otobüs Rezervasyon ve Satış Sistemi — Kurulum ve Kullanım Rehberi

> Sürüm 1.2 · Ağustos 2026
> Kurulum, telefona ekleme, internete açma ve bilet gönderme — teknik bilgi gerektirmeyen adımlarla.

---

## 1. Kendi bilgisayarınızda çalıştırma (Windows)

Önce burada deneyin. Beğenmezseniz klasörü silmeniz yeterli.

**1. Node.js kurun (bir kereye mahsus)**
[nodejs.org](https://nodejs.org) → yeşil **LTS** butonu → inen `.msi` dosyasını çalıştırın → hep **Next**, sonra **Install**. Bittiğinde bilgisayarı yeniden başlatın.

**2. Zip dosyasını çıkarın**
`otobus-rezervasyon.zip` → sağ tık → **Tümünü Ayıkla** → **Ayıkla**. Açılan klasörlerin içine girin; **`server.js`** dosyasını gördüğünüz klasör doğru klasördür.

**3. O klasörde komut penceresi açın**
Pencerenin üstündeki **adres çubuğuna** tıklayın, yazan yolu silin, yerine `cmd` yazıp **Enter**. Siyah bir pencere açılır.

**4. İki komut yazın**

```
npm install
npm start
```

Birincisi 1–2 dakika sürer ve sadece ilk seferde gerekir.

**5. Tarayıcıdan açın**
`localhost:3000` → kullanıcı adı **admin**, şifre **admin123**

### Dikkat

- **Siyah pencereyi kapatmayın.** Sistem o pencere açıkken çalışır.
- Tekrar açmak için: aynı klasörde `cmd` → `npm start` (`npm install` bir daha gerekmez).
- **"package.json bulunamadı" hatası:** yanlış klasördesiniz. `dir` yazın; listede `package.json` yoksa `cd otobus-rezervasyon` yazıp tekrar deneyin.

---

## 2. Telefonda kullanma

### Aynı Wi-Fi ağındaysanız (test için)

1. Siyah pencereye `ipconfig` yazıp Enter.
2. **IPv4 Adresi** satırını bulun (örn. `192.168.1.25`).
3. Telefonun tarayıcısına `192.168.1.25:3000` yazın.

### Ana ekrana ekleme (uygulama gibi açılması için)

| Telefon | Yapılacak |
|---|---|
| **Android** (Chrome) | Altta çıkan **"Ana ekrana ekleyin"** kutusunda **Ekle**'ye basın. Çıkmazsa sağ üst **⋮** → **Ana ekrana ekle**. |
| **iPhone** (Safari) | Alttaki **paylaş** simgesi → **Ana Ekrana Ekle** → **Ekle**. |

Eklendikten sonra simgeye dokununca tam ekran, adres çubuğu olmadan açılır.

---

## 3. İnternete açma

> **Ücretsiz plan bu iş için uygun değil.** Ücretsiz sunucular 15 dakika işlem olmayınca uykuya geçer ve kalıcı disk vermez — **bilet kayıtlarınız silinebilir.** Gerçek satış için ücretli plan şart.

### Aylık maliyet (Render.com)

| Kalem | Ücret |
|---|---|
| Sunucu (Starter plan) | 7,00 $ |
| 1 GB kalıcı disk | 0,25 $ |
| **Toplam** | **≈ 7,25 $ / ay** |

Fiyatlar Ağustos 2026 itibarıyladır.

### Adımlar

1. **GitHub hesabı açın** — [github.com](https://github.com) → **Sign up**. Ücretsizdir.
2. **Dosyaları yükleyin** — Sağ üst **+** → **New repository** → isim `otobus-rezervasyon` → **Private** → **Create**. Açılan sayfada **"uploading an existing file"** bağlantısına tıklayın. Zip'i çıkardığınız klasördeki **tüm dosya ve klasörleri** seçip (Ctrl+A) tarayıcıya sürükleyin → **Commit changes**.
3. **Render hesabı açın** — [render.com](https://render.com) → **Get Started** → GitHub ile devam edin.
4. **Yayına alın** — **New +** → **Blueprint** → deponuzu seçin. Projedeki `render.yaml` sayesinde tüm ayarlar kendiliğinden gelir (Frankfurt bölgesi, kalıcı disk, güvenlik anahtarı). **Apply** deyin.
5. **3–5 dakika bekleyin** — Adresiniz görünür: `https://otobus-rezervasyon-xxxx.onrender.com`
6. **İlk girişte mutlaka:** admin/admin123 ile girin → **Ayarlar**'dan şifrenizi değiştirin → **Kullanıcılar**'dan acentelerinizi ekleyin, demo hesapları (acente1, acente2) **pasif** yapın.

https (kilit simgesi) Render tarafından otomatik gelir, ayrıca bir şey yapmanız gerekmez.

---

## 4. Günlük kullanım

### Aynı anda birden fazla kişi çalışabilir

Bir acente koltuk sattığı anda, aynı seferi açık tutan diğer tüm terminallerde koltuk haritası **kendiliğinden** güncellenir ve "… koltuk sattı" bildirimi çıkar. Üst çubuktaki yeşil nokta canlı bağlantıyı gösterir. Aynı koltuğun iki kez satılması engellenir.

### Kimin ne göreceği

| Rol | Yetkileri |
|---|---|
| **Yönetici** | Her şey: otobüs/güzergah/sefer tanımlama, kullanıcı ekleme, tüm satışlar ve raporlar, yedek indirme, işlem kayıtları. |
| **Acente** | Bilet satar, kendi sattığı biletleri görür ve düzenler. Başkasının biletine erişemez, tanımlara giremez. |

### Biniş kontrolü (şoför / peron)

Alt menüdeki **Biniş** bölümünden seferi açın; yolcuya dokundukça yeşile döner, "kaç bindi / kaç bekliyor" sayacı güncellenir. Ödemesi olmayanlar kırmızı **ÖDENMEDİ** etiketiyle görünür.

### Yedekleme

Sistem her gün otomatik yedek alır, son 14 yedeği saklar. **Ayarlar → Yedekleme**'den istediğiniz an yedek indirebilirsiniz. **Ayda bir yedek indirip kendi bilgisayarınızda saklamanız önerilir.**

---

## 5. Kendi alan adınızı alma ve bağlama

Render size `firmaadi.onrender.com` gibi ücretsiz bir adres verir; bu çalışır ve güvenlidir. Kendi adresinizi isterseniz:

> **Kural değişti:** Eskiden `.com.tr` için marka tescili veya ticaret sicil belgesi isteniyordu. TRABİS sistemine geçişle bu zorunluluk kalktı; artık **"ilk gelen alır"** kuralı geçerli. Ad, soyad, adres, e-posta ve telefon yeterli.

### Hangi uzantı?

| Uzantı | Yıllık ücret (yaklaşık) | Kimler için |
|---|---|---|
| **.com.tr** | 1,5–3 $ civarından başlıyor | Yurt içinde çalışan firmalar için en mantıklısı |
| **.com** | ≈ 12 $ | Uluslararası görünüm; kısa isimlerin çoğu dolu |
| **.tr** | ≈ 2,5–3 $ | Yeni ve kısa uzantı, uygun isim bulma şansı yüksek |

> **Fiyatlarda tek dikkat edilecek şey:** ilk yıl fiyatı ile **yenileme fiyatı** genelde farklıdır. İlk yıl 1 $ olup ikinci yıl 15 $ olan kampanyalar yaygındır — satın alırken yenileme ücretini kontrol edin. Fiyatlar KDV hariçtir.

**Nereden alınır:** İsimtescil, Natro, IHS, İnetmar, Turhost, Daha.net — hepsi aynı işi yapar.

**İsim seçerken:** telefonda söylendiğinde yazılabilecek kadar basit olsun, Türkçe karakter kullanmayın, kısa tutun, tire ve rakamdan kaçının.

### Render'a bağlama

1. Render'da servisiniz → **Settings** → **Custom Domains** → **Add Custom Domain**
2. Adresinizi yazın (örn. `bilet.ozseyahat.com.tr`). Render size bir **CNAME değeri** verir.
3. Alan adını aldığınız firmanın panelinde **DNS Yönetimi**'ne girin.
4. Yeni kayıt: Tür **CNAME**, Ad **bilet**, Değer olarak Render'ın verdiği adres.
5. 15 dakika–2 saat içinde aktifleşir. https sertifikası otomatik kurulur.

> **Öneri:** ana adresi (`ozseyahat.com.tr`) ileride tanıtım siteniz için saklayın; rezervasyon sistemini `bilet.` ön ekiyle bağlayın.

---

## 6. Yolcuya bilet gönderme (WhatsApp / SMS)

Bilet ekranındaki **Bilet gönder** düğmesiyle yolcuya koltuk, PNR ve sefer bilgisi iletilir.

### WhatsApp — bugün kullanabilirsiniz, ücretsiz

Hiçbir abonelik gerekmez. Düğmeye bastığınızda WhatsApp, mesaj hazır yazılmış hâlde açılır; siz sadece **Gönder**'e basarsınız. Acentenin kendi WhatsApp hesabından gider. Bilgisayarda WhatsApp Web, telefonda uygulama açılır.

### Otomatik SMS (isteğe bağlı, ücretli)

Bilet kesildiği anda SMS'in kendiliğinden gitmesi için bir SMS servisine abone olmanız gerekir.

| Servis | Notlar |
|---|---|
| **Netgsm** | Türkiye'de yaygın. Kullanıcı numarası, API şifresi ve onaylı SMS başlığı istenir. |
| **İletiMerkezi** | API Key + Hash ile çalışır. |
| **Twilio** | Yurt dışı kaynaklı, dolar üzerinden. Genelde daha pahalı. |
| **Özel servis** | Başka sağlayıcı kullanıyorsanız kendi adresinizi tanımlayabilirsiniz. |

**Kurulumu:**

1. Servise abone olun, **SMS başlığı** (gönderici adı, örn. OZSEYAHAT) onayı alın. Onay 1–3 gün sürebilir.
2. **Ayarlar → Bildirimler**'den servisi seçin, bilgileri girin, **Kaydet**.
3. **Deneme SMS'i gönder** ile kendi numaranıza test atın.
4. Çalıştığını gördükten sonra **"Satış sonrası otomatik SMS"** seçeneğini açın.

> **SMS ücretlerinde dikkat:** Bir SMS 160 karakterdir. Türkçe karakter (ş, ı, ğ) kullanırsanız bu sınır **70 karaktere** düşer ve 2–3 kat ücret ödersiniz. Bu yüzden **"Türkçe karakterleri sadeleştir"** seçeneği açık gelir — mesaj "Sayin Ayse Yilmaz" şeklinde gider ama tek SMS olur.

**Gönderim Kayıtları** sayfasından hangi mesajın kime gittiğini, gitmediyse sebebini görebilirsiniz.

---

## 7. Sık karşılaşılan durumlar

| Durum | Ne yapmalı |
|---|---|
| Şifremi unuttum | Yönetici, **Kullanıcılar**'dan o kişiye yeni şifre verebilir. Yönetici şifresi unutulursa sunucudaki veritabanından sıfırlanması gerekir — **yönetici şifresini güvenli bir yere not edin.** |
| "Çok fazla hatalı giriş" uyarısı | Güvenlik koruması devreye girdi. 15 dakika sonra kendiliğinden açılır. |
| "Koltuk az önce satıldı" | Başka terminal sizden önce satmış. Harita kendiliğinden güncellenir, başka koltuk seçin. |
| Yan koltuğa bayan/bay satamıyorum | Yabancı bay–bayan yan yana oturamaz. Aile/grup ise **Kafile / grup satışı** kutusunu işaretleyin. |
| Telefonda "bağlantı yok" ekranı | İnternet kesilmiştir. Gelince kendiliğinden kapanır. Bağlantı yokken satış yapılamaz — aynı koltuğun iki kez satılmasını önlemek için. |
| Sistemi güncellemek istiyorum | GitHub'daki dosyaları yenileyin; Render kendiliğinden yeniden yayınlar. Verileriniz silinmez. |

---

## Demo hesaplar

| Rol | Kullanıcı adı | Şifre |
|---|---|---|
| Yönetici | `admin` | `admin123` |
| Acente | `acente1` | `acente123` |
| Acente | `acente2` | `acente123` |

**İlk iş:** admin şifresini değiştirin ve demo acente hesaplarını pasif yapın.
