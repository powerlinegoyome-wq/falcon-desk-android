# Falcon Desk (Android Sürümü) 📱

Telegram botlarınızı Android akıllı telefonunuz veya tabletiniz üzerinden profesyonel bir canlı destek masasına dönüştüren mobil operatör yönetim panelidir.

> **Not:** Bu proje, orijinal masaüstü (Electron .EXE) projesinin bilgisayar ihtiyacı olmadan doğrudan Android cihazlarda çalışabilmesi için Capacitor + React + Vite altyapısıyla yeniden optimize edilmiş Android APK sürümüdür.

---

## ⬇️ Android APK İndir

GitHub Actions üzerinden otomatik olarak üretilen ve doğrudan Android telefonunuza yükleyebileceğiniz `.apk` dosyası:

| Sürüm | Platform | İndirme Bağlantısı |
|---|---|---|
| **Falcon Desk Android v1.1.0** (Bildirim Desteği) | Android 7.0+ (ARM64 / x86_64) | [📥 FalconDesk-v1.1.0.apk İndir](https://github.com/powerlinegoyome-wq/falcon-desk-android/releases/download/v1.1.0/FalconDesk-v1.1.0.apk) |

### 📲 Telefona Nasıl Yüklenir?
1. Yukarıdaki bağlantıdan veya [Releases](https://github.com/powerlinegoyome-wq/falcon-desk-android/releases) sekmesinden `FalconDesk-v1.1.0.apk` dosyasını telefonunuza indirin.
2. İndirilen `.apk` dosyasına dokunun.
3. Telefonunuz "Bilinmeyen kaynaklardan yüklemeye izin ver" uyarısı verirse izin verin.
4. "Yükle" butonuna basarak kurulumu tamamlayın ve uygulamayı açın!

---

## 🚀 Öne Çıkan Mobil Özellikler

- 🔔 **Anlık Sistem Bildirimleri**: Müşteriniz botunuza mesaj attığında telefonunuzun bildirim çubuğunda ses, titreşim ve önizleme ile bildirim çıkar. Bildirime dokunarak doğrudan ilgili müşterinin sohbetine gidebilirsiniz.
- 📱 **Tamamen Bilgisayarsız**: Harici bir sunucuya veya masaüstü bilgisayara ihtiyaç duymaz. Tüm bot trafiği ve veritabanı doğrudan Android cihazınızda çalışır.
- 💬 **Canlı Destek Operatör Masası**: Botunuza Telegram'dan yazan tüm müşterilerle anlık sohbet edin, mesajları yanıtlayın.
- 🖼️ **Mobil Dosya & Medya Aktarımı**: Telefon galerisinden veya dosya yöneticisinden fotoğraf, belge ve medya gönderin ve alın.
- 🔙 **Mobil Uyumlu Kullanıcı Arayüzü**:
  - Sohbet listesi ve sohbet odası arasında akıcı mobil geçişler.
  - Sohbet içi tek tıkla geri dönüş butonu (`<`).
  - Dokunmatik ve kaydırılabilir (swipeable) ayarlar sekmesi.
  - Bildirim sesleri ve titreşim desteği.
- 🔒 **Güvenli Yerel Veritabanı**: IndexedDB mimarisi sayesinde tüm sohbet geçmişiniz, ayarlarınız ve şablonlarınız cihazınızda şifrelenmiş gibi yerel olarak güvenle saklanır.
- 🛡️ **Whitelist / ID Filtreleme**: Botun yalnızca belirlediğiniz Telegram kullanıcılarıyla iletişim kurmasını sağlayabilirsiniz.
- ⚡ **Otomatik Karşılama ve Hızlı Şablonlar**: `/start` komutuna otomatik karşılama mesajı ve sık kullanılan hazır yanıt şablonları.
- 🌍 **4 Dil Desteği**: Türkçe, İngilizce, Arapça ve İspanyolca.
- 🌙 **Saf Siyah (OLED) Tema**: Mobil pil tasarrufu için optimize edilmiş AMOLED siyah karanlık tema.

---

## ⚙️ Bot Bağlantısı Nasıl Yapılır?

1. Telegram üzerinden [@BotFather](https://t.me/BotFather) botuna gidin.
2. `/newbot` komutuyla yeni bir bot oluşturun veya mevcut botunuzun **API Token**'ını alın.
3. Falcon Desk uygulamasını açın ve **Ayarlar (Çark Simgesi) > Bot & ID** sekmesine gidin.
4. Bot Token'ınızı yapıştırın ve **"Doğrula & Başlat"** butonuna dokunun.
5. Bot bağlandıktan sonra müşterileriniz botunuza yazdığında tüm mesajlar anında telefon ekranınıza düşecektir!

---

## 🛠️ Geliştirici & Yerel Derleme

### 1. Web Varlıklarını Derleme
```bash
npm install
npm run build
```

### 2. Capacitor Android Senkronizasyonu
```bash
npx cap sync android
```

### 3. Android APK Derleme (Terminal)
```bash
cd android
./gradlew assembleDebug
```
*Derlenen `.apk` dosyası `android/app/build/outputs/apk/debug/app-debug.apk` konumunda oluşturulur.*

---

## 🤖 GitHub Actions Otomatik Derleme

Bu depoda `.github/workflows/build-apk.yml` yapılandırması bulunmaktadır. Kod üzerinde yapılan her güncellemede GitHub Actions otomatik olarak:
1. Android derleme ortamını ayağa kaldırır.
2. Gradle ile `.apk` paketini derler.
3. [Releases](https://github.com/powerlinegoyome-wq/falcon-desk-android/releases) altına yeni sürüm olarak `.apk` indirme linkini ekler.

---

## Lisans

Bu proje kişisel kullanım içindir.
