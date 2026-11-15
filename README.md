# Splitflat

Havaalanlarındaki ve tren garlarındaki dönen harfli panoları eve getiren bir web uygulaması. Bir ekran pano olur, telefon kumanda: notunuzu gönderin; kartlar tek tek dönerek yerine otursun.

A split-flap board for your home: a screen is the board, your phone is the remote.

## Nasıl çalışır

- **Pano (`/`)** yalnızca gösterir: ekranda düğme, ayar ya da not kutusu yoktur. Sayfanın tamamını kaplar (12 × 5 hücre).
- Eşleşmiş bir telefon yoksa pano bir **QR kod** gösterir. Kod okutulunca telefonda **kumanda (`/remote`)** açılır ve pano eşleşir.
- Her şey telefondan yapılır: notlar (20'ye kadar), saat ve tarih, hava durumu ve şehri, geri sayım, geçiş süresi, kart sesi, pano dili, başka telefon ekleme ve eşleşmeyi sıfırlama.
- Pano sunucuyu 7 saniyede bir sorgular ve değişikliği dönerek gösterir.

Hesap yoktur. Pano durumu sunucuda, panonun rastgele anahtarına bağlı olarak saklanır. Hava durumu açıkken şehir adı [Open-Meteo](https://open-meteo.com)'ya gönderilir.

## Sunucu deposu (gerekli)

Pano içeriği sunucuda tutulduğu için bir Redis deposu **gerekir**; yoksa pano "telefon bağlantısı hazır değil" der ve yalnızca tanıtım notlarını gösterir.

**Vercel'de kurulum:** proje → Storage → Upstash for Redis → Create. Vercel bağlantı bilgilerini ortam değişkeni olarak ekler; ardından yeniden yayınlayın. Kabul edilen değişkenler:

| Değişken | Alternatif adı |
|---|---|
| `KV_REST_API_URL` | `UPSTASH_REDIS_REST_URL` |
| `KV_REST_API_TOKEN` | `UPSTASH_REDIS_REST_TOKEN` |

**Yerelde:** değişkenler yoksa `npm run dev` verileri bellekte tutar (sunucu yeniden başlayınca silinir). Gerçek depoyla denemek için `vercel env pull .env.local`.

### Güvenlik

- Her panonun tarayıcıda üretilen iki rastgele anahtarı vardır (128 bit): biri okumaya, diğeri yazmaya yetkilidir. Depoda anahtarların kendisi değil SHA-256 özeti durur.
- Eşleştirme bağlantısında anahtarlar `#` sonrasında durur, isteklerde başlık olarak gider; sunucu günlüklerine düşmez.
- Pano kaydı, kod ilk okutulduğunda telefon tarafından oluşturulur; okutulmamış bir kod için sunucuda hiçbir şey yoktur.
- Sunucu her yazmayı doğrular (`lib/board.ts` → `parseShared`) ve IP başına sınırlar: dakikada 30 yazma, 5 yeni pano.
- "Eşleşmeyi sıfırla" kaydı siler; pano yeni bir kod gösterir ve eski bağlantı geçersiz olur.
- Depo kullanımı: pano başına ayda yaklaşık 370 bin Redis komutu (Upstash'in ücretsiz katmanı ayda 500 bin).

## Zayıf cihazlar ve kiosk

- **Hafif görünüm:** tarayıcı 1 GB ve altında bellek bildirdiğinde kendiliğinden açılır; adresin sonuna `?lite` eklenerek de zorlanabilir. Kart çevirme animasyonunu ve ağır görsel katmanları kapatır.
- **Raspberry Pi:** `raspberry-pi/splash.png`, FullPageOS için açılış görselidir. Kart sesinin dokunmadan çalması için Chromium'a `--autoplay-policy=no-user-gesture-required` verilmelidir.
- Panoya dokunmak sayfayı tam ekrana geçirir.

## Geliştirme

```bash
npm install
npm run dev
```

Ardından <http://localhost:3000>.

```bash
npm run lint
npm run build
```

## Yapı

| Dosya | İçerik |
|---|---|
| `components/Board.tsx` | Pano: gösterim, eşleştirme kodu, sunucu sorgusu |
| `components/FlapCell.tsx` | Tek hücre ve kart çevirme animasyonu |
| `components/Remote.tsx` | Telefon kumandası (`/remote`) |
| `components/About.tsx` | Hakkında sayfası (`/about`) |
| `app/api/board/route.ts` | Pano kaydı API'si |
| `lib/board.ts` | Ortak tanımlar, sınırlar ve veri doğrulama |
| `lib/remote.ts`, `lib/server/` | API istemcisi; depo ve güvenlik yardımcıları |
| `lib/i18n.ts`, `lib/about.ts` | Türkçe ve İngilizce metinler |
| `lib/weather.ts`, `lib/sound.ts` | Hava durumu; kart sesi |

Next.js 16, React 19, Tailwind CSS 4.
