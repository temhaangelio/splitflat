"use client";

import { useEffect, useState } from "react";
import Tiles from "@/components/Tiles";
import { FOCUS } from "@/components/ui";
import { BRAND, STRINGS } from "@/lib/i18n";
import { useLang } from "@/lib/useLang";
import { connectWifi, readWifi, type WifiStatus } from "@/lib/wifi";

// İnternet kurulumu: telefon panonun açtığı "Split Flap Kurulum" ağına bağlanıp
// bu sayfayı açar, panonun bağlanacağı ağı seçer. Gönderince pano kurulum ağını
// kapatır; telefon o ağdan düşer, sonuç panonun ekranında görünür.

const OTHER = "\u0000other";

export default function Setup() {
  const lang = useLang();
  const t = STRINGS[lang];
  const [status, setStatus] = useState<WifiStatus | null | "loading">("loading");
  const [choice, setChoice] = useState<string>("");
  const [other, setOther] = useState("");
  const [password, setPassword] = useState("");
  const [sent, setSent] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    document.documentElement.lang = lang;
    document.title = `${t.setupTitle} · ${STRINGS[lang].title}`;
  }, [lang, t.setupTitle]);

  useEffect(() => {
    let alive = true;
    void readWifi().then((w) => {
      if (!alive) return;
      setStatus(w);
      if (w?.networks.length) setChoice(w.networks[0].ssid);
      else setChoice(OTHER);
    });
    return () => {
      alive = false;
    };
  }, []);

  const networks = status && status !== "loading" ? status.networks : [];
  const selected = networks.find((n) => n.ssid === choice);
  const ssid = choice === OTHER ? other.trim() : choice;
  const needsPassword = choice === OTHER ? password.length > 0 : (selected?.secure ?? true);
  const passwordOk = !needsPassword || password.length >= 8;
  const canSend = !!ssid && passwordOk && !sent;

  const field = `h-11 w-full min-w-0 border border-edge bg-flap-lo px-3 text-[15px] transition-colors placeholder:text-muted hover:border-muted ${FOCUS}`;

  let body: React.ReactNode;
  if (status === "loading") {
    body = <p className="py-10 text-center text-sm text-muted">…</p>;
  } else if (sent) {
    body = (
      <p role="status" className="border border-edge p-5 text-[15px] leading-relaxed">
        {t.setupSent}
      </p>
    );
  } else if (!status || status.mode === "online") {
    body = (
      <p className="border border-edge p-5 text-[15px] leading-relaxed text-muted">
        {status?.mode === "online" ? t.setupDone : t.setupUnavailable}
      </p>
    );
  } else if (status.mode !== "setup") {
    body = (
      <p className="border border-edge p-5 text-[15px] leading-relaxed text-muted">
        {t.setupUnavailable}
      </p>
    );
  } else {
    body = (
      <form
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (!canSend) return;
          setFailed(false);
          void connectWifi(ssid, needsPassword ? password : "").then((err) => {
            if (err) setFailed(true);
            else setSent(true);
          });
        }}
      >
        <p className="text-[15px] leading-relaxed text-muted">{t.setupIntro}</p>
        {status.error && (
          <p role="alert" className="border border-edge p-4 text-sm leading-relaxed">
            {t.wifiErrors[status.error]}
          </p>
        )}

        <fieldset className="border border-edge">
          <legend className="sr-only">{t.wifiNetwork}</legend>
          {networks.length === 0 && (
            <p className="px-4 py-3 text-sm text-muted">{t.setupNoNetworks}</p>
          )}
          {[...networks.map((n) => n.ssid), OTHER].map((value) => {
            const n = networks.find((x) => x.ssid === value);
            return (
              <label
                key={value}
                className="flex min-h-12 cursor-pointer items-center gap-3 border-t border-edge px-4 first:border-t-0 has-[:checked]:bg-housing-hi"
              >
                <input
                  type="radio"
                  name="network"
                  value={value}
                  checked={choice === value}
                  onChange={() => setChoice(value)}
                  className="size-4 accent-[var(--color-ink)]"
                />
                <span className="min-w-0 flex-1 truncate text-[15px]">
                  {value === OTHER ? t.setupOther : value}
                </span>
                {n && (
                  <span className="shrink-0 text-xs text-muted tabular-nums">
                    {n.secure ? "" : `${t.setupOpen} · `}
                    {n.signal}%
                  </span>
                )}
              </label>
            );
          })}
        </fieldset>

        {choice === OTHER && (
          <input
            value={other}
            onChange={(e) => setOther(e.target.value)}
            placeholder={t.setupOtherName}
            aria-label={t.setupOtherName}
            autoComplete="off"
            autoCapitalize="none"
            spellCheck={false}
            className={field}
          />
        )}
        {(choice === OTHER || selected?.secure !== false) && (
          <div>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={t.wifiPassword}
              aria-label={t.wifiPassword}
              autoComplete="off"
              autoCapitalize="none"
              spellCheck={false}
              className={field}
            />
            {password.length > 0 && !passwordOk && (
              <p className="mt-2 text-xs text-muted">{t.setupPasswordShort}</p>
            )}
          </div>
        )}

        <button
          type="submit"
          disabled={!canSend}
          className={`h-11 cursor-pointer bg-ink text-sm font-semibold tracking-wider text-pit transition-colors hover:bg-white disabled:cursor-default disabled:bg-edge disabled:text-muted ${FOCUS}`}
        >
          {t.setupConnect}
        </button>
        {failed && (
          <p role="alert" className="text-sm text-ink">
            {t.setupFailed}
          </p>
        )}
      </form>
    );
  }

  return (
    <main className="min-h-dvh bg-pit text-ink">
      <div className="mx-auto flex max-w-[520px] flex-col gap-6 px-4 pt-6 pb-[max(2rem,env(safe-area-inset-bottom))]">
        <header>
          <h1>
            <span className="sr-only">
              {BRAND} · {t.setupTitle}
            </span>
            <Tiles text={BRAND} className="text-[1.1rem]" />
          </h1>
          <p className="mt-4 text-[11px] font-semibold tracking-[.24em] text-muted uppercase">
            {t.setupTitle}
          </p>
        </header>
        {body}
      </div>
    </main>
  );
}
