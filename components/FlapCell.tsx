"use client";

import { useEffect, useRef } from "react";
import { tick } from "@/lib/sound";

// Tamburdaki düz renkli kartlar. Klavyeden yazılamayan özel karakterlerle
// temsil edilirler; bir hücre hiçbir zaman renkli kartta durmaz, renkler
// yalnızca harfler dönerken araya girer. `colors` kapalıyken bu kartlar
// atlanır ve dönüş tamamen siyah-beyaz kalır.
const COLOR_CARDS: Record<string, string> = {
  "\uE000": "#c8372d", // kırmızı
  "\uE001": "#e07b2a", // turuncu
  "\uE002": "#e8c33a", // sarı
  "\uE003": "#3f9b5b", // yeşil
  "\uE004": "#2f6fb5", // mavi
  "\uE005": "#7b4fa8", // mor
  "\uE006": "#ececec", // beyaz
};

/**
 * Tamburdaki yaprakların sırası. Hücre hedefe ulaşana dek bu sırayla döner.
 * Renkli kartlar harflerin arasına eşit aralıklarla serpiştirilmiştir, böylece
 * hemen her dönüşte bir-iki renk görünür.
 */
export const CHARS = [
  " ABCÇDE",
  "\uE000",
  "FGĞHIİJ",
  "\uE001",
  "KLMNOÖP",
  "\uE002",
  "QRSŞTUÜ",
  "\uE003",
  "VWXYZ01",
  "\uE004",
  "2345678",
  "\uE005",
  "9:.,-/!",
  "\uE006",
  "?'°",
].join("");
// Tek bir yaprak düşüşü. Düşüşün gözle seçilebilmesi için yeterince yavaş.
const PLAIN = [...CHARS].filter((ch) => ch !== " " && !COLOR_CARDS[ch]);
const FLIP_MS = 150;
// Hedefe varan son kartın durdurucuya çarpıp sekmesi. Aradaki kartlar
// beklemez: gerçek tamburda sıradaki kart, önceki daha sekerken düşer.
const BOUNCE_MS = 260;
// Hedefe bu kadar yapraktan uzaksa tambur hızlı döner (her düşüşte birkaç
// yaprak geçer), yaklaşınca normal hıza iner. Böylece 9 → 0 gibi tamburun
// tamamını dolaşan geçişler de bir saniye civarında biter.
const FAST_FROM = 6;
const FAST_MS = 60;
const FAST_STEP = 4;

// Hafif görünüm: zayıf cihazlar (ör. Raspberry Pi Zero 2 W) için. Açıkken kart
// çevirme animasyonu çalışmaz: yeni içerik gelince her hücre, hedefinden önceki
// birkaç harften sırayla geçip hedefe oturur (tamburun son yaprakları gibi).
// Bütün hücreler tek bir saatle, aynı ekran karesinde güncellenir; böylece zayıf
// işlemcide bile ritim bozulmaz. Tarayıcıya düşen iş, adım başına birkaç metin
// değişikliğidir.
let lite = false;
export const setLiteMode = (on: boolean) => {
  lite = on;
};
const LITE_STEP_MS = 95; // bir kart düşüşü (ortak saatin bir adımı)
// Hedeften önce düşen kart sayısı: her hücrede farklı, böylece hücreler
// gerçek panodaki gibi farklı anlarda yerine oturur.
const LITE_MIN_STEPS = 3;
const LITE_MAX_STEPS = 7;

type LiteJob = { engine: FlapEngine; at: number; seq: string[]; k: number };
const liteJobs = new Set<LiteJob>();
let liteTimer: ReturnType<typeof setTimeout> | undefined;

/**
 * Ortak saat: her adımda, zamanı gelmiş bütün hücreleri tek seferde ilerletir.
 * Yazımların hepsi aynı görevde yapıldığı için ekrana aynı karede çıkar.
 */
function liteTick() {
  const now = performance.now();
  let settled = false;
  for (const job of liteJobs) {
    if (now < job.at) continue;
    if (job.engine.liteStep(job)) {
      liteJobs.delete(job);
      settled = true;
    }
  }
  // Her adımda en az bir kart düştüyse tık sesi (sound.ts kendisi seyreltir).
  if (settled || liteJobs.size > 0) tick();
  liteTimer = liteJobs.size > 0 ? setTimeout(liteTick, LITE_STEP_MS) : undefined;
}

