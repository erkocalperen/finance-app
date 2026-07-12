import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database as BaseDatabase } from "./database";

/**
 * Geçici tip shim'i.
 *
 * `transfers` tablosu 20260712120700 migration'ıyla oluşturuluyor;
 * `pnpm db:types` çalışana kadar `Database` içinde görünmüyor. Bu dosya
 * TypeScript'in tabloyu tanıyabilmesi için gerekli tipleri elle deklare
 * eder ve Supabase client'ı buna göre cast eden bir yardımcı sağlar.
 *
 * `db:types` regen ettikten sonra:
 * - Bu dosya silinebilir (base Database transfers'i kendiliğinden içerir),
 * - Ya da olduğu gibi bırakılabilir — TS intersection ile birleşir.
 */

export type TransferRow = {
  id: string;
  user_id: string;
  from_account_id: string;
  to_account_id: string;
  amount: number;
  currency: string;
  received_amount: number;
  occurred_on: string;
  note: string | null;
  created_at: string;
  updated_at: string;
};

export type TransferInsert = {
  id?: string;
  user_id: string;
  from_account_id: string;
  to_account_id: string;
  amount: number;
  currency?: string;
  received_amount: number;
  occurred_on: string;
  note?: string | null;
  created_at?: string;
  updated_at?: string;
};

export type TransferUpdate = Partial<TransferInsert>;

type ExtendedDatabase = BaseDatabase & {
  public: BaseDatabase["public"] & {
    Tables: BaseDatabase["public"]["Tables"] & {
      transfers: {
        Row: TransferRow;
        Insert: TransferInsert;
        Update: TransferUpdate;
        Relationships: [];
      };
    };
  };
};

export function extendWithTransfers(
  client: SupabaseClient<BaseDatabase>,
): SupabaseClient<ExtendedDatabase> {
  return client as unknown as SupabaseClient<ExtendedDatabase>;
}
