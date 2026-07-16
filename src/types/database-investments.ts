import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database as BaseDatabase } from "./database";

/**
 * Geçici tip shim'i (transfers'takine benzer).
 * 20260712120800_investments migration'ı push edilene ve `pnpm db:types`
 * regen olana kadar bu deklarasyonlar sayesinde TypeScript, instruments /
 * investment_trades / instrument_prices tablolarını ve iki yeni view'ı
 * tanıyor. Regen sonrası bu dosya kaldırılabilir; intersection ile
 * çakışma vermez.
 */

export type InstrumentKind = "gold" | "silver" | "stock";
export type TradeSide = "buy" | "sell";

export type InstrumentRow = {
  id: string;
  kind: InstrumentKind;
  symbol: string;
  name: string;
  unit: string;
  currency: string;
  is_active: boolean;
  created_at: string;
};

export type InstrumentInsert = {
  id?: string;
  kind: InstrumentKind;
  symbol: string;
  name: string;
  unit: string;
  currency?: string;
  is_active?: boolean;
  created_at?: string;
};

export type InvestmentTradeRow = {
  id: string;
  user_id: string;
  instrument_id: string;
  account_id: string;
  side: TradeSide;
  quantity: number;
  unit_price: number;
  fee: number;
  counts_as_cash_flow: boolean;
  occurred_on: string;
  note: string | null;
  created_at: string;
  updated_at: string;
};

export type InvestmentTradeInsert = {
  id?: string;
  user_id: string;
  instrument_id: string;
  account_id: string;
  side: TradeSide;
  quantity: number;
  unit_price: number;
  fee?: number;
  counts_as_cash_flow?: boolean;
  occurred_on: string;
  note?: string | null;
  created_at?: string;
  updated_at?: string;
};

export type InvestmentTradeUpdate = Partial<InvestmentTradeInsert>;

export type InstrumentPriceRow = {
  id: string;
  instrument_id: string;
  price: number;
  as_of: string;
  source: string;
  created_at: string;
};

export type InstrumentPriceInsert = {
  id?: string;
  instrument_id: string;
  price: number;
  as_of?: string;
  source?: string;
  created_at?: string;
};

export type LatestInstrumentPriceRow = {
  instrument_id: string | null;
  price: number | null;
  as_of: string | null;
  source: string | null;
};

export type PortfolioHoldingRow = {
  user_id: string | null;
  instrument_id: string | null;
  symbol: string | null;
  name: string | null;
  kind: InstrumentKind | null;
  unit: string | null;
  currency: string | null;
  quantity: number | null;
  avg_cost: number | null;
  total_cost: number | null;
  current_price: number | null;
  price_as_of: string | null;
  market_value: number | null;
  pnl: number | null;
  pnl_pct: number | null;
};

type ExtendedDatabase = BaseDatabase & {
  public: BaseDatabase["public"] & {
    Tables: BaseDatabase["public"]["Tables"] & {
      instruments: {
        Row: InstrumentRow;
        Insert: InstrumentInsert;
        Update: never;
        Relationships: [];
      };
      investment_trades: {
        Row: InvestmentTradeRow;
        Insert: InvestmentTradeInsert;
        Update: InvestmentTradeUpdate;
        Relationships: [];
      };
      instrument_prices: {
        Row: InstrumentPriceRow;
        Insert: InstrumentPriceInsert;
        Update: never;
        Relationships: [];
      };
    };
    Views: BaseDatabase["public"]["Views"] & {
      latest_instrument_prices: {
        Row: LatestInstrumentPriceRow;
        Relationships: [];
      };
      portfolio_holdings: {
        Row: PortfolioHoldingRow;
        Relationships: [];
      };
    };
  };
};

export function extendWithInvestments(
  client: SupabaseClient<BaseDatabase>,
): SupabaseClient<ExtendedDatabase> {
  return client as unknown as SupabaseClient<ExtendedDatabase>;
}