function startLite(job: LiteJob) {
  liteJobs.add(job);
  liteTimer ??= setTimeout(liteTick, 0);
}

/** Hedeften önceki birkaç harf (alfabe sırasıyla); boşluğa giderken son harfler. */
function leadIn(target: string): string[] {
  const i = PLAIN.indexOf(target);
  const end = i < 0 ? PLAIN.length : i;
  const steps = LITE_MIN_STEPS + Math.floor(Math.random() * (LITE_MAX_STEPS - LITE_MIN_STEPS + 1));
  return Array.from(
    { length: steps },
    (_, n) => PLAIN[(end - steps + n + PLAIN.length) % PLAIN.length],
  );
}

/**
 * Animasyon motoru React'in dışında, doğrudan DOM üzerinde çalışır: bir harf
 * değişimi onlarca ara yaprak demek, bunları render döngüsüne sokmuyoruz.
 */
class FlapEngine {
  private idx = 0;
  private target = 0;
  private face = " "; // hücrede şu an görünen yaprak
  private colors = false;
  private spin = 0; // son görülen "pano değişti" sayacı
  private lap = false; // hedef aynı olsa da tamburu bir tur döndür
  private snap = false; // süren dönüşü kes, hedefi doğrudan yaz
  private running = false;
  private alive = true;
  private timer: ReturnType<typeof setTimeout> | undefined;
  private halves: HTMLElement[];
  private spans: HTMLElement[];
  private reduced: boolean;
  private flipId = 0; // hafif düşüş: geç kalan bir önceki düşüş yenisini bozmasın
  private liteTo: string | null = null; // süren hafif düşüşün hedef yaprağı
  private liteAnims: Animation[] = [];

  constructor(root: HTMLElement) {
    // Sıra: sabit üst, sabit alt, düşen üst, düşen alt
    this.halves = Array.from(root.querySelectorAll<HTMLElement>("[data-half]"));
    this.spans = this.halves.map((h) => h.firstElementChild as HTMLElement);
    this.reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  }

  /**
   * Hücreyi `char`a götürür. `spin` değiştiyse (panoya yeni bir not geldiyse)
   * harfi değişmeyen hücre de dahil her hücre çalışır.
   */
  set(char: string, delay: number, colors: boolean, spin: number, instant = false) {
    this.colors = colors;
    const i = CHARS.indexOf(char);
    this.target = i < 0 ? 0 : i;
    const kicked = spin !== this.spin;
    this.spin = spin;
    if (this.running) {
      // Dönüş sürerken anlık yazma istenirse (ör. video kaydı için panoyu
      // boşaltma), döngü bir sonraki kartta kesilir.
      this.snap = instant && !kicked;
      return;
    }
    this.snap = false; // önceki dönüşten kalmış bir kesme isteği yeni dönüşü kesmesin
    if ((instant || lite) && !kicked) {
      // Saniyeli saat gibi sık güncellenen içerikte yaprak çevirmeden yaz.
      if (this.idx === this.target) return;
      this.idx = this.target;
      this.face = CHARS[this.idx];
      this.show(0, this.face);
      this.show(1, this.face);
      return;
    }
    if (kicked && lite && !this.reduced) {
      // Yeni içerik (not, saat, hava durumu): harfi aynı kalan hücre de çalışır.
      this.running = true;
      startLite({
        engine: this,
        at: performance.now() + delay,
        seq: leadIn(CHARS[this.target]),
        k: 0,
      });
      return;
    }
    if (kicked && !this.reduced) {
      // Her hücre tamburu farklı bir yerden çevirmeye başlar; böylece hücreler
      // aynı harfleri birlikte göstermez ve farklı anlarda yerine oturur.
      // Görünen yaprak (face) değişmez, ilk düşüşte rastgele bir harf belirir.
      this.idx = Math.floor(Math.random() * CHARS.length);
      this.lap = this.idx === this.target;
    } else if (this.idx === this.target) return;
    this.running = true;
    this.timer = setTimeout(() => void this.run(), delay);
  }

