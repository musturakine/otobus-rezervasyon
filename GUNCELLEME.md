# Sistemi Güncelleme — Güvenli Yöntem

Bu rehber, sisteme yeni bir sürüm yüklerken dosya atlanmasını **imkansız** hale getirir.

---

## Neden bu rehber var?

GitHub'ın internet sitesinden dosya sürükleyip bırakma yöntemi kolay görünür ama
güvenilir değildir: iç içe klasörlerde (`public` → `css`, `js`, `icons`) bazı dosyalar
sessizce atlanır. Hiçbir hata mesajı vermez, "yüklendi" der ve geçer.

Bu yüzden bir kez site tamamen kapandı. Sebep koddaki bir hata değil, eksik yüklenen
tek bir dosyaydı.

Aşağıdaki yöntemde dosya seçmiyorsunuz. Program **neyin değiştiğini kendisi buluyor**
ve hepsini birden gönderiyor. Atlanma ihtimali yok.

---

## BİR KEZ YAPILACAK KURULUM (10 dakika)

Bunu bir kere yapıyorsunuz, sonraki tüm güncellemeler 1 dakika sürecek.

### 1. GitHub Desktop programını kurun

- Tarayıcıdan **desktop.github.com** adresine gidin
- **Download for Windows** düğmesine basın
- İnen dosyayı çalıştırın, kurulum kendiliğinden tamamlanır

> Bu, GitHub'ın kendi resmi programıdır. Ücretsizdir, komut satırı gerektirmez.

### 2. GitHub hesabınızla giriş yapın

- Program açılınca **Sign in to GitHub.com** deyin
- Tarayıcı açılır, GitHub şifrenizle giriş yaparsınız
- "Authorize" deyip programa dönün

### 3. Depoyu bilgisayarınıza indirin

- **Clone a repository from the Internet…** düğmesine basın
- Listeden **musturakine/otobus-rezervasyon** seçin
- **Local path** kısmında klasörün nereye ineceği yazar — bunu bir yere not edin
  (genelde `C:\Users\KullanıcıAdınız\Documents\GitHub\otobus-rezervasyon`)
- **Clone** düğmesine basın

Bitti. Artık bilgisayarınızda, sunucudakiyle birebir aynı bir klasör var.

---

## HER GÜNCELLEMEDE YAPILACAK (1 dakika)

### 1. Yeni paketi açın

Size gönderilen zip dosyasına sağ tıklayın → **Tümünü ayıkla**.
`otobus-rezervasyon` adında bir klasör çıkar.

### 2. Dosyaları GitHub klasörünün üzerine kopyalayın

- Çıkan klasörün **içine** girin, **Ctrl+A** ile hepsini seçin, **Ctrl+C** ile kopyalayın
- 3. adımda not ettiğiniz **GitHub klasörünü** açın
- İçine girip **Ctrl+V** yapın
- Windows "Dosyalar zaten var, değiştirilsin mi?" diye sorar →
  **"Hedefteki dosyaları değiştir"** seçin

> Bu adımda hiçbir şey seçmiyor, ayıklamıyorsunuz. Hepsini kopyalayıp hepsinin
> üzerine yazıyorsunuz. Yanlış yapma ihtimali yok.

### 3. GitHub Desktop'ı açın

Program, değişen **her dosyayı** sol tarafta listeler. Kendiniz bulmanıza gerek yok,
o buluyor. Listeye bir göz atın — beklediğiniz dosyalar orada olmalı.

### 4. Gönderin

- Sol altta **Summary** kutusuna kısa bir şey yazın (örn. `Surum 1.4.0`)
- **Commit to main** düğmesine basın
- Sonra üstte beliren **Push origin** düğmesine basın

Bitti. Render 3–5 dakika içinde siteyi kendiliğinden günceller.

---

## HER GÜNCELLEMEDEN SONRA — 10 saniyelik kontrol

Tarayıcıdan şu adresi açın:

```
https://otobus-rezervasyon.onrender.com/durum
```

Bu sayfa size şunu söyler:

| Gördüğünüz | Anlamı |
|---|---|
| 🟢 **Her şey yolunda — tüm dosyalar yerinde** | Güncelleme tamam, hiçbir şey yapmayın |
| 🟡 **Sistem çalışıyor, bazı görsel dosyalar eksik** | Site çalışır ama logo/simge eksik olabilir |
| 🔴 **Bazı dosyalar eksik** | Sayfa hangi dosyanın eksik olduğunu ve ne yapacağınızı yazar |

Sayfada ayrıca **sistem sürümü** yazar. Beklediğiniz numaraysa güncelleme geçmiş demektir.

---

## Bir şey ters giderse

**Site açılmıyorsa** panik yapmayın — artık site eksik dosya yüzünden komple kapanmıyor.
Bunun yerine "Sistem şu an hazırlanıyor" diye bir sayfa gösteriyor ve
**personel girişi çalışmaya devam ediyor.** Satışlarınız durmaz.

O sayfadaki **"Ne eksik, göster"** düğmesine basıp eksiği görebilir,
dosyaları tekrar gönderebilirsiniz.

**Eski sürüme dönmek isterseniz:** Render → servisiniz → **Events** →
son çalışan deploy'un yanındaki **Rollback**. Site anında eski hâline döner.

---

## Sık sorulanlar

**Sürükle-bırak yöntemini kullanmaya devam edebilir miyim?**
Edebilirsiniz ama önermiyorum. Kullanırsanız mutlaka arkasından `/durum` sayfasına bakın.

**Bilgisayarımdaki klasörü silersem ne olur?**
Bir şey olmaz, sunucudaki kopya yerinde durur. GitHub Desktop'tan tekrar `Clone`
yaparak indirirsiniz.

**Yanlışlıkla bozuk bir şey gönderirsem?**
Render'dan **Rollback** ile eski sürüme dönersiniz. Ayrıca veritabanınız (biletler,
seferler, kullanıcılar) güncellemelerden etkilenmez — o ayrı bir diskte durur.

**Veritabanım güncellemede silinir mi?**
Hayır. Kod ile veri ayrıdır. Sistem her gün otomatik yedek de alır
(Ayarlar → Yedekleme'den indirebilirsiniz).
