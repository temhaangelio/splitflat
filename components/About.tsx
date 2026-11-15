"use client";

import Link from "next/link";
import { useEffect } from "react";
import Tiles from "@/components/Tiles";
import { ABOUT } from "@/lib/about";
import { FOCUS } from "@/components/ui";
import { BRAND, LANGS } from "@/lib/i18n";
import { useLang, writeLang } from "@/lib/useLang";


export default function About() {
  const lang = useLang();
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
            <Tiles text="SPLITFLAT" className="text-[clamp(1.6rem,7.5vw,3.4rem)]" />
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
          <span className="text-[11px] tracking-[.42em] text-muted">{BRAND}</span>
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
