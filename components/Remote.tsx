"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import Tiles from "@/components/Tiles";
import { FIELD_LABEL, FOCUS, Section, Segmented, Toggle } from "@/components/ui";
import {
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
import { BRAND, LANGS, STRINGS, upper } from "@/lib/i18n";
import {
  createBoard,
  deleteBoard,
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

  const size = data ? sizeOf(data.size) : null;
  const text = draft.trim();
  const full = (data?.notes.length ?? 0) >= MAX_NOTES;
  const tooLong = !!data && !!text && !fits(text, data.size);
  const field = `h-11 min-w-0 border border-edge bg-flap-lo px-3 text-[15px] tracking-wider uppercase transition-colors placeholder:tracking-normal placeholder:text-muted placeholder:normal-case hover:border-muted ${FOCUS}`;
  const quiet = `h-11 cursor-pointer border border-edge px-3 text-xs font-semibold tracking-wider text-muted transition-colors hover:border-ink hover:text-ink ${FOCUS}`;

  return (
    <main className="min-h-dvh bg-pit text-ink">
      <div className="mx-auto flex max-w-[520px] flex-col px-4 pt-6 pb-[max(2rem,env(safe-area-inset-bottom))]">
        <header className="mb-6 flex items-center justify-between gap-4">
          <h1>
            <span className="sr-only">Split Flap · {t.phoneTitle}</span>
            <Tiles text={BRAND} className="text-[1.1rem]" />
          </h1>
          <Link
            href="/about"
            className={`text-xs font-semibold tracking-[.2em] text-muted uppercase transition-colors hover:text-ink ${FOCUS}`}
          >
            {t.about}
          </Link>
        </header>

        {status === "loading" && (
          <p className="py-10 text-center text-sm text-muted">{t.phoneLoading}</p>
        )}
        {status === "unpaired" && (
          <p className="border border-edge p-5 text-[15px] leading-relaxed text-muted">
            {t.phoneNotPaired}
          </p>
        )}
        {status === "gone" && (
          <div className="flex flex-col gap-4 border border-edge p-5">
            <p role="alert" className="text-[15px] leading-relaxed">
              {t.phoneGone}
            </p>
            <button type="button" className={quiet} onClick={forgetLocally}>
              {t.phoneForget}
            </button>
          </div>
        )}

        {status === "ready" && data && size && (
          <>
            <p
              role="status"
              className={`mb-2 min-h-5 text-xs ${offline ? "text-ink" : "text-muted"}`}
            >
              {offline ? t.phoneOffline : sent ? t.phoneSent : ""}
            </p>

            <form
              className="flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                if (!text || full || tooLong) return;
                // Notlar kapalıysa yeni not görünsün diye açılır.
                void change(
                  { ...data, notes: [...data.notes, text], show: { ...data.show, notes: true } },
                  true,
                );
                setDraft("");
                input.current?.focus();
              }}
            >
              <input
                ref={input}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                maxLength={Math.min(NOTE_LIMIT, size.cols * size.rows)}
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
                className={`h-11 cursor-pointer bg-ink px-5 text-sm font-semibold tracking-wider text-pit transition-colors hover:bg-white disabled:cursor-default disabled:bg-edge disabled:text-muted ${FOCUS}`}
              >
                {t.phoneAdd}
              </button>
            </form>
            <p role="status" className="mt-2 min-h-5 text-xs text-muted">
              {tooLong ? t.phoneTooLong : full ? t.phoneFull : ""}
            </p>

            <div className="mt-4 border border-edge">
              <Section title={`${t.notesHeading} · ${data.notes.length}/${MAX_NOTES}`}>
                {data.notes.length === 0 ? (
                  <p className="py-3 text-sm text-muted">{t.noNotes}</p>
                ) : (
                  <ul className="-mx-5">
                    {data.notes.map((n, i) => (
                      <li
                        key={i}
                        className="flex items-center border-t border-edge first:border-t-0"
                      >
                        <span className="min-w-0 flex-1 px-5 py-3 text-sm tracking-wider break-words">
                          {upper(n, lang)}
                        </span>
                        <button
                          type="button"
                          aria-label={`${t.deleteNote}: ${n}`}
                          className={`mr-2 grid size-11 shrink-0 cursor-pointer place-items-center text-muted transition-colors hover:text-ink ${FOCUS}`}
                          onClick={() =>
                            void change({ ...data, notes: data.notes.filter((_, j) => j !== i) })
                          }
                        >
                          <svg
                            viewBox="0 0 24 24"
                            aria-hidden
                            className="size-5"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth={2}
                            strokeLinecap="round"
                          >
                            <path d="m6 6 12 12" />
                            <path d="M18 6 6 18" />
                          </svg>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </Section>

              <Section title={t.showOnBoard}>
                <Toggle
                  label={t.notes}
                  checked={data.show.notes}
                  onChange={(v) => void change({ ...data, show: { ...data.show, notes: v } })}
                />
                <Toggle
                  label={t.clock}
                  checked={data.show.clock}
                  onChange={(v) => void change({ ...data, show: { ...data.show, clock: v } })}
                />
                {data.show.clock && (
                  <div className="ml-1 border-l border-edge pl-4">
                    <Toggle
                      label={t.showSeconds}
                      checked={data.show.seconds}
                      onChange={(v) => void change({ ...data, show: { ...data.show, seconds: v } })}
                    />
                  </div>
                )}
                <Toggle
                  label={t.countdown}
                  checked={data.show.countdown}
                  onChange={(v) => void change({ ...data, show: { ...data.show, countdown: v } })}
                />
                {data.show.countdown && (
                  <div className="mb-1 ml-1 flex flex-col gap-2 border-l border-edge py-1 pl-4">
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
                  </div>
                )}
                <Toggle
                  label={t.weather}
                  checked={data.show.weather}
                  onChange={(v) => void change({ ...data, show: { ...data.show, weather: v } })}
                />
                {data.show.weather && (
                  <div className="mb-1 ml-1 flex flex-col border-l border-edge py-1 pl-4">
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
                  </div>
                )}
                <p className={FIELD_LABEL}>{t.interval}</p>
                <Segmented
                  label={t.interval}
                  value={data.intervalSec}
                  options={INTERVALS.map((o) => ({ value: o.sec, label: `${o.n} ${t[o.unit]}` }))}
                  onChange={(v) => void change({ ...data, intervalSec: v })}
                />
              </Section>

              <Section title={t.general}>
                <Toggle
                  label={t.sound}
                  checked={data.sound}
                  onChange={(v) => void change({ ...data, sound: v })}
                />
                <p className={FIELD_LABEL}>{t.boardLanguage}</p>
                <Segmented
                  label={t.boardLanguage}
                  value={data.lang}
                  options={LANGS}
                  onChange={(v) => void change({ ...data, lang: v })}
                />
              </Section>

              <Section title={t.pairing}>
                <p className="mt-2 text-xs leading-relaxed text-muted">{t.shareHelp}</p>
                <div className="mt-3 flex flex-col gap-2">
                  <button
                    type="button"
                    className={quiet}
                    onClick={() => {
                      if (!pair) return;
                      const url = pairUrl(pair);
                      // Ev ağında sayfa şifresiz (http) sunulur; tarayıcılar orada
                      // panoya kopyalamaya izin vermez. O zaman bağlantı gösterilir.
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
                    }}
                  >
                    {copied ? t.shareCopied : t.shareLink}
                  </button>
                  <button type="button" className={quiet} onClick={() => void resetPairing()}>
                    {t.resetPairing}
                  </button>
                  <button type="button" className={quiet} onClick={forget}>
                    {t.phoneForget}
                  </button>
                </div>
              </Section>
            </div>
          </>
        )}
      </div>
    </main>
  );
}
