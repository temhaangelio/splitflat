// İnternet kurulumu: Pi bir WiFi ağına bağlı değilse kendi kurulum ağını
// ("Split Flap Kurulum") açar. Telefon o ağa bağlanıp /setup sayfasından evin
// ağını seçer; Pi kurulum ağını kapatıp seçilen ağa geçer. Bağlanamazsa kurulum
// ağını aynı şifreyle yeniden açar ve hatayı bildirir.
//
// WiFi'yi NetworkManager'ın komut satırı aracı nmcli yönetir. Sunucu yönetici
// değil, normal kullanıcı olarak çalıştığı için nmcli `sudo -n` ile çağrılır;
// install.sh buna yalnızca nmcli için izin veren bir kural ekler.
//
// Ortam değişkenleri (geliştirme ve deneme için):
//   SPLITFLAT_NMCLI          nmcli yerine kullanılacak program
//   SPLITFLAT_NMCLI_SUDO=0   sudo kullanma
//   SPLITFLAT_WIFI_IFACE     WiFi arayüzü (varsayılan wlan0)
//   SPLITFLAT_WIFI_WAIT_MS   açılışta ağ için beklenecek süre (varsayılan 60 sn)

import { execFile } from "node:child_process";
import { randomInt } from "node:crypto";

const NMCLI = process.env.SPLITFLAT_NMCLI || "nmcli";
const USE_SUDO = process.env.SPLITFLAT_NMCLI_SUDO !== "0";
const IFACE = process.env.SPLITFLAT_WIFI_IFACE || "wlan0";
const BOOT_WAIT_MS = Number(process.env.SPLITFLAT_WIFI_WAIT_MS) || 60_000;
const CHECK_MS = 10_000;
// Bağlantı bu kadar süre kopuk kalırsa kurulum ağı açılır. Modemin kısa süreli
// yeniden başlaması bunu tetiklemesin diye uzun tutulur.
const LOST_MS = 3 * 60_000;

const SETUP_CON = "splitflap-setup";
export const SETUP_SSID = "Split Flap Kurulum";

export type Network = { ssid: string; signal: number; secure: boolean };

export type WifiError = "wrong_password" | "not_found" | "no_address" | "failed";

export type WifiState = {
  /**
   * unsupported: bu cihazda nmcli yok (ör. geliştirme bilgisayarı)
   * checking:    açılışta ağ bekleniyor
   * online:      bir WiFi ağına bağlı
   * setup:       kurulum ağı açık, telefon bekleniyor
   * connecting:  seçilen ağa bağlanılıyor
   */
  mode: "unsupported" | "checking" | "online" | "setup" | "connecting";
  /** Bağlı olunan ya da bağlanılmaya çalışılan ağ */
  ssid?: string;
  networks: Network[];
  error?: WifiError;
  /** Kurulum ağı: ad, şifre ve telefonun açacağı adres */
  setup?: { ssid: string; password: string; address: string };
};

const state: WifiState = { mode: "checking", networks: [] };
let setupPassword = "";
let busy = false;

/* ---------- nmcli ---------- */

class NmcliMissing extends Error {}

function nmcli(args: string[], timeoutMs = 20_000): Promise<string> {
  const cmd = USE_SUDO ? "sudo" : NMCLI;
  const argv = USE_SUDO ? ["-n", NMCLI, ...args] : args;
  return new Promise((resolve, reject) => {
    execFile(cmd, argv, { timeout: timeoutMs }, (err, stdout, stderr) => {
      if (!err) return resolve(stdout);
      if ((err as NodeJS.ErrnoException).code === "ENOENT") return reject(new NmcliMissing());
      reject(new Error(`${stderr || ""}${stdout || ""}`.trim() || err.message));
    });
  });
}

/** nmcli -t çıktısının bir satırını ":" ile böler; "\:" ve "\\" kaçışlarını çözer. */
function fields(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === "\\" && i + 1 < line.length) cur += line[++i];
    else if (ch === ":") {
      out.push(cur);
      cur = "";
    } else cur += ch;
  }
  out.push(cur);
  return out;
}

/** WiFi arayüzü kurulum ağı dışında bir ağa bağlıysa o ağın bağlantı adı. */
async function connectedTo(): Promise<string | null> {
  const out = await nmcli(["-t", "-f", "DEVICE,STATE,CONNECTION", "dev", "status"]);
  for (const line of out.split("\n")) {
    const [dev, st, con] = fields(line);
    if (dev === IFACE && st === "connected" && con && con !== SETUP_CON) return con;
  }
  return null;
}

async function scan(): Promise<Network[]> {
  const out = await nmcli(
    ["-t", "-f", "SSID,SIGNAL,SECURITY", "dev", "wifi", "list", "--rescan", "yes", "ifname", IFACE],
    30_000,
  );
  const best = new Map<string, Network>();
  for (const line of out.split("\n")) {
    const [ssid, signal, security] = fields(line);
    if (!ssid || ssid === SETUP_SSID) continue;
    const n = { ssid, signal: Number(signal) || 0, secure: !!security && security !== "--" };
    const prev = best.get(ssid);
    if (!prev || prev.signal < n.signal) best.set(ssid, n);
  }
  return [...best.values()].sort((a, b) => b.signal - a.signal).slice(0, 30);
}

/* ---------- kurulum ağı ---------- */

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/** Kurulum ağının şifresi: okunması kolay 8 karakter (karışan harfler yok). */
function newPassword() {
  const abc = "abcdefghjkmnpqrstuvwxyz23456789";
  return Array.from({ length: 8 }, () => abc[randomInt(abc.length)]).join("");
}

