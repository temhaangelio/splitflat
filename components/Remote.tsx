"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import Tiles from "@/components/Tiles";
import { FIELD_LABEL, FOCUS, Segmented, Toggle } from "@/components/ui";
import {
  boardLines,
  CITY_LIMIT,
  defaultShared,
  fits,
  INTERVALS,
  MAX_NOTES,
  NOTE_LIMIT,
  sizeOf,
  TITLE_LIMIT,
  type Shared,
} from "@/lib/board";
import { BRAND, LANGS, STRINGS, upper, type Strings } from "@/lib/i18n";
import {
  createBoard,
  deleteBoard,
  forgetWifi,
  pairUrl,
  parsePair,
  readBoard,
  RemoteError,
  writeBoard,
  type Pair,
} from "@/lib/remote";
import { useLang } from "@/lib/useLang";

// Panonun kumandası. Pano yalnızca gösterir; not eklemek ve bütün ayarlar
// buradan yapılır. Sayfaya panodaki kod okutularak gelinir: anahtarlar bu
// tarayıcıda saklanır ve adres çubuğundan hemen silinir. Her değişiklik
// sunucuya yazılır; pano birkaç saniye içinde alır.

const PAIR_KEY = "splitflat:pair";
const HOME_HINT_KEY = "splitflat:home-hint"; // "hidden": ipucu kapatıldı
const POLL_MS = 10_000;

type Status = "loading" | "unpaired" | "gone" | "ready";

/** Pano silinmiş ya da eşleşmesi sıfırlanmışsa bu telefonun anahtarları artık geçersizdir. */
const isGone = (e: unknown) =>
  e instanceof RemoteError && (e.code === "not_found" || e.code === "forbidden");

