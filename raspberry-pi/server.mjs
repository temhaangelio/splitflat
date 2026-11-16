// raspberry-pi/server.ts
import { createHash, timingSafeEqual } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, renameSync, statSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import { homedir, networkInterfaces } from "node:os";
import { dirname, extname, join, normalize, sep } from "node:path";
import { fileURLToPath } from "node:url";

// lib/board.ts
var SIZES = [
  { id: "s", cols: 10, rows: 4 },
  { id: "m", cols: 12, rows: 5 },
  { id: "l", cols: 16, rows: 6 },
  { id: "xl", cols: 22, rows: 6 }
];
var MAX_NOTES = 20;
var NOTE_LIMIT = 100;
var TITLE_LIMIT = 22;
var INTERVALS = [
  { sec: 15, n: 15, unit: "seconds" },
  { sec: 30, n: 30, unit: "seconds" },
  { sec: 60, n: 1, unit: "minutes" },
  { sec: 300, n: 5, unit: "minutes" }
];
var CITY_LIMIT = 40;
var DEFAULT_CITY = "\u0130stanbul";
var isBool = (v) => typeof v === "boolean";
var TARGET = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/;
function parseShared(input) {
  if (typeof input !== "object" || input === null) return null;
  const o = input;
  if (!Array.isArray(o.notes) || o.notes.length > MAX_NOTES) return null;
  const notes = [];
  for (const n of o.notes) {
    if (typeof n !== "string" || !n.trim() || n.length > NOTE_LIMIT) return null;
    notes.push(n);
  }
  const s = o.show;
  if (typeof s !== "object" || s === null) return null;
  const show = {
    notes: s.notes,
    clock: s.clock,
    seconds: s.seconds,
    weather: s.weather,
    countdown: s.countdown
  };
  if (!Object.values(show).every(isBool)) return null;
  if (!INTERVALS.some((i) => i.sec === o.intervalSec)) return null;
  if (!SIZES.some((z) => z.id === o.size)) return null;
  let countdown = null;
  if (o.countdown !== null && o.countdown !== void 0) {
    const c = o.countdown;
    if (typeof c !== "object") return null;
    if (typeof c.title !== "string" || c.title.length > TITLE_LIMIT) return null;
    if (typeof c.target !== "string" || c.target !== "" && !TARGET.test(c.target)) return null;
    countdown = { title: c.title, target: c.target };
  }
  const city = o.city === void 0 ? DEFAULT_CITY : o.city;
  if (typeof city !== "string" || !city.trim() || city.length > CITY_LIMIT) return null;
  const lang = o.lang === void 0 ? "tr" : o.lang;
  if (lang !== "tr" && lang !== "en") return null;
  const sound = o.sound === void 0 ? true : o.sound;
  if (!isBool(sound)) return null;
  return {
    notes,
    show,
    intervalSec: o.intervalSec,
    countdown,
    size: o.size,
    city,
    lang,
    sound
  };
}

