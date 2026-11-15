"use client";

import Link from "next/link";
import {
  useEffect,
  useEffectEvent,
  useRef,
  useState,
  useSyncExternalStore,
  type CSSProperties,
} from "react";
import FlapCell, { setLiteMode } from "@/components/FlapCell";
import { FIELD_LABEL, FOCUS, Section, Segmented, Toggle } from "@/components/ui";
import {
  DEFAULT_INTERVAL,
  DEFAULT_SHOW,
  DEFAULT_SIZE,
  INTERVALS,
  MAX_NOTES,
  NOTE_LIMIT,
  SIZES,
  TITLE_LIMIT,
  toShared,
  wrap,
  type Countdown,
  type Shared,
  type Show,
  type SizeId,
} from "@/lib/board";
import {
  createBoard,
  deleteBoard,
  newPair,
  pairUrl,
  parsePair,
  readBoard,
  RemoteError,
  rotateBoard,
  writeBoard,
  type Pair,
} from "@/lib/remote";
import { canRecord, captureTab, download, startRecording, timestamp } from "@/lib/record";
import { savePng } from "@/lib/snapshot";
import { setSound } from "@/lib/sound";
import {
  BRAND,
  browserLang,
  describeWeather,
  LANGS,
  STRINGS,
  upper,
  type Lang,
  type Strings,
} from "@/lib/i18n";
import {
  currentPosition,
  fetchWeather,
  fetchWeatherAt,
  placeName,
  type Weather,
} from "@/lib/weather";

const NOTES_KEY = "splitflat:notes";
const LEGACY_NOTE_KEY = "splitflat:note"; // tek notlu eski sürüm
const INTERVAL_KEY = "splitflat:interval";
const SOUND_KEY = "splitflat:sound";
const WALL_KEY = "splitflat:wall";
const LITE_KEY = "splitflat:lite";
const SHOW_KEY = "splitflat:show";
const CITY_KEY = "splitflat:city";
const LOCATION_KEY = "splitflat:location";
type LocationMode = "auto" | "city";
const DEFAULT_CITY = "İstanbul";
const WEATHER_REFRESH_MS = 15 * 60 * 1000;

const LANG_KEY = "splitflat:lang";
const REMOTE_KEY = "splitflat:remote";
// Telefondan kontrol açıkken pano sunucuya bu aralıkla "değişen var mı" diye
// sorar. Her sorgu depoda bir komut harcar: 7 sn, tek pano için ayda ~370 bin.
const POLL_MS = 7000;
const PUSH_DELAY_MS = 500;
type RemoteNote = "" | "busy" | "unavailable" | "error" | "lost";

/** Panoda sırayla gösterilen içerik: saat, hava durumu ya da bir not (sırası). */
type Item = "clock" | "weather" | "countdown" | number;
const COUNTDOWN_KEY = "splitflat:countdown";
const intervalLabel = (sec: number, t: Strings) => {
  const o = INTERVALS.find((i) => i.sec === sec) ?? INTERVALS[1];
  return `${o.n} ${t[o.unit]}`;
};
// Tanıtım notları, kullanıcının seçtiği süreden bağımsız olarak hızlı döner.
const INTRO_INTERVAL = 5;
const INTRO_INTERVAL_LITE = 12; // zayıf cihazda pano sürekli dönmesin
// Video: pano boşalır, yazı dönerek gelir ve bu kadar süre kaydedilir.
const RECORD_MS = 7000;
const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
const IDLE_MS = 4000;
// Yeni bir not yazıldığında renkli kartların araya girme ihtimali.
const COLOR_CHANCE = 0.3;
const rollColors = () => Math.random() < COLOR_CHANCE;


/* ---------- Sabit ızgara, ekrana göre ölçek ---------- */

const SIZE_KEY = "splitflat:size";

// Ölçüler hücre genişliği (u) cinsinden.
const GAP = 0.38; // sütun arası
const ROW_GAP = 0.5; // satır arası
const BEZEL = 0.5; // dış çerçevenin kalınlığı
const INSET = 1.9; // çerçeve ile hücreler arası nefes boşluğu
const LIP = 0.12; // hücrenin altındaki kenar + ışık çizgisi, em cinsinden (bkz. FlapCell)
const MIN_RATIO = 1.3; // hücre yüksekliği / genişliği
const MAX_RATIO = 1.6;
// Pano ekranın tamamını değil bu kadarını kaplar; kalan kısımda duvar görünür.
const FILL_W = 0.86;
const FILL_H = 0.78;

type Grid = {
  cols: number;
  rows: number;
  cw: number;
  ch: number;
  gap: number;
  rowGap: number;
  pad: number;
  bezel: number;
  width: number;
  height: number;
};

/**
 * Panoyu ekrana sığacak en büyük ölçekte hesaplar. Pano ekrandan daha yassıysa
 * hücreler bir miktar uzayarak boşluğu doldurur; kalan alan boş kalır.
 */
function computeGrid(screenW: number, screenH: number, COLS: number, ROWS: number): Grid {
  // Dar ekranda (telefon, dikey) pano kenarlara daha çok yaklaşır.
  const w = screenW * (screenW < 640 ? 0.95 : FILL_W);
  const h = screenH * FILL_H;
  const unitsW = COLS + (COLS - 1) * GAP + 2 * (BEZEL + INSET);
  const fixedH = (ROWS - 1) * ROW_GAP + 2 * (BEZEL + INSET);
  const u = Math.min(w / unitsW, h / (ROWS * MIN_RATIO + fixedH));
  const ratio = Math.min(MAX_RATIO, Math.max(MIN_RATIO, (h / u - fixedH) / ROWS));
  return {
    cols: COLS,
    rows: ROWS,
    cw: u,
    ch: u * ratio,
    gap: u * GAP,
    rowGap: u * ROW_GAP,
    pad: u * (BEZEL + INSET),
    bezel: u * BEZEL,
    width: u * unitsW,
    height: u * (ROWS * ratio + fixedH),
  };
}

const subscribeResize = (cb: () => void) => {
  window.addEventListener("resize", cb);
  return () => window.removeEventListener("resize", cb);
};
const viewportSnapshot = () => `${window.innerWidth}x${window.innerHeight}`;
const serverSnapshot = () => "";

