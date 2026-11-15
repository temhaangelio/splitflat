import { parseShared, type Shared } from "@/lib/board";
import {
  clientIp,
  digest,
  KEY_FORMAT,
  sameDigest,
  withinLocalLimit,
  withinSharedLimit,
} from "@/lib/server/guard";
import { available, redis } from "@/lib/server/store";

// Telefondan kontrol için pano kaydı.
//
//   POST    yeni pano açar            (kimlik + yazma anahtarı + ilk durum)
//   GET     durumu okur               (kimlik)
//   PUT     durumu değiştirir         (kimlik + yazma anahtarı)
//   PATCH   bağlantıyı yeniler        (kimlik + yazma anahtarı → yeni çift)
//   DELETE  panoyu siler              (kimlik + yazma anahtarı)
//
// Kimlik okuma anahtarıdır; ikisi de adres yerine başlıkta gelir ki sunucu
// günlüklerine düşmesin. Hesap ve çerez yoktur, bu yüzden CSRF de söz konusu değil.

type Rec = { v: number; w: string; data: Shared };

const TTL = 60 * 60 * 24 * 365; // bir yıl yazılmayan pano silinir
const MAX_BODY = 8_000;
const READS_PER_MIN = 120;
const WRITES_PER_MIN = 30;
const CREATES_PER_MIN = 5;

const json = (body: unknown, status = 200) =>
  Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
const fail = (error: string, status: number) => json({ error }, status);

const recordKey = (id: string) => `board:${digest(id)}`;

function keysFrom(request: Request) {
  const id = request.headers.get("x-board-id") ?? "";
  const key = request.headers.get("x-board-key") ?? "";
  return { id: KEY_FORMAT.test(id) ? id : null, key: KEY_FORMAT.test(key) ? key : null };
}

async function bodyOf(request: Request): Promise<Record<string, unknown> | null> {
  const text = await request.text();
  if (text.length > MAX_BODY) return null;
  try {
    const parsed: unknown = JSON.parse(text);
    return typeof parsed === "object" && parsed !== null ? (parsed as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

async function load(id: string): Promise<Rec | null> {
  const [raw] = await redis(["GET", recordKey(id)]);
  if (typeof raw !== "string") return null;
  return JSON.parse(raw) as Rec;
}

/** Yazma işlemlerinin ortak ön kontrolü: sınır, anahtar biçimi, kayıt, yetki. */
async function authorize(request: Request, bucket: string, max: number) {
  if (!available()) return { error: fail("not_configured", 503) };
  const ip = clientIp(request);
  if (!withinLocalLimit(ip, READS_PER_MIN) || !(await withinSharedLimit(ip, bucket, max))) {
    return { error: fail("rate_limited", 429) };
  }
  const { id, key } = keysFrom(request);
  if (!id || !key) return { error: fail("not_found", 404) };
  const rec = await load(id);
  if (!rec) return { error: fail("not_found", 404) };
  if (!sameDigest(rec.w, digest(key))) return { error: fail("forbidden", 403) };
  return { id, rec };
}

export async function GET(request: Request) {
  if (!available()) return fail("not_configured", 503);
  if (!withinLocalLimit(clientIp(request), READS_PER_MIN)) return fail("rate_limited", 429);
  const { id } = keysFrom(request);
  if (!id) return fail("not_found", 404);
  const rec = await load(id);
  if (!rec) return fail("not_found", 404);
  // İstemci elindeki sürümü bildirirse ve değişiklik yoksa yalnızca sürüm döner.
  const known = Number(new URL(request.url).searchParams.get("v"));
  return json(known === rec.v ? { v: rec.v } : { v: rec.v, data: rec.data });
}

export async function POST(request: Request) {
  if (!available()) return fail("not_configured", 503);
  const ip = clientIp(request);
  if (!withinLocalLimit(ip, READS_PER_MIN) || !(await withinSharedLimit(ip, "create", CREATES_PER_MIN))) {
    return fail("rate_limited", 429);
  }
  const { id, key } = keysFrom(request);
  const body = await bodyOf(request);
  const data = body && parseShared(body.data);
  if (!id || !key || id === key || !data) return fail("bad_request", 400);

  const rec: Rec = { v: 1, w: digest(key), data };
  const [created] = await redis(["SET", recordKey(id), JSON.stringify(rec), "EX", TTL, "NX"]);
  if (created !== "OK") return fail("conflict", 409);
  return json({ v: rec.v }, 201);
}

export async function PUT(request: Request) {
  const auth = await authorize(request, "write", WRITES_PER_MIN);
  if (auth.error) return auth.error;
  const body = await bodyOf(request);
  const data = body && parseShared(body.data);
  if (!data) return fail("bad_request", 400);

  // İstemcinin gördüğü sürüm eskiyse başka bir cihaz arada yazmıştır: üzerine
  // yazmak yerine güncel durum geri gönderilir.
  if (typeof body.base === "number" && body.base !== auth.rec.v) {
    return json({ error: "stale", v: auth.rec.v, data: auth.rec.data }, 409);
  }
  const next: Rec = { v: auth.rec.v + 1, w: auth.rec.w, data };
  await redis(["SET", recordKey(auth.id), JSON.stringify(next), "EX", TTL]);
  return json({ v: next.v });
}

export async function PATCH(request: Request) {
  const auth = await authorize(request, "write", WRITES_PER_MIN);
  if (auth.error) return auth.error;
  const body = await bodyOf(request);
  const id = typeof body?.id === "string" && KEY_FORMAT.test(body.id) ? body.id : null;
  const key = typeof body?.key === "string" && KEY_FORMAT.test(body.key) ? body.key : null;
  if (!id || !key || id === key || id === auth.id) return fail("bad_request", 400);

  // Kayıt yeni kimliğe taşınır, eskisi silinir: eski bağlantı artık hiçbir işe yaramaz.
  const next: Rec = { v: auth.rec.v + 1, w: digest(key), data: auth.rec.data };
  const [created] = await redis(["SET", recordKey(id), JSON.stringify(next), "EX", TTL, "NX"]);
  if (created !== "OK") return fail("conflict", 409);
  await redis(["DEL", recordKey(auth.id)]);
  return json({ v: next.v });
}

export async function DELETE(request: Request) {
  const auth = await authorize(request, "write", WRITES_PER_MIN);
  if (auth.error) return auth.error;
  await redis(["DEL", recordKey(auth.id)]);
  return json({ ok: true });
}
