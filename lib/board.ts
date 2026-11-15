// Pano, telefon sayfası ve sunucunun ortak kullandığı tanımlar. Buradaki
// sınırlar hem arayüzde hem sunucuda uygulanır; sunucu arayüze güvenmez.

/* ---------- Boyutlar ---------- */

// Hücre sayısı kullanıcının seçtiği boyuttan gelir ve ekrana göre değişmez;
// ekran boyutu yalnızca panonun ölçeğini değiştirir. Az hücre = büyük, uzaktan
// okunur harfler. Varsayılan 12 × 5: Türkçedeki uzun kelimelerin çoğuna yeter.
export const SIZES = [
  { id: "s", cols: 10, rows: 4 },
  { id: "m", cols: 12, rows: 5 },
  { id: "l", cols: 16, rows: 6 },
  { id: "xl", cols: 22, rows: 6 },
] as const;
export type SizeId = (typeof SIZES)[number]["id"];
export const DEFAULT_SIZE: SizeId = "m";
export const sizeOf = (id: SizeId) => SIZES.find((s) => s.id === id) ?? SIZES[1];

/* ---------- İçerik ---------- */

export const MAX_NOTES = 20;
// Kısa notlar panoda en iyi okunur; 100 karakter en büyük panoya da sığar.
export const NOTE_LIMIT = 100;
export const TITLE_LIMIT = 22; // geri sayım başlığı: en geniş panonun bir satırı

// Notlar arası geçiş süresi seçenekleri (saniye).
export const INTERVALS = [
  { sec: 15, n: 15, unit: "seconds" },
  { sec: 30, n: 30, unit: "seconds" },
  { sec: 60, n: 1, unit: "minutes" },
  { sec: 300, n: 5, unit: "minutes" },
] as const;
export const DEFAULT_INTERVAL = 30;

export type Show = {
  notes: boolean;
  clock: boolean;
  seconds: boolean;
  weather: boolean;
  countdown: boolean;
};
export const DEFAULT_SHOW: Show = {
  notes: true,
  clock: false,
  seconds: false,
  weather: false,
  countdown: false,
};

/** Geri sayım hedefi. `target`, tarih seçicinin verdiği yerel "YYYY-AA-GGTSS:DD" metnidir. */
export type Countdown = { title: string; target: string };

/** Metni kelime kelime `width` genişliğinde satırlara böler. */
export function wrap(text: string, width: number): string[] {
  const lines: string[] = [];
  let line = "";
  for (let w of text.split(/\s+/).filter(Boolean)) {
    while (w.length > width) {
      // tek kelime satırdan uzunsa böl
      if (line) lines.push(line);
      line = "";
      lines.push(w.slice(0, width));
      w = w.slice(width);
    }
    if (!w) continue;
    if (!line) line = w;
    else if (line.length + 1 + w.length <= width) line += " " + w;
    else {
      lines.push(line);
      line = w;
    }
  }
  if (line) lines.push(line);
  return lines;
}

/** Not, verilen boyuttaki panoya (satır sayısını aşmadan) sığıyor mu? */
export const fits = (text: string, size: SizeId) => {
  const { cols, rows } = sizeOf(size);
  return text.length <= Math.min(NOTE_LIMIT, cols * rows) && wrap(text, cols).length <= rows;
};

/* ---------- Telefonla paylaşılan durum ---------- */

/**
 * Duvardaki pano ile telefon arasında eşitlenen her şey. Cihaza özgü ayarlar
 * (dil, ses, duvar arka planı, hava durumu konumu) burada yoktur; `size` yalnızca
 * telefonun notu doğru sınırlayabilmesi için paylaşılır.
 */
export type Shared = {
  notes: string[];
  show: Show;
  intervalSec: number;
  countdown: Countdown | null;
  size: SizeId;
};

/**
 * Paylaşılan durumu her zaman aynı alan sırasıyla kurar. Böylece iki durum
 * JSON metni olarak karşılaştırılabilir (parseShared de aynı sırayı üretir).
 */
export const toShared = (
  notes: string[],
  show: Show,
  intervalSec: number,
  countdown: Countdown | null,
  size: SizeId,
): Shared => ({
  notes,
  show: {
    notes: show.notes,
    clock: show.clock,
    seconds: show.seconds,
    weather: show.weather,
    countdown: show.countdown,
  },
  intervalSec,
  countdown: countdown && { title: countdown.title, target: countdown.target },
  size,
});

const isBool = (v: unknown): v is boolean => typeof v === "boolean";
const TARGET = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/;

/**
 * Dışarıdan gelen veriyi doğrular ve yalnızca beklenen alanları içeren temiz
 * bir kopya döndürür; geçersizse null. Sunucu her yazmada bunu çalıştırır.
 */
export function parseShared(input: unknown): Shared | null {
  if (typeof input !== "object" || input === null) return null;
  const o = input as Record<string, unknown>;

  if (!Array.isArray(o.notes) || o.notes.length > MAX_NOTES) return null;
  const notes: string[] = [];
  for (const n of o.notes) {
    if (typeof n !== "string" || !n.trim() || n.length > NOTE_LIMIT) return null;
    notes.push(n);
  }

  const s = o.show as Record<string, unknown> | null;
  if (typeof s !== "object" || s === null) return null;
  const show = {
    notes: s.notes,
    clock: s.clock,
    seconds: s.seconds,
    weather: s.weather,
    countdown: s.countdown,
  };
  if (!Object.values(show).every(isBool)) return null;

  if (!INTERVALS.some((i) => i.sec === o.intervalSec)) return null;
  if (!SIZES.some((z) => z.id === o.size)) return null;

  let countdown: Countdown | null = null;
  if (o.countdown !== null && o.countdown !== undefined) {
    const c = o.countdown as Record<string, unknown>;
    if (typeof c !== "object") return null;
    if (typeof c.title !== "string" || c.title.length > TITLE_LIMIT) return null;
    if (typeof c.target !== "string" || (c.target !== "" && !TARGET.test(c.target))) return null;
    countdown = { title: c.title, target: c.target };
  }

  return {
    notes,
    show: show as Show,
    intervalSec: o.intervalSec as number,
    countdown,
    size: o.size as SizeId,
  };
}
