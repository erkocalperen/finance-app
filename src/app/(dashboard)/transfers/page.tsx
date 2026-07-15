import { redirect } from "next/navigation";

import { Pagination } from "@/components/pagination";
import {
  TransfersManager,
  type TransferRow,
} from "@/components/transfers/transfers-manager";
import type { TransferAccountOption } from "@/components/transfers/transfer-form-dialog";
import { createClient } from "@/lib/supabase/server";
import { extendWithTransfers } from "@/types/database-transfers";
import type { Currency } from "@/lib/constants";

const PAGE_SIZE = 25;

// Transfers listeleme sorgusundan dönen ham veri şekli.
// FK'ları column-hint syntax'ıyla ayırıyoruz: `from_account_id`,
// `to_account_id`. Embed sonucu tek nesne olarak gelir.
type TransferRaw = {
  id: string;
  amount: number;
  currency: string;
  received_amount: number;
  counts_as_expense: boolean;
  occurred_on: string;
  note: string | null;
  from_account:
    | { id: string; name: string; currency: string; type: string }
    | { id: string; name: string; currency: string; type: string }[]
    | null;
  to_account:
    | { id: string; name: string; currency: string; type: string }
    | { id: string; name: string; currency: string; type: string }[]
    | null;
};

function first<T>(v: T | T[] | null): T | null {
  if (v == null) return null;
  return Array.isArray(v) ? (v[0] ?? null) : v;
}

export default async function TransfersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const base = await createClient();
  const {
    data: { user },
  } = await base.auth.getUser();
  if (!user) redirect("/login");

  const supabase = extendWithTransfers(base);

  const params = await searchParams;
  const rawPage = Number(
    typeof params.page === "string" ? params.page : "1",
  );
  const page =
    Number.isFinite(rawPage) && rawPage > 0 ? Math.floor(rawPage) : 1;

  const [accountsRes, listRes] = await Promise.all([
    supabase
      .from("accounts")
      .select("id, name, currency, type, is_archived")
      .eq("user_id", user.id)
      .order("name"),
    supabase
      .from("transfers")
      .select(
        `id, amount, currency, received_amount, counts_as_expense, occurred_on, note,
         from_account:accounts!from_account_id(id, name, currency, type),
         to_account:accounts!to_account_id(id, name, currency, type)`,
        { count: "exact" },
      )
      .eq("user_id", user.id)
      .order("occurred_on", { ascending: false })
      .order("created_at", { ascending: false })
      .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1),
  ]);

  const activeAccounts: TransferAccountOption[] = (
    accountsRes.data ?? []
  )
    .filter((a) => !a.is_archived)
    .map((a) => ({
      id: a.id,
      name: a.name,
      currency: a.currency as Currency,
      type: a.type as TransferAccountOption["type"],
    }));

  // Supabase gen types transfers'ı henüz tanımıyor (regen sonrası düzelecek).
  // Şimdilik unknown üzerinden manuel cast — runtime şekli garanti.
  const rows: TransferRow[] = ((listRes.data ?? []) as unknown as TransferRaw[])
    .map((r) => {
      const from = first(r.from_account);
      const to = first(r.to_account);
      if (!from || !to) return null;
      return {
        id: r.id,
        amount: Number(r.amount),
        currency: r.currency as Currency,
        received_amount: Number(r.received_amount),
        counts_as_expense: Boolean(r.counts_as_expense),
        occurred_on: r.occurred_on,
        note: r.note,
        fromAccount: {
          id: from.id,
          name: from.name,
          currency: from.currency as Currency,
        },
        toAccount: {
          id: to.id,
          name: to.name,
          currency: to.currency as Currency,
        },
      } satisfies TransferRow;
    })
    .filter((r): r is TransferRow => r !== null);

  const filteredCount = listRes.count ?? 0;
  const totalPages = Math.max(1, Math.ceil(filteredCount / PAGE_SIZE));
  const emptyKind: "none" | "no-data" =
    rows.length === 0 && filteredCount === 0 ? "no-data" : "none";

  return (
    <div className="space-y-6">
      <TransfersManager
        transfers={rows}
        accounts={activeAccounts}
        emptyKind={emptyKind}
      />
      <Pagination page={page} totalPages={totalPages} />
    </div>
  );
}
