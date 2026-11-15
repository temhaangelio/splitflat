import "server-only";
import { createHash, timingSafeEqual } from "node:crypto";
import { redis } from "@/lib/server/store";

/** Anahtarlar: tarayıcıda üretilen 128 bit, base64url ile 22 karakter. */
export const KEY_FORMAT = /^[A-Za-z0-9_-]{22}$/;

/**
 * Depoda anahtarların kendisi değil özeti durur: depo sızsa bile içindeki
 * bilgiyle bir panoya ulaşılamaz ya da yazılamaz.
 */
export const digest = (value: string) => createHash("sha256").update(value).digest("hex");

/** Zamanlama farkı sızdırmadan karşılaştırır. */
export function sameDigest(a: string, b: string) {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

export const clientIp = (request: Request) =>
  request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";

/* ---------- İstek sınırı ---------- */

// 1) Bellekte, her istek için: depoya gitmeden kaba seli keser. Sunucusuz
//    ortamda her örnek kendi sayacını tutar, yani kesin değil, ilk süzgeçtir.
const WINDOW_MS = 60_000;
const hits = new Map<string, { count: number; reset: number }>();

export function withinLocalLimit(ip: string, max: number) {
  const now = Date.now();
  if (hits.size > 5000) {
    for (const [k, v] of hits) if (v.reset < now) hits.delete(k);
  }
  const hit = hits.get(ip);
  if (!hit || hit.reset < now) {
    hits.set(ip, { count: 1, reset: now + WINDOW_MS });
    return true;
  }
  return ++hit.count <= max;
}

// 2) Depoda, yalnızca yazma işlemleri için: tüm örnekler arasında ortak ve
//    kesin. Okumalarda kullanılmaz, çünkü her okuma başına ek komut harcar.
export async function withinSharedLimit(ip: string, bucket: string, max: number) {
  const key = `rl:${bucket}:${digest(ip).slice(0, 16)}:${Math.floor(Date.now() / WINDOW_MS)}`;
  const [count] = await redis(["INCR", key], ["EXPIRE", key, 120]);
  return Number(count) <= max;
}
