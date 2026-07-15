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
import { extendWithInvestments } from "@/types/database-investments";
import { extendWithTransfers } from "@/types/database-transfers";
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

type InvestmentEmbed = {
  id: string;
  side: "buy" | "sell";
  quantity: number;
  unit_price: number;
  fee: number;
  counts_as_cash_flow: boolean;
  occurred_on: string;
  note: string | null;
  created_at: string;
  instrument:
    | { id: string; name: string; symbol: string; currency: string }
    | { id: string; name: string; symbol: string; currency: string }[]
    | null;
  account:
    | { id: string; name: string; currency: string; type: AccountType }
    | { id: string; name: string; currency: string; type: AccountType }[]
    | null;
};

type DebtPaymentEmbed = {
  id: string;
  amount: number;
  currency: string;
  received_amount: number;
  counts_as_expense: boolean;
  occurred_on: string;
  note: string | null;
  created_at: string;
  from_account:
    | { id: string; name: string; currency: string; type: AccountType }
    | { id: string; name: string; currency: string; type: AccountType }[]
    | null;
  to_account:
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
  const investmentClient = extendWithInvestments(supabase);
  const transferClient = extendWithTransfers(supabase);
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

  // Query builder'lar filtrelerle önceden hazırlanıyor; Promise.all altındaki
  // 6 sorgu birbirini beklemeden aynı anda uçuşur (fra1 → Frankfurt gidişi tek).
  const listQuery = supabase
    .from("transactions")
    .select(
      `id, type, amount, currency, fx_rate, occurred_on, note,
       category:categories(id, name, color, type),
       account:accounts(id, name, currency, type)`,
      { count: "exact" },
    )
    .eq("user_id", user.id);

  if (typeFilter) {
    listQuery.eq("type", typeFilter);
  }
  if (categoryFilter) {
    listQuery.eq("category_id", categoryFilter);
  }
  if (accountFilter) {
    listQuery.eq("account_id", accountFilter);
  }
  if (dateRange.from) {
    listQuery.gte("occurred_on", dateRange.from);
  }
  if (dateRange.to) {
    listQuery.lte("occurred_on", dateRange.to);
  }

  listQuery
    .order("occurred_on", { ascending: false })
    .order("created_at", { ascending: false });

  const [
    profileRes,
    accountsRes,
    categoriesRes,
    allCountRes,
    listRes,
    investmentRes,
    debtPaymentRes,
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
    listQuery,
    investmentClient
      .from("investment_trades")
      .select(
        `id, side, quantity, unit_price, fee, counts_as_cash_flow, occurred_on, note, created_at,
         instrument:instruments(id, name, symbol, currency),
         account:accounts(id, name, currency, type)`,
      )
      .eq("user_id", user.id)
      .order("occurred_on", { ascending: false })
      .order("created_at", { ascending: false }),
    transferClient
      .from("transfers")
      .select(
        `id, amount, currency, received_amount, counts_as_expense, occurred_on, note, created_at,
         from_account:accounts!from_account_id(id, name, currency, type),
         to_account:accounts!to_account_id(id, name, currency, type)`,
      )
      .eq("user_id", user.id)
      .order("occurred_on", { ascending: false })
      .order("created_at", { ascending: false }),
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

  const totalRawTransactions = allCountRes.count ?? 0;

  const transactionRows: TransactionRow[] = (
    (listRes.data ?? []) as TransactionEmbed[]
  )
    .map((r) => {
      const category = first(r.category);
      const account = first(r.account);
      if (!category || !account) return null;
      return {
        id: r.id,
        kind: "transaction",
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
    .filter((r) => r !== null) as TransactionRow[];

  const investmentRows: TransactionRow[] = (
    (investmentRes.data ?? []) as unknown as InvestmentEmbed[]
  )
    .map((r) => {
      const instrument = first(r.instrument);
      const account = first(r.account);
      if (!instrument || !account) return null;
      if (!r.counts_as_cash_flow) return null;
      const gross = Number(r.quantity) * Number(r.unit_price);
      const fee = Number(r.fee ?? 0);
      const isBuy = r.side === "buy";
      return {
        id: `investment-${r.id}`,
        kind: "investment",
        type: isBuy ? "expense" : "income",
        amount: isBuy ? gross + fee : Math.max(gross - fee, 0),
        currency: instrument.currency as Currency,
        fx_rate: 1,
        occurred_on: r.occurred_on,
        note: r.note,
        typeLabel: "Yatırım",
        isReadonly: true,
        category: {
          id: `investment-${r.side}`,
          name: isBuy ? "Yatırım alımı" : "Yatırım satışı",
          color: "#0ea5e9",
          type: isBuy ? "expense" : "income",
        },
        account: {
          id: account.id,
          name: `${account.name} · ${instrument.name}`,
          currency: account.currency as Currency,
        },
      } satisfies TransactionRow;
    })
    .filter((r) => r !== null) as TransactionRow[];

  const debtPaymentRows: TransactionRow[] = (
    (debtPaymentRes.data ?? []) as unknown as DebtPaymentEmbed[]
  )
    .map((r) => {
      const from = first(r.from_account);
      const to = first(r.to_account);
      if (!from || !to || to.type !== "credit_card") return null;
      return {
        id: `debt-payment-${r.id}`,
        kind: "debt_payment",
        type: "expense",
        amount: Number(r.amount),
        currency: r.currency as Currency,
        fx_rate: 1,
        occurred_on: r.occurred_on,
        note: r.note,
        typeLabel: "Borç ödeme",
        isReadonly: true,
        countsInSummary: Boolean(r.counts_as_expense),
        category: {
          id: "debt-payment",
          name: "Borç ödeme",
          color: "#f59e0b",
          type: "expense",
        },
        account: {
          id: from.id,
          name: `${from.name} → ${to.name}`,
          currency: from.currency as Currency,
        },
        relatedAccountIds: [from.id, to.id],
      } satisfies TransactionRow;
    })
    .filter((r) => r !== null) as TransactionRow[];

  const virtualRows = [...investmentRows, ...debtPaymentRows].filter((r) => {
    if (typeFilter && r.type !== typeFilter) return false;
    if (typeFilter && r.kind === "debt_payment" && !r.countsInSummary) {
      return false;
    }
    if (categoryFilter) return false;
    if (
      accountFilter &&
      !(r.relatedAccountIds ?? [r.account.id]).includes(accountFilter)
    ) {
      return false;
    }
    if (dateRange.from && r.occurred_on < dateRange.from) return false;
    if (dateRange.to && r.occurred_on > dateRange.to) return false;
    return true;
  });

  const allRows = [...transactionRows, ...virtualRows].sort((a, b) => {
    const dateCmp = b.occurred_on.localeCompare(a.occurred_on);
    if (dateCmp !== 0) return dateCmp;
    return b.id.localeCompare(a.id);
  });

  const rows = allRows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const totalUserTransactions =
    totalRawTransactions + investmentRows.length + debtPaymentRows.length;

  let totalIncome = 0;
  let totalExpense = 0;
  for (const row of allRows) {
    if (row.countsInSummary === false) continue;
    const amt = row.amount * row.fx_rate;
    if (row.type === "income") totalIncome += amt;
    else if (row.type === "expense") totalExpense += amt;
  }
  const net = totalIncome - totalExpense;

  const filteredCount = allRows.length;
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