/** Sunucuda boyut bilinmez; ızgara ancak tarayıcıda kurulur. */
function useGrid(cols: number, rows: number): Grid | null {
  const size = useSyncExternalStore(subscribeResize, viewportSnapshot, serverSnapshot);
  if (!size) return null;
  const [w, h] = size.split("x").map(Number);
  return computeGrid(w, h, cols, rows);
}

// Saat modu için saniye sayacı. Pano yalnızca gösterilen rakamlar değişince
// döner; saniye kapalıyken dakikada bir değişir.
const subscribeSecond = (cb: () => void) => {
  const id = setInterval(cb, 250);
  return () => clearInterval(id);
};
const currentSecond = () => Math.floor(Date.now() / 1000);

const subscribeFullscreen = (cb: () => void) => {
  document.addEventListener("fullscreenchange", cb);
  return () => document.removeEventListener("fullscreenchange", cb);
};
const isFullscreen = () => document.fullscreenElement !== null;

/* ---------- İkonlar ---------- */

function Icon({ children }: { children: React.ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden
      className="size-5"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {children}
    </svg>
  );
}

const ClearIcon = () => (
  <Icon>
    <path d="m6 6 12 12" />
    <path d="M18 6 6 18" />
  </Icon>
);
const EnterKeyIcon = () => (
  <Icon>
    <path d="M20 5v7a3 3 0 0 1-3 3H5" />
    <path d="m9 11-4 4 4 4" />
  </Icon>
);
const ListIcon = () => (
  <Icon>
    <path d="M9 6h11" />
    <path d="M9 12h11" />
    <path d="M9 18h11" />
    <path d="M4.5 6h.01" />
    <path d="M4.5 12h.01" />
    <path d="M4.5 18h.01" />
  </Icon>
);
const SettingsIcon = () => (
  <Icon>
    <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
    <circle cx="12" cy="12" r="3" />
  </Icon>
);
const RecordIcon = () => (
  <Icon>
    <circle cx="12" cy="12" r="8" />
    <circle cx="12" cy="12" r="3" fill="currentColor" />
  </Icon>
);
const InfoIcon = () => (
  <Icon>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 11v6" />
    <path d="M12 7.5h.01" />
  </Icon>
);
const DownloadIcon = () => (
  <Icon>
    <path d="M12 4v11" />
    <path d="m7 11 5 5 5-5" />
    <path d="M5 20h14" />
  </Icon>
);
const EnterFullscreenIcon = () => (
  <Icon>
    <path d="M4 9V4h5" />
    <path d="M20 9V4h-5" />
    <path d="M4 15v5h5" />
    <path d="M20 15v5h-5" />
  </Icon>
);
const ExitFullscreenIcon = () => (
  <Icon>
    <path d="M9 4v5H4" />
    <path d="M15 4v5h5" />
    <path d="M9 20v-5H4" />
    <path d="M15 20v-5h5" />
  </Icon>
);

/* ---------- Metin yerleşimi ---------- */


function readNotes(): string[] {
  const raw = localStorage.getItem(NOTES_KEY);
  if (raw) {
    const parsed: unknown = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed.filter((n): n is string => typeof n === "string");
  }
  const legacy = localStorage.getItem(LEGACY_NOTE_KEY);
  return legacy ? [legacy] : [];
}

function store(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Depolama kapalıysa değişiklik yalnızca bu oturumda kalır.
  }
}

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
  const clock = [left % 86_400 / 3600, (left % 3600) / 60, left % 60]
    .map((n) => pad2(Math.floor(n)))
    .join(":");
  return [title, ...(days > 0 ? [`${days} ${days === 1 ? t.dayOne : t.dayMany}`] : []), clock];
}

function weatherLines(w: Weather | "error" | null, t: Strings, lang: Lang): string[] {
  if (w === null) return [t.weatherTitle, t.weatherLoading];
  if (w === "error") return [t.weatherTitle, t.weatherFailed];
  const lines = [`${w.temp}°`, describeWeather(w.code, lang), `${w.max}° / ${w.min}°`];
  const city = upper(w.city, lang);
  return city ? [city, ...lines] : lines;
}

/** Satırları ızgaranın ortasına hizalar. `content` null ise (henüz yüklenmedi) pano boştur. */
function boardLines(content: string[] | null, cols: number, rows: number): string[] {
  if (content === null) return Array<string>(rows).fill("");
  // Sütuna sığmayan satırlar kelime kelime bölünür (küçük panolarda gerekir).
  const lines = content.flatMap((l) => (l ? wrap(l, cols) : [""])).slice(0, rows);
  const offset = Math.floor((rows - lines.length) / 2);
  return Array.from({ length: rows }, (_, r) => {
    const l = lines[r - offset] ?? "";
    return " ".repeat(Math.floor((cols - l.length) / 2)) + l;
  });
}

