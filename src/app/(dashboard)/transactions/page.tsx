import { redirect } from "next/navigation";

import { TransactionFilters } from "@/components/transactions/transaction-filters";
import { Pagination } from "@/components/pagination";
import { TransactionsSummary } from "@/components/transactions/transactions-summary";
import {
  TransactionsManager,
  type TransactionRow,
} from "@/components/transactions/transactions-manager";
import type {
  FormAccountOption,
  FormCategoryOption,
} from "@/components/transactions/transaction-form-dialog";
import { createClient } from "@/lib/supabase/server";
import type { AccountType, Currency, EntryType } from "@/lib/constants";
import {
  DEFAULT_DATE_RANGE,
  computeDateRange,
  isDateRangePreset,
} from "@/lib/date-range";

const PAGE_SIZE = 25;

// Supabase select() embed sonucunun tipi bazen array | object olarak
// inferred oluyor. Elimizle daraltmak için ara tip.
type TransactionEmbed = {
  id: string;
  type: EntryType;
  amount: number;
  currency: string;
  fx_rate: number;
  occurred_on: string;
  note: string | null;
  category:
    | { id: string; name: string; color: string; type: EntryType }
    | { id: string; name: string; color: string; type: EntryType }[]
    | null;
  account:
    | { id: string; name: string; currency: string; type: AccountType }
    | { id: string; name: string; currency: string; type: AccountType }[]
    | null;
};

function first<T>(v: T | T[] | null): T | null {
  if (v == null) return null;
  return Array.isArray(v) ? (v[0] ?? null) : v;
}

export default async function TransactionsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const params = await searchParams;
  const getStr = (key: string): string | null => {
    const v = params[key];
    if (typeof v === "string" && v.length > 0) return v;
    return null;
  };

  const rangeParam = getStr("range");
  const range = isDateRangePreset(rangeParam) ? rangeParam : DEFAULT_DATE_RANGE;
  const dateRange = computeDateRange(range);

  const typeParam = getStr("type");
  const typeFilter: EntryType | null =
    typeParam === "income" || typeParam === "expense" ? typeParam : null;

  const categoryFilter = getStr("category");
  const accountFilter = getStr("account");

  const rawPage = Number(getStr("page") ?? 1);
  const page = Number.isFinite(rawPage) && rawPage > 0 ? Math.floor(rawPage) : 1;

  // Profil, hesaplar, kategoriler — form ve filtre için.
  const [
    profileRes,
    accountsRes,
    categoriesRes,
    allCountRes,
  ] = await Promise.all([
    supabase
      .from("profiles")
      .select("base_currency")
      .eq("id", user.id)
      .single(),
    supabase
      .from("accounts")
      .select("id, name, currency, is_archived")
      .eq("user_id", user.id)
      .order("name"),
    supabase
      .from("categories")
      .select("id, name, type, color")
      .eq("user_id", user.id)
      .order("name"),
    supabase
      .from("transactions")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id),
  ]);

  const baseCurrency = (profileRes.data?.base_currency ?? "TRY") as Currency;

  const activeAccounts: FormAccountOption[] = (accountsRes.data ?? [])
    .filter((a) => !a.is_archived)
    .map((a) => ({
      id: a.id,
      name: a.name,
      currency: a.currency as Currency,
    }));

  const categoriesForForm: FormCategoryOption[] = (categoriesRes.data ?? []).map(
    (c) => ({
      id: c.id,
      name: c.name,
      type: c.type as EntryType,
      color: c.color,
    }),
  );

  const totalUserTransactions = allCountRes.count ?? 0;

  // Filtrelenmiş sayfa sorgusu ve toplam sayı.
  const listQuery = supabase
    .from("transactions")
    .select(
      `id, type, amount, currency, fx_rate, occurred_on, note,
       category:categories(id, name, color, type),
       account:accounts(id, name, currency, type)`,
      { count: "exact" },
    )
    .eq("user_id", user.id);

  // Aynı filtreleri hem liste hem özet için tekrarlıyoruz.
  const summaryQuery = supabase
    .from("transactions")
    .select("type, base_amount")
    .eq("user_id", user.id);

  if (typeFilter) {
    listQuery.eq("type", typeFilter);
    summaryQuery.eq("type", typeFilter);
  }
  if (categoryFilter) {
    listQuery.eq("category_id", categoryFilter);
    summaryQuery.eq("category_id", categoryFilter);
  }
  if (accountFilter) {
    listQuery.eq("account_id", accountFilter);
    summaryQuery.eq("account_id", accountFilter);
  }
  if (dateRange.from) {
    listQuery.gte("occurred_on", dateRange.from);
    summaryQuery.gte("occurred_on", dateRange.from);
  }
  if (dateRange.to) {
    listQuery.lte("occurred_on", dateRange.to);
    summaryQuery.lte("occurred_on", dateRange.to);
  }

  listQuery
    .order("occurred_on", { ascending: false })
    .order("created_at", { ascending: false })
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);

  const [listRes, summaryRes] = await Promise.all([listQuery, summaryQuery]);

  const rows: TransactionRow[] = ((listRes.data ?? []) as TransactionEmbed[])
    .map((r) => {
      const category = first(r.category);
      const account = first(r.account);
      if (!category || !account) return null;
      return {
        id: r.id,
        type: r.type,
        amount: Number(r.amount),
        currency: r.currency as Currency,
        fx_rate: Number(r.fx_rate),
        occurred_on: r.occurred_on,
        note: r.note,
        category: {
          id: category.id,
          name: category.name,
          color: category.color,
          type: category.type,
        },
        account: {
          id: account.id,
          name: account.name,
          currency: account.currency as Currency,
        },
      } satisfies TransactionRow;
    })
    .filter((r): r is TransactionRow => r !== null);

  let totalIncome = 0;
  let totalExpense = 0;
  for (const s of summaryRes.data ?? []) {
    const amt = Number(s.base_amount ?? 0);
    if (s.type === "income") totalIncome += amt;
    else if (s.type === "expense") totalExpense += amt;
  }
  const net = totalIncome - totalExpense;

  const filteredCount = listRes.count ?? 0;
  const totalPages = Math.max(1, Math.ceil(filteredCount / PAGE_SIZE));

  const emptyKind: "none" | "no-data" | "no-matches" =
    rows.length > 0
      ? "none"
      : totalUserTransactions === 0
        ? "no-data"
        : "no-matches";

  const filterCategories = categoriesForForm
    .slice()
    .sort((a, b) => a.name.localeCompare(b.name, "tr"))
    .map((c) => ({ id: c.id, name: c.name, color: c.color }));

  const filterAccounts = (accountsRes.data ?? [])
    .slice()
    .sort((a, b) => a.name.localeCompare(b.name, "tr"))
    .map((a) => ({ id: a.id, name: a.name }));

  return (
    <div className="space-y-6">
      <TransactionsSummary
        totalIncome={totalIncome}
        totalExpense={totalExpense}
        net={net}
        baseCurrency={baseCurrency}
      />

      <TransactionFilters
        range={range}
        type={typeFilter}
        categoryId={categoryFilter}
        accountId={accountFilter}
        categories={filterCategories}
        accounts={filterAccounts}
      />

      <TransactionsManager
        transactions={rows}
        accounts={activeAccounts}
        categories={categoriesForForm}
        baseCurrency={baseCurrency}
        emptyKind={emptyKind}
      />

      <Pagination page={page} totalPages={totalPages} />
    </div>
  );
}
