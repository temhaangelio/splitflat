import type { Shared } from "@/lib/board";

// Telefondan kontrolün tarayıcı tarafı: anahtar üretimi ve /api/board çağrıları.
//
// Bir pano iki anahtarla tanımlanır: `id` okumaya, `key` yazmaya yetkilidir.
// İkisi de bu tarayıcıda üretilir ve adres yerine istek başlığında gönderilir.
// Eşleştirme bağlantısında anahtarlar `#` sonrasında durur; tarayıcı o kısmı
// sunucuya göndermez, yani sunucu günlüklerine ve yönlendiren bilgisine düşmez.

export type Pair = { id: string; key: string };

/** 128 bit kriptografik rastgele, base64url ile 22 karakter. */
export function newKey(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}
export const newPair = (): Pair => ({ id: newKey(), key: newKey() });

const PAIR = /^#?([A-Za-z0-9_-]{22})\.([A-Za-z0-9_-]{22})$/;
/**
 * Eşleştirme bağlantısı. Pano Pi'de `localhost` üzerinden açıldığı için kendi
 * adresi telefona bir şey ifade etmez; pano, sunucudan aldığı ev ağı adresini
 * (`/api/host`) verir.
 */
export const pairUrl = (p: Pair, origin = location.origin) => `${origin}/remote#${p.id}.${p.key}`;

/** Sunucunun ev ağındaki adresi; bilinmiyorsa sayfanın kendi adresi. */
export async function hostOrigin(): Promise<string> {
  try {
    const r = await fetch("/api/host", { cache: "no-store" });
    const body = (await r.json()) as { origin?: unknown };
    if (typeof body.origin === "string" && /^https?:\/\//.test(body.origin)) return body.origin;
  } catch {
    // sunucu adresi bildiremezse aşağıya düşülür
  }
  return location.origin;
}
export function parsePair(hash: string): Pair | null {
  const m = PAIR.exec(hash);
  return m ? { id: m[1], key: m[2] } : null;
}

/** Sunucunun döndürdüğü hata kodu: not_found, forbidden, rate_limited, not_configured… */
export class RemoteError extends Error {
  constructor(
    public code: string,
    public status: number,
  ) {
    super(code);
  }
}

async function call(
  method: string,
  pair: { id: string; key?: string },
  body?: unknown,
  query = "",
): Promise<{ status: number; body: Record<string, unknown> }> {
  const headers: Record<string, string> = { "x-board-id": pair.id };
  if (pair.key) headers["x-board-key"] = pair.key;
  if (body !== undefined) headers["Content-Type"] = "application/json";
  const res = await fetch(`/api/board${query}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
    cache: "no-store",
    referrerPolicy: "no-referrer",
  });
  const parsed = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  return { status: res.status, body: parsed };
}

const fail = (r: { status: number; body: Record<string, unknown> }) =>
  new RemoteError(typeof r.body.error === "string" ? r.body.error : "error", r.status);

export async function createBoard(pair: Pair, data: Shared): Promise<number> {
  const r = await call("POST", pair, { data });
  if (r.status !== 201) throw fail(r);
  return r.body.v as number;
}

/** Durumu okur. `known` verilirse ve değişiklik yoksa `data` gelmez. */
export async function readBoard(id: string, known?: number): Promise<{ v: number; data?: Shared }> {
  const r = await call("GET", { id }, undefined, known === undefined ? "" : `?v=${known}`);
  if (r.status !== 200) throw fail(r);
  return r.body as { v: number; data?: Shared };
}

/**
 * Durumu yazar. Arada başka bir cihaz yazdıysa (`stale`) sunucudaki güncel
 * durum döner ve çağıran onu benimser.
 */
export async function writeBoard(
  pair: Pair,
  data: Shared,
  base: number,
): Promise<{ v: number; stale?: Shared }> {
  const r = await call("PUT", pair, { data, base });
  if (r.status === 409 && r.body.error === "stale") {
    return { v: r.body.v as number, stale: r.body.data as Shared };
  }
  if (r.status !== 200) throw fail(r);
  return { v: r.body.v as number };
}

/** Bağlantıyı yeniler: kayıt yeni anahtarlara taşınır, eskileri geçersiz olur. */
export async function rotateBoard(pair: Pair, next: Pair): Promise<number> {
  const r = await call("PATCH", pair, next);
  if (r.status !== 200) throw fail(r);
  return r.body.v as number;
}

/**
 * Pi'nin WiFi ayarını sıfırlar: Pi ağı unutur ve kurulum ağını açar.
 * `alsoBoard` ile pano kaydı da silinir (tümünü sıfırla).
 */
export async function forgetWifi(pair: Pair, alsoBoard: boolean): Promise<void> {
  const res = await fetch("/api/wifi/forget", {
    method: "POST",
    headers: { "x-board-id": pair.id, "x-board-key": pair.key, "Content-Type": "application/json" },
    body: JSON.stringify({ board: alsoBoard }),
    cache: "no-store",
    referrerPolicy: "no-referrer",
  });
  if (res.status !== 202) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    throw new RemoteError(body.error ?? "error", res.status);
  }
}

export async function deleteBoard(pair: Pair): Promise<void> {
  const r = await call("DELETE", pair);
  if (r.status !== 200 && r.status !== 404) throw fail(r);
}
