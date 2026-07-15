import type { PriceProvider, PriceQuote } from "../types";

const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";
const TIMEOUT_MS = 15_000;
const BETWEEN_REQUESTS_MS = 350;

async function fetchWithTimeout(url: string, headers: HeadersInit) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    return await fetch(url, {
      signal: ctrl.signal,
      headers,
      cache: "no-store",
    });
  } finally {
    clearTimeout(timer);
  }
}

function parseAsOf(raw: unknown): string {
  if (typeof raw !== "string" || raw.length === 0) {
    return new Date().toISOString();
  }
  const d = new Date(raw);
  const t = d.getTime();
  if (Number.isFinite(t)) return d.toISOString();
  return new Date().toISOString();
}

/**
 * Bigpara sayısal alanları bazen "326,00" gibi TR ondalık ayracı ile,
 * bazen "1.234,56" gibi binlik ayracıyla birlikte döner. İkisini de
 * güvenli şekilde number'a çevir.
 */
function toPositiveNumber(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v) && v > 0) return v;
  if (typeof v === "string") {
    const cleaned = v.trim().replace(/\./g, "").replace(",", ".");
    if (cleaned.length === 0) return null;
    const n = Number(cleaned);
    if (Number.isFinite(n) && n > 0) return n;
  }
  return null;
}

function toChangePercent(v: unknown): number | undefined {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const n = Number(v.trim().replace(",", "."));
    if (Number.isFinite(n)) return n;
  }
  return undefined;
}

async function fetchOne(symbol: string): Promise<PriceQuote | null> {
  // instruments.symbol saf BIST kodudur (THYAO), ama önek gelirse temizle.
  const clean = symbol.replace(/^BIST_/i, "").toUpperCase();
  const url = `https://bigpara.hurriyet.com.tr/api/v1/borsa/hisseyuzeysel/${encodeURIComponent(clean)}`;

  const headers = {
    "User-Agent": USER_AGENT,
    Accept: "application/json, text/plain, */*",
    Referer: "https://bigpara.hurriyet.com.tr/",
    "Accept-Language": "tr-TR,tr;q=0.9,en-US;q=0.8,en;q=0.7",
  };

  let res: Response;
  try {
    res = await fetchWithTimeout(url, headers);
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") {
      await new Promise((r) => setTimeout(r, 750));
      res = await fetchWithTimeout(url, headers);
    } else {
      throw err;
    }
  }
  if (!res.ok) return null;

  let body: unknown;
  try {
    body = await res.json();
  } catch {
    return null;
  }
  if (!body || typeof body !== "object") return null;

  const b = body as {
    code?: string | number;
    data?: { hisseYuzeysel?: Record<string, unknown> } | null;
  };
  // API "0" = başarılı; başka her şey atlanır.
  if (String(b.code) !== "0") return null;

  const d = b.data?.hisseYuzeysel;
  if (!d) return null;

  const price = toPositiveNumber(d.kapanis);
  if (price == null) return null;

  return {
    symbol: clean,
    price,
    asOf: parseAsOf(d.tarih),
    source: "bigpara",
    changePercent: toChangePercent(d.yuzdedegisim),
  };
}

export class BigparaProvider implements PriceProvider {
  readonly name = "bigpara";

  supports(kind: "gold" | "silver" | "stock"): boolean {
    return kind === "stock";
  }

  async fetchQuotes(symbols: string[]): Promise<PriceQuote[]> {
    // Sıralı çek — Promise.all ile aynı anda dövmek Bigpara'yı rahatsız eder.
    // Her sembol izole try/catch: biri patlarsa diğerleri devam eder.
    const results: PriceQuote[] = [];
    for (let i = 0; i < symbols.length; i++) {
      if (i > 0) {
        await new Promise((r) => setTimeout(r, BETWEEN_REQUESTS_MS));
      }
      try {
        const q = await fetchOne(symbols[i]);
        if (q) results.push(q);
      } catch (err) {
        // Sessizce atla — timeout, network, parse hatası, hepsi burada yutulur.
        console.warn(`bigpara: ${symbols[i]} atlandı`, err);
      }
    }
    return results;
  }
}
