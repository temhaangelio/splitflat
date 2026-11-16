// Split Flap'in Raspberry Pi'de çalışan sunucusu. İki işi var:
//
//   1. Derlenmiş siteyi (./site) sunmak: pano, telefon kumandası, Hakkında.
//   2. Pano kaydını tutmak (/api/board): telefon yazar, pano okur.
//   3. İnternet kurulumu (/api/wifi): Pi bir ağa bağlı değilse kendi kurulum
//      ağını açar, telefon oradan evin ağını seçer (bkz. wifi.ts).
//
// Yalnızca Node'un kendi modüllerini kullanır; Pi'de `npm install` gerekmez.
// Bu dosya `npm run release` ile server.mjs olarak paketlenir ve Pi'de o
// çalıştırılır. Doğrulama kuralları sitenin kullandığıyla aynı koddur
// (lib/board.ts).
//
// Ortam değişkenleri:
//   PORT            dinlenecek port (varsayılan 8080)
//   SPLITFLAT_DATA  kayıtların tutulduğu klasör (varsayılan ~/.splitflat)
//   SPLITFLAT_URL   telefonların panoya ulaşacağı adres; verilmezse ev ağı
//                   adresi kendiliğinden bulunur (ör. http://192.168.1.50:8080)

import { createHash, timingSafeEqual } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, renameSync, statSync, writeFileSync } from "node:fs";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { homedir, networkInterfaces } from "node:os";
import { dirname, extname, join, normalize, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { parseShared, type Shared } from "../lib/board";
import { fromSetupNetwork, requestConnect, setupPageOpened, startWifi, wifiState } from "./wifi";

const PORT = Number(process.env.PORT) || 8080;
const HERE = dirname(fileURLToPath(import.meta.url));
const SITE = join(HERE, "site");
const DATA_DIR = process.env.SPLITFLAT_DATA || join(homedir(), ".splitflat");
const DATA_FILE = join(DATA_DIR, "boards.json");

/* ---------- Kayıtlar ---------- */

// Bir pano iki anahtarla tanımlanır: kimlik okumaya, yazma anahtarı yazmaya
// yetkilidir. Diskte anahtarların kendisi değil özeti durur.
type Rec = { v: number; w: string; data: Shared };

const KEY_FORMAT = /^[A-Za-z0-9_-]{22}$/;
const digest = (value: string) => createHash("sha256").update(value).digest("hex");
const sameDigest = (a: string, b: string) => {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
};

const boards = new Map<string, Rec>();

function load() {
  if (!existsSync(DATA_FILE)) return;
  try {
    const saved = JSON.parse(readFileSync(DATA_FILE, "utf8")) as Record<string, Rec>;
    for (const [id, rec] of Object.entries(saved)) {
      const data = parseShared(rec.data);
      if (data && typeof rec.v === "number" && typeof rec.w === "string") {
        boards.set(id, { v: rec.v, w: rec.w, data });
      }
    }
  } catch (e) {
    // Bozuk dosyanın üzerine yazmak notları kalıcı olarak silerdi: dur.
    console.error(`Kayıt dosyası okunamadı (${DATA_FILE}). Düzeltin ya da silin.`, e);
    process.exit(1);
  }
}

/** Önce geçici dosyaya yazıp yeniden adlandırır: elektrik kesilse de dosya yarım kalmaz. */
function save() {
  mkdirSync(DATA_DIR, { recursive: true });
  const tmp = `${DATA_FILE}.tmp`;
  writeFileSync(tmp, JSON.stringify(Object.fromEntries(boards)));
  renameSync(tmp, DATA_FILE);
}

/* ---------- İstek sınırı ---------- */

// Ev ağında çalışır, ama bir cihaz kontrolden çıkarsa SD kartı sürekli yazmayla
// yormasın: adres başına dakikada sınırlı sayıda yazma.
const WINDOW_MS = 60_000;
const WRITES_PER_MIN = 60;
const hits = new Map<string, { count: number; reset: number }>();

function withinLimit(ip: string) {
  const now = Date.now();
  const hit = hits.get(ip);
  if (!hit || hit.reset < now) {
    hits.set(ip, { count: 1, reset: now + WINDOW_MS });
    return true;
  }
  return ++hit.count <= WRITES_PER_MIN;
}

/* ---------- Yanıtlar ---------- */

const SECURITY_HEADERS = {
  "Referrer-Policy": "no-referrer",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
};

function json(res: ServerResponse, status: number, body: unknown) {
  res.writeHead(status, {
    ...SECURITY_HEADERS,
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  });
  res.end(JSON.stringify(body));
}
const fail = (res: ServerResponse, status: number, error: string) => json(res, status, { error });

const MAX_BODY = 8_000;

function readBody(req: IncomingMessage): Promise<Record<string, unknown> | null> {
  return new Promise((resolve) => {
    let text = "";
    let tooBig = false;
    req.setEncoding("utf8");
    req.on("data", (chunk: string) => {
      text += chunk;
      if (text.length > MAX_BODY) tooBig = true;
    });
    req.on("error", () => resolve(null));
    req.on("end", () => {
      if (tooBig) return resolve(null);
      try {
        const parsed: unknown = JSON.parse(text);
        resolve(
          typeof parsed === "object" && parsed !== null ? (parsed as Record<string, unknown>) : null,
        );
      } catch {
        resolve(null);
      }
    });
  });
}

/* ---------- /api/board ---------- */
//
//   POST    yeni pano açar            (kimlik + yazma anahtarı + ilk durum)
//   GET     durumu okur               (kimlik)
//   PUT     durumu değiştirir         (kimlik + yazma anahtarı)
//   DELETE  panoyu siler              (kimlik + yazma anahtarı)

function header(req: IncomingMessage, name: string) {
  const value = req.headers[name];
  const text = Array.isArray(value) ? value[0] : value;
  return text && KEY_FORMAT.test(text) ? text : null;
}

async function board(req: IncomingMessage, res: ServerResponse, url: URL) {
  const id = header(req, "x-board-id");
  const key = header(req, "x-board-key");
  const ip = req.socket.remoteAddress ?? "unknown";

  if (req.method === "GET") {
    const rec = id && boards.get(digest(id));
    if (!rec) return fail(res, 404, "not_found");
    // İstemci elindeki sürümü bildirirse ve değişiklik yoksa yalnızca sürüm döner.
    const known = Number(url.searchParams.get("v"));
    return json(res, 200, known === rec.v ? { v: rec.v } : { v: rec.v, data: rec.data });
  }

  if (!withinLimit(ip)) return fail(res, 429, "rate_limited");

  if (req.method === "POST") {
    const body = await readBody(req);
    const data = body && parseShared(body.data);
    if (!id || !key || id === key || !data) return fail(res, 400, "bad_request");
    if (boards.has(digest(id))) return fail(res, 409, "conflict");
    boards.set(digest(id), { v: 1, w: digest(key), data });
    save();
    return json(res, 201, { v: 1 });
  }

  // Bundan sonrası var olan bir panoya yazma yetkisi ister.
  const rec = id && boards.get(digest(id));
  if (!id || !key || !rec) return fail(res, 404, "not_found");
  if (!sameDigest(rec.w, digest(key))) return fail(res, 403, "forbidden");

  if (req.method === "PUT") {
    const body = await readBody(req);
    const data = body && parseShared(body.data);
    if (!data) return fail(res, 400, "bad_request");
    // İstemcinin gördüğü sürüm eskiyse başka bir cihaz arada yazmıştır: üzerine
    // yazmak yerine güncel durum geri gönderilir.
    if (typeof body.base === "number" && body.base !== rec.v) {
      return json(res, 409, { error: "stale", v: rec.v, data: rec.data });
    }
    const next = { v: rec.v + 1, w: rec.w, data };
    boards.set(digest(id), next);
    save();
    return json(res, 200, { v: next.v });
  }

  if (req.method === "DELETE") {
    boards.delete(digest(id));
    save();
    return json(res, 200, { ok: true });
  }

  return fail(res, 405, "method_not_allowed");
}

/* ---------- /api/host ---------- */

/** Pi'nin ev ağındaki adresi: panodaki kod, telefonun ulaşabileceği bu adresi taşır. */
function lanOrigin() {
  if (process.env.SPLITFLAT_URL) return process.env.SPLITFLAT_URL.replace(/\/$/, "");
  for (const list of Object.values(networkInterfaces())) {
    for (const net of list ?? []) {
      if (net.family === "IPv4" && !net.internal) return `http://${net.address}:${PORT}`;
    }
  }
  return null;
}

/* ---------- /api/wifi ---------- */
//
//   GET   /api/wifi           internet kurulumunun durumu (pano ve telefon sorar)
//   POST  /api/wifi/connect   seçilen ağa bağlan (yalnızca kurulum ağındaki telefondan)

const isLocal = (req: IncomingMessage) =>
  ["127.0.0.1", "::1", "::ffff:127.0.0.1"].includes(req.socket.remoteAddress ?? "");

async function wifi(req: IncomingMessage, res: ServerResponse, url: URL) {
  if (url.pathname === "/api/wifi" && req.method === "GET") {
    // Kurulum ağındaki bir telefon soruyorsa kurulum sayfasını açmış demektir.
    if (!isLocal(req) && fromSetupNetwork(req.socket.remoteAddress ?? "")) setupPageOpened();
    // Kurulum ağının şifresi yalnızca panoya (aynı cihaz) verilir; telefon ağa
    // bağlanmışsa onu zaten biliyordur.
    const state = wifiState(isLocal(req));
    return json(res, 200, {
      ...state,
      setupUrl: state.setup ? `http://${state.setup.address}:${PORT}/setup` : null,
    });
  }
  if (url.pathname === "/api/wifi/connect" && req.method === "POST") {
    const address = req.socket.remoteAddress ?? "";
    if (!isLocal(req) && !fromSetupNetwork(address)) return fail(res, 403, "forbidden");
    if (!withinLimit(address)) return fail(res, 429, "rate_limited");
    const body = await readBody(req);
    const error = requestConnect(body?.ssid, body?.password);
    if (error) return fail(res, error === "not_in_setup" ? 409 : 400, error);
    return json(res, 202, { ok: true });
  }
  return fail(res, 404, "not_found");
}

/* ---------- Site dosyaları ---------- */

const TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
};

