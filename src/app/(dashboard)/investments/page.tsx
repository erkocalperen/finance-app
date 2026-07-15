import { redirect } from "next/navigation";

import { Pagination } from "@/components/pagination";
import {
  InvestmentsManager,
  type HoldingRow,
  type TradeHistoryRow,
} from "@/components/investments/investments-manager";
import { PriceRefresher } from "@/components/investments/price-refresher";
import type {
  TradeAccountOption,
  TradeInstrumentOption,
} from "@/components/investments/trade-form-dialog";
import { createClient } from "@/lib/supabase/server";
import type { Currency } from "@/lib/constants";
import { shouldRefresh as shouldRefreshPrices } from "@/lib/prices/staleness";
import {
  extendWithInvestments,
  type InstrumentKind,
  type TradeSide,
} from "@/types/database-investments";

const PAGE_SIZE = 25;

// investment_trades join sonuçları için ara tip.
type TradeRaw = {
  id: string;
  side: TradeSide;
  quantity: number;
  unit_price: number;
  fee: number;
  counts_as_cash_flow: boolean;
  occurred_on: string;
  note: string | null;
  instrument:
    | {
        id: string;
        name: string;
        symbol: string;
        unit: string;
        currency: string;
        kind: InstrumentKind;
      }
    | {
        id: string;
        name: string;
        symbol: string;
        unit: string;
        currency: string;
        kind: InstrumentKind;
      }[]
    | null;
  account:
    | { id: string; name: string; currency: string }
    | { id: string; name: string; currency: string }[]
    | null;
};

function first<T>(v: T | T[] | null | undefined): T | null {
  if (v == null) return null;
  return Array.isArray(v) ? (v[0] ?? null) : v;
}

