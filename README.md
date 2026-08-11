# 🚌 Otobüs Koltuk, Kafile Rezervasyon ve Satış Sistemi

İnternet üzerinden çalışan, telefondan ve bilgisayardan kullanılabilen, yetkili kişilerin
giriş yaparak bilet satabildiği tam kapsamlı rezervasyon sistemi.

---

> **Kurulum için** `KURULUM.html` dosyasını tarayıcıda açın.
> **Sistemi güncellerken** `GUNCELLEME.md` dosyasını okuyun — dosya atlanmasını önleyen
> güvenli yöntem orada anlatılıyor.

---

## Neler var?

**Kendi kendini denetleyen kurulum (yeni)**

- `/durum` adresi, **her dosyanın sunucuya doğru yüklenip yüklenmediğini** gösterir —
  güncellemeden sonra tek bakışta doğrulama
- Bir dosya eksik yüklenirse site **artık komple kapanmıyor**: sorunu anlatan bir sayfa
  gösteriyor ve **personel girişi çalışmaya devam ediyor**, satış durmuyor
- Açılışta konsola hangi dosyanın eksik olduğu ve hangi klasörü yeniden yüklemek
  gerektiği yazılır
- `/saglik` adresi sürümü ve eksik dosya listesini JSON olarak döner
- Güvenli güncelleme yöntemi için → **`GUNCELLEME.md`**

**Herkese açık sefer sayfası (yeni)**

- Sitenin ana sayfası artık **müşteriye açık**: `siteniz.com` adresine giren herkes
  sefer saatlerini, fiyatları ve **koltuk doluluğunu** görebilir
- Koltuk planında hangi koltuğun boş, hangisinin bay/bayan dolu olduğu görünür —
  **yolcu adı, telefon, T.C. ve PNR bilgisi ASLA paylaşılmaz**
- Ziyaretçi hiçbir şey satın alamaz, değiştiremez, silemez; sadece bakar
- "Rezervasyon için arayın" ve **WhatsApp** düğmeleri — müşteri koltuk numarasını söyleyip yer ayırtır
- Satışa kapalı ve geçmiş seferler açık listede görünmez
- Personel girişi `siteniz.com/giris` adresine taşındı

**Orta kapı (yeni)**

- Otobüs tanımında **"orta kapı var mı, kaçıncı sırada"** seçeneği (varsayılan 6. sıra)
- Kapı olan sırada sağdaki 2 koltuk yoktur; kapasite otomatik 2 azalır
- Koltuk numaraları kesintisiz devam eder (… 20, **21, 22 [KAPI]**, 23, 24 …)
- Yan koltuk cinsiyet kuralı kapı sırasında da doğru çalışır
- Satılmış bilet varken orta kapı ayarı **kilitlenir** — koltuk numaraları kaymasın diye

**Silme ve çöp kutusu**