export default function Board() {
  const [lang, setLang] = useState<Lang>("tr");
  const t = STRINGS[lang];
  const [sizeId, setSizeId] = useState<SizeId>(DEFAULT_SIZE);
  const { cols: COLS, rows: ROWS } = SIZES.find((s) => s.id === sizeId) ?? SIZES[1];
  const grid = useGrid(COLS, ROWS);
  const [notes, setNotes] = useState<string[] | null>(null); // null: henüz yüklenmedi
  const [current, setCurrent] = useState(0); // `items` içindeki sıra
  const [intervalSec, setIntervalSec] = useState(DEFAULT_INTERVAL);
  const [draft, setDraft] = useState("");
  const [listOpen, setListOpen] = useState(false);
  const [soundOn, setSoundOn] = useState(true);
  const [wallOn, setWallOn] = useState(true);
  const [lite, setLite] = useState(false);
  const [show, setShow] = useState<Show>(DEFAULT_SHOW);
  const [city, setCity] = useState(DEFAULT_CITY);
  const [cityDraft, setCityDraft] = useState(DEFAULT_CITY);
  const [locationMode, setLocationMode] = useState<LocationMode>("auto");
  const [weather, setWeather] = useState<Weather | "error" | null>(null);
  const [countdown, setCountdown] = useState<Countdown | null>(null); // null: yılbaşı
  const second = useSyncExternalStore(subscribeSecond, currentSecond, () => 0);
  const [idle, setIdle] = useState(false);
  const [colorful, setColorful] = useState(false);
  const [recordable, setRecordable] = useState(false);
  // Video kaydı sürerken kontroller gizlenir ve döngü bekler; `blank` panoyu
  // kaydın başında bir anlığına boşaltır ki yazı videoda baştan dönerek gelsin.
  const [recording, setRecording] = useState(false);
  const [blank, setBlank] = useState(false);
  // Telefondan kontrol: bu panonun anahtarları (yoksa özellik kapalı).
  const [remote, setRemote] = useState<Pair | null>(null);
  const [remoteNote, setRemoteNote] = useState<RemoteNote>("");
  const [qrOpen, setQrOpen] = useState(false);
  const [qr, setQr] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const version = useRef(0); // sunucudaki son bilinen sürüm
  const synced = useRef<string | null>(null); // sunucuyla eşit olduğu bilinen durum; null: henüz okunmadı
  // Panoya her yeni not geldiğinde artar; bütün hücreler bir tur döner.
  const [spin, setSpin] = useState(0);
  const fullscreen = useSyncExternalStore(subscribeFullscreen, isFullscreen, () => false);
  const input = useRef<HTMLInputElement>(null);
  const controls = useRef<HTMLDivElement>(null);
  const settings = useRef<HTMLDialogElement>(null);

  // Kayıtlı notlar yalnızca tarayıcıda bilinir; pano boş başlar, sonra dolar.
  useEffect(() => {
    const boot = setTimeout(() => {
      let saved: string[] = [];
      try {
        saved = readNotes();
        const savedLang = localStorage.getItem(LANG_KEY);
        setLang(savedLang === "tr" || savedLang === "en" ? savedLang : browserLang());
        const sec = Number(localStorage.getItem(INTERVAL_KEY));
        if (INTERVALS.some((o) => o.sec === sec)) setIntervalSec(sec);
        if (localStorage.getItem(SOUND_KEY) === "off") setSoundOn(false);
        if (localStorage.getItem(WALL_KEY) === "off") setWallOn(false);
        // Hafif görünüm: kayıtlı tercih, yoksa adresteki ?lite ya da az bellek
        // (tarayıcı 1 GB ve altını bildiriyorsa) kendiliğinden açar.
        const savedLite = localStorage.getItem(LITE_KEY);
        const lowMemory = ((navigator as { deviceMemory?: number }).deviceMemory ?? 8) <= 1;
        const forced = new URLSearchParams(location.search).has("lite");
        setLite(savedLite ? savedLite === "on" : forced || lowMemory);
        const savedShow = localStorage.getItem(SHOW_KEY);
        if (savedShow) setShow({ ...DEFAULT_SHOW, ...JSON.parse(savedShow) });
        if (localStorage.getItem(LOCATION_KEY) === "city") setLocationMode("city");
        const savedSize = localStorage.getItem(SIZE_KEY);
        if (SIZES.some((s) => s.id === savedSize)) setSizeId(savedSize as SizeId);
        const savedRemote = JSON.parse(localStorage.getItem(REMOTE_KEY) ?? "null");
        if (savedRemote) setRemote(parsePair(`${savedRemote.id}.${savedRemote.key}`));
        const savedCountdown = localStorage.getItem(COUNTDOWN_KEY);
        if (savedCountdown) setCountdown(JSON.parse(savedCountdown));
        const savedCity = localStorage.getItem(CITY_KEY);
        if (savedCity) {
          setCity(savedCity);
          setCityDraft(savedCity);
        }
      } catch {
        // Depolama kapalı ya da bozuksa boş listeyle başla.
      }
      setRecordable(canRecord());
      setNotes(saved);
      setSpin((n) => n + 1);
    }, 300);
    return () => clearTimeout(boot);
  }, []);

  // Panoda gösterilecekler: açık olan saat ve hava durumu, ardından notlar.
  const items: Item[] = [];
  if (show.clock) items.push("clock");
  if (show.weather) items.push("weather");
  if (show.countdown) items.push("countdown");
  if (show.notes) notes?.forEach((_, i) => items.push(i));
  const noteOffset = (show.clock ? 1 : 0) + (show.weather ? 1 : 0) + (show.countdown ? 1 : 0);
  // Gösterilecek hiçbir şey yoksa uygulamayı tanıtan notlar döner.
  const intro = t.intro(COLS, ROWS);
  const showingIntro = items.length === 0;
  const pos = current % (showingIntro ? intro.length : items.length);
  const item: Item | undefined = showingIntro ? undefined : items[pos];
  const count = notes?.length ?? 0;

  // Birden fazla içerik varsa sırayla döner. Süre, her içerik gösterildiğinde
  // baştan başlar; elle seçilen not da tam süre ekranda kalır.
  const itemCount = showingIntro ? intro.length : items.length;
  const delaySec = showingIntro ? (lite ? INTRO_INTERVAL_LITE : INTRO_INTERVAL) : intervalSec;
  useEffect(() => {
    if (itemCount < 2 || recording) return;
    const t = setTimeout(() => {
      setColorful(rollColors());
      setSpin((n) => n + 1);
      setCurrent((c) => (c + 1) % itemCount);
    }, delaySec * 1000);
    return () => clearTimeout(t);
  }, [itemCount, current, delaySec, recording]);

  // Hava durumu açıkken yüklenir ve 15 dakikada bir yenilenir. Konum
  // otomatikse koordinat ve şehir adı bir kez alınır, yenilemelerde tekrar
  // kullanılır.
  useEffect(() => {
    if (!show.weather) return;
    const ctrl = new AbortController();
    let here: { lat: number; lon: number; name: string } | null = null;
    const fromHere = async () => {
      if (!here) {
        const c = await currentPosition();
        const name = await placeName(c.latitude, c.longitude, lang, ctrl.signal).catch(() => "");
        here = { lat: c.latitude, lon: c.longitude, name };
      }
      return fetchWeatherAt(here.lat, here.lon, here.name, ctrl.signal);
    };
    const load = () =>
      (locationMode === "auto" ? fromHere() : fetchWeather(city, lang, ctrl.signal)).then(
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
  }, [show.weather, city, locationMode, lang]);

  // Sayfa dili: tarayıcı başlığı ve not kutusundaki büyük harf dönüşümü (i/İ) için.
  useEffect(() => {
    document.documentElement.lang = lang;
    document.title = STRINGS[lang].title;
  }, [lang]);

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

  // Hafif görünüm: stil tarafı <html data-lite> ile, animasyon tarafı motorla.
  useEffect(() => {
    document.documentElement.toggleAttribute("data-lite", lite);
    setLiteMode(lite);
  }, [lite]);

  /* ---------- Telefondan kontrol: sunucuyla eşitleme ---------- */

  const sharedJson =
    notes === null
      ? null
      : JSON.stringify(toShared(notes, show, intervalSec, countdown, sizeId));

  /** Sunucudan gelen durumu panoya uygular ve tarayıcıda da saklar. */
  const applyRemote = useEffectEvent((data: Shared, v: number) => {
    const json = JSON.stringify(data);
    version.current = v;
    synced.current = json;
    if (json === sharedJson) return;
    const added = data.notes.length > (notes?.length ?? 0);
    setNotes(data.notes);
    setShow(data.show);
    setIntervalSec(data.intervalSec);
    setCountdown(data.countdown);
    setSizeId(data.size);
    store(NOTES_KEY, JSON.stringify(data.notes));
    store(SHOW_KEY, JSON.stringify(data.show));
    store(INTERVAL_KEY, String(data.intervalSec));
    store(SIZE_KEY, data.size);
    if (data.countdown) store(COUNTDOWN_KEY, JSON.stringify(data.countdown));
    else {
      try {
        localStorage.removeItem(COUNTDOWN_KEY);
      } catch {
        // depolama kapalı
      }
    }
    // Yeni not geldiyse hemen o gösterilir; yoksa döngü baştan başlar.
    const offset =
      (data.show.clock ? 1 : 0) + (data.show.weather ? 1 : 0) + (data.show.countdown ? 1 : 0);
    setColorful(rollColors());
    setSpin((n) => n + 1);
    setCurrent(added && data.show.notes ? offset + data.notes.length - 1 : 0);
  });

  // Sunucuyu düzenli sorgular. İlk okumada sunucudaki durum esas alınır.
  const loaded = notes !== null;
  useEffect(() => {
    if (!remote || !loaded) return;
    let alive = true;
    const tick = async () => {
      try {
        const known = synced.current === null ? undefined : version.current;
        const r = await readBoard(remote.id, known);
        // Sorgu yoldayken bu pano yazdıysa gelen yanıt eskidir; yok sayılır.
        if (!alive || r.v < version.current) return;
        if (r.data) applyRemote(r.data, r.v);
        setRemoteNote("");
      } catch (e) {
        if (!alive) return;
        setRemoteNote(e instanceof RemoteError && e.code === "not_found" ? "lost" : "error");
      }
    };
    void tick();
    const id = setInterval(tick, POLL_MS);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [remote, loaded]);

  // Bu panoda yapılan değişiklikleri sunucuya yazar.
  useEffect(() => {
    if (!remote || sharedJson === null) return;
    if (synced.current === null || synced.current === sharedJson) return;
    const t = setTimeout(async () => {
      try {
        const r = await writeBoard(remote, JSON.parse(sharedJson) as Shared, version.current);
        if (r.stale) applyRemote(r.stale, r.v);
        else {
          version.current = r.v;
          synced.current = sharedJson;
        }
      } catch {
        setRemoteNote("error");
      }
    }, PUSH_DELAY_MS);
    return () => clearTimeout(t);
  }, [remote, sharedJson]);

  // Eşleştirme kodu yalnızca istenince üretilir; kütüphane de o zaman yüklenir.
  useEffect(() => {
    if (!remote || !qrOpen) return;
    let alive = true;
    void import("qrcode")
      .then((QR) => QR.toDataURL(pairUrl(remote), { margin: 2, width: 560, errorCorrectionLevel: "M" }))
      .then((url) => {
        if (alive) setQr(url);
      });
    return () => {
      alive = false;
    };
  }, [remote, qrOpen]);

  const enableRemote = async () => {
    if (sharedJson === null || remoteNote === "busy") return;
    const pair = newPair();
    setRemoteNote("busy");
    try {
      version.current = await createBoard(pair, JSON.parse(sharedJson) as Shared);
      synced.current = sharedJson;
      store(REMOTE_KEY, JSON.stringify(pair));
      setRemote(pair);
      setRemoteNote("");
    } catch (e) {
      setRemoteNote(
        e instanceof RemoteError && e.code === "not_configured" ? "unavailable" : "error",
      );
    }
  };

  const disableRemote = async () => {
    if (!remote) return;
    const old = remote;
    setRemote(null);
    setQrOpen(false);
    setQr(null);
    setRemoteNote("");
    synced.current = null;
    try {
      localStorage.removeItem(REMOTE_KEY);
      await deleteBoard(old);
    } catch {
      // sunucuya ulaşılamadıysa kayıt bir yıl sonra kendiliğinden silinir
    }
  };

  const rotateRemote = async () => {
    if (!remote || !window.confirm(t.remoteRotateConfirm)) return;
    const next = newPair();
    try {
      version.current = await rotateBoard(remote, next);
      store(REMOTE_KEY, JSON.stringify(next));
      setQr(null);
      setRemote(next);
      setRemoteNote("");
    } catch {
      setRemoteNote("error");
    }
  };

  // Ses varsayılan olarak açık. Tarayıcılar ilk dokunuş ya da tuştan önce ses
  // çalmaya izin vermediği için asıl açılış o ilk etkileşimde olur.
  useEffect(() => {
    if (!soundOn) {
      setSound(false);
      return;
    }
    const unlock = () => setSound(true);
    if (navigator.userActivation?.hasBeenActive) unlock();
    const events = ["pointerdown", "keydown"] as const;
    events.forEach((e) => window.addEventListener(e, unlock));
    return () => events.forEach((e) => window.removeEventListener(e, unlock));
  }, [soundOn]);

  // Duvarda ekran olarak dururken kontroller gizlenir; dokununca geri gelir.
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const arm = () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        if (settings.current?.open || controls.current?.contains(document.activeElement)) arm();
        else setIdle(true);
      }, IDLE_MS);
    };
    const wake = () => {
      setIdle(false);
      arm();
    };
    arm();
    const events = ["pointermove", "pointerdown", "keydown"] as const;
    events.forEach((e) => window.addEventListener(e, wake));
    return () => {
      clearTimeout(timer);
      events.forEach((e) => window.removeEventListener(e, wake));
    };
  }, []);

  /**
   * Panonun kısa bir videosunu kaydeder. Tarayıcı önce sekme paylaşım izni
   * sorar; izin verilince pano boşalır, yazı baştan dönerek gelir ve kayıt
   * RECORD_MS sonra (ya da paylaşım durdurulunca) biter, dosya iner.
   */
  const recordVideo = async () => {
    if (recording) return;
    let stream: MediaStream;
    try {
      stream = await captureTab();
    } catch {
      return; // izin verilmedi ya da pencere kapatıldı
    }
    setRecording(true);
    setBlank(true);
    settings.current?.close();
    try {
      await sleep(800); // kontroller kaybolsun, pano boşalsın
      const rec = startRecording(stream);
      await sleep(500);
      setBlank(false);
      setColorful(rollColors());
      setSpin((n) => n + 1);
      await Promise.race([sleep(RECORD_MS), rec.ended]);
      const { blob, ext } = await rec.stop();
      if (blob.size) download(blob, `splitflat-${timestamp()}.${ext}`);
    } finally {
      stream.getTracks().forEach((track) => track.stop());
      setBlank(false);
      setRecording(false);
    }
  };

  const updateNotes = (next: string[]) => {
    setNotes(next);
    store(NOTES_KEY, JSON.stringify(next));
  };

  /** `items` içindeki `p` sırasındaki içeriği hemen gösterir. */
  const showAt = (p: number) => {
    setColorful(rollColors());
    setSpin((n) => n + 1);
    setCurrent(p);
  };

  const updateShow = (next: Show) => {
    setShow(next);
    store(SHOW_KEY, JSON.stringify(next));
    showAt(0);
  };

  const countdownTarget =
    countdown?.target || `${new Date(second * 1000).getFullYear() + 1}-01-01T00:00`;
  const saveCountdown = (next: Countdown) => {
    setCountdown(next);
    store(COUNTDOWN_KEY, JSON.stringify(next));
  };

  /** `i` numaralı notu gösterir; notlar kapalıysa açar. */
  const showNote = (i: number) => {
    if (!show.notes) {
      const next = { ...show, notes: true };
      setShow(next);
      store(SHOW_KEY, JSON.stringify(next));
    }
    showAt(noteOffset + i);
  };

  /** Yeni notu listenin sonuna ekler ve hemen panoda gösterir. */
  const add = (value: string) => {
    const text = value.trim();
    if (!text || !notes) return;
    // Liste doluysa en eski not düşer.
    const next = [...notes, text].slice(-MAX_NOTES);
    updateNotes(next);
    showNote(next.length - 1);
    setDraft("");
  };

  const remove = (index: number) => {
    if (!notes) return;
    const next = notes.filter((_, i) => i !== index);
    updateNotes(next);
    if (typeof item !== "number") return;
    if (index < item) setCurrent(pos - 1);
    else if (index === item) showAt(Math.max(0, Math.min(pos, items.length - 2)));
  };

  let content: string[] | null = null;
  if (blank) content = [];
  else if (notes !== null) {
    if (item === "clock") content = clockLines(second, show.seconds, t);
    else if (item === "weather") content = weatherLines(weather, t, lang);
    else if (item === "countdown") content = countdownLines(second, countdown, t, lang);
    else if (typeof item === "number") content = [upper(notes[item], lang)];
    else content = intro[pos];
  }
  const limit = Math.min(NOTE_LIMIT, COLS * ROWS);
  const lines = grid ? boardLines(content, grid.cols, grid.rows) : [];
  const focus = FOCUS;
  const panel = "border border-edge bg-pit/90 shadow-[0_10px_40px_rgba(0,0,0,.45)] backdrop-blur-md";
  const iconButton = `grid size-11 shrink-0 cursor-pointer place-items-center border border-edge bg-housing text-ink transition-colors hover:bg-flap-hi ${focus}`;
  const inlineButton = `absolute inset-y-1 grid w-9 cursor-pointer place-items-center text-muted transition-colors hover:bg-flap-hi hover:text-ink ${focus}`;

  return (
    <>
      <section
        aria-label={t.board}
        className={`${wallOn ? "wall" : "bg-pit"} fixed inset-0 grid place-items-center overflow-hidden ${idle || recording ? "cursor-none" : ""}`}
      >
        {/* Ekran okuyucular flap hücreleri yerine düz metni okur. */}
        <p className="sr-only">{content?.filter(Boolean).join(" ") ?? ""}</p>

        {grid && (
          <div
            className="board-frame relative bg-linear-to-b from-frame-hi to-frame shadow-[inset_0_2px_0_rgba(255,255,255,.13),inset_0_-2px_0_rgba(0,0,0,.7),inset_2px_0_0_rgba(255,255,255,.04),inset_-2px_0_0_rgba(0,0,0,.4),0_.12em_.2em_rgba(0,0,0,.5),0_.9em_1.4em_-.2em_rgba(0,0,0,.5),0_2.6em_3.6em_-.6em_rgba(0,0,0,.45)]"
            style={{ width: grid.width, height: grid.height, fontSize: grid.cw / 0.74 }}
          >
            {/* Çerçevenin içine gömülü pano yüzeyi; hücreler bunun içinde durur. */}
            <div
              aria-hidden
              className="board-surface absolute bg-housing bg-radial-[at_72%_0%] from-housing-hi to-housing to-65% shadow-[inset_0_0_0_1px_var(--color-slot),inset_0_.5em_.9em_var(--depth),inset_0_-.15em_.4em_rgba(0,0,0,.5),0_1px_0_rgba(255,255,255,.07)]"
              style={{ inset: grid.bezel }}
            />
            <div
              className="relative flex h-full flex-col"
              style={
                {
                  padding: grid.pad,
                  gap: grid.rowGap,
                  "--cw": `${grid.cw}px`,
                  "--ch": `${grid.ch}px`,
                } as CSSProperties
              }
            >
              {lines.map((line, r) => (
                <div key={r} className="flex" style={{ gap: grid.gap }}>
                  {Array.from(line.padEnd(grid.cols).slice(0, grid.cols), (ch, i) => (
                    <FlapCell key={i} char={ch} delay={r * 60 + i * 18} colors={colorful}
                      spin={spin}
                      instant={blank || item === "countdown" || (item === "clock" && show.seconds)}
                    />
                  ))}
                </div>
              ))}
            </div>
            {/* Alt nefes boşluğunda, yüzeye kazınmış gibi duran marka yazısı. */}
            <div
              aria-hidden
              className="pointer-events-none absolute inset-x-0 flex items-center justify-center text-[.2em] font-medium tracking-[.42em] text-[#4a4a4a] [text-shadow:0_-1px_0_rgba(0,0,0,.9),0_1px_0_rgba(255,255,255,.05)]"
              // Hücrelerin altındaki kenar ve ışık çizgisi (0,12em) göze hücrenin
              // parçası gibi görünür; yazı, ondan sonra kalan boşluğa ortalanır.
              style={{ bottom: grid.bezel, height: grid.pad - grid.bezel - LIP * (grid.cw / 0.74) }}
            >
              {/* harf aralığı son harften sonra da boşluk bırakır; ortalamak için dengelenir */}
              <span className="translate-y-[.07em] pl-[.42em]">{BRAND}</span>
            </div>
            {/* Panoya tek yönden düşen ışık: sağ üst aydınlık, alt kısım gölgede. */}
            <div
              aria-hidden
              className="board-light pointer-events-none absolute z-30 bg-[radial-gradient(110%_85%_at_72%_-8%,rgba(255,255,255,.09),transparent_60%),linear-gradient(to_bottom,transparent_45%,rgba(0,0,0,.32))]"
              style={{ inset: grid.bezel }}
            />
          </div>
        )}
        {/* Film greni: düz dijital yüzeyleri fotoğraf gibi gösterir. */}
        <div aria-hidden className="grain" />
      </section>

      {/* Hakkında: sağ üstte, alttaki kontrollerle birlikte gizlenip görünür. */}
      <Link
        href="/about"
        aria-label={t.about}
        title={t.about}
        className={`${panel} ${focus} fixed top-[max(1rem,env(safe-area-inset-top))] right-[max(1rem,env(safe-area-inset-right))] z-20 grid size-11 place-items-center text-ink transition-opacity duration-700 hover:bg-flap-hi ${
          recording
            ? "pointer-events-none invisible opacity-0"
            : idle
              ? "pointer-events-none opacity-0"
              : "opacity-100"
        }`}
      >
        <InfoIcon />
      </Link>

      <div
        ref={controls}
        className={`fixed inset-x-3 bottom-[max(1rem,env(safe-area-inset-bottom))] z-20 mx-auto flex max-w-[640px] flex-col gap-2 transition-opacity duration-700 ${
          recording
            ? "pointer-events-none invisible opacity-0"
            : idle
              ? "pointer-events-none opacity-0"
              : "opacity-100"
        }`}
      >
        {listOpen && (
          <div id="note-list" className={panel}>
            <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-edge px-4 py-3">
              <span className="text-[11px] font-semibold tracking-[.24em] text-muted">
                {t.notesHeading} · <span className="tabular-nums">{count}/{MAX_NOTES}</span>
              </span>
              {!showingIntro && itemCount > 1 && (
                <span className="text-[11px] tracking-[.14em] text-muted">
                  {t.rotatesEvery(intervalLabel(intervalSec, t))}
                </span>
              )}
            </div>
            {count === 0 ? (
              <p className="px-4 py-6 text-center text-sm text-muted">{t.noNotes}</p>
            ) : (
              <ul className="max-h-[38dvh] overflow-y-auto py-1">
                {notes!.map((n, i) => (
                  <li key={i} className="flex items-center">
                    <button
                      type="button"
                      aria-current={item === i}
                      className={`flex min-h-11 min-w-0 flex-1 cursor-pointer items-center gap-3 px-4 text-left text-sm tracking-wider transition-colors ${focus} ${
                        item === i ? "text-ink" : "text-muted hover:bg-housing-hi hover:text-ink"
                      }`}
                      onClick={() => showNote(i)}
                    >
                      <span
                        aria-hidden
                        className={`size-1.5 shrink-0 ${item === i ? "bg-ink" : "bg-edge"}`}
                      />
                      <span className="truncate">{upper(n, lang)}</span>
                    </button>
                    <button
                      type="button"
                      aria-label={`${t.deleteNote}: ${n}`}
                      title={t.deleteNote}
                      className={`mr-1 grid size-9 shrink-0 cursor-pointer place-items-center text-muted transition-colors hover:bg-housing-hi hover:text-ink ${focus}`}
                      onClick={() => remove(i)}
                    >
                      <ClearIcon />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        <form
          className={`${panel} flex flex-wrap justify-end gap-2 p-2`}
          onSubmit={(e) => {
            e.preventDefault();
            add(draft);
          }}
        >
          <div className="relative min-w-0 flex-[1_1_100%] sm:flex-[1_1_240px]">
            <input
              ref={input}
              value={draft}
              onChange={(e) => {
                // Panoya sığmayacak (satır sayısını aşan) metni kabul etme.
                const next = e.target.value;
                if (wrap(next, COLS).length <= ROWS) setDraft(next);
              }}
              maxLength={limit}
              autoComplete="off"
              enterKeyHint="done"
              aria-label={t.newNote}
              placeholder={t.notePlaceholder}
              className={`h-11 w-full border border-edge bg-flap-lo pr-36 pl-3 text-[15px] tracking-wider uppercase transition-colors placeholder:tracking-normal placeholder:text-muted placeholder:normal-case hover:border-muted ${focus}`}
            />
            {draft && (
              <span
                aria-hidden
                className={`pointer-events-none absolute inset-y-0 right-20 flex items-center text-xs tabular-nums ${
                  draft.length >= limit ? "text-ink" : "text-muted"
                }`}
              >
                {draft.length}/{limit}
              </span>
            )}
            {draft && (
              <button
                type="button"
                aria-label={t.clearDraft}
                title={t.clearDraft}
                className={`${inlineButton} right-10`}
                onClick={() => {
                  setDraft("");
                  input.current?.focus();
                }}
              >
                <ClearIcon />
              </button>
            )}
            <button
              type="submit"
              aria-label={t.addNote}
              title={t.addNoteTitle}
              className={`${inlineButton} right-1 ${draft ? "text-ink" : ""}`}
            >
              <EnterKeyIcon />
            </button>
          </div>
          <button
            type="button"
            aria-expanded={listOpen}
            aria-controls="note-list"
            aria-label={t.noteList}
            title={t.noteList}
            className={`${iconButton} relative ${listOpen ? "border-ink" : ""}`}
            onClick={() => setListOpen(!listOpen)}
          >
            <ListIcon />
            {count > 0 && (
              <span
                aria-hidden
                className="absolute -top-1.5 -right-1.5 grid h-4 min-w-4 place-items-center bg-ink px-1 text-[10px] leading-none font-bold text-pit tabular-nums"
              >
                {count}
              </span>
            )}
          </button>
          <button
            type="button"
            aria-haspopup="dialog"
            aria-label={t.settings}
            title={t.settings}
            className={iconButton}
            onClick={() => settings.current?.showModal()}
          >
            <SettingsIcon />
          </button>
          <button
            type="button"
            aria-label={t.downloadPng}
            title={t.downloadPng}
            className={iconButton}
            disabled={!grid}
            onClick={() => grid && savePng(grid, lines)}
          >
            <DownloadIcon />
          </button>
          {recordable && (
            <button
              type="button"
              aria-label={t.recordVideo}
              title={t.recordVideo}
              className={iconButton}
              onClick={() => void recordVideo()}
            >
              <RecordIcon />
            </button>
          )}
          <button
            type="button"
            aria-label={fullscreen ? t.exitFullscreen : t.fullscreen}
            title={fullscreen ? t.exitFullscreen : t.fullscreen}
            className={iconButton}
            onClick={() => {
              if (document.fullscreenElement) void document.exitFullscreen();
              else void document.documentElement.requestFullscreen?.();
            }}
          >
            {fullscreen ? <ExitFullscreenIcon /> : <EnterFullscreenIcon />}
          </button>
        </form>
      </div>

      {/* Ayarlar: yerel <dialog>; odak içinde kalır, Esc ve arka plana tıklama kapatır. */}
      <dialog
        ref={settings}
        aria-labelledby="settings-title"
        onClose={() => setQrOpen(false)}
        className="m-auto max-h-[calc(100dvh-2rem)] w-[min(440px,calc(100vw-1.5rem))] border border-edge bg-pit p-0 text-ink shadow-[0_24px_80px_rgba(0,0,0,.6)] backdrop:bg-black/55 backdrop:backdrop-blur-sm"
        onClick={(e) => {
          if (e.target === e.currentTarget) settings.current?.close();
        }}
      >
        <div className="flex max-h-[calc(100dvh-2rem)] flex-col">
          <header className="flex shrink-0 items-center justify-between border-b border-edge py-2 pr-2 pl-5">
            <h2 id="settings-title" className="text-sm font-semibold tracking-[.24em]">
              {t.settingsTitle}
            </h2>
            <button
              type="button"
              aria-label={t.close}
              title={t.close}
              className={`grid size-10 cursor-pointer place-items-center text-muted transition-colors hover:text-ink ${focus}`}
              onClick={() => settings.current?.close()}
            >
              <ClearIcon />
            </button>
          </header>

          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
            <Section title={t.showOnBoard}>
              <Toggle
                label={t.notes}
                checked={show.notes}
                onChange={(v) => updateShow({ ...show, notes: v })}
              />
              <Toggle
                label={t.clock}
                checked={show.clock}
                onChange={(v) => updateShow({ ...show, clock: v })}
              />
              {show.clock && (
                <div className="ml-1 border-l border-edge pl-4">
                  <Toggle
                    label={t.showSeconds}
                    checked={show.seconds}
                    onChange={(v) => {
                      const next = { ...show, seconds: v };
                      setShow(next);
                      store(SHOW_KEY, JSON.stringify(next));
                    }}
                  />
                </div>
              )}
              <Toggle
                label={t.countdown}
                checked={show.countdown}
                onChange={(v) => updateShow({ ...show, countdown: v })}
              />
              {show.countdown && (
                <div className="mb-1 ml-1 flex flex-col gap-2 border-l border-edge py-1 pl-4">
                  <input
                    value={countdown ? countdown.title : t.newYear}
                    onChange={(e) =>
                      saveCountdown({ title: e.target.value, target: countdownTarget })
                    }
                    maxLength={Math.min(COLS, TITLE_LIMIT)}
                    aria-label={t.countdownTitle}
                    placeholder={t.countdownTitle}
                    autoComplete="off"
                    className={`h-9 border border-edge bg-flap-lo px-3 text-sm tracking-wider uppercase transition-colors hover:border-muted ${focus}`}
                  />
                  <input
                    type="datetime-local"
                    value={countdownTarget}
                    onChange={(e) =>
                      saveCountdown({
                        title: countdown ? countdown.title : t.newYear,
                        target: e.target.value,
                      })
                    }
                    aria-label={t.countdownDate}
                    className={`h-9 border border-edge bg-flap-lo px-3 text-sm tracking-wider tabular-nums transition-colors [color-scheme:dark] hover:border-muted ${focus}`}
                  />
                </div>
              )}
              <Toggle
                label={t.weather}
                checked={show.weather}
                onChange={(v) => updateShow({ ...show, weather: v })}
              />
              {show.weather && (
                <div className="mb-1 ml-1 flex flex-col gap-2 border-l border-edge py-1 pl-4">
                  <Segmented
                    label={t.location}
                    value={locationMode}
                    options={[
                      { value: "auto", label: t.myLocation },
                      { value: "city", label: t.chooseCity },
                    ]}
                    onChange={(v) => {
                      setWeather(null);
                      setLocationMode(v);
                      store(LOCATION_KEY, v);
                    }}
                  />
                  {locationMode === "city" && (
                    <form
                      className="flex gap-2"
                      onSubmit={(e) => {
                        e.preventDefault();
                        const next = cityDraft.trim();
                        if (!next || next === city) return;
                        setWeather(null);
                        setCity(next);
                        store(CITY_KEY, next);
                      }}
                    >
                      <input
                        value={cityDraft}
                        onChange={(e) => setCityDraft(e.target.value)}
                        aria-label={t.city}
                        placeholder={t.city}
                        autoComplete="off"
                        className={`h-9 min-w-0 flex-1 border border-edge bg-flap-lo px-3 text-sm tracking-wider uppercase transition-colors hover:border-muted ${focus}`}
                      />
                      <button
                        type="submit"
                        className={`h-9 cursor-pointer border border-edge px-3 text-xs font-semibold tracking-wider text-muted transition-colors hover:border-ink hover:text-ink ${focus}`}
                      >
                        {t.save}
                      </button>
                    </form>
                  )}
                  {weather === "error" && (
                    <p role="status" className="text-xs leading-relaxed text-muted">
                      {locationMode === "auto" ? t.locationError : t.cityError}
                    </p>
                  )}
                </div>
              )}
              <p className={FIELD_LABEL}>{t.interval}</p>
              <Segmented
                label={t.interval}
                value={intervalSec}
                options={INTERVALS.map((o) => ({ value: o.sec, label: intervalLabel(o.sec, t) }))}
                onChange={(v) => {
                  setIntervalSec(v);
                  store(INTERVAL_KEY, String(v));
                }}
              />
            </Section>

            <Section title={t.boardSection}>
              <p className={FIELD_LABEL}>{t.cellCount}</p>
              <Segmented
                label={t.cellCount}
                value={sizeId}
                options={SIZES.map((o) => ({
                  value: o.id,
                  label: `${o.cols}×${o.rows}`,
                  aria: t.cellsAria(o.cols, o.rows),
                }))}
                onChange={(v) => {
                  setSizeId(v);
                  store(SIZE_KEY, v);
                  showAt(current);
                }}
              />
              <div className="mt-2">
                <Toggle
                  label={t.wall}
                  checked={wallOn}
                  onChange={(next) => {
                    setWallOn(next);
                    store(WALL_KEY, next ? "on" : "off");
                  }}
                />
                <Toggle
                  label={t.lite}
                  checked={lite}
                  onChange={(next) => {
                    setLite(next);
                    store(LITE_KEY, next ? "on" : "off");
                  }}
                />
                <Toggle
                  label={t.sound}
                  checked={soundOn}
                  onChange={(next) => {
                    setSoundOn(next);
                    store(SOUND_KEY, next ? "on" : "off");
                  }}
                />
              </div>
            </Section>

            <Section title={t.remoteSection}>
              <Toggle
                label={t.remoteToggle}
                checked={remote !== null}
                onChange={(v) => void (v ? enableRemote() : disableRemote())}
              />
              <p className="text-xs leading-relaxed text-muted">{t.remoteHelp}</p>
              {remote && (
                <div className="mt-3 flex flex-col gap-2">
                  {qrOpen && (
                    <div className="grid place-items-center bg-white p-2">
                      {qr ? (
                        // eslint-disable-next-line @next/next/no-img-element -- tarayıcıda üretilen veri adresi
                        <img src={qr} alt={t.remoteQrAlt} className="aspect-square w-full max-w-[280px]" />
                      ) : (
                        <div className="aspect-square w-full max-w-[280px]" />
                      )}
                    </div>
                  )}
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      aria-expanded={qrOpen}
                      className={`h-9 cursor-pointer border px-2 text-xs font-semibold tracking-wider transition-colors ${focus} ${
                        qrOpen
                          ? "border-edge text-muted hover:text-ink"
                          : "border-ink bg-ink text-pit hover:bg-white"
                      }`}
                      onClick={() => setQrOpen(!qrOpen)}
                    >
                      {qrOpen ? t.remoteHide : t.remotePair}
                    </button>
                    <button
                      type="button"
                      className={`h-9 cursor-pointer border border-edge px-2 text-xs font-semibold tracking-wider text-muted transition-colors hover:border-ink hover:text-ink ${focus}`}
                      onClick={() => {
                        void navigator.clipboard?.writeText(pairUrl(remote)).then(() => {
                          setCopied(true);
                          setTimeout(() => setCopied(false), 1500);
                        });
                      }}
                    >
                      {copied ? t.remoteCopied : t.remoteCopy}
                    </button>
                  </div>
                  <button
                    type="button"
                    className={`h-9 cursor-pointer border border-edge px-2 text-xs font-semibold tracking-wider text-muted transition-colors hover:border-ink hover:text-ink ${focus}`}
                    onClick={() => void rotateRemote()}
                  >
                    {t.remoteRotate}
                  </button>
                </div>
              )}
              {remoteNote && remoteNote !== "busy" && (
                <p role="status" className="mt-2 text-xs leading-relaxed text-ink">
                  {remoteNote === "unavailable"
                    ? t.remoteUnavailable
                    : remoteNote === "lost"
                      ? t.remoteLost
                      : t.remoteError}
                </p>
              )}
            </Section>

            <Section title={t.language}>
              <div className="mt-3">
                <Segmented
                  label={t.language}
                  value={lang}
                  options={LANGS}
                  onChange={(v) => {
                    setLang(v);
                    store(LANG_KEY, v);
                    showAt(current);
                  }}
                />
              </div>
            </Section>

            <div className="flex items-center justify-between border-t border-edge px-5 py-4">
              <span className="text-[11px] tracking-[.42em] text-muted">{BRAND}</span>
              <Link
                href="/about"
                className={`text-xs font-semibold tracking-[.2em] text-muted uppercase transition-colors hover:text-ink ${focus}`}
              >
                {t.about} →
              </Link>
            </div>
          </div>

        </div>
      </dialog>
    </>
  );
}
