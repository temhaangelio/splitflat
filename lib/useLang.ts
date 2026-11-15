import { useSyncExternalStore } from "react";
import { browserLang, type Lang } from "@/lib/i18n";

// Dil tercihi panonun kullandığı yerde durur; Hakkında ve telefon sayfaları da
// aynı tercihi okur. Başka sekmede değişirse o da izlenir.

const LANG_KEY = "splitflat:lang";

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

export const writeLang = (lang: Lang) => {
  try {
    localStorage.setItem(LANG_KEY, lang);
  } catch {
    // tercih yalnızca bu oturumda kalır
  }
  listeners.forEach((cb) => cb());
};

/** Sunucuda Türkçe varsayılır; tarayıcıda kayıtlı tercih ya da tarayıcı dili kullanılır. */
export const useLang = () => useSyncExternalStore(subscribe, readLang, (): Lang => "tr");
