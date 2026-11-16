# Split Flap

Havaalanlarındaki ve tren garlarındaki dönen harfli panoları eve getiren bir uygulama. Evdeki bir Raspberry Pi'de çalışır: Pi'ye bağlı ekran pano olur, telefon kumanda. Notunuzu gönderin; kartlar tek tek dönerek yerine otursun.

A split-flap board for your home. It runs on a Raspberry Pi: the attached screen is the board, your phone is the remote.

## Nasıl çalışır

- **Pano (`/`)** yalnızca gösterir: ekranda düğme, ayar ya da not kutusu yoktur. Sayfanın tamamını kaplar (12 × 5 hücre).
- Eşleşmiş bir telefon yoksa pano bir **QR kod** gösterir. Aynı WiFi'deki telefon kodu okutunca **kumanda (`/remote`)** açılır ve pano eşleşir. Pano açılışta ve ekrana dokununca kodu kısa süre yeniden gösterir.
- Her şey telefondan yapılır: notlar (20'ye kadar), saat ve tarih, hava durumu ve şehri, geri sayım, geçiş süresi, kart sesi, pano dili, başka telefon ekleme ve eşleşmeyi sıfırlama.
- Bulut yok. Pi'deki küçük bir Node.js sunucusu siteyi sunar ve pano kaydını `~/.splitflat/boards.json` dosyasında tutar. İnternet yalnızca hava durumu için kullanılır (seçilen şehrin adı [Open-Meteo](https://open-meteo.com)'ya gider).

## Raspberry Pi'ye kurulum

Raspberry Pi OS ya da FullPageOS üzerinde, Pi'ye SSH ile bağlanıp:

```bash
git clone https://github.com/temhaangelio/splitflat.git ~/splitflat
bash ~/splitflat/raspberry-pi/install.sh
sudo reboot
```

`install.sh` şunları yapar:

1. Node.js yoksa kurar (`apt install nodejs`).
2. Sunucuyu `splitflat` adlı bir servis olarak kurar; Pi açılınca kendiliğinden başlar, çökerse yeniden başlar.
3. FullPageOS varsa açılış adresini `http://localhost:8080/?lite` yapar, Chromium'un "1 GB'tan az bellek" uyarısını kapatır ve FullPageOS logosunu Split Flap açılış görseliyle değiştirir.
4. Pi açılırken ekrana akan sistem yazılarını gizler (`quiet-boot.sh`). Önceki ayar `cmdline.txt.orig` olarak saklanır; bir sorun olursa SD kartı bilgisayara takıp o dosyayı `cmdline.txt` adıyla geri koymak yeterlidir.

Pi açılınca ekranda QR görünür; telefonla okutun.

### İnternet kurulumu (ağ yoksa)

Pi açıldıktan sonra bir dakika içinde hiçbir WiFi ağına bağlanamazsa (ya da bağlantı üç dakikadan uzun koparsa) kendi kurulum ağını açar: **Split Flap Kurulum**. Ekran kullanıcıyı adım adım götürür; her adımda tek bir şey görünür:

1. Ağa katılma kodu: telefonla okutunca telefon kurulum ağına bağlanır (ağın şifresi de ekranda yazar).
2. Pi telefonun katıldığını fark edince ekran kurulum sayfasının (`/setup`) koduna geçer.
3. Telefon sayfayı açınca ekranda kod kalmaz; telefondan evin ağı seçilip şifresi girilir.

Pi kurulum ağını kapatıp seçilen ağa geçer. Bağlanamazsa kurulum ağını aynı şifreyle yeniden açar ve nedenini ekranda yazar (şifre yanlış, ağ bulunamadı, ağ adres vermedi). Zero 2 W yalnızca 2,4 GHz ağlara bağlanabilir.

WiFi'yi NetworkManager (`nmcli`) yönetir; `install.sh` sunucuya yalnızca `nmcli` için şifresiz `sudo` izni verir (`/etc/sudoers.d/splitflat-nmcli`). Kurulum isteği yalnızca kurulum ağındaki cihazlardan ve yalnızca kurulum modundayken kabul edilir.

