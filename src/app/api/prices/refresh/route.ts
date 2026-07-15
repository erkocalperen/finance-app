import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import {
  extendWithInvestments,
  type InstrumentKind,
} from "@/types/database-investments";
import { getQuotesForInstruments } from "@/lib/prices";

export const dynamic = "force-dynamic";
export const runtime = "nodejs"; // Bigpara fetch'i Node runtime'ında güvenilir.

/**
 * POST /api/prices/refresh
 *
 * Aktif tüm 'stock' enstrümanlarının fiyatlarını Bigpara'dan çeker,
 * başarılı olanları instrument_prices'a INSERT'ler. Başarısızlıklar
 * sessizce atlanır — tüm çekim çökse bile 200 döner (updated: 0).
 *
 * Kimlik doğrulama: sadece giriş yapmış kullanıcı tetikleyebilir. Yazılan
 * fiyatlar GLOBAL (kullanıcıya özel değil), ancak endpoint'in halka açık
 * olmasını istemiyoruz — bot/DDoS riski.
 */
export async function POST() {
  const base = await createClient();
  const {
    data: { user },
  } = await base.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const supabase = extendWithInvestments(base);

  const { data: stocks, error: instrumentsError } = await supabase
    .from("instruments")
    .select("id, symbol, kind")
    .eq("kind", "stock")
    .eq("is_active", true);

  if (instrumentsError || !stocks || stocks.length === 0) {
    return NextResponse.json({ updated: 0, failed: 0, failedSymbols: [] });
  }

  const stockList = stocks.map((s) => ({
    id: s.id,
    symbol: s.symbol,
    kind: s.kind as InstrumentKind,
  }));

  const quotes = await getQuotesForInstruments(stockList);

  const symbolToId = new Map(stockList.map((s) => [s.symbol, s.id]));
  const succeededSymbols = new Set<string>();
  const inserts: Array<{
    instrument_id: string;
    price: number;
    as_of: string;
    source: string;
  }> = [];

  for (const q of quotes) {
    const id = symbolToId.get(q.symbol);
    if (!id) continue;
    inserts.push({
      instrument_id: id,
      price: q.price,
      as_of: q.asOf,
      source: q.source,
    });
    succeededSymbols.add(q.symbol);
  }

  if (inserts.length > 0) {
    const { error } = await supabase
      .from("instrument_prices")
      .insert(inserts);
    if (error) {
      console.warn("instrument_prices insert failed:", error.message);
      // Yine de sessizce dön — kullanıcı için hata değil, geçici bir aksaklık.
    }
  }

  const failedSymbols = stockList
    .filter((s) => !succeededSymbols.has(s.symbol))
    .map((s) => s.symbol);

  revalidatePath("/investments");
  revalidatePath("/dashboard");

  return NextResponse.json({
    updated: inserts.length,
    failed: failedSymbols.length,
    failedSymbols,
  });
}