async function openSetup() {
  // Kurulum ağı açıkken WiFi tarama yapamaz; ağ listesi önce alınır.
  state.networks = await scan().catch(() => state.networks);
  if (!setupPassword) setupPassword = newPassword();
  await nmcli(["con", "delete", SETUP_CON]).catch(() => {});
  await nmcli([
    "dev", "wifi", "hotspot", "ifname", IFACE, "con-name", SETUP_CON,
    "ssid", SETUP_SSID, "password", setupPassword,
  ]);
  const ip = (await nmcli(["-g", "IP4.ADDRESS", "dev", "show", IFACE]).catch(() => ""))
    .split("\n")[0]
    .split("/")[0]
    .trim();
  state.setup = { ssid: SETUP_SSID, password: setupPassword, address: ip || "10.42.0.1" };
  state.mode = "setup";
  state.ssid = undefined;
  console.log(`WiFi kurulum ağı açık: ${SETUP_SSID} (${state.setup.address})`);
}

async function closeSetup() {
  await nmcli(["con", "down", SETUP_CON]).catch(() => {});
  await nmcli(["con", "delete", SETUP_CON]).catch(() => {});
  state.setup = undefined;
}

function classify(message: string): WifiError {
  const m = message.toLowerCase();
  if (m.includes("secrets were required") || m.includes("psk") || m.includes("password"))
    return "wrong_password";
  if (m.includes("no network with ssid")) return "not_found";
  if (m.includes("ip configuration")) return "no_address";
  return "failed";
}

/** Telefondan gelen istek: kurulum ağını kapatıp seçilen ağa bağlanmayı dener. */
async function connect(ssid: string, password: string) {
  busy = true;
  state.mode = "connecting";
  state.ssid = ssid;
  state.error = undefined;
  try {
    await closeSetup();
    await sleep(2000);
    // Kurulum ağı kapanınca liste boş olabilir; hedef ağı görebilmek için yeniden tara.
    await nmcli(["dev", "wifi", "list", "--rescan", "yes", "ifname", IFACE], 30_000).catch(() => {});
    const args = ["dev", "wifi", "connect", ssid];
    if (password) args.push("password", password);
    args.push("ifname", IFACE);
    await nmcli(args, 60_000);
    state.mode = "online";
    state.networks = [];
    console.log(`WiFi: ${ssid} ağına bağlandı`);
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error(`WiFi: ${ssid} ağına bağlanılamadı: ${message}`);
    state.error = classify(message);
    // Yanlış şifreyle kaydedilen bağlantı silinir ki Pi onunla denemeye devam etmesin.
    await nmcli(["con", "delete", "id", ssid]).catch(() => {});
    await openSetup().catch((err) => console.error("Kurulum ağı yeniden açılamadı:", err));
  } finally {
    busy = false;
  }
}

/* ---------- dışarıya açılan ---------- */

/** Panoya ve telefona gösterilecek durum. Kurulum ağının şifresi yalnızca panoya verilir. */
export function wifiState(includePassword: boolean): WifiState {
  if (includePassword || !state.setup) return state;
  return { ...state, setup: { ...state.setup, password: "" } };
}

/** İstek kurulum ağına bağlı bir telefondan mı geliyor? */
export function fromSetupNetwork(address: string) {
  if (!state.setup) return false;
  const ip = address.replace(/^::ffff:/, "");
  const prefix = state.setup.address.split(".").slice(0, 3).join(".") + ".";
  return ip.startsWith(prefix);
}

export function requestConnect(ssid: unknown, password: unknown): string | null {
  if (state.mode !== "setup" || busy) return "not_in_setup";
  if (typeof ssid !== "string" || !ssid || Buffer.byteLength(ssid) > 32) return "bad_ssid";
  if (typeof password !== "string") return "bad_password";
  if (password && (password.length < 8 || password.length > 63)) return "bad_password";
  void connect(ssid, password);
  return null;
}

/** Açılışta ağı bekler; bağlanamazsa ya da bağlantı uzun süre koparsa kurulum ağını açar. */
export async function startWifi() {
  try {
    await connectedTo();
  } catch (e) {
    if (e instanceof NmcliMissing) {
      state.mode = "unsupported";
      console.log("WiFi kurulumu kapalı: nmcli bulunamadı.");
      return;
    }
    // nmcli var ama hata verdi (ör. sudo izni yok): kurulum denenmez, uyarı yazılır.
    console.error("WiFi durumu okunamadı; kurulum ağı devre dışı.", e);
    state.mode = "unsupported";
    return;
  }

  const started = Date.now();
  let lostSince: number | null = null;
  const tick = async () => {
    if (busy || state.mode === "setup" || state.mode === "connecting") return;
    const con = await connectedTo().catch(() => null);
    if (con) {
      state.mode = "online";
      state.ssid = con;
      lostSince = null;
      return;
    }
    if (state.mode === "checking" && Date.now() - started < BOOT_WAIT_MS) return;
    if (state.mode === "online") {
      lostSince ??= Date.now();
      if (Date.now() - lostSince < LOST_MS) return;
    }
    busy = true;
    try {
      await openSetup();
    } catch (e) {
      console.error("Kurulum ağı açılamadı:", e);
    } finally {
      busy = false;
    }
  };
  await tick();
  setInterval(() => void tick(), CHECK_MS);
}