**Güncelleme:**

```bash
bash ~/splitflat/raspberry-pi/update.sh
```

Notlar `~/.splitflat` altında durur; güncelleme onlara dokunmaz.

**Bilmeniz gerekenler**

- Telefon panoya yalnızca ev ağındayken ulaşır. QR, Pi'nin ev ağındaki adresini taşır; modemde Pi'ye **sabit IP** ayırın, yoksa adres değişince eşleşmiş telefonlar panoyu bulamaz (yeniden okutmak gerekir).
- Adres yanlış bulunursa servise `SPLITFLAT_URL=http://192.168.1.50:8080` gibi elle verilebilir (`/etc/systemd/system/splitflat.service` içinde `Environment=`).
- Ev içinde bağlantı şifrelenmez (http). Bu yüzden telefonda "Bağlantıyı kopyala" panoya kopyalamak yerine bağlantıyı gösterir.
- **Hafif görünüm:** tarayıcı 1 GB ve altında bellek bildirdiğinde ya da adreste `?lite` varken açılır; kart çevirme animasyonunu ve ağır görsel katmanları kapatır. Zero 2 W için gereklidir.
- `raspberry-pi/splash.png`: Pi açılırken ve tarayıcı açılmadan önce görünen görsel. Kurulum ve güncelleme betikleri FullPageOS'un kendi görselleri yerine bunu koyar (`splash.sh`).

### Servis komutları

```bash
sudo systemctl status splitflat     # çalışıyor mu
journalctl -u splitflat -f          # günlük
sudo systemctl restart splitflat    # yeniden başlat
```

## Geliştirme

Site hazır dosyalar olarak derlenir; Pi bunları derlemez, depodan hazır alır. Bu yüzden derlenmiş çıktılar (`raspberry-pi/site/`, `raspberry-pi/server.mjs`) depoya eklenir.

```bash
npm install
npm run serve        # Pi sunucusu, 8080'de (pano kaydı burada)
npm run dev          # ayrı terminalde; /api istekleri 8080'e yönlendirilir
```

Pi'ye gönderilecek sürümü hazırlamak:

```bash
npm run lint
npm run release      # siteyi ve sunucuyu raspberry-pi/ altına derler
git add -A && git commit && git push
```

Ardından Pi'de `update.sh`.

## Güvenlik

- Her panonun tarayıcıda üretilen iki rastgele anahtarı vardır (128 bit): biri okumaya, diğeri yazmaya yetkilidir. Diskte anahtarların kendisi değil SHA-256 özeti durur.
- Eşleştirme bağlantısında anahtarlar `#` sonrasında durur, isteklerde başlık olarak gider.
- Sunucu her yazmayı doğrular (`lib/board.ts` → `parseShared`, sitenin kullandığıyla aynı kod), adres başına dakikada 60 yazmayla sınırlar ve site klasörünün dışına dosya sunmaz.
- "Eşleşmeyi sıfırla" kaydı siler; pano yeni bir kod gösterir ve eski bağlantı geçersiz olur.

## Yapı

| Dosya | İçerik |
|---|---|
| `components/Board.tsx` | Pano: gösterim, eşleştirme kodu, sunucu sorgusu |
| `components/FlapCell.tsx` | Tek hücre ve kart çevirme animasyonu |
| `components/Remote.tsx` | Telefon kumandası (`/remote`) |
| `components/About.tsx` | Hakkında sayfası (`/about`) |
| `raspberry-pi/server.ts` | Pi sunucusu: site dosyaları ve `/api/board` |
| `raspberry-pi/install.sh`, `update.sh`, `splitflat.service` | Pi kurulumu |
| `lib/board.ts` | Ortak tanımlar, sınırlar ve veri doğrulama |
| `lib/remote.ts` | API istemcisi |
| `lib/i18n.ts`, `lib/about.ts` | Türkçe ve İngilizce metinler |
| `lib/weather.ts`, `lib/sound.ts` | Hava durumu; kart sesi |

Next.js 16, React 19, Tailwind CSS 4, Node.js 18+.
