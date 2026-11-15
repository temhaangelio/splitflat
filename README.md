# Splitflat

Havaalanlarındaki ve tren garlarındaki dönen harfli panoları eve getiren bir web uygulaması. Notunuzu yazın; kartlar tek tek dönerek yerine otursun.

A split-flap board for your home: type a note and watch the cards flip into place.

## Özellikler

- **Notlar:** 20 nota kadar; seçilen aralıkla sırayla döner.
- **Saat ve tarih:** isteğe bağlı saniyeyle.
- **Hava durumu:** otomatik konum ya da seçilen şehir.
- **Geri sayım:** başlık ve hedef tarih.
- **Kayıt:** panoyu PNG ya da kısa video olarak indirme.
- **Duvar ekranı:** tam ekran, kendiliğinden gizlenen kontroller, ekran uyku kilidi.
- **Ayarlar:** hücre sayısı (10×4, 12×5, 16×6, 22×6), duvar arka planı, ses, Türkçe / İngilizce.

Hesap ve sunucu yok: notlar ve ayarlar yalnızca tarayıcıda (`localStorage`) saklanır. Hava durumu açıkken [Open-Meteo](https://open-meteo.com) ve [BigDataCloud](https://www.bigdatacloud.com) çağrılır; ikisi de anahtar gerektirmez.

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
| `components/Board.tsx` | Pano, kontrol şeridi, not listesi, ayarlar |
| `components/FlapCell.tsx` | Tek hücre ve kart çevirme animasyonu |
| `components/About.tsx` | Hakkında sayfası (`/about`) |
| `lib/i18n.ts`, `lib/about.ts` | Türkçe ve İngilizce metinler |
| `lib/weather.ts` | Hava durumu ve konum |
| `lib/snapshot.ts`, `lib/record.ts` | PNG ve video kaydı |
| `lib/sound.ts` | Kart sesi |

Next.js 16, React 19, Tailwind CSS 4. Vercel'de ek ayar gerektirmeden yayınlanır.