export default async function InvestmentsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const base = await createClient();
  const {
    data: { user },
  } = await base.auth.getUser();
  if (!user) redirect("/login");

  const supabase = extendWithInvestments(base);

  const params = await searchParams;
  const rawPage = Number(
    typeof params.page === "string" ? params.page : "1",
  );
  const page =
    Number.isFinite(rawPage) && rawPage > 0 ? Math.floor(rawPage) : 1;

  const [
    profileRes,
    instrumentsRes,
    accountsRes,
    holdingsRes,
    tradesRes,
    tradesCountRes,
    latestPricesRes,
  ] = await Promise.all([
    supabase
      .from("profiles")
      .select("base_currency")
      .eq("id", user.id)
      .single(),
    supabase
      .from("instruments")
      .select("id, kind, symbol, name, unit, currency, is_active")
      .eq("is_active", true)
      .order("kind")
      .order("name"),
    supabase
      .from("accounts")
      .select("id, name, currency, is_archived")
      .eq("user_id", user.id)
      .order("name"),
    supabase
      .from("portfolio_holdings")
      .select(
        "instrument_id, symbol, name, kind, unit, currency, quantity, avg_cost, total_cost, current_price, price_as_of, market_value, pnl, pnl_pct",
      )
      .eq("user_id", user.id)
      .order("name"),
    supabase
      .from("investment_trades")
      .select(
        `id, side, quantity, unit_price, fee, counts_as_cash_flow, occurred_on, note,
         instrument:instruments(id, name, symbol, unit, currency, kind),
         account:accounts(id, name, currency)`,
        { count: "exact" },
      )
      .eq("user_id", user.id)
      .order("occurred_on", { ascending: false })
      .order("created_at", { ascending: false })
      .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1),
    supabase
      .from("investment_trades")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id),
    // Fiyat kaynak + yaşı için latest_instrument_prices ayrıca çekilir
    // (portfolio_holdings view'ı source içermediği için).
    supabase
      .from("latest_instrument_prices")
      .select("instrument_id, source, as_of"),
  ]);

  const baseCurrency = (profileRes.data?.base_currency ?? "TRY") as Currency;

  const instruments: TradeInstrumentOption[] = (instrumentsRes.data ?? []).map(
    (i) => ({
      id: i.id,
      symbol: i.symbol,
      name: i.name,
      kind: i.kind,
      unit: i.unit,
      currency: i.currency as Currency,
    }),
  );

  // instrument_id -> { source, as_of } eşleşmesi. holdings mapping burayı okur.
  const priceMetaById = new Map<string, { source: string; asOf: string }>();
  for (const p of latestPricesRes.data ?? []) {
    if (!p.instrument_id || !p.source || !p.as_of) continue;
    priceMetaById.set(p.instrument_id, {
      source: p.source,
      asOf: p.as_of,
    });
  }

  // shouldRefresh: sadece hisse enstrümanlarının en yeni fiyatına bak.
  // Hisse yoksa refresh yok.
  const stockInstrumentIds = (instrumentsRes.data ?? [])
    .filter((i) => i.kind === "stock")
    .map((i) => i.id);
  const stockLatestAsOf = stockInstrumentIds
    .map((id) => priceMetaById.get(id)?.asOf)
    .filter((d): d is string => typeof d === "string");
  const stocksExist = stockInstrumentIds.length > 0;
  const stocksHaveNoPrices = stocksExist && stockLatestAsOf.length === 0;
  const stocksAreStale = shouldRefreshPrices(stockLatestAsOf);
  const shouldRefresh =
    stocksExist && (stocksHaveNoPrices || stocksAreStale);

  const activeAccounts: TradeAccountOption[] = (accountsRes.data ?? [])
    .filter((a) => !a.is_archived)
    .map((a) => ({
      id: a.id,
      name: a.name,
      currency: a.currency as Currency,
    }));

  const holdings: HoldingRow[] = (holdingsRes.data ?? [])
    .filter(
      (h) =>
        h.instrument_id != null &&
        h.symbol != null &&
        h.name != null &&
        h.kind != null &&
        h.unit != null &&
        h.currency != null &&
        h.quantity != null &&
        h.avg_cost != null,
    )
    .map((h) => {
      const meta = priceMetaById.get(h.instrument_id as string);
      return {
        instrumentId: h.instrument_id as string,
        symbol: h.symbol as string,
        name: h.name as string,
        kind: h.kind as InstrumentKind,
        unit: h.unit as string,
        currency: h.currency as Currency,
        quantity: Number(h.quantity),
        avgCost: Number(h.avg_cost),
        totalCost: Number(h.total_cost ?? 0),
        currentPrice:
          h.current_price == null ? null : Number(h.current_price),
        priceAsOf: h.price_as_of,
        priceSource: meta?.source ?? null,
        marketValue: h.market_value == null ? null : Number(h.market_value),
        pnl: h.pnl == null ? null : Number(h.pnl),
        pnlPct: h.pnl_pct == null ? null : Number(h.pnl_pct),
      } satisfies HoldingRow;
    });

  // Supabase gen types investments'ı yeni tanıyacak; şimdilik unknown cast.
  const trades: TradeHistoryRow[] = (
    (tradesRes.data ?? []) as unknown as TradeRaw[]
  )
    .map((r) => {
      const ins = first(r.instrument);
      const acc = first(r.account);
      if (!ins || !acc) return null;
      return {
        id: r.id,
        side: r.side,
        quantity: Number(r.quantity),
        unitPrice: Number(r.unit_price),
        fee: Number(r.fee),
        countsAsCashFlow: Boolean(r.counts_as_cash_flow),
        occurredOn: r.occurred_on,
        note: r.note,
        instrument: {
          id: ins.id,
          name: ins.name,
          symbol: ins.symbol,
          unit: ins.unit,
          currency: ins.currency as Currency,
          kind: ins.kind,
        },
        account: {
          id: acc.id,
          name: acc.name,
          currency: acc.currency as Currency,
        },
      } satisfies TradeHistoryRow;
    })
    .filter((r): r is TradeHistoryRow => r !== null);

  const totalTradeCount = tradesCountRes.count ?? 0;
  const filteredCount = tradesRes.count ?? 0;
  const totalPages = Math.max(1, Math.ceil(filteredCount / PAGE_SIZE));

  const emptyKind: "none" | "no-data" =
    totalTradeCount === 0 ? "no-data" : "none";

  return (
    <div className="space-y-6">
      <InvestmentsManager
        holdings={holdings}
        trades={trades}
        instruments={instruments}
        accounts={activeAccounts}
        baseCurrency={baseCurrency}
        emptyKind={emptyKind}
      />
      {emptyKind === "none" && (
        <Pagination page={page} totalPages={totalPages} />
      )}
      <PriceRefresher shouldRefresh={shouldRefresh} />
    </div>
  );
}