/** İstenen yolu ./site içindeki bir dosyaya çevirir; klasörün dışına çıkılamaz. */
function resolveFile(pathname: string): string | null {
  let rel: string;
  try {
    rel = decodeURIComponent(pathname);
  } catch {
    return null;
  }
  const target = normalize(join(SITE, rel));
  if (target !== SITE && !target.startsWith(SITE + sep)) return null;
  // "/" → index.html, "/remote" → remote.html
  const candidates =
    target === SITE
      ? [join(SITE, "index.html")]
      : [target, `${target}.html`, join(target, "index.html")];
  for (const file of candidates) {
    if (existsSync(file) && statSync(file).isFile()) return file;
  }
  return null;
}

function serveFile(res: ServerResponse, pathname: string, head: boolean) {
  const file = resolveFile(pathname);
  const found = file ?? join(SITE, "404.html");
  if (!existsSync(found)) {
    res.writeHead(404, { ...SECURITY_HEADERS, "Content-Type": "text/plain; charset=utf-8" });
    return res.end("Site dosyaları bulunamadı. `npm run release` çalıştırıldı mı?");
  }
  res.writeHead(file ? 200 : 404, {
    ...SECURITY_HEADERS,
    "Content-Type": TYPES[extname(found)] ?? "application/octet-stream",
    // Adında özet taşıyan dosyalar hiç değişmez; sayfalar her seferinde yeniden
    // sorulur ki güncellemeden sonra pano eski sürümde kalmasın.
    "Cache-Control": pathname.startsWith("/_next/static/")
      ? "public, max-age=31536000, immutable"
      : "no-cache",
  });
  res.end(head ? undefined : readFileSync(found));
}

/* ---------- Sunucu ---------- */

load();

createServer((req, res) => {
  const url = new URL(req.url ?? "/", "http://localhost");
  const done = (e: unknown) => {
    console.error(e);
    if (!res.headersSent) fail(res, 500, "error");
    else res.end();
  };
  try {
    if (url.pathname === "/api/board") return void board(req, res, url).catch(done);
    if (url.pathname === "/api/host") return json(res, 200, { origin: lanOrigin() });
    if (url.pathname.startsWith("/api/wifi")) return void wifi(req, res, url).catch(done);
    if (url.pathname.startsWith("/api/")) return fail(res, 404, "not_found");
    if (req.method !== "GET" && req.method !== "HEAD") return fail(res, 405, "method_not_allowed");
    serveFile(res, url.pathname, req.method === "HEAD");
  } catch (e) {
    done(e);
  }
}).listen(PORT, () => {
  console.log(`Split Flap: http://localhost:${PORT}  (ev ağında: ${lanOrigin() ?? "adres bulunamadı"})`);
  console.log(`Kayıtlar: ${DATA_FILE}`);
  void startWifi();
});
