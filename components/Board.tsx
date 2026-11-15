"use client";

import {
  useEffect,
  useEffectEvent,
  useRef,
  useState,
  useSyncExternalStore,
  type CSSProperties,
} from "react";
import FlapCell, { setLiteMode } from "@/components/FlapCell";
import {
  DEFAULT_SIZE,
  defaultShared,
  parseShared,
  sizeOf,
  wrap,
  type Countdown,
  type Shared,
} from "@/lib/board";
import {
  browserLang,
  describeWeather,
  STRINGS,
  upper,
  type Lang,
  type Strings,
} from "@/lib/i18n";
import {
  newPair,
  pairUrl,
  parsePair,
  readBoard,
  RemoteError,
  writeBoard,
  type Pair,
} from "@/lib/remote";
import { setSound } from "@/lib/sound";
import { fetchWeather, type Weather } from "@/lib/weather";

// Pano yalnızca gösterir. Not eklemek, saat/hava durumu/geri sayımı açmak ve
// diğer tüm ayarlar telefondan yapılır (bkz. components/Remote.tsx); pano
// sunucuyu düzenli sorgulayıp gelen durumu ekrana yansıtır. Eşleşmiş bir
// telefon yoksa ekranda eşleştirme kodu görünür.

const BOARD_KEY = "splitflat:board"; // son bilinen durum; açılışta ve çevrimdışıyken gösterilir
const REMOTE_KEY = "splitflat:remote"; // eşleşmiş panonun anahtarları
const PENDING_KEY = "splitflat:pending"; // henüz okutulmamış eşleştirme kodunun anahtarları

// Pano sunucuya bu aralıkla "değişen var mı" diye sorar. Her sorgu depoda bir
// komut harcar: 7 sn, tek pano için ayda ~370 bin.
const POLL_MS = 7000;
// Eşleştirme kodu ekrandayken: ilk dakikalarda sık, sonra seyrek sorulur ki
// kod açık unutulan bir sekme depoyu boşuna yormasın.
const PAIR_POLL_FAST_MS = 4000;
const PAIR_POLL_SLOW_MS = 20_000;
const PAIR_FAST_FOR_MS = 3 * 60_000;

const WEATHER_REFRESH_MS = 15 * 60 * 1000;
// Tanıtım notları, seçilen süreden bağımsız olarak hızlı döner.
const INTRO_INTERVAL = 5;
const INTRO_INTERVAL_LITE = 12; // zayıf cihazda pano sürekli dönmesin
// Yeni içerik geldiğinde renkli kartların araya girme ihtimali.
const COLOR_CHANCE = 0.3;
const rollColors = () => Math.random() < COLOR_CHANCE;

/* ---------- Izgara: pano ekranın tamamıdır ---------- */

// Ölçüler hücre genişliği (u) cinsinden.
const GAP = 0.38; // sütun arası
const ROW_GAP = 0.5; // satır arası
const EDGE = 0.9; // ekran kenarı ile hücreler arasındaki en az boşluk
const MIN_RATIO = 1.3; // hücre yüksekliği / genişliği
const MAX_RATIO = 1.6;

type Grid = {
  cols: number;
  rows: number;
  cw: number;
  ch: number;
  gap: number;
  rowGap: number;
  padX: number; // ekran kenarından ilk hücreye, yatay
  padY: number; // ekran kenarından ilk hücreye, dikey
};

/**
 * Hücreler ekrana sığabildiği kadar büyür; ekran panodan daha uzunsa bir miktar
 * uzarlar, artan boşluk kenarlara eşit dağıtılır. Çerçeve ve duvar yoktur.
 */
function computeGrid(screenW: number, screenH: number, cols: number, rows: number): Grid {
  const gridUnitsW = cols + (cols - 1) * GAP;
  const fixedH = (rows - 1) * ROW_GAP + 2 * EDGE;
  const u = Math.min(screenW / (gridUnitsW + 2 * EDGE), screenH / (rows * MIN_RATIO + fixedH));
  const ratio = Math.min(MAX_RATIO, Math.max(MIN_RATIO, (screenH / u - fixedH) / rows));
  return {
    cols,
    rows,
    cw: u,
    ch: u * ratio,
    gap: u * GAP,
    rowGap: u * ROW_GAP,
    padX: (screenW - u * gridUnitsW) / 2,
    padY: (screenH - u * (rows * ratio + (rows - 1) * ROW_GAP)) / 2,
  };
}

