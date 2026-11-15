import "server-only";

// Pano kayıtlarının durduğu depo: Upstash Redis (REST). Bağlantı bilgisi yalnızca
// sunucudaki ortam değişkenlerinden okunur ve tarayıcıya giden koda girmez.
// Vercel'in Upstash bağlantısı değişkenleri KV_* adıyla, Upstash'in kendi
// kurulumu UPSTASH_* adıyla ekler; ikisi de kabul edilir.
//
// Geliştirme sırasında depo ayarlı değilse veriler bellekte tutulur ki özellik
// yerelde denenebilsin. Yayında depo yoksa özellik kapalıdır (bkz. available()).

const URL_ = process.env.UPSTASH_REDIS_REST_URL ?? process.env.KV_REST_API_URL;
const TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN ?? process.env.KV_REST_API_TOKEN;
const DEV = process.env.NODE_ENV !== "production";

type Command = (string | number)[];

const memory: Map<string, { value: string; expires: number }> =
  ((globalThis as Record<string, unknown>).__splitflatStore as never) ??
  ((globalThis as Record<string, unknown>).__splitflatStore = new Map());

function runInMemory([op, key, ...rest]: Command): unknown {
  const k = String(key);
  const now = Date.now();
  const hit = memory.get(k);
  if (hit && hit.expires < now) memory.delete(k);
  switch (op) {
    case "GET":
      return memory.get(k)?.value ?? null;
    case "DEL":
      return memory.delete(k) ? 1 : 0;
    case "SET": {
      const nx = rest.includes("NX");
      const ex = rest.indexOf("EX");
      if (nx && memory.has(k)) return null;
      const ttl = ex >= 0 ? Number(rest[ex + 1]) * 1000 : Infinity;
      memory.set(k, { value: String(rest[0]), expires: now + ttl });
      return "OK";
    }
    case "INCR": {
      const cur = memory.get(k);
      const next = Number(cur?.value ?? 0) + 1;
      memory.set(k, { value: String(next), expires: cur?.expires ?? Infinity });
      return next;
    }
    case "EXPIRE": {
      const cur = memory.get(k);
      if (cur) cur.expires = now + Number(rest[0]) * 1000;
      return cur ? 1 : 0;
    }
    default:
      throw new Error(`Desteklenmeyen komut: ${op}`);
  }
}

/** Depo kullanılabilir mi? Yayında ortam değişkenleri yoksa hayır. */
export const available = () => Boolean(URL_ && TOKEN) || DEV;

/** Komutları tek istekte, sırayla çalıştırır ve sonuçlarını döndürür. */
export async function redis(...commands: Command[]): Promise<unknown[]> {
  if (!URL_ || !TOKEN) {
    if (!DEV) throw new Error("Depo ayarlı değil");
    return commands.map(runInMemory);
  }
  const res = await fetch(`${URL_}/pipeline`, {
    method: "POST",
    headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify(commands),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Depo hatası: ${res.status}`);
  const out = (await res.json()) as { result?: unknown; error?: string }[];
  return out.map((r) => {
    if (r.error) throw new Error(r.error);
    return r.result;
  });
}
