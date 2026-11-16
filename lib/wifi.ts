// İnternet kurulumunun tarayıcı tarafı (bkz. raspberry-pi/wifi.ts).

export type WifiError = "wrong_password" | "not_found" | "no_address" | "failed";

export type WifiStatus = {
  mode: "unsupported" | "checking" | "online" | "setup" | "connecting";
  ssid?: string;
  networks: { ssid: string; signal: number; secure: boolean }[];
  error?: WifiError;
  setup?: { ssid: string; password: string; address: string };
  setupUrl: string | null;
};

/** Sunucu bu özelliği desteklemiyorsa (ör. geliştirme sırasında) null. */
export async function readWifi(): Promise<WifiStatus | null> {
  try {
    const r = await fetch("/api/wifi", { cache: "no-store" });
    if (!r.ok) return null;
    return (await r.json()) as WifiStatus;
  } catch {
    return null;
  }
}

export async function connectWifi(ssid: string, password: string): Promise<string | null> {
  try {
    const r = await fetch("/api/wifi/connect", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ssid, password }),
      cache: "no-store",
    });
    if (r.status === 202) return null;
    const body = (await r.json().catch(() => ({}))) as { error?: string };
    return body.error ?? "error";
  } catch {
    return "error";
  }
}

/** Telefon kamerasının tanıdığı "bu ağa bağlan" kodu. */
export function wifiQr(ssid: string, password: string) {
  const esc = (v: string) => v.replace(/([\;,:"])/g, "\\$1");
  return `WIFI:T:WPA;S:${esc(ssid)};P:${esc(password)};;`;
}