const subscribeResize = (cb: () => void) => {
  window.addEventListener("resize", cb);
  return () => window.removeEventListener("resize", cb);
};
const viewportSnapshot = () => `${window.innerWidth}x${window.innerHeight}`;

/** Sunucuda boyut bilinmez; ızgara ancak tarayıcıda kurulur. */
function useGrid(cols: number, rows: number): Grid | null {
  const size = useSyncExternalStore(subscribeResize, viewportSnapshot, () => "");
  if (!size) return null;
  const [w, h] = size.split("x").map(Number);
  return computeGrid(w, h, cols, rows);
}

// Saat ve geri sayım için saniye sayacı. Pano yalnızca gösterilen rakamlar
// değişince yeniden yazılır.
const subscribeSecond = (cb: () => void) => {
  const id = setInterval(cb, 250);
  return () => clearInterval(id);
};
const currentSecond = () => Math.floor(Date.now() / 1000);

/* ---------- İçerik ---------- */

/** Panoda sırayla gösterilen içerik: saat, hava durumu, geri sayım ya da bir not (sırası). */
type Item = "clock" | "weather" | "countdown" | number;

const pad2 = (n: number) => String(n).padStart(2, "0");

function clockLines(second: number, withSeconds: boolean, t: Strings): string[] {
  const d = new Date(second * 1000);
  const time = `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
  return [
    withSeconds ? `${time}:${pad2(d.getSeconds())}` : time,
    "",
    t.days[d.getDay()],
    `${d.getDate()} ${t.months[d.getMonth()]}`,
  ];
}

/**
 * Geri sayım: başlık, kalan gün ve saat:dakika:saniye. Süre dolduysa bunu yazar.
 * Hedef seçilmediyse bir sonraki yılbaşına sayar.
 */
function countdownLines(second: number, saved: Countdown | null, t: Strings, lang: Lang): string[] {
  const nextYear = new Date(second * 1000).getFullYear() + 1;
  const target = saved?.target || `${nextYear}-01-01T00:00`;
  const title = saved ? upper(saved.title, lang) : t.newYear;
  const left = Math.floor(new Date(target).getTime() / 1000) - second;
  if (Number.isNaN(left)) return [title, "--:--:--"];
  if (left <= 0) return [title, t.countdownDone];
  const days = Math.floor(left / 86_400);
  const clock = [(left % 86_400) / 3600, (left % 3600) / 60, left % 60]
    .map((n) => pad2(Math.floor(n)))
    .join(":");
  return [title, ...(days > 0 ? [`${days} ${days === 1 ? t.dayOne : t.dayMany}`] : []), clock];
}

function weatherLines(w: Weather | "error" | null, t: Strings, lang: Lang): string[] {
  if (w === null) return [t.weatherTitle, t.weatherLoading];
  if (w === "error") return [t.weatherTitle, t.weatherFailed];
  return [
    upper(w.city, lang),
    `${w.temp}°`,
    describeWeather(w.code, lang),
    `${w.max}° / ${w.min}°`,
  ];
}

/** Satırları ızgaranın ortasına hizalar. `content` null ise (henüz yüklenmedi) pano boştur. */
function boardLines(content: string[] | null, cols: number, rows: number): string[] {
  if (content === null) return Array<string>(rows).fill("");
  // Sütuna sığmayan satırlar kelime kelime bölünür.
  const lines = content.flatMap((l) => (l ? wrap(l, cols) : [""])).slice(0, rows);
  const offset = Math.floor((rows - lines.length) / 2);
  return Array.from({ length: rows }, (_, r) => {
    const l = lines[r - offset] ?? "";
    return " ".repeat(Math.floor((cols - l.length) / 2)) + l;
  });
}

/* ---------- Tarayıcıdaki kayıt ---------- */

function store(key: string, value: string | null) {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {
    // Depolama kapalıysa değişiklik yalnızca bu oturumda kalır.
  }
}

function readJson(key: string): unknown {
  try {
    return JSON.parse(localStorage.getItem(key) ?? "null");
  } catch {
    return null;
  }
}

const readPair = (key: string): Pair | null => {
  const saved = readJson(key) as { id?: unknown; key?: unknown } | null;
  return saved ? parsePair(`${saved.id}.${saved.key}`) : null;
};

/**
 * Açılışta gösterilecek durum: son bilinen durum; yoksa, ayarların ekranda
 * yapıldığı eski sürümden kalan notlar ve tercihler; o da yoksa boş pano.
 */
function loadShared(): Shared {
  const cached = parseShared(readJson(BOARD_KEY));
  if (cached) return cached;
  const savedLang = (() => {
    try {
      return localStorage.getItem("splitflat:lang");
    } catch {
      return null;
    }
  })();
  const base = defaultShared(savedLang === "tr" || savedLang === "en" ? savedLang : browserLang());
  const legacy = parseShared({
    ...base,
    notes: readJson("splitflat:notes") ?? [],
    show: { ...base.show, ...(readJson("splitflat:show") as object | null) },
    countdown: readJson("splitflat:countdown"),
  });
  return legacy ?? base;
}

export default function Board() {
  const { cols, rows } = sizeOf(DEFAULT_SIZE);
  const grid = useGrid(cols, rows);
  const second = useSyncExternalStore(subscribeSecond, currentSecond, () => 0);

  const [data, setData] = useState<Shared | null>(null); // null: henüz yüklenmedi
  const [current, setCurrent] = useState(0); // `items` içindeki sıra
  const [colorful, setColorful] = useState(false);
  // Panoya her yeni içerik geldiğinde artar; bütün hücreler çalışır.
  const [spin, setSpin] = useState(0);
  const [lite, setLite] = useState(false);
  const [weather, setWeather] = useState<Weather | "error" | null>(null);

  // Telefonla eşleşme: `remote` eşleşmiş panonun anahtarları; yoksa `pending`
  // ekrandaki kodun anahtarlarıdır ve bir telefonun okutması beklenir.
  const [remote, setRemote] = useState<Pair | null>(null);
  const [pending, setPending] = useState<Pair | null>(null);
  const [link, setLink] = useState<"checking" | "ready" | "unavailable" | "offline">("checking");
  const [qr, setQr] = useState<string | null>(null);
  const version = useRef(0); // sunucudaki son bilinen sürüm

  const lang: Lang = data?.lang ?? "tr";
  const t = STRINGS[lang];

  // Kayıtlı durum yalnızca tarayıcıda bilinir; pano boş başlar, sonra dolar.
  useEffect(() => {
    const boot = setTimeout(() => {
      // Hafif görünüm, sayfa çizilmeden önce <html data-lite> olarak belirlenir
      // (bkz. app/layout.tsx). Motor burada, hücreler dönmeye başlamadan önce
      // haberdar edilir; yoksa ilk açılış ağır animasyonla oynar.
      const isLite = document.documentElement.hasAttribute("data-lite");
      setLiteMode(isLite);
      setLite(isLite);

      setData(loadShared());
      setSpin((n) => n + 1);

      const paired = readPair(REMOTE_KEY);
      if (paired) setRemote(paired);
      else {
        const waiting = readPair(PENDING_KEY) ?? newPair();
        store(PENDING_KEY, JSON.stringify(waiting));
        setPending(waiting);
      }
    }, 300);
    return () => clearTimeout(boot);
  }, []);

  /** Sunucudan gelen durumu panoya uygular ve tarayıcıda da saklar. */
  const apply = useEffectEvent((next: Shared, v: number) => {
    version.current = v;
    const json = JSON.stringify(next);
    store(BOARD_KEY, json);
    if (json === JSON.stringify(data)) return;
    // Yeni not geldiyse hemen o gösterilir; yoksa döngü baştan başlar.
    const added = next.notes.length > (data?.notes.length ?? 0);
    const offset =
      (next.show.clock ? 1 : 0) + (next.show.weather ? 1 : 0) + (next.show.countdown ? 1 : 0);
    setData(next);
    setColorful(rollColors());
    setSpin((n) => n + 1);
    setCurrent(added && next.show.notes ? offset + next.notes.length - 1 : 0);
  });

  // Eşleşmiş pano: sunucuyu düzenli sorgular.
  useEffect(() => {
    if (!remote) return;
    let alive = true;
    const tick = async () => {
      try {
        const r = await readBoard(remote.id, version.current || undefined);
        if (alive && r.data) apply(r.data, r.v);
      } catch (e) {
        if (!alive) return;
        // Pano telefondan sıfırlanmış: eşleşme düşer, ekranda yeni kod görünür.
        if (e instanceof RemoteError && e.code === "not_found") {
          const next = newPair();
          store(REMOTE_KEY, null);
          store(PENDING_KEY, JSON.stringify(next));
          version.current = 0;
          setRemote(null);
          setLink("checking");
          setPending(next);
        }
        // Diğer hatalarda (ağ yok vb.) pano son bildiği içeriği göstermeye devam eder.
      }
    };
    void tick();
    const id = setInterval(tick, POLL_MS);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [remote]);

  /** Telefon kodu okuttu ve panoyu sunucuda oluşturdu: eşleşme tamamlanır. */
  const adopt = useEffectEvent(async (pair: Pair, server: Shared, v: number) => {
    let next = server;
    let nextV = v;
    // Eski sürümden kalan yerel notlar varsa ve telefon henüz bir şey
    // yazmadıysa, onlar sunucuya taşınır ki kaybolmasınlar.
    if (data && data.notes.length > 0 && server.notes.length === 0 && v === 1) {
      try {
        const moved: Shared = { ...data, lang: server.lang };
        const w = await writeBoard(pair, moved, v);
        next = w.stale ?? moved;
        nextV = w.v;
      } catch {
        // taşınamadıysa sunucudaki durumla devam edilir
      }
    }
    store(REMOTE_KEY, JSON.stringify(pair));
    store(PENDING_KEY, null);
    setPending(null);
    setQr(null);
    setRemote(pair);
    apply(next, nextV);
  });

  // Eşleşmemiş pano: ekrandaki kodun okutulmasını bekler. Kod okutulana kadar
  // sunucuda bu panoya ait hiçbir şey yoktur; kaydı, okutan telefon oluşturur.
  useEffect(() => {
    if (!pending) return;
    let alive = true;
    let timer: ReturnType<typeof setTimeout>;
    const started = Date.now();
    const tick = async () => {
      try {
        const r = await readBoard(pending.id);
        if (alive && r.data) void adopt(pending, r.data, r.v);
        return;
      } catch (e) {
        if (!alive) return;
        const code = e instanceof RemoteError ? e.code : "";
        // "Bulunamadı" beklenen durumdur: sunucu çalışıyor, kod henüz okutulmadı.
        setLink(
          code === "not_found" ? "ready" : code === "not_configured" ? "unavailable" : "offline",
        );
      }
      const fast = Date.now() - started < PAIR_FAST_FOR_MS;
      timer = setTimeout(tick, fast ? PAIR_POLL_FAST_MS : PAIR_POLL_SLOW_MS);
    };
    void tick();
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [pending]);

  // Eşleştirme kodu; kütüphane yalnızca gerektiğinde yüklenir.
  useEffect(() => {
    if (!pending) return;
    let alive = true;
    void import("qrcode")
      .then((QR) =>
        QR.toDataURL(pairUrl(pending), { margin: 2, width: 720, errorCorrectionLevel: "M" }),
      )
      .then((url) => {
        if (alive) setQr(url);
      });
    return () => {
      alive = false;
    };
  }, [pending]);

  // Panoda gösterilecekler: açık olan saat, hava durumu ve geri sayım, ardından notlar.
  const items: Item[] = [];
  if (data?.show.clock) items.push("clock");
  if (data?.show.weather) items.push("weather");
  if (data?.show.countdown) items.push("countdown");
  if (data?.show.notes) data.notes.forEach((_, i) => items.push(i));
  // Gösterilecek hiçbir şey yoksa tanıtım notları döner.
  const showingIntro = items.length === 0;
  const itemCount = showingIntro ? t.intro.length : items.length;
  const pos = current % itemCount;
  const item: Item | undefined = showingIntro ? undefined : items[pos];
  const delaySec = showingIntro
    ? lite
      ? INTRO_INTERVAL_LITE
      : INTRO_INTERVAL
    : (data?.intervalSec ?? INTRO_INTERVAL);

  // Birden fazla içerik varsa sırayla döner.
  useEffect(() => {
    if (itemCount < 2) return;
    const timer = setTimeout(() => {
      setColorful(rollColors());
      setSpin((n) => n + 1);
      setCurrent((c) => (c + 1) % itemCount);
    }, delaySec * 1000);
    return () => clearTimeout(timer);
  }, [itemCount, current, delaySec]);

  // Hava durumu açıkken yüklenir ve 15 dakikada bir yenilenir.
  const showWeather = data?.show.weather ?? false;
  const city = data?.city ?? "";
  useEffect(() => {
    if (!showWeather || !city) return;
    const ctrl = new AbortController();
    const load = () =>
      fetchWeather(city, lang, ctrl.signal).then(
        (w) => {
          if (!ctrl.signal.aborted) setWeather(w);
        },
        () => {
          if (!ctrl.signal.aborted) setWeather("error");
        },
      );
    void load();
    const id = setInterval(load, WEATHER_REFRESH_MS);
    return () => {
      ctrl.abort();
      clearInterval(id);
    };
  }, [showWeather, city, lang]);

  // Pano açıkken ekran uykuya geçmesin. Kilit, sekme arka plana geçince
  // tarayıcı tarafından bırakılır; görünür olunca yeniden istenir. Bazı
  // tarayıcılar ilk dokunuştan önce izin vermediği için dokunuşta da denenir.
  useEffect(() => {
    if (!("wakeLock" in navigator)) return;
    let lock: WakeLockSentinel | null = null;
    let alive = true;
    const acquire = async () => {
      if (!alive || document.visibilityState !== "visible" || (lock && !lock.released)) return;
      try {
        lock = await navigator.wakeLock.request("screen");
      } catch {
        // izin verilmediyse bir sonraki dokunuşta tekrar denenir
      }
    };
    void acquire();
    document.addEventListener("visibilitychange", acquire);
    window.addEventListener("pointerdown", acquire);
    return () => {
      alive = false;
      document.removeEventListener("visibilitychange", acquire);
      window.removeEventListener("pointerdown", acquire);
      void lock?.release();
    };
  }, []);

  // Ses: tarayıcılar ilk dokunuş ya da tuştan önce ses çalmaya izin vermediği
  // için asıl açılış o ilk etkileşimde olur (kiosk kurulumunda bu kısıt
  // tarayıcı ayarıyla kaldırılır).
  const soundOn = data?.sound ?? false;
  useEffect(() => {
    if (!soundOn) {
      setSound(false);
      return;
    }
    const unlock = () => setSound(true);
    unlock();
    const events = ["pointerdown", "keydown"] as const;
    events.forEach((e) => window.addEventListener(e, unlock));
    return () => events.forEach((e) => window.removeEventListener(e, unlock));
  }, [soundOn]);

  // Ekranda düğme yok: panoya dokunmak tam ekrana geçirir.
  useEffect(() => {
    const enter = () => {
      if (!document.fullscreenElement) {
        void document.documentElement.requestFullscreen?.().catch(() => {});
      }
    };
    window.addEventListener("pointerdown", enter);
    return () => window.removeEventListener("pointerdown", enter);
  }, []);

  useEffect(() => {
    document.documentElement.lang = lang;
    document.title = STRINGS[lang].title;
  }, [lang]);

  let content: string[] | null = null;
  if (data) {
    if (item === "clock") content = clockLines(second, data.show.seconds, t);
    else if (item === "weather") content = weatherLines(weather, t, lang);
    else if (item === "countdown") content = countdownLines(second, data.countdown, t, lang);
    else if (typeof item === "number") content = [upper(data.notes[item], lang)];
    else content = t.intro[pos];
  }
  const lines = grid ? boardLines(content, grid.cols, grid.rows) : [];
  // Her saniye değişen içerik kart çevirmeden, doğrudan yazılır.
  const instant = item === "countdown" || (item === "clock" && (data?.show.seconds ?? false));

  return (
    <section
      aria-label={t.board}
      className="fixed inset-0 cursor-none overflow-hidden bg-housing select-none"
    >
      {/* Ekran okuyucular flap hücreleri yerine düz metni okur. */}
      <p className="sr-only">{content?.filter(Boolean).join(" ") ?? ""}</p>

      {grid && (
        <div className="relative size-full" style={{ fontSize: grid.cw / 0.74 }}>
          {/* Pano yüzeyi: sağ üstten gelen hafif ışık. */}
          <div
            aria-hidden
            className="board-surface absolute inset-0 bg-housing bg-radial-[at_72%_0%] from-housing-hi to-housing to-65%"
          />
          <div
            className="relative flex h-full flex-col"
            style={
              {
                padding: `${grid.padY}px ${grid.padX}px`,
                gap: grid.rowGap,
                "--cw": `${grid.cw}px`,
                "--ch": `${grid.ch}px`,
              } as CSSProperties
            }
          >
            {lines.map((line, r) => (
              <div key={r} className="flex" style={{ gap: grid.gap }}>
                {Array.from(line.padEnd(grid.cols).slice(0, grid.cols), (ch, i) => (
                  <FlapCell
                    key={i}
                    char={ch}
                    delay={r * 60 + i * 18}
                    colors={colorful}
                    spin={spin}
                    instant={instant}
                  />
                ))}
              </div>
            ))}
          </div>
          {/* Panoya tek yönden düşen ışık: sağ üst aydınlık, alt kısım gölgede. */}
          <div
            aria-hidden
            className="board-light pointer-events-none absolute inset-0 z-30 bg-[radial-gradient(110%_85%_at_72%_-8%,rgba(255,255,255,.09),transparent_60%),linear-gradient(to_bottom,transparent_45%,rgba(0,0,0,.32))]"
          />
        </div>
      )}
      {/* Film greni: düz dijital yüzeyleri fotoğraf gibi gösterir. */}
      <div aria-hidden className="grain" />

      {/* Eşleşmiş telefon yokken: eşleştirme kodu. */}
      {pending && link !== "checking" && (
        <div className="absolute inset-0 z-40 grid place-items-center bg-black/85 p-[4vmin]">
          <div className="flex flex-wrap items-center justify-center gap-[6vmin]">
            {link !== "unavailable" && (
              <div className="bg-white p-[1.2vmin]">
                {qr ? (
                  // eslint-disable-next-line @next/next/no-img-element -- tarayıcıda üretilen veri adresi
                  <img src={qr} alt={t.pairQrAlt} className="size-[min(52vmin,460px)]" />
                ) : (
                  <div className="size-[min(52vmin,460px)]" />
                )}
              </div>
            )}
            <div className="flex max-w-[26rem] flex-col gap-[2vmin] text-center text-ink sm:text-left">
              <p className="text-[clamp(.65rem,1.5vmin,.9rem)] font-semibold tracking-[.42em] text-muted">
                SPLITFLAT
              </p>
              <h1 className="text-[clamp(1.5rem,4.4vmin,2.8rem)] leading-tight font-bold tracking-wide">
                {link === "unavailable" ? t.pairUnavailableTitle : t.pairTitle}
              </h1>
              <p className="text-[clamp(.95rem,2.2vmin,1.3rem)] leading-relaxed text-muted">
                {link === "unavailable"
                  ? t.pairUnavailable
                  : link === "offline"
                    ? t.pairOffline
                    : t.pairText}
              </p>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