  /** `i` numaralı yarıma bir yaprağı koyar: harf ya da düz renkli kart. */
  private show(i: number, char: string) {
    const color = COLOR_CARDS[char];
    this.spans[i].textContent = color ? "" : char;
    // Satır içi stil, sınıftan gelen koyu gradyanı örter; boş değer geri getirir.
    this.halves[i].style.background = color
      ? `linear-gradient(rgba(255,255,255,.1), rgba(0,0,0,.14)), ${color}`
      : "";
  }

  destroy() {
    this.alive = false;
    clearTimeout(this.timer);
  }

  private async run() {
    try {
      while (this.alive && (this.idx !== this.target || this.lap)) {
        this.lap = false;
        if (this.snap) {
          this.snap = false;
          this.idx = this.target;
          this.face = CHARS[this.idx];
          this.show(0, this.face);
          this.show(1, this.face);
          break;
        }
        if (this.reduced) {
          this.idx = this.target;
          this.face = CHARS[this.idx];
          this.show(0, CHARS[this.idx]);
          this.show(1, CHARS[this.idx]);
          break;
        }
        const left = (this.target - this.idx + CHARS.length) % CHARS.length || CHARS.length;
        const fast = left > FAST_FROM;
        const step = fast ? Math.min(FAST_STEP, left - FAST_FROM) : 1;
        const next = (this.idx + step) % CHARS.length;
        this.idx = next;
        if (!this.colors && COLOR_CARDS[CHARS[next]]) continue;
        await this.flip(this.face, CHARS[next], fast ? FAST_MS : FLIP_MS, next === this.target);
        this.face = CHARS[next];
      }
    } catch {
      // Hücre animasyon ortasında kaldırıldıysa sessizce bırak.
    }
    this.running = false;
  }

  /**
   * Hafif görünümde bir adım (ortak saat çağırır). Hücre bittiyse true döner.
   * Son adımda her zaman en güncel hedef yazılır.
   */
  liteStep(job: LiteJob): boolean {
    if (!this.alive) return true;
    if (job.k < job.seq.length) {
      this.liteFlip(job.seq[job.k++]);
      return false;
    }
    this.idx = this.target;
    this.liteFlip(CHARS[this.idx]);
    this.running = false;
    return true;
  }

  /**
   * Hafif görünümdeki kart düşüşü: eski harfin üst yarısı menteşeye doğru
   * katlanır, sonra yeni harfin alt yarısı açılır. Yalnızca `scaleY` canlandırılır;
   * tarayıcı bunu grafik işlemcide yapar, sayfayı yeniden çizmez. 3B, gölge ve
   * filtre yoktur. Düşen yarımlar yalnızca düşüş sırasında görünür.
   */
  private liteFlip(next: string) {
    // Önceki düşüş bitmediyse (ekran kareleri gecikti) hemen tamamlanır.
    if (this.liteTo !== null) this.liteSettle(this.liteTo);
    const cur = this.face;
    if (next === cur) return;
    const [, , fTop, fBot] = this.halves;
    const id = ++this.flipId;
    this.liteTo = next;
    this.face = next;
    this.paint(2, cur); // düşen üst: eski harf
    this.paint(3, next); // açılan alt: yeni harf
    this.paint(0, next); // arkada yeni harfin üstü hazır
    fTop.style.display = "block";
    fBot.style.display = "block";
    fBot.style.transform = "scaleY(0)";
    const a = fTop.animate([{ transform: "scaleY(1)" }, { transform: "scaleY(0)" }], {
      duration: LITE_STEP_MS * 0.45,
      easing: "ease-in",
    });
    this.liteAnims = [a];
    a.onfinish = () => {
      if (id !== this.flipId || !this.alive) return;
      fTop.style.display = "";
      const b = fBot.animate([{ transform: "scaleY(0)" }, { transform: "scaleY(1)" }], {
        duration: LITE_STEP_MS * 0.4,
        easing: "ease-out",
      });
      this.liteAnims = [b];
      b.onfinish = () => {
        if (id === this.flipId) this.liteSettle(next);
      };
    };
    // Animasyon hiç bitmezse (ör. ekran çizilmiyor) kart yine de yerine oturur.
    setTimeout(() => {
      if (id === this.flipId && this.liteTo === next) this.liteSettle(next);
    }, LITE_STEP_MS * 3);
  }