// raspberry-pi/server.ts
var PORT = Number(process.env.PORT) || 8080;
var HERE = dirname(fileURLToPath(import.meta.url));
var SITE = join(HERE, "site");
var DATA_DIR = process.env.SPLITFLAT_DATA || join(homedir(), ".splitflat");
var DATA_FILE = join(DATA_DIR, "boards.json");
var KEY_FORMAT = /^[A-Za-z0-9_-]{22}$/;
var digest = (value) => createHash("sha256").update(value).digest("hex");
var sameDigest = (a, b) => {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
};
var boards = /* @__PURE__ */ new Map();
function load() {
  if (!existsSync(DATA_FILE)) return;
  try {
    const saved = JSON.parse(readFileSync(DATA_FILE, "utf8"));
    for (const [id, rec] of Object.entries(saved)) {
      const data = parseShared(rec.data);
      if (data && typeof rec.v === "number" && typeof rec.w === "string") {
        boards.set(id, { v: rec.v, w: rec.w, data });
      }
    }
  } catch (e) {
    console.error(`Kay\u0131t dosyas\u0131 okunamad\u0131 (${DATA_FILE}). D\xFCzeltin ya da silin.`, e);
    process.exit(1);
  }
}
function save() {
  mkdirSync(DATA_DIR, { recursive: true });
  const tmp = `${DATA_FILE}.tmp`;
  writeFileSync(tmp, JSON.stringify(Object.fromEntries(boards)));
  renameSync(tmp, DATA_FILE);
}
var WINDOW_MS = 6e4;
var WRITES_PER_MIN = 60;
var hits = /* @__PURE__ */ new Map();
function withinLimit(ip) {
  const now = Date.now();
  const hit = hits.get(ip);
  if (!hit || hit.reset < now) {
    hits.set(ip, { count: 1, reset: now + WINDOW_MS });
    return true;
  }
  return ++hit.count <= WRITES_PER_MIN;
}
var SECURITY_HEADERS = {
  "Referrer-Policy": "no-referrer",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY"
};
function json(res, status, body) {
  res.writeHead(status, {
    ...SECURITY_HEADERS,
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store"
  });
  res.end(JSON.stringify(body));
}
var fail = (res, status, error) => json(res, status, { error });
var MAX_BODY = 8e3;
function readBody(req) {
  return new Promise((resolve) => {
    let text = "";
    let tooBig = false;
    req.setEncoding("utf8");
    req.on("data", (chunk) => {
      text += chunk;
      if (text.length > MAX_BODY) tooBig = true;
    });
    req.on("error", () => resolve(null));
    req.on("end", () => {
      if (tooBig) return resolve(null);
      try {
        const parsed = JSON.parse(text);
        resolve(
          typeof parsed === "object" && parsed !== null ? parsed : null
        );
      } catch {
        resolve(null);
      }
    });
  });
}
function header(req, name) {
  const value = req.headers[name];
  const text = Array.isArray(value) ? value[0] : value;
  return text && KEY_FORMAT.test(text) ? text : null;
}
async function board(req, res, url) {
  const id = header(req, "x-board-id");
  const key = header(req, "x-board-key");
  const ip = req.socket.remoteAddress ?? "unknown";
  if (req.method === "GET") {
    const rec2 = id && boards.get(digest(id));
    if (!rec2) return fail(res, 404, "not_found");
    const known = Number(url.searchParams.get("v"));
    return json(res, 200, known === rec2.v ? { v: rec2.v } : { v: rec2.v, data: rec2.data });
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
  const rec = id && boards.get(digest(id));
  if (!id || !key || !rec) return fail(res, 404, "not_found");
  if (!sameDigest(rec.w, digest(key))) return fail(res, 403, "forbidden");
  if (req.method === "PUT") {
    const body = await readBody(req);
    const data = body && parseShared(body.data);
    if (!data) return fail(res, 400, "bad_request");
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
function lanOrigin() {
  if (process.env.SPLITFLAT_URL) return process.env.SPLITFLAT_URL.replace(/\/$/, "");
  for (const list of Object.values(networkInterfaces())) {
    for (const net of list ?? []) {
      if (net.family === "IPv4" && !net.internal) return `http://${net.address}:${PORT}`;
    }
  }
  return null;
}
var TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2"
};
function resolveFile(pathname) {
  let rel;
  try {
    rel = decodeURIComponent(pathname);
  } catch {
    return null;
  }
  const target = normalize(join(SITE, rel));
  if (target !== SITE && !target.startsWith(SITE + sep)) return null;
  const candidates = target === SITE ? [join(SITE, "index.html")] : [target, `${target}.html`, join(target, "index.html")];
  for (const file of candidates) {
    if (existsSync(file) && statSync(file).isFile()) return file;
  }
  return null;
}
function serveFile(res, pathname, head) {
  const file = resolveFile(pathname);
  const found = file ?? join(SITE, "404.html");
  if (!existsSync(found)) {
    res.writeHead(404, { ...SECURITY_HEADERS, "Content-Type": "text/plain; charset=utf-8" });
    return res.end("Site dosyalar\u0131 bulunamad\u0131. `npm run release` \xE7al\u0131\u015Ft\u0131r\u0131ld\u0131 m\u0131?");
  }
  res.writeHead(file ? 200 : 404, {
    ...SECURITY_HEADERS,
    "Content-Type": TYPES[extname(found)] ?? "application/octet-stream",
    // Adında özet taşıyan dosyalar hiç değişmez; sayfalar her seferinde yeniden
    // sorulur ki güncellemeden sonra pano eski sürümde kalmasın.
    "Cache-Control": pathname.startsWith("/_next/static/") ? "public, max-age=31536000, immutable" : "no-cache"
  });
  res.end(head ? void 0 : readFileSync(found));
}
load();
createServer((req, res) => {
  const url = new URL(req.url ?? "/", "http://localhost");
  const done = (e) => {
    console.error(e);
    if (!res.headersSent) fail(res, 500, "error");
    else res.end();
  };
  try {
    if (url.pathname === "/api/board") return void board(req, res, url).catch(done);
    if (url.pathname === "/api/host") return json(res, 200, { origin: lanOrigin() });
    if (url.pathname.startsWith("/api/")) return fail(res, 404, "not_found");
    if (req.method !== "GET" && req.method !== "HEAD") return fail(res, 405, "method_not_allowed");
    serveFile(res, url.pathname, req.method === "HEAD");
  } catch (e) {
    done(e);
  }
}).listen(PORT, () => {
  console.log(`Split Flap: http://localhost:${PORT}  (ev a\u011F\u0131nda: ${lanOrigin() ?? "adres bulunamad\u0131"})`);
  console.log(`Kay\u0131tlar: ${DATA_FILE}`);
});
