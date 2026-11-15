# Splitflat

Havaalanlarındaki ve tren garlarındaki dönen harfli panoları eve getiren bir web uygulaması. Notunuzu yazın; kartlar tek tek dönerek yerine otursun.

A split-flap board for your home: type a note and watch the cards flip into place.

## Özellikler

- **Notlar:** 20 nota kadar; seçilen aralıkla sırayla döner.
- **Saat ve tarih:** isteğe bağlı saniyeyle.
- **Hava durumu:** otomatik konum ya da seçilen şehir.
- **Geri sayım:** başlık ve hedef tarih.
- **Telefondan kontrol:** panodaki QR kodu okutup notları telefondan gönderme (isteğe bağlı, aşağıya bakın).
- **Kayıt:** panoyu PNG ya da kısa video olarak indirme.
- **Duvar ekranı:** tam ekran, kendiliğinden gizlenen kontroller, ekran uyku kilidi.
- **Ayarlar:** hücre sayısı (10×4, 12×5, 16×6, 22×6), duvar arka planı, ses, Türkçe / İngilizce.

Hesap yok. Telefondan kontrol açılmadıkça notlar ve ayarlar yalnızca tarayıcıda (`localStorage`) saklanır. Hava durumu açıkken [Open-Meteo](https://open-meteo.com) ve [BigDataCloud](https://www.bigdatacloud.com) çağrılır; ikisi de anahtar gerektirmez.

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

## Telefondan kontrol

Bu özellik pano durumunu sunucuda tutar ve bir Redis deposu ister. Depo yoksa uygulamanın geri kalanı aynen çalışır; ayarlarda özelliği açmaya çalışan kullanıcı "sunucuda ayarlanmamış" uyarısı görür.

**Vercel'de kurulum:** proje → Storage → Upstash for Redis → Create. Vercel bağlantı bilgilerini ortam değişkeni olarak ekler; ardından yeniden yayınlayın. Kabul edilen değişkenler:

| Değişken | Alternatif adı |
|---|---|
| `KV_REST_API_URL` | `UPSTASH_REDIS_REST_URL` |
| `KV_REST_API_TOKEN` | `UPSTASH_REDIS_REST_TOKEN` |

**Yerelde:** değişkenler yoksa `npm run dev` verileri bellekte tutar (sunucu yeniden başlayınca silinir). Gerçek depoyla denemek için `vercel env pull .env.local`.

**Nasıl çalışır**

- Her panonun tarayıcıda üretilen iki rastgele anahtarı vardır (128 bit): biri okumaya, diğeri yazmaya yetkilidir. Depoda anahtarların kendisi değil SHA-256 özeti durur.
- Eşleştirme bağlantısında anahtarlar `#` sonrasında durur, isteklerde başlık olarak gider; sunucu günlüklerine düşmez.
- Pano sunucuyu 7 saniyede bir sorgular (pano başına ayda yaklaşık 370 bin Redis komutu; Upstash'in ücretsiz katmanı ayda 500 bin).
- Sunucu her yazmayı doğrular (`lib/board.ts` → `parseShared`) ve IP başına sınırlar: dakikada 30 yazma, 5 yeni pano.
- "Bağlantıyı yenile" kaydı yeni anahtarlara taşır; eski bağlantı geçersiz olur.

## Yapı

| Dosya | İçerik |
|---|---|
| `components/Board.tsx` | Pano, kontrol şeridi, not listesi, ayarlar |
| `components/FlapCell.tsx` | Tek hücre ve kart çevirme animasyonu |
| `components/About.tsx` | Hakkında sayfası (`/about`) |
| `components/Remote.tsx` | Telefon sayfası (`/remote`) |
| `app/api/board/route.ts` | Telefondan kontrol API'si |
| `lib/board.ts` | Ortak tanımlar, sınırlar ve veri doğrulama |
| `lib/remote.ts`, `lib/server/` | API istemcisi; depo ve güvenlik yardımcıları |
| `lib/i18n.ts`, `lib/about.ts` | Türkçe ve İngilizce metinler |
| `lib/weather.ts` | Hava durumu ve konum |
| `lib/snapshot.ts`, `lib/record.ts` | PNG ve video kaydı |
| `lib/sound.ts` | Kart sesi |

Next.js 16, React 19, Tailwind CSS 4. Vercel'de ek ayar gerektirmeden yayınlanır.