  /** Düşüşü bitirir: iki sabit yarımda `char`, düşen yarımlar gizli. */
  private liteSettle(char: string) {
    for (const a of this.liteAnims) a.cancel();
    this.liteAnims = [];
    this.liteTo = null;
    this.paint(0, char);
    this.paint(1, char);
    const [, , fTop, fBot] = this.halves;
    fTop.style.display = "";
    fBot.style.display = "";
    fBot.style.transform = "";
  }

  /** Bir yarıma yaprak koyar; aynısı zaten oradaysa dokunmaz. */
  private paint(i: number, char: string) {
    const span = this.spans[i];
    const color = COLOR_CARDS[char];
    const text = color ? "" : char;
    if (span.textContent !== text) span.textContent = text;
    const bg = color ? `linear-gradient(rgba(255,255,255,.1), rgba(0,0,0,.14)), ${color}` : "";
    if (this.halves[i].style.background !== bg) this.halves[i].style.background = bg;
  }

  /**
   * Tek bir kartın menteşe etrafında 180° dönerek düşmesi. İki yarım olarak
   * çizilir: önce eski harfin üst yarısı öne doğru devrilir (0° → 90°), kart
   * yan döndüğü anda arka yüzü, yani yeni harfin alt yarısı görünür ve aşağı
   * iner (90° → 0°). Hareket baştan sona hızlanır, sonunda durdurucuya çarpar.
   */
  private async flip(cur: string, next: string, ms: number, last: boolean) {
    const [sTop, sBot, fTop, fBot] = this.halves;
    const fall = ms * 0.58; // yerçekimiyle hızlandığı için ilk yarı daha uzun sürer
    const drop = ms - fall;

    this.show(0, next); // arkadan yeni harfin üstü görünür
    this.show(2, cur); // eski harfin üstü düşer
    this.show(3, next); // yeni harfin altı yerine oturur

    // Düşen kart alttaki eski yarıya, menteşeden aşağı doğru büyüyen bir gölge
    // düşürür; arkadan açılan yeni üst yarı da gölgeden aydınlığa çıkar.
    const shade = sBot.animate(
      [
        { filter: "brightness(1)", boxShadow: "inset 0 0 0 0 rgba(0,0,0,0)" },
        {
          filter: "brightness(.45)",
          boxShadow: "inset 0 .9em .5em -.2em rgba(0,0,0,.9)",
        },
      ],
      { duration: ms, easing: "ease-in", fill: "forwards" },
    );
    sTop.animate([{ filter: "brightness(.5)" }, { filter: "brightness(1)" }], {
      duration: fall,
      easing: "ease-out",
    });

    fTop.style.visibility = "visible";
    await fTop.animate(
      [
        { transform: "rotateX(0deg)", filter: "brightness(1)" },
        // öne eğilirken tepeden gelen ışığı alır, yan dönünce kararır
        {
          transform: "rotateX(-38deg)",
          filter: "brightness(1.18)",
          offset: 0.6,
        },
        { transform: "rotateX(-90deg)", filter: "brightness(.3)" },
      ],
      { duration: fall, easing: "cubic-bezier(.45,0,1,.55)" },
    ).finished;
    fTop.style.visibility = "hidden";

    fBot.style.visibility = "visible";
    await fBot.animate(
      [
        { transform: "rotateX(90deg)", filter: "brightness(.55)" },
        { transform: "rotateX(0deg)", filter: "brightness(1)" },
      ],
      // hız kesmeden iner: yavaşlama yok, çarpma var
      { duration: drop, easing: "cubic-bezier(.3,.2,.9,.8)" },
    ).finished;
    tick(); // ses tam çarpma anında

    if (last) {
      // Durdurucuya çarpıp iki kez seker; kalkınca altındaki eski kart görünür.
      await fBot.animate(
        [
          { transform: "rotateX(0deg)", easing: "ease-out" },
          { transform: "rotateX(17deg)", offset: 0.28, easing: "ease-in" },
          { transform: "rotateX(0deg)", offset: 0.58, easing: "ease-out" },
          { transform: "rotateX(6deg)", offset: 0.78, easing: "ease-in" },
          { transform: "rotateX(0deg)" },
        ],
        { duration: BOUNCE_MS },
      ).finished;
    }

    this.show(1, next);
    fBot.style.visibility = "hidden";
    shade.cancel();
  }
}

