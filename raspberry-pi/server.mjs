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

// raspberry-pi/wifi.ts
import { execFile } from "node:child_process";
import { randomInt } from "node:crypto";
var NMCLI = process.env.SPLITFLAT_NMCLI || "nmcli";
var USE_SUDO = process.env.SPLITFLAT_NMCLI_SUDO !== "0";
var IFACE = process.env.SPLITFLAT_WIFI_IFACE || "wlan0";
var BOOT_WAIT_MS = Number(process.env.SPLITFLAT_WIFI_WAIT_MS) || 6e4;
var CHECK_MS = 1e4;
var LOST_MS = Number(process.env.SPLITFLAT_WIFI_LOST_MS) || 3 * 6e4;
var RETRY_SAVED_MS = Number(process.env.SPLITFLAT_WIFI_RETRY_MS) || 3 * 6e4;
var SETUP_CON = "splitflap-setup";
var IP = process.env.SPLITFLAT_IP || "ip";
var CLIENT_CHECK_MS = 1e3;
var SETUP_SSID = "Split Flap Kurulum";
var state = { mode: "checking", networks: [] };
var setupPassword = "";
var setupSince = 0;
var busy = false;
var NmcliMissing = class extends Error {
};
function nmcli(args, timeoutMs = 2e4, read = false) {
  const sudo = USE_SUDO && !read;
  const cmd = sudo ? "sudo" : NMCLI;
  const argv = sudo ? ["-n", NMCLI, ...args] : args;
  return new Promise((resolve, reject) => {
    execFile(cmd, argv, { timeout: timeoutMs }, (err, stdout, stderr) => {
      if (!err) return resolve(stdout);
      if (err.code === "ENOENT") return reject(new NmcliMissing());
      reject(new Error(`${stderr || ""}${stdout || ""}`.trim() || err.message));
    });
  });
}
function fields(line) {
  const out = [];
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
async function connectedTo() {
  const out = await nmcli(["-t", "-f", "DEVICE,STATE,CONNECTION", "dev", "status"], 2e4, true);
  for (const line of out.split("\n")) {
    const [dev, st, con] = fields(line);
    if (dev === IFACE && st === "connected" && con && con !== SETUP_CON) return con;
  }
  return null;
}
async function savedWifi() {
  const out = await nmcli(["-t", "-f", "TYPE,NAME", "con", "show"], 2e4, true);
  return out.split("\n").map(fields).filter(([type, name]) => type === "802-11-wireless" && name && name !== SETUP_CON).map(([, name]) => name);
}
async function hasSavedWifi() {
  try {
    return (await savedWifi()).length > 0;
  } catch {
    return true;
  }
}
async function scan() {
  const out = await nmcli(
    ["-t", "-f", "SSID,SIGNAL,SECURITY", "dev", "wifi", "list", "--rescan", "yes", "ifname", IFACE],
    3e4
  );
  const best = /* @__PURE__ */ new Map();
  for (const line of out.split("\n")) {
    const [ssid, signal, security] = fields(line);
    if (!ssid || ssid === SETUP_SSID) continue;
    const n = { ssid, signal: Number(signal) || 0, secure: !!security && security !== "--" };
    const prev = best.get(ssid);
    if (!prev || prev.signal < n.signal) best.set(ssid, n);
  }
  return [...best.values()].sort((a, b) => b.signal - a.signal).slice(0, 30);
}
function hasClient() {
  const own = state.setup?.address ?? "";
  const prefix = own.split(".").slice(0, 3).join(".") + ".";
  return new Promise((resolve) => {
    if (!own) return resolve(false);
    execFile(IP, ["neigh", "show", "dev", IFACE], { timeout: 5e3 }, (err, stdout) => {
      if (err) return resolve(false);
      resolve(
        stdout.split("\n").some((l) => {
          const ip = l.split(" ")[0];
          return ip.startsWith(prefix) && ip !== own && l.includes("lladdr") && /\b(REACHABLE|DELAY|PROBE)\b/.test(l);
        })
      );
    });
  });
}
var clientTimer;
function watchClients() {
  clearInterval(clientTimer);
  clientTimer = setInterval(async () => {
    if (state.mode !== "setup") return clearInterval(clientTimer);
    if (state.step === "join" && await hasClient()) {
      state.step = "open";
      console.log("WiFi kurulumu: telefon kurulum a\u011F\u0131na kat\u0131ld\u0131");
    }
  }, CLIENT_CHECK_MS);
}
var sleep = (ms) => new Promise((r) => setTimeout(r, ms));
function newPassword() {
  const abc = "abcdefghjkmnpqrstuvwxyz23456789";
  return Array.from({ length: 8 }, () => abc[randomInt(abc.length)]).join("");
}
async function openSetup() {
  state.networks = await scan().catch(() => state.networks);
  if (!setupPassword) setupPassword = newPassword();
  await nmcli(["con", "delete", SETUP_CON]).catch(() => {
  });
  await nmcli([
    "dev",
    "wifi",
    "hotspot",
    "ifname",
    IFACE,
    "con-name",
    SETUP_CON,
    "ssid",
    SETUP_SSID,
    "password",
    setupPassword
  ]);
  const ip = (await nmcli(["-g", "IP4.ADDRESS", "dev", "show", IFACE], 2e4, true).catch(() => "")).split("\n")[0].split("/")[0].trim();
  state.setup = { ssid: SETUP_SSID, password: setupPassword, address: ip || "10.42.0.1" };
  state.mode = "setup";
  state.step = "join";
  state.ssid = void 0;
  setupSince = Date.now();
  console.log(`WiFi kurulum a\u011F\u0131 a\xE7\u0131k: ${SETUP_SSID} (${state.setup.address})`);
  watchClients();
}
async function closeSetup() {
  await nmcli(["con", "down", SETUP_CON]).catch(() => {
  });
  await nmcli(["con", "delete", SETUP_CON]).catch(() => {
  });
  state.setup = void 0;
}
function classify(message) {
  const m = message.toLowerCase();
  if (m.includes("secrets were required") || m.includes("psk") || m.includes("password"))
    return "wrong_password";
  if (m.includes("no network with ssid")) return "not_found";
  if (m.includes("ip configuration")) return "no_address";
  return "failed";
}
async function connect(ssid, password) {
  busy = true;
  state.mode = "connecting";
  state.phase = "leaving";
  state.ssid = ssid;
  state.error = void 0;
  try {
    await closeSetup();
    await sleep(1e3);
    state.phase = "searching";
    await nmcli(["dev", "wifi", "list", "--rescan", "yes", "ifname", IFACE], 3e4).catch(() => {
    });
    const args = ["dev", "wifi", "connect", ssid];
    if (password) args.push("password", password);
    args.push("ifname", IFACE);
    state.phase = "joining";
    await nmcli(args, 6e4);
    state.mode = "online";
    state.networks = [];
    console.log(`WiFi: ${ssid} a\u011F\u0131na ba\u011Fland\u0131`);
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error(`WiFi: ${ssid} a\u011F\u0131na ba\u011Flan\u0131lamad\u0131: ${message}`);
    state.error = classify(message);
    await nmcli(["con", "delete", "id", ssid]).catch(() => {
    });
    await openSetup().catch((err) => console.error("Kurulum a\u011F\u0131 yeniden a\xE7\u0131lamad\u0131:", err));
  } finally {
    state.phase = void 0;
    busy = false;
  }
}
function wifiState(includePassword) {
  if (includePassword || !state.setup) return state;
  return { ...state, setup: { ...state.setup, password: "" } };
}
function setupPageOpened() {
  if (state.mode === "setup") state.step = "choose";
}
function fromSetupNetwork(address) {
  if (!state.setup) return false;
  const ip = address.replace(/^::ffff:/, "");
  const prefix = state.setup.address.split(".").slice(0, 3).join(".") + ".";
  return ip.startsWith(prefix);
}
function requestForget() {
  if (state.mode === "unsupported") return "unsupported";
  if (busy || state.mode === "setup" || state.mode === "connecting") return "busy";
  busy = true;
  const con = state.ssid;
  setTimeout(async () => {
    try {
      if (con) await nmcli(["con", "delete", "id", con]).catch(() => {
      });
      setupPassword = "";
      state.error = void 0;
      await openSetup();
    } catch (e) {
      console.error("WiFi s\u0131f\u0131rlanamad\u0131:", e);
    } finally {
      busy = false;
    }
  }, 1500);
  console.log(`WiFi s\u0131f\u0131rlan\u0131yor${con ? `: ${con} unutulacak` : ""}`);
  return null;
}
function requestConnect(ssid, password) {
  if (state.mode !== "setup" || busy) return "not_in_setup";
  if (typeof ssid !== "string" || !ssid || Buffer.byteLength(ssid) > 32) return "bad_ssid";
  if (typeof password !== "string") return "bad_password";
  if (password && (password.length < 8 || password.length > 63)) return "bad_password";
  void connect(ssid, password);
  return null;
}
async function retrySaved() {
  const saved = await savedWifi().catch(() => []);
  if (saved.length === 0) return null;
  console.log(`WiFi: kay\u0131tl\u0131 a\u011Flar yeniden deneniyor (${saved.join(", ")})`);
  state.mode = "checking";
  await closeSetup();
  for (let i = 0; i < 15; i++) {
    await sleep(1e3);
    const con = await connectedTo().catch(() => null);
    if (con) return con;
  }
  for (const name of saved) {
    await nmcli(["con", "up", "id", name], 3e4).catch(() => {
    });
    const con = await connectedTo().catch(() => null);
    if (con) return con;
  }
  return null;
}
async function startWifi() {
  try {
    await connectedTo();
  } catch (e) {
    if (e instanceof NmcliMissing) {
      state.mode = "unsupported";
      console.log("WiFi kurulumu kapal\u0131: nmcli bulunamad\u0131.");
      return;
    }
    console.error("WiFi durumu okunamad\u0131; kurulum a\u011F\u0131 devre d\u0131\u015F\u0131.", e);
    state.mode = "unsupported";
    return;
  }
  const started = Date.now();
  let lostSince = null;
  const tick = async () => {
    if (busy || state.mode === "connecting") return;
    if (state.mode === "setup") {
      if (state.step !== "join" || Date.now() - setupSince < RETRY_SAVED_MS) return;
      busy = true;
      try {
        const con2 = await retrySaved();
        if (con2) {
          state.mode = "online";
          state.ssid = con2;
          state.error = void 0;
          lostSince = null;
          console.log(`WiFi: ${con2} a\u011F\u0131na geri d\xF6n\xFCld\xFC`);
        } else if (state.mode !== "setup") {
          await openSetup();
        } else {
          setupSince = Date.now();
        }
      } catch (e) {
        console.error("Kay\u0131tl\u0131 a\u011Flar denenemedi:", e);
        await openSetup().catch(() => {
        });
      } finally {
        busy = false;
      }
      return;
    }
    const con = await connectedTo().catch(() => null);
    if (con) {
      state.mode = "online";
      state.ssid = con;
      lostSince = null;
      return;
    }
    if (state.mode === "checking" && Date.now() - started < BOOT_WAIT_MS && await hasSavedWifi())
      return;
    if (state.mode === "online") {
      lostSince ??= Date.now();
      if (Date.now() - lostSince < LOST_MS) return;
    }
    busy = true;
    try {
      await openSetup();
    } catch (e) {
      console.error("Kurulum a\u011F\u0131 a\xE7\u0131lamad\u0131:", e);
    } finally {
      busy = false;
    }
  };
  await tick();
  setInterval(() => void tick(), CHECK_MS);
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
var isLocal = (req) => ["127.0.0.1", "::1", "::ffff:127.0.0.1"].includes(req.socket.remoteAddress ?? "");
async function wifi(req, res, url) {
  if (url.pathname === "/api/wifi" && req.method === "GET") {
    if (!isLocal(req) && fromSetupNetwork(req.socket.remoteAddress ?? "")) setupPageOpened();
    const state2 = wifiState(isLocal(req));
    return json(res, 200, {
      ...state2,
      setupUrl: state2.setup ? `http://${state2.setup.address}:${PORT}/setup` : null
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
  if (url.pathname === "/api/wifi/forget" && req.method === "POST") {
    const address = req.socket.remoteAddress ?? "";
    if (!withinLimit(address)) return fail(res, 429, "rate_limited");
    const id = header(req, "x-board-id");
    const key = header(req, "x-board-key");
    const rec = id && boards.get(digest(id));
    if (!id || !key || !rec) return fail(res, 404, "not_found");
    if (!sameDigest(rec.w, digest(key))) return fail(res, 403, "forbidden");
    const body = await readBody(req);
    const error = requestForget();
    if (error) return fail(res, error === "unsupported" ? 501 : 409, error);
    if (body?.board === true) {
      boards.delete(digest(id));
      save();
    }
    return json(res, 202, { ok: true });
  }
  return fail(res, 404, "not_found");
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
    if (url.pathname.startsWith("/api/wifi")) return void wifi(req, res, url).catch(done);
    if (url.pathname.startsWith("/api/")) return fail(res, 404, "not_found");
    if (req.method !== "GET" && req.method !== "HEAD") return fail(res, 405, "method_not_allowed");
    serveFile(res, url.pathname, req.method === "HEAD");
  } catch (e) {
    done(e);
  }
}).listen(PORT, () => {
  console.log(`Split Flap: http://localhost:${PORT}  (ev a\u011F\u0131nda: ${lanOrigin() ?? "adres bulunamad\u0131"})`);
  console.log(`Kay\u0131tlar: ${DATA_FILE}`);
  void startWifi();
});
