"use client";

import Link from "next/link";
import { useEffect, useSyncExternalStore } from "react";
import { ABOUT } from "@/lib/about";
import { browserLang, LANGS, type Lang } from "@/lib/i18n";

const LANG_KEY = "splitflat:lang"; // pano ile ortak tercih

// Dil tercihi panonun kullandığı yerde durur; başka sekmede değişirse de izlenir.
const listeners = new Set<() => void>();
const subscribe = (cb: () => void) => {
  listeners.add(cb);
  window.addEventListener("storage", cb);
  return () => {
    listeners.delete(cb);
    window.removeEventListener("storage", cb);
  };
};
const readLang = (): Lang => {
  try {
    const saved = localStorage.getItem(LANG_KEY);
    if (saved === "tr" || saved === "en") return saved;
  } catch {
    // depolama kapalıysa tarayıcı diline düş
  }
  return browserLang();
};
const writeLang = (lang: Lang) => {
  try {
    localStorage.setItem(LANG_KEY, lang);
  } catch {
    // tercih yalnızca bu oturumda kalır
  }
  listeners.forEach((cb) => cb());
};

const FOCUS = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink";

/** Başlık: panodaki hücrelerin durağan hali. */
function Tiles({ text }: { text: string }) {
  return (
    <span aria-hidden className="flex gap-[.09em] text-[clamp(1.6rem,7.5vw,3.4rem)]">
      {[...text].map((ch, i) => (
        <span
          key={i}
          className="relative grid h-[1.3em] w-[.86em] place-items-center bg-linear-to-b from-flap-hi to-flap font-bold shadow-[0_0_0_1px_var(--color-slot)] after:absolute after:inset-x-0 after:top-[calc(50%-.5px)] after:h-px after:bg-hinge after:content-['']"
        >
          <span className="text-[.8em] leading-none">{ch}</span>
        </span>
      ))}
    </span>
  );
}

export default function About() {
  const lang = useSyncExternalStore(subscribe, readLang, (): Lang => "tr");
  const t = ABOUT[lang];

  useEffect(() => {
    document.documentElement.lang = lang;
    document.title = `${t.metaTitle} · Splitflat`;
  }, [lang, t.metaTitle]);

  return (
    <main className="min-h-dvh bg-pit text-ink">
      <div className="mx-auto flex max-w-[640px] flex-col gap-12 px-5 py-10 sm:py-16">
        <header className="flex flex-col gap-8">
          <div className="flex items-center justify-between gap-4">
            <Link
              href="/"
              className={`text-xs font-semibold tracking-[.2em] text-muted uppercase transition-colors hover:text-ink ${FOCUS}`}
            >
              ← {t.back}
            </Link>
            <div role="radiogroup" aria-label="Dil / Language" className="flex gap-px border border-edge bg-edge">
              {LANGS.map((o) => (
                <button
                  key={o.value}
                  type="button"
                  role="radio"
                  aria-checked={lang === o.value}
                  className={`min-h-8 cursor-pointer px-3 text-[11px] font-semibold tracking-wider transition-colors ${FOCUS} focus-visible:z-10 ${
                    lang === o.value ? "bg-ink text-pit" : "bg-pit text-muted hover:text-ink"
                  }`}
                  onClick={() => writeLang(o.value)}
                >
                  {o.value.toUpperCase()}
                </button>
              ))}
            </div>
          </div>

          <h1>
            <span className="sr-only">Splitflat</span>
            <Tiles text="SPLITFLAT" />
          </h1>
          <p className="text-lg leading-relaxed text-pretty sm:text-xl">{t.lead}</p>
        </header>

        {t.sections.map((s) => (
          <section key={s.title} className="border-t border-edge pt-6">
            <h2 className="mb-4 text-[11px] font-semibold tracking-[.24em] text-muted uppercase">
              {s.title}
            </h2>
            {s.list && (
              <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-[9rem_1fr]">
                {s.list.map((item) => (
                  <div key={item.term} className="contents">
                    <dt className="text-sm font-semibold tracking-wide">{item.term}</dt>
                    <dd className="mb-2 text-[15px] leading-relaxed text-muted sm:mb-0">{item.text}</dd>
                  </div>
                ))}
              </dl>
            )}
            {s.body && (
              <div className="flex flex-col gap-4">
                {s.body.map((p) => (
                  <p key={p} className="text-[15px] leading-relaxed text-pretty text-muted">
                    {p}
                  </p>
                ))}
              </div>
            )}
          </section>
        ))}

        <footer className="flex items-center justify-between gap-4 border-t border-edge pt-6">
          <span className="text-[11px] tracking-[.42em] text-muted">SPLITFLAT.APP</span>
          <Link
            href="/"
            className={`grid h-11 place-items-center bg-ink px-5 text-sm font-semibold tracking-wider text-pit transition-colors hover:bg-white ${FOCUS}`}
          >
            {t.back}
          </Link>
        </footer>
      </div>
    </main>
  );
}