- Sefer, otobüs, güzergah, bilet, kafile, kullanıcı ve bildirim — **her yerde silme** düğmesi
- Silmeden önce **ne gideceği açıkça gösterilir**: "Bu seferle birlikte 1 kafile, 12 bilet de silinecek"
- Hiçbir şey anında yok olmaz: silinen kayıt **çöp kutusuna** gider, **30 gün** boyunca durur
- Silme sonrası ekranda **"Geri al"** düğmesi çıkar — yanlış tıkladıysanız tek hamlede geri gelir
- Geri alındığında **bağlı kayıtlar da aynen döner** (biletler, kafileler, koltuk numaraları, PNR'ler)
- Çöp kutusu ekranından tek tek geri alma, kalıcı silme veya tamamen boşaltma
- Güvenlik kilitleri: kendi hesabınızı silemezsiniz, son yöneticiyi silemezsiniz, acenteler hiçbir şey silemez
- Süresi dolanlar kendiliğinden temizlenir

**Firma kimliği (yeni)**

- **Logo yükleme** — giriş ekranında, sol menüde, biletlerde ve yolcu listelerinde görünür
- Slogan, internet adresi, vergi dairesi/no ve bilet alt yazısı ayarlanabilir
- Yüklenen resim tarayıcıda otomatik küçültülür, sunucuya yük bindirmez

**Ekranda yol gösterme (yeni)**

- İlk girişte **karşılama turu**: "önce güzergah, sonra otobüs, sonra sefer" diye adım adım yönlendirir
- Her ekranın başında **"burada ne yapılır"** açıklaması — okuyup kapatınca bir daha çıkmaz
- Boş ekranlarda ne yapılacağını anlatan **yönlendirme ve düğme** ("İlk otobüsü ekle")
- Ayarlar → Yardım bölümünden tüm açıklamalar geri açılabilir

**Çoklu terminal**

- **Canlı koltuk güncellemesi**: bir acente satış yaptığı anda aynı seferi açık tutan tüm terminallerde
  koltuk haritası kendiliğinden tazelenir, satılan koltuk yanıp söner ve "… koltuk sattı" bildirimi çıkar
- Üst çubukta canlı bağlantı göstergesi ve o an bağlı terminal sayısı
- Bağlantı koparsa otomatik yeniden bağlanma; çevrimdışıyken satış uyarısı

**Telefon uygulaması (yeni)**

- Ana ekrana eklenip tam ekran, uygulama gibi açılır (PWA) — mağazadan indirme gerekmez
- Telefonda alt menü çubuğu, büyütülmüş koltuk dokunma alanları, alttan açılan formlar
- İnternet kesilirse bilgilendirme ekranı; bağlantı gelince kendiliğinden geri döner
- **Biniş kontrol ekranı**: şoför/peron görevlisi yolcuya dokunarak bindi işaretler, sayaç anlık güncellenir

**Satış ve rezervasyon**

- Görsel **2+2 koltuk haritası** (arka 5'li sıra desteğiyle), tıklayarak koltuk seçme
- **Cinsiyet kuralı**: yan yana koltuklara farklı cinsiyette yabancı yolcu satılamaz — sistem otomatik engeller ve arayüzde cinsiyet butonunu kilitler
- **Kafile / grup rezervasyonu**: tek seferde çoklu koltuk, grup adı ve yetkili kişi bilgisi, toplu iptal. Aynı kafile içinde bay–bayan yan yana oturabilir
- **Koltuk kilidi**: iki kullanıcı aynı anda aynı koltuğu satamaz (veritabanı seviyesinde garanti)
- Satıldı / Opsiyon (rezerve) ayrımı, Ödendi / Kısmi / Ödenmedi tahsilat takibi
- Koltuk değiştirme, bilet iptali, bilet düzenleme
- PNR kodu ile bilet arama (ad, telefon, T.C. no ile de aranır)

**Yönetim**

- Otobüs tanımları (plaka, model, sıra sayısı, arka sıra, orta kapı → kapasite otomatik hesaplanır)
- Güzergah tanımları ve sefer planlama (**tek seferde 60 güne kadar tekrarlı sefer oluşturma**)
- Kullanıcı yönetimi: **Yönetici** (tam yetki) ve **Acente** (yalnızca kendi sattığı biletleri görür/düzenler)
- Firma bilgileri (bilet ve yolcu listesi çıktılarında görünür)
- İşlem kayıtları (kim, ne zaman, ne yaptı)

**Çıktı ve raporlar**

- Yazdırılabilir **yolcu listesi (manifest)** — imza sütunlu, kaptana verilecek biçimde
- Yazdırılabilir **yolcu bileti** (tekli veya kafile için toplu)
- Satış raporları: satıcıya, güzergaha ve güne göre kırılım, tahsil edilmemiş biletler listesi

**Arayüz**

- Mobil ve masaüstü uyumlu (telefonda koltuk haritası dahil her şey çalışır)
- Açık / koyu tema
- Tamamen Türkçe

---

## Kurulum

Gereken tek şey **Node.js 18 veya üzeri**. ([nodejs.org](https://nodejs.org) adresinden indirilir.)

```bash
# 1. Klasöre girin
cd otobus-rezervasyon

# 2. Paketleri kurun (bir kez)
npm install

# 3. Başlatın
npm start
```

Tarayıcıdan **http://localhost:3000** adresine gidin.

### Demo hesaplar

| Rol | Kullanıcı adı | Şifre |
|---|---|---|
| Yönetici | `admin` | `admin123` |
| Acente | `acente1` | `acente123` |
| Acente | `acente2` | `acente123` |

> **İlk iş:** Ayarlar sayfasından `admin` şifresini değiştirin ve kendi kullanıcılarınızı oluşturun.

Sistem ilk açılışta örnek otobüsler, güzergahlar ve seferlerle gelir.
Sıfırdan başlamak isterseniz `data/` klasöründeki `otobus.db*` dosyalarını silip yeniden başlatın.

---

## İnternete açma (canlıya alma)

Veriler tek bir SQLite dosyasında (`data/otobus.db`) tutulur — ayrı bir veritabanı sunucusu kurmanız gerekmez.
Sadece bu klasörün **kalıcı disk** üzerinde durduğundan emin olun.

> **Ücretsiz plan uyarısı:** ücretsiz sunucular 15 dakika işlem olmayınca uykuya geçer ve kalıcı disk
> vermez — bilet kayıtlarınız silinebilir. Gerçek satış için ücretli plan (≈ 7,25 $/ay) kullanın.

### Seçenek 1 — Render.com Blueprint (en kolay, tek adım)

Projede hazır bir `render.yaml` vardır. Render'da **New → Blueprint** deyip depoyu seçmeniz yeterli;
bölge (Frankfurt), kalıcı disk, sağlık kontrolü ve rastgele `JWT_SECRET` kendiliğinden ayarlanır.

Elle kurmak isterseniz: **New → Web Service**, Build `npm install`, Start `npm start`,
ortam değişkenleri `JWT_SECRET` + `DATA_DIR=/veri`, ve `/veri` yoluna 1 GB disk.

### Seçenek 1b — Docker

```bash
docker build -t otobus .
docker run -d --name otobus -p 3000:3000 \
  -e JWT_SECRET="uzun-rastgele-bir-metin" \
  -v otobus-veri:/veri otobus
```

### Seçenek 2 — Kendi sunucunuz (VPS)

```bash
npm install
npm install -g pm2
JWT_SECRET="uzun-rastgele-bir-metin" pm2 start server.js --name otobus
pm2 startup && pm2 save
```

Ardından Nginx ile 80/443 portundan yönlendirip **mutlaka SSL (https) kurun** —
Let's Encrypt ücretsizdir. Şifreler ve oturum bilgileri şifresiz bağlantıda güvende olmaz.

### Seçenek 3 — Kendi bilgisayarınız / ofis ağı

`npm start` yeterlidir. Aynı ağdaki telefonlardan bilgisayarınızın yerel IP adresiyle
(`http://192.168.1.x:3000`) girilebilir.

### Ortam değişkenleri

| Değişken | Varsayılan | Açıklama |
|---|---|---|
| `PORT` | `3000` | Sunucu portu |
| `HOST` | `0.0.0.0` | Dinlenecek arayüz |
| `JWT_SECRET` | *(otomatik üretilir)* | Verilmezse rastgele üretilip `data/.oturum-anahtari` dosyasına yazılır. Canlıda kendiniz vermeniz önerilir |
| `DATA_DIR` | `./data` | Veritabanı ve yedeklerin klasörü |
| `NODE_ENV` | `geliştirme` | `production` ise http istekleri https'e yönlendirilir |
| `FORCE_HTTPS` | — | `1` yaparsanız NODE_ENV'den bağımsız https zorlanır |

### Güvenlik özeti

- Şifreler bcrypt ile saklanır, oturumlar imzalı jeton (JWT) ile yürür
- 15 dakikada 8 hatalı girişten sonra o kullanıcı/IP için giriş geçici kilitlenir
- `Content-Security-Policy`, `X-Frame-Options`, `nosniff`, HSTS başlıkları açıktır
- Vekil sunucu arkasında https tespiti yapılır, çerezler https'te `secure` işaretlenir
- Varsayılan şifre kullanılıyorsa arayüzde uyarı gösterilir

Rastgele anahtar üretmek için: `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`

---

## Yedekleme

Tüm veri tek dosyada. Yedek almak için sunucu çalışırken bile:

```bash
cp data/otobus.db data/yedek-$(date +%F).db
```

Günlük otomatik yedek için bu satırı `crontab -e` içine ekleyebilirsiniz.

---

## Testler

Kural ve güvenlik testleri (sunucu çalışırken):

```bash
node test-api.js     # 30 test — satış kuralları
node test-silme.js   # 40 test — silme, çöp kutusu, firma kimliği
node test-acik.js    # 42 test — herkese açık sayfa, orta kapı, gizlilik, kurulum denetimi
```

veya ikisi birden:

```bash
npm test
```

`test-api.js` cinsiyet kuralını, kafile istisnasını, çift satış engelini, eşzamanlı satış
yarışını, rol izolasyonunu ve iptal senaryolarını denetler.

`test-acik.js` orta kapılı koltuk düzenini, herkese açık uçların çalıştığını ve en önemlisi
**dışarıya hiçbir kişisel bilginin sızmadığını** denetler.

`test-silme.js` silme yetkilerini, silme önizlemesini, çöp kutusuna taşımayı, geri almada
bağlı kayıtların (bilet, kafile, sefer) eksiksiz dönüşünü, kalıcı silmeyi ve logo/firma
bilgisi doğrulamalarını denetler.

---

## Klasör yapısı

```
server.js            Sunucu girişi
src/db.js            Veritabanı şeması, koltuk düzeni hesapları, örnek veri
src/auth.js          Giriş, JWT, rol kontrolü
src/api.js           Tüm API uçları (satış, iptal, rapor, tanımlar, silme)
src/trash.js         Çöp kutusu: silme, geri alma, otomatik temizlik
src/durum.js         Kurulum denetimi, /durum sayfası, eksik dosya koruması
public/anasayfa.html Herkese açık sefer ve koltuk sayfası
public/index.html    Personel giriş ekranı (/giris)
public/app.html      Uygulama kabuğu
public/js/app.js     Arayüz (koltuk haritası, satış paneli, raporlar, yazdırma)
public/css/style.css Tasarım
data/otobus.db       Veritabanı (otomatik oluşur)
```

---

## Sonraki adımlar için notlar

- **Online kredi kartı tahsilatı**: iyzico veya PayTR entegrasyonu `src/api.js` içindeki
  satış ucuna eklenir. Akış: koltuğu `rezerve` olarak kaydet → ödeme sağlayıcısına yönlendir →
  başarılı dönüşte `satildi` + `odendi` yap, başarısızsa iptal et.
- **Müşteriye açık online satış sayfası**: mevcut koltuk haritası bileşeni doğrudan
  kullanılabilir; kayıtsız kullanıcılar için ayrı bir sayfa ve "misafir" satış ucu eklenir.
- **SMS/e-posta bilet gönderimi**: satış sonrası PNR ve koltuk bilgisi ile.
- **Şoför ekranı**: yolcu listesi ekranındaki `boarded` (biniş) alanı hazır — mobilde
  dokunmatik biniş kontrolü ekranı eklenebilir.