const HALF = "absolute inset-x-0 h-1/2 overflow-hidden [backface-visibility:hidden]";
// Işık yukarıdan gelir. Üst kartın en tepesi yuva kenarının gölgesinde kalır,
// hemen altı en aydınlık yerdir. Alt kartın tepesi üstteki kartın gölgesinde
// kalır; alt kenarı yuvanın dibinde kararır.
const TOP =
  "top-0 origin-bottom bg-[linear-gradient(to_bottom,#0c0c0c_0,var(--color-flap-hi)_15%,var(--color-flap)_100%)]";
const BOT =
  "bottom-0 origin-top bg-[linear-gradient(to_bottom,#080808_0,var(--color-flap-lo)_22%,var(--color-flap)_88%,#101010_100%)]";
// before = menteşe hizasındaki yan çentikler, after = menteşe çizgisi.
const CELL = [
  "flap-cell relative h-(--ch) w-(--cw) shrink-0 font-bold text-ink shadow-[0_0_0_.045em_var(--color-slot),0_.075em_0_.045em_rgba(255,255,255,.05)] [perspective:3.2em]",
  "before:absolute before:inset-x-0 before:top-[calc(50%-.07em)] before:z-10 before:h-[.14em] before:content-['']",
  "before:bg-[linear-gradient(90deg,var(--color-housing)_0_.07em,transparent_.07em_calc(100%-.07em),var(--color-housing)_calc(100%-.07em))]",
  "after:absolute after:inset-x-0 after:top-[calc(50%-.5px)] after:z-10 after:h-px after:bg-hinge after:content-['']",
].join(" ");

// Düşen kartın serbest (alt) kenarı: kartın kalınlığı ışık alır.
const EDGE = "shadow-[0_1px_0_rgba(255,255,255,.3),0_2px_3px_rgba(0,0,0,.5)]";
const GLYPH =
  // Hafif ışıma: mat plastiğe basılmış beyaz mürekkebin ışığı yayması.
  "absolute inset-x-0 flex h-[200%] items-center justify-center text-[.8em] leading-none [text-shadow:0_0_.035em_color-mix(in_srgb,currentColor_40%,transparent)]";

export default function FlapCell({
  char,
  delay = 0,
  colors = false,
  spin = 0,
  instant = false,
}: {
  char: string;
  delay?: number;
  colors?: boolean;
  spin?: number;
  /** Yeni not (spin) dışındaki değişimleri animasyonsuz yaz. */
  instant?: boolean;
}) {
  const root = useRef<HTMLDivElement>(null);
  const engine = useRef<FlapEngine | null>(null);

  useEffect(() => {
    const e = new FlapEngine(root.current!);
    engine.current = e;
    return () => e.destroy();
  }, []);

  useEffect(() => {
    engine.current?.set(char, delay, colors, spin, instant);
  }, [char, delay, colors, spin, instant]);

  return (
    <div ref={root} aria-hidden className={CELL}>
      <div data-half className={`${HALF} ${TOP}`}>
        <span className={`${GLYPH} top-0`} />
      </div>
      <div data-half className={`${HALF} ${BOT}`}>
        <span className={`${GLYPH} bottom-0`} />
      </div>
      <div data-half className={`${HALF} ${TOP} ${EDGE} invisible z-[2]`}>
        <span className={`${GLYPH} top-0`} />
      </div>
      <div data-half className={`${HALF} ${BOT} ${EDGE} invisible z-[2]`}>
        <span className={`${GLYPH} bottom-0`} />
      </div>
    </div>
  );
}