export default function Remote() {
  const browserPref = useLang();
  const [pair, setPair] = useState<Pair | null>(null);
  const [status, setStatus] = useState<Status>("loading");
  const [data, setData] = useState<Shared | null>(null);
  const [offline, setOffline] = useState(false);
  const [draft, setDraft] = useState("");
  const [sent, setSent] = useState(false);
  const [copied, setCopied] = useState(false);
  // Sıfırlama sonucu: WiFi sıfırlandıysa telefonun bağlantısı kopacak.
  const [resetNote, setResetNote] = useState<"" | "wifi" | "failed" | "unsupported">("");
  // "Ana ekrana ekle" ipucu: hangi telefonun yönergesi gösterilecek.
  const [homeHint, setHomeHint] = useState<"ios" | "android" | null>(null);
  const version = useRef(0);
  // Kod az önce okutuldu: pano sunucuda henüz yoksa bu telefon oluşturur.
  const fresh = useRef(false);
  const input = useRef<HTMLInputElement>(null);

  // Sayfa, panonun dilini kullanır; pano yüklenene kadar tarayıcının dilini.
  const lang = data?.lang ?? browserPref;
  const t = STRINGS[lang];

  useEffect(() => {
    document.documentElement.lang = lang;
    document.title = `${t.phoneTitle} · ${STRINGS[lang].title}`;
  }, [lang, t.phoneTitle]);

  // Anahtarlar: önce adresteki eşleştirme bağlantısı, yoksa kayıtlı eşleşme.
  useEffect(() => {
    const boot = setTimeout(() => {
      let found = parsePair(location.hash);
      try {
        if (found) {
          fresh.current = true;
          localStorage.setItem(PAIR_KEY, JSON.stringify(found));
          // Anahtar adres çubuğunda, geçmişte ve ekran görüntülerinde kalmasın.
          history.replaceState(null, "", location.pathname);
        } else {
          const saved = JSON.parse(localStorage.getItem(PAIR_KEY) ?? "null");
          found = saved ? parsePair(`${saved.id}.${saved.key}`) : null;
        }
      } catch {
        // depolama kapalıysa eşleşme yalnızca bu oturumda geçerli
      }
      setPair(found);
      if (!found) setStatus("unpaired");
    }, 0);
    return () => clearTimeout(boot);
  }, []);

  // Panonun durumunu okur; sayfa açıkken düzenli yeniler (arka plandayken değil).
  useEffect(() => {
    if (!pair) return;
    let alive = true;
    const load = async () => {
      if (document.visibilityState !== "visible") return;
      try {
        const r = await readBoard(pair.id, version.current || undefined);
        if (!alive || r.v < version.current) return;
        version.current = r.v;
        if (r.data) setData(r.data);
        fresh.current = false;
        setOffline(false);
        setStatus("ready");
      } catch (e) {
        if (!alive) return;
        if (isGone(e) && fresh.current) {
          // İlk okutma: panonun kaydını bu telefon açar. Pano bunu görünce
          // eşleşir ve ekranındaki kodu kaldırır.
          fresh.current = false;
          try {
            const first = defaultShared(browserPref);
            version.current = await createBoard(pair, first);
            if (!alive) return;
            setData(first);
            setOffline(false);
            setStatus("ready");
          } catch (created) {
            if (!alive) return;
            if (created instanceof RemoteError && created.code === "conflict") void load();
            else setOffline(true);
          }
        } else if (isGone(e)) setStatus("gone");
        else setOffline(true);
      }
    };
    void load();
    const id = setInterval(load, POLL_MS);
    document.addEventListener("visibilitychange", load);
    return () => {
      alive = false;
      clearInterval(id);
      document.removeEventListener("visibilitychange", load);
    };
  }, [pair, browserPref]);

  /** Değişikliği hemen ekranda gösterir, sonra sunucuya yazar. */
  const change = async (next: Shared, announce = false) => {
    if (!pair) return;
    setData(next);
    try {
      const r = await writeBoard(pair, next, version.current);
      version.current = r.v;
      if (r.stale) setData(r.stale); // arada başka cihaz yazmış: güncel durum esas
      setOffline(false);
      if (announce && !r.stale) {
        setSent(true);
        setTimeout(() => setSent(false), 2000);
      }
    } catch (e) {
      if (isGone(e)) setStatus("gone");
      else setOffline(true);
    }
  };

  // Ana ekran ipucu: kumanda zaten ana ekrandan açılmadıysa ve kapatılmadıysa.
  // Ana ekrana eklenen kısayol o anki adresi saklar; iOS'ta ana ekrandaki
  // uygulamanın tarayıcıdan ayrı bir deposu vardır. Bu yüzden ipucu görünürken
  // eşleşme adresin `#` kısmına geri konur: kısayol açılınca kendini eşler
  // (ve adres yine hemen temizlenir).
  useEffect(() => {
    if (status !== "ready" || !pair) return;
    const nav = navigator as Navigator & { standalone?: boolean };
    let hidden = false;
    try {
      hidden = localStorage.getItem(HOME_HINT_KEY) === "hidden";
    } catch {
      // depolama kapalıysa ipucu her seferinde görünür
    }
    if (hidden || nav.standalone || matchMedia("(display-mode: standalone)").matches) return;
    const ios =
      /iPhone|iPad|iPod/.test(nav.userAgent) ||
      (nav.userAgent.includes("Macintosh") && nav.maxTouchPoints > 1);
    history.replaceState(null, "", `${location.pathname}#${pair.id}.${pair.key}`);
    const show = setTimeout(() => setHomeHint(ios ? "ios" : "android"), 0);
    return () => {
      clearTimeout(show);
      history.replaceState(null, "", location.pathname);
    };
  }, [status, pair]);

  const hideHomeHint = () => {
    try {
      localStorage.setItem(HOME_HINT_KEY, "hidden");
    } catch {
      // depolama kapalı
    }
    history.replaceState(null, "", location.pathname);
    setHomeHint(null);
  };

  const forgetLocally = () => {
    try {
      localStorage.removeItem(PAIR_KEY);
    } catch {
      // depolama kapalı
    }
    version.current = 0;
    setPair(null);
    setData(null);
    setStatus("unpaired");
  };

  const forget = () => {
    if (window.confirm(t.phoneForgetConfirm)) forgetLocally();
  };

  /** Panonun sunucudaki kaydını siler: bütün telefonlar düşer, pano yeni kod gösterir. */
  const resetPairing = async () => {
    if (!pair || !window.confirm(t.resetConfirm)) return;
    try {
      await deleteBoard(pair);
      forgetLocally();
    } catch {
      setOffline(true);
    }
  };

  /** Notları siler, ayarları varsayılana döndürür; eşleşme ve WiFi kalır. */
  const resetContent = () => {
    if (!data || !window.confirm(t.resetContentConfirm)) return;
    void change(defaultShared(data.lang));
  };

  /** Pi ağı unutur ve kurulum ağını açar; `all` ile pano kaydı da silinir. */
  const resetWifi = async (all: boolean) => {
    if (!pair || !window.confirm(all ? t.resetAllConfirm : t.resetWifiConfirm)) return;
    try {
      await forgetWifi(pair, all);
      setResetNote("wifi");
      if (all) {
        try {
          localStorage.removeItem(PAIR_KEY);
        } catch {
          // depolama kapalı
        }
      }
    } catch (e) {
      setResetNote(e instanceof RemoteError && e.status === 501 ? "unsupported" : "failed");
    }
  };

  const size = data ? sizeOf(data.size) : null;
  const text = draft.trim();
  const full = (data?.notes.length ?? 0) >= MAX_NOTES;
  const tooLong = !!data && !!text && !fits(text, data.size);
  const limit = size ? Math.min(NOTE_LIMIT, size.cols * size.rows) : NOTE_LIMIT;
  const field = `h-12 w-full min-w-0 border border-edge bg-flap-lo px-3.5 text-[15px] tracking-wider uppercase transition-colors placeholder:tracking-normal placeholder:text-muted placeholder:normal-case hover:border-muted focus:border-ink ${FOCUS}`;
  const card = "border border-edge bg-housing";

  const addNote = () => {
    if (!data || !text || full || tooLong) return;
    // Notlar kapalıysa yeni not görünsün diye açılır.
    void change(
      { ...data, notes: [...data.notes, text], show: { ...data.show, notes: true } },
      true,
    );
    setDraft("");
    input.current?.focus();
  };

  const copyLink = () => {
    if (!pair) return;
    const url = pairUrl(pair);
    // Ev ağında sayfa şifresiz (http) sunulur; tarayıcılar orada panoya
    // kopyalamaya izin vermez. O zaman bağlantı gösterilir.
    if (!navigator.clipboard) {
      window.prompt(t.shareLink, url);
      return;
    }
    void navigator.clipboard.writeText(url).then(
      () => {
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      },
      () => window.prompt(t.shareLink, url),
    );
  };

  return (
    <main className="min-h-dvh bg-pit text-ink">
      <div className="mx-auto flex max-w-[520px] flex-col px-4 pt-[max(1.25rem,env(safe-area-inset-top))] pb-[max(6rem,calc(env(safe-area-inset-bottom)+5rem))]">
        <header className="mb-6 flex items-center justify-between gap-4">
          <h1>
            <span className="sr-only">Split Flap · {t.phoneTitle}</span>
            <Tiles text={BRAND} className="text-[1.05rem]" />
          </h1>
          <div className="flex items-center gap-1">
            {status === "ready" && <Connection online={!offline} t={t} />}
            <Link
              href="/about"
              aria-label={t.about}
              className={`grid size-10 place-items-center text-muted transition-colors hover:text-ink ${FOCUS}`}
            >
              <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
                <circle cx="12" cy="12" r="9" />
                <path d="M12 11v6M12 7.5v.01" strokeLinecap="round" />
              </svg>
            </Link>
          </div>
        </header>

        {status === "loading" && (
          <div className="grid place-items-center py-16 text-muted">
            <span className="sr-only">{t.phoneLoading}</span>
            <span aria-hidden className="inline-flex gap-1.5">
              {[0, 1, 2].map((i) => (
                <span key={i} className="wait-dot size-2 rounded-full bg-current" style={{ animationDelay: `${i * 200}ms` }} />
              ))}
            </span>
          </div>
        )}
        {status === "unpaired" && (
          <div className={`${card} flex flex-col items-center gap-4 px-6 py-10 text-center`}>
            <svg viewBox="0 0 24 24" className="size-10 text-muted" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
              <path d="M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h2v2h-2zM18 18h2v2h-2zM14 18h2M18 14h2" />
            </svg>
            <p className="text-[15px] leading-relaxed text-muted">{t.phoneNotPaired}</p>
          </div>
        )}
        {status === "gone" && (
          <div className={`${card} flex flex-col gap-4 p-5`}>
            <p role="alert" className="text-[15px] leading-relaxed">
              {t.phoneGone}
            </p>
            <button type="button" className={quietButton} onClick={forgetLocally}>
              {t.phoneForget}
            </button>
          </div>
        )}

        {status === "ready" && data && size && (
          <div className="flex flex-col gap-8">
            {homeHint && (
              <aside className={`${card} flex items-start gap-3 p-4`}>
                <svg viewBox="0 0 24 24" className="mt-0.5 size-5 shrink-0 text-muted" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
                  <rect x="6" y="2.5" width="12" height="19" rx="1.5" />
                  <path d="M12 8v6M9 11h6" strokeLinecap="round" />
                </svg>
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <p className="text-sm font-semibold tracking-wide">{t.homeHintTitle}</p>
                  <p className="text-[13.5px] leading-relaxed text-muted">
                    {homeHint === "ios" ? t.homeHintIos : t.homeHintAndroid}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={hideHomeHint}
                  aria-label={t.homeHintClose}
                  className={`-m-2 grid size-10 shrink-0 cursor-pointer place-items-center text-muted transition-colors hover:text-ink ${FOCUS}`}
                >
                  <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                    <path d="M6 6l12 12M18 6L6 18" />
                  </svg>
                </button>
              </aside>
            )}

            {/* Yeni not: yazılan, panodaki gibi önizlenir. */}
            <section aria-label={t.newNote} className="flex flex-col gap-3">
              <Preview
                text={text ? upper(text, lang) : ""}
                placeholder={t.previewEmpty}
                cols={size.cols}
                rows={size.rows}
                over={tooLong}
              />
              <form
                className="flex gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  addNote();
                }}
              >
                <input
                  ref={input}
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  maxLength={limit}
                  autoComplete="off"
                  enterKeyHint="send"
                  aria-label={t.newNote}
                  aria-invalid={tooLong}
                  placeholder={t.newNote}
                  className={`${field} flex-1`}
                />
                <button
                  type="submit"
                  disabled={!text || full || tooLong}
                  aria-label={t.phoneAdd}
                  className={`grid h-12 w-14 shrink-0 cursor-pointer place-items-center bg-ink text-pit transition-colors hover:bg-white disabled:cursor-default disabled:bg-edge disabled:text-muted ${FOCUS}`}
                >
                  <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden>
                    <path d="M5 12h13M13 6l6 6-6 6" strokeLinecap="square" />
                  </svg>
                </button>
              </form>
              <p role="status" className="flex min-h-4 justify-between gap-3 text-xs text-muted">
                <span className={tooLong || full ? "text-ink" : ""}>
                  {tooLong ? t.phoneTooLong : full ? t.phoneFull : ""}
                </span>
                {draft && (
                  <span className="tabular-nums">
                    {draft.length}/{limit}
                  </span>
                )}
              </p>
            </section>

            <Group title={`${t.notesHeading} · ${data.notes.length}/${MAX_NOTES}`}>
              {data.notes.length === 0 ? (
                <p className="px-4 py-5 text-sm leading-relaxed text-muted">{t.noNotes}</p>
              ) : (
                <ol>
                  {data.notes.map((n, i) => (
                    <li key={i} className="flex items-center border-t border-edge first:border-t-0">
                      <span className="w-11 shrink-0 pl-4 text-xs text-muted tabular-nums">
                        {String(i + 1).padStart(2, "0")}
                      </span>
                      <span className="min-w-0 flex-1 py-3.5 text-[15px] font-semibold tracking-wider break-words">
                        {upper(n, lang)}
                      </span>
                      <button
                        type="button"
                        aria-label={`${t.deleteNote}: ${n}`}
                        className={`mr-1 grid size-11 shrink-0 cursor-pointer place-items-center text-muted transition-colors hover:text-ink ${FOCUS}`}
                        onClick={() =>
                          void change({ ...data, notes: data.notes.filter((_, j) => j !== i) })
                        }
                      >
                        <svg viewBox="0 0 24 24" aria-hidden className="size-[18px]" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
                          <path d="m6 6 12 12" />
                          <path d="M18 6 6 18" />
                        </svg>
                      </button>
                    </li>
                  ))}
                </ol>
              )}
            </Group>

            <Group title={t.showOnBoard}>
              <Row>
                <Toggle
                  label={t.notes}
                  checked={data.show.notes}
                  onChange={(v) => void change({ ...data, show: { ...data.show, notes: v } })}
                />
              </Row>
              <Row>
                <Toggle
                  label={t.clock}
                  checked={data.show.clock}
                  onChange={(v) => void change({ ...data, show: { ...data.show, clock: v } })}
                />
                {data.show.clock && (
                  <Nested>
                    <Toggle
                      label={t.showSeconds}
                      checked={data.show.seconds}
                      onChange={(v) => void change({ ...data, show: { ...data.show, seconds: v } })}
                    />
                  </Nested>
                )}
              </Row>
              <Row>
                <Toggle
                  label={t.countdown}
                  checked={data.show.countdown}
                  onChange={(v) => void change({ ...data, show: { ...data.show, countdown: v } })}
                />
                {data.show.countdown && (
                  <Nested>
                    <input
                      // Yazarken her tuşta sunucuya gitmesin: alan terk edilince kaydedilir.
                      key={`title-${data.countdown?.title ?? ""}`}
                      defaultValue={data.countdown?.title ?? t.newYear}
                      maxLength={Math.min(size.cols, TITLE_LIMIT)}
                      aria-label={t.countdownTitle}
                      placeholder={t.countdownTitle}
                      autoComplete="off"
                      enterKeyHint="done"
                      className={field}
                      onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
                      onBlur={(e) => {
                        const title = e.target.value;
                        if (title === (data.countdown?.title ?? t.newYear)) return;
                        void change({
                          ...data,
                          countdown: { title, target: data.countdown?.target ?? "" },
                        });
                      }}
                    />
                    <input
                      type="datetime-local"
                      value={data.countdown?.target ?? ""}
                      aria-label={t.countdownDate}
                      className={`${field} tabular-nums [color-scheme:dark]`}
                      onChange={(e) =>
                        void change({
                          ...data,
                          countdown: {
                            title: data.countdown?.title ?? t.newYear,
                            target: e.target.value,
                          },
                        })
                      }
                    />
                  </Nested>
                )}
              </Row>
              <Row>
                <Toggle
                  label={t.weather}
                  checked={data.show.weather}
                  onChange={(v) => void change({ ...data, show: { ...data.show, weather: v } })}
                />
                {data.show.weather && (
                  <Nested>
                    <input
                      key={`city-${data.city}`}
                      defaultValue={data.city}
                      maxLength={CITY_LIMIT}
                      aria-label={t.city}
                      placeholder={t.city}
                      autoComplete="off"
                      enterKeyHint="done"
                      className={field}
                      onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
                      onBlur={(e) => {
                        const city = e.target.value.trim();
                        if (!city || city === data.city) return;
                        void change({ ...data, city });
                      }}
                    />
                  </Nested>
                )}
              </Row>
              <Row>
                <p className={FIELD_LABEL}>{t.interval}</p>
                <Segmented
                  label={t.interval}
                  value={data.intervalSec}
                  options={INTERVALS.map((o) => ({ value: o.sec, label: `${o.n} ${t[o.unit]}` }))}
                  onChange={(v) => void change({ ...data, intervalSec: v })}
                />
              </Row>
            </Group>

            <Group title={t.general}>
              <Row>
                <Toggle
                  label={t.sound}
                  checked={data.sound}
                  onChange={(v) => void change({ ...data, sound: v })}
                />
              </Row>
              <Row>
                <p className={FIELD_LABEL}>{t.boardLanguage}</p>
                <Segmented
                  label={t.boardLanguage}
                  value={data.lang}
                  options={LANGS}
                  onChange={(v) => void change({ ...data, lang: v })}
                />
              </Row>
            </Group>

            <Group title={t.pairing}>
              <p className="px-4 pt-4 text-[13px] leading-relaxed text-muted">{t.shareHelp}</p>
              <div className="flex flex-col">
                <Action label={copied ? t.shareCopied : t.shareLink} onClick={copyLink} />
                <Action label={t.resetPairing} onClick={() => void resetPairing()} />
                <Action label={t.phoneForget} onClick={forget} />
              </div>
            </Group>

            <Group title={t.resetSection}>
              {resetNote === "wifi" ? (
                <p role="status" className="p-4 text-sm leading-relaxed">
                  {t.resetWifiSent}
                </p>
              ) : (
                <div className="flex flex-col">
                  <Action label={t.resetContent} help={t.resetContentHelp} onClick={resetContent} />
                  <Action label={t.resetWifi} help={t.resetWifiHelp} onClick={() => void resetWifi(false)} />
                  <Action label={t.resetAll} help={t.resetAllHelp} onClick={() => void resetWifi(true)} danger />
                  {resetNote && (
                    <p role="alert" className="border-t border-edge p-4 text-xs leading-relaxed text-ink">
                      {resetNote === "unsupported" ? t.resetWifiUnsupported : t.resetFailed}
                    </p>
                  )}
                </div>
              )}
            </Group>
          </div>
        )}
      </div>

      {/* Gönderildi / bağlantı yok: ekranın altında kısa bir bildirim. */}
      <div
        role="status"
        aria-live="polite"
        className={`pointer-events-none fixed inset-x-0 bottom-[max(1.25rem,env(safe-area-inset-bottom))] z-20 flex justify-center px-4 transition-[opacity,transform] duration-200 ${
          status === "ready" && (sent || offline) ? "translate-y-0 opacity-100" : "translate-y-2 opacity-0"
        }`}
      >
        <p
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-semibold tracking-wide ${
            offline ? "border border-ink bg-pit text-ink" : "bg-ink text-pit"
          }`}
        >
          {offline ? (
            t.phoneOffline
          ) : (
            <>
              <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="3" aria-hidden>
                <path d="M4 12.5l5 5L20 6.5" />
              </svg>
              {t.phoneSent}
            </>
          )}
        </p>
      </div>
    </main>
  );
}

const quietButton = `h-11 cursor-pointer border border-edge px-3 text-xs font-semibold tracking-wider text-muted transition-colors hover:border-ink hover:text-ink ${FOCUS}`;

/** Başlıklı kart: bir grup ayar. */
function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      <h2 className="px-1 text-[11px] font-semibold tracking-[.24em] text-muted uppercase">{title}</h2>
      <div className="border border-edge bg-housing">{children}</div>
    </section>
  );
}

/** Karttaki bir satır. */
function Row({ children }: { children: React.ReactNode }) {
  return <div className="border-t border-edge px-4 py-1.5 first:border-t-0 [&>p:first-child]:mt-2">{children}</div>;
}

/** Bir ayarın açılınca görünen alt seçenekleri. */
function Nested({ children }: { children: React.ReactNode }) {
  return <div className="mb-2.5 ml-0.5 flex flex-col gap-2 border-l-2 border-edge pl-3.5">{children}</div>;
}

/** Karttaki düğme satırı; isteğe bağlı açıklamayla. */
function Action({
  label,
  help,
  onClick,
  danger = false,
}: {
  label: string;
  help?: string;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`group flex min-h-13 w-full cursor-pointer items-center gap-3 border-t border-edge px-4 py-3 text-left first:border-t-0 transition-colors hover:bg-flap-lo ${FOCUS} focus-visible:-outline-offset-2`}
    >
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className={`text-[13px] font-semibold tracking-wider ${danger ? "text-danger" : "text-ink"}`}>
          {label}
        </span>
        {help && <span className="text-[12.5px] leading-snug text-muted">{help}</span>}
      </span>
      <svg viewBox="0 0 24 24" className="size-4 shrink-0 text-muted transition-colors group-hover:text-ink" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
        <path d="M9 6l6 6-6 6" />
      </svg>
    </button>
  );
}

/** Başlıktaki bağlantı durumu. */
function Connection({ online, t }: { online: boolean; t: Strings }) {
  return (
    <span className="flex items-center gap-2 px-2 text-[11px] font-semibold tracking-[.18em] text-muted uppercase">
      <span
        aria-hidden
        className={`size-2 rounded-full ${online ? "bg-live shadow-[0_0_0_3px_rgba(74,222,128,.15)]" : "bg-danger"}`}
      />
      {online ? t.connected : t.disconnected}
    </span>
  );
}

/** Yazılan notun panodaki görünümü: küçük, durağan hücreler. */
function Preview({
  text,
  placeholder,
  cols,
  rows,
  over,
}: {
  text: string;
  placeholder: string;
  cols: number;
  rows: number;
  over: boolean;
}) {
  const lines = boardLines([text || placeholder], cols, rows);
  return (
    <div
      aria-hidden
      className={`border bg-housing p-[2.4%] transition-colors ${over ? "border-ink" : "border-edge"}`}
    >
      <div className="grid gap-y-[1.4%]" style={{ gridTemplateRows: `repeat(${rows}, minmax(0, 1fr))` }}>
        {lines.map((line, r) => (
          <div key={r} className="grid gap-x-[.9%]" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
            {Array.from(line.padEnd(cols).slice(0, cols), (ch, i) => (
              <span
                key={i}
                className="relative grid aspect-[1/1.42] place-items-center bg-linear-to-b from-flap-hi to-flap shadow-[0_0_0_1px_var(--color-slot)] after:absolute after:inset-x-0 after:top-[calc(50%-.5px)] after:h-px after:bg-hinge after:content-['']"
              >
                <span
                  className={`text-[clamp(.7rem,4.6vw,1.45rem)] leading-none font-bold ${text ? "text-ink" : "text-muted/45"}`}
                >
                  {ch}
                </span>
              </span>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
