import Link from "next/link";
import { redirect } from "next/navigation";
import { Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { CategoryDonut, type CategorySlice } from "@/components/dashboard/category-donut";
import { EmptyDashboard } from "@/components/dashboard/empty-dashboard";
import { MonthPicker } from "@/components/dashboard/month-picker";
import { MonthlyBars, type MonthlyBar } from "@/components/dashboard/monthly-bars";
import {
  RecentTransactions,
  type RecentTransaction,
} from "@/components/dashboard/recent-transactions";
import { SummaryTiles } from "@/components/dashboard/summary-tiles";
import { createClient } from "@/lib/supabase/server";
import { extendWithInvestments } from "@/types/database-investments";
import { extendWithTransfers } from "@/types/database-transfers";
import type { Currency, EntryType } from "@/lib/constants";
import {
  currentMonth,
  formatMonthShort,
  parseMonthParam,
  shiftMonth,
  toMonthDate,
  toMonthParam,
} from "@/lib/month-utils";

type PageProps = {
  searchParams: Promise<{ month?: string | string[] }>;
};

// Supabase embed sonucunu tek nesneye daraltmak için — join tarafında
// bazen array bazen object tipi çıkar.
function first<T>(v: T | T[] | null | undefined): T | null {
  if (v == null) return null;
  return Array.isArray(v) ? (v[0] ?? null) : v;
}

type DashboardInvestmentTrade = {
  side: "buy" | "sell";
  quantity: number;
  unit_price: number;
  fee: number;
  counts_as_cash_flow: boolean;
  occurred_on: string;
};

type DashboardDebtPayment = {
  amount: number;
  occurred_on: string;
  counts_as_expense: boolean;
  from_account:
    | { type: string }
    | { type: string }[]
    | null;
  to_account:
    | { type: string }
    | { type: string }[]
    | null;
};

type DashboardCashTransaction = {
  type: EntryType;
  base_amount: number;
  occurred_on: string;
  account:
    | { type: string }
    | { type: string }[]
    | null;
};

export default async function DashboardPage({ searchParams }: PageProps) {
  const base = await createClient();
  const {
    data: { user },
  } = await base.auth.getUser();
  if (!user) redirect("/login");
  const supabase = extendWithInvestments(base);
  const transferClient = extendWithTransfers(base);

  const params = await searchParams;
  const monthRaw =
    typeof params.month === "string" ? params.month : null;
  const selected = parseMonthParam(monthRaw) ?? currentMonth();
  const prev = shiftMonth(selected, -1);
  const chartStart = shiftMonth(selected, -5);
  const chartEndExclusive = shiftMonth(selected, 1);

  const [
    profileRes,
    balancesRes,
    countRes,
    accountsCountRes,
    monthlyRes,
    categoryRes,
    recentRes,
    holdingsRes,
    cashTransactionsRes,
    investmentTradesRes,
    debtPaymentsRes,
  ] = await Promise.all([
    supabase
      .from("profiles")
      .select("base_currency")
      .eq("id", user.id)
      .single(),
    supabase
      .from("account_balances")
      .select("type, currency, balance")
      .eq("user_id", user.id),
    supabase
      .from("transactions")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id),
    supabase
      .from("accounts")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id),
    supabase
      .from("monthly_summary")
      .select("month, total_income, total_expense")
      .eq("user_id", user.id)
      .gte("month", toMonthDate(chartStart))
      .lte("month", toMonthDate(selected))
      .order("month", { ascending: true }),
    supabase
      .from("category_spending")
      .select("category_id, category_name, color, total")
      .eq("user_id", user.id)
      .eq("month", toMonthDate(selected))
      .eq("type", "expense"),
    supabase
      .from("transactions")
      .select(
        `id, type, amount, currency, occurred_on, note,
         category:categories(name, color),
         account:accounts(name)`,
      )
      .eq("user_id", user.id)
      .order("occurred_on", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(5),
    supabase
      .from("portfolio_holdings")
      .select("currency, market_value, current_price")
      .eq("user_id", user.id),
    supabase
      .from("transactions")
      .select(
        `type, base_amount, occurred_on,
         account:accounts(type)`,
      )
      .eq("user_id", user.id)
      .gte("occurred_on", toMonthDate(chartStart))
      .lt("occurred_on", toMonthDate(chartEndExclusive)),
    supabase
      .from("investment_trades")
      .select("side, quantity, unit_price, fee, counts_as_cash_flow, occurred_on")
      .eq("user_id", user.id)
      .gte("occurred_on", toMonthDate(chartStart))
      .lt("occurred_on", toMonthDate(chartEndExclusive)),
    transferClient
      .from("transfers")
      .select(
        `amount, occurred_on, counts_as_expense,
         from_account:accounts!from_account_id(type),
         to_account:accounts!to_account_id(type)`,
      )
      .eq("user_id", user.id)
      .eq("counts_as_expense", true)
      .gte("occurred_on", toMonthDate(chartStart))
      .lt("occurred_on", toMonthDate(chartEndExclusive)),
  ]);

  const baseCurrency = (profileRes.data?.base_currency ?? "TRY") as Currency;
  const hasAnyData = (countRes.count ?? 0) > 0;
  const hasAccounts = (accountsCountRes.count ?? 0) > 0;

  // Nakit bakiyeleri para birimine göre grupla.
  const cashMap = new Map<Currency, number>();
  const debtMap = new Map<Currency, number>();
  for (const b of balancesRes.data ?? []) {
    if (!b.currency || b.balance == null) continue;
    const c = b.currency as Currency;
    if (b.type === "credit_card") {
      const balance = Number(b.balance);
      const debt = balance < 0 ? Math.abs(balance) : 0;
      if (debt > 0) debtMap.set(c, (debtMap.get(c) ?? 0) + debt);
      continue;
    }
    cashMap.set(c, (cashMap.get(c) ?? 0) + Number(b.balance));
  }
  const cashByCurrency = Array.from(cashMap.entries())
    .map(([currency, total]) => ({ currency, total }))
    .sort((a, b) => a.currency.localeCompare(b.currency));
  const debtByCurrency = Array.from(debtMap.entries())
    .map(([currency, total]) => ({ currency, total }))
    .sort((a, b) => a.currency.localeCompare(b.currency));

  // Portföy: fiyatı olan pozisyonların market_value'sını para birimine göre topla.
  // Fiyatı olmayan pozisyonları saymıyoruz (0 uydurmuyoruz) — sayısını
  // hasMissingPrices olarak dashboard'a bildiriyoruz.
  const portfolioMap = new Map<Currency, number>();
  let hasMissingPrices = false;
  for (const h of holdingsRes.data ?? []) {
    if (h.current_price == null) {
      hasMissingPrices = true;
      continue;
    }
    if (!h.currency || h.market_value == null) continue;
    const c = h.currency as Currency;
    portfolioMap.set(
      c,
      (portfolioMap.get(c) ?? 0) + Number(h.market_value),
    );
  }
  const portfolioByCurrency = Array.from(portfolioMap.entries())
    .map(([currency, total]) => ({ currency, total }))
    .sort((a, b) => a.currency.localeCompare(b.currency));

  // monthly_summary: 6 aylık pencereyi doldur (eksik ay = 0)
  const monthlyByKey = new Map<
    string,
    { income: number; expense: number }
  >();
  for (const r of monthlyRes.data ?? []) {
    if (!r.month) continue;
    monthlyByKey.set(r.month, {
      income: Number(r.total_income ?? 0),
      expense: Number(r.total_expense ?? 0),
    });
  }
  for (const r of (investmentTradesRes.data ?? []) as DashboardInvestmentTrade[]) {
    if (!r.counts_as_cash_flow) continue;
    const key = `${r.occurred_on.slice(0, 7)}-01`;
    const row = monthlyByKey.get(key) ?? { income: 0, expense: 0 };
    const gross = Number(r.quantity) * Number(r.unit_price);
    const fee = Number(r.fee ?? 0);
    if (r.side === "buy") row.expense += gross + fee;
    else row.income += Math.max(gross - fee, 0);
    monthlyByKey.set(key, row);
  }
  for (const r of (debtPaymentsRes.data ?? []) as unknown as DashboardDebtPayment[]) {
    const to = first(r.to_account);
    if (!r.counts_as_expense || to?.type !== "credit_card") continue;
    const key = `${r.occurred_on.slice(0, 7)}-01`;
    const row = monthlyByKey.get(key) ?? { income: 0, expense: 0 };
    row.expense += Number(r.amount ?? 0);
    monthlyByKey.set(key, row);
  }

  const cashFlowByKey = new Map<string, number>();
  for (const r of (cashTransactionsRes.data ?? []) as unknown as DashboardCashTransaction[]) {
    const account = first(r.account);
    if (account?.type === "credit_card") continue;
    const key = `${r.occurred_on.slice(0, 7)}-01`;
    const amount = Number(r.base_amount ?? 0);
    cashFlowByKey.set(
      key,
      (cashFlowByKey.get(key) ?? 0) +
        (r.type === "income" ? amount : -amount),
    );
  }
  for (const r of (investmentTradesRes.data ?? []) as DashboardInvestmentTrade[]) {
    if (!r.counts_as_cash_flow) continue;
    const key = `${r.occurred_on.slice(0, 7)}-01`;
    const gross = Number(r.quantity) * Number(r.unit_price);
    const fee = Number(r.fee ?? 0);
    cashFlowByKey.set(
      key,
      (cashFlowByKey.get(key) ?? 0) +
        (r.side === "buy" ? -(gross + fee) : Math.max(gross - fee, 0)),
    );
  }
  for (const r of (debtPaymentsRes.data ?? []) as unknown as DashboardDebtPayment[]) {
    const from = first(r.from_account);
    const to = first(r.to_account);
    if (from?.type === "credit_card" || to?.type !== "credit_card") continue;
    const key = `${r.occurred_on.slice(0, 7)}-01`;
    cashFlowByKey.set(key, (cashFlowByKey.get(key) ?? 0) - Number(r.amount ?? 0));
  }

  const currentRow = monthlyByKey.get(toMonthDate(selected));
  const prevRow = monthlyByKey.get(toMonthDate(prev));
  const currentIncome = currentRow?.income ?? 0;
  const currentExpense = currentRow?.expense ?? 0;
  const prevIncome = prevRow?.income ?? 0;
  const prevExpense = prevRow?.expense ?? 0;
  const currentCashFlow = cashFlowByKey.get(toMonthDate(selected)) ?? 0;
  const prevCashFlow = cashFlowByKey.get(toMonthDate(prev)) ?? 0;

  const monthlyBars: MonthlyBar[] = [];
  for (let i = 0; i < 6; i++) {
    const m = shiftMonth(chartStart, i);
    const row = monthlyByKey.get(toMonthDate(m));
    monthlyBars.push({
      key: toMonthParam(m),
      label: formatMonthShort(m),
      income: row?.income ?? 0,
      expense: row?.expense ?? 0,
    });
  }
  const barsHaveData = monthlyBars.some(
    (b) => b.income > 0 || b.expense > 0,
  );

  // Donut için kategori dağılımı.
  const selectedMonthKey = toMonthDate(selected);
  const sliceMap = new Map<string, CategorySlice>();

  for (const slice of (categoryRes.data ?? [])
    .filter(
      (r) =>
        r.category_id != null &&
        r.category_name != null &&
        r.color != null &&
        r.total != null,
    )
    .map((r) => ({
      categoryId: r.category_id as string,
      name: r.category_name as string,
      color: r.color as string,
      total: Number(r.total),
    }))) {
    sliceMap.set(slice.categoryId, slice);
  }

  const addExpenseSlice = (
    categoryId: string,
    name: string,
    color: string,
    total: number,
  ) => {
    if (total <= 0) return;
    const existing = sliceMap.get(categoryId);
    if (existing) existing.total += total;
    else sliceMap.set(categoryId, { categoryId, name, color, total });
  };

  let investmentExpenseTotal = 0;
  for (const r of (investmentTradesRes.data ?? []) as DashboardInvestmentTrade[]) {
    if (!r.counts_as_cash_flow) continue;
    if (r.side !== "buy") continue;
    if (`${r.occurred_on.slice(0, 7)}-01` !== selectedMonthKey) continue;
    investmentExpenseTotal +=
      Number(r.quantity) * Number(r.unit_price) + Number(r.fee ?? 0);
  }
  addExpenseSlice("virtual-investment", "Yatırım", "#0ea5e9", investmentExpenseTotal);

  let debtPaymentExpenseTotal = 0;
  for (const r of (debtPaymentsRes.data ?? []) as unknown as DashboardDebtPayment[]) {
    const to = first(r.to_account);
    if (!r.counts_as_expense || to?.type !== "credit_card") continue;
    if (`${r.occurred_on.slice(0, 7)}-01` !== selectedMonthKey) continue;
    debtPaymentExpenseTotal += Number(r.amount ?? 0);
  }
  addExpenseSlice(
    "virtual-debt-payment",
    "Borç ödeme",
    "#f59e0b",
    debtPaymentExpenseTotal,
  );

  const slices: CategorySlice[] = Array.from(sliceMap.values()).sort(
    (a, b) => b.total - a.total,
  );

  // Son 5 işlem.
  const recent: RecentTransaction[] = (recentRes.data ?? []).map((r) => {
    const cat = first(r.category);
    const acc = first(r.account);
    return {
      id: r.id,
      type: r.type as EntryType,
      amount: Number(r.amount),
      currency: r.currency as Currency,
      occurred_on: r.occurred_on,
      note: r.note,
      categoryName: cat?.name ?? "—",
      categoryColor: cat?.color ?? "#64748b",
      accountName: acc?.name ?? "—",
    };
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">Panel</h1>
        <MonthPicker selected={selected} />
      </div>

      {!hasAnyData ? (
        <EmptyDashboard hasAccounts={hasAccounts} />
      ) : (
        <>
          <SummaryTiles
            currentIncome={currentIncome}
            currentExpense={currentExpense}
            currentCashFlow={currentCashFlow}
            prevIncome={prevIncome}
            prevExpense={prevExpense}
            prevCashFlow={prevCashFlow}
            cashByCurrency={cashByCurrency}
            portfolioByCurrency={portfolioByCurrency}
            debtByCurrency={debtByCurrency}
            hasMissingPrices={hasMissingPrices}
            baseCurrency={baseCurrency}
          />

          <div className="grid gap-4 lg:grid-cols-2">
            <ChartCard title="Kategori Bazlı Gider Dağılımı">
              {slices.length === 0 ? (
                <ChartEmpty />
              ) : (
                <CategoryDonut data={slices} baseCurrency={baseCurrency} />
              )}
            </ChartCard>
            <ChartCard title="Son 6 Ay Trendi">
              {barsHaveData ? (
                <MonthlyBars
                  data={monthlyBars}
                  baseCurrency={baseCurrency}
                />
              ) : (
                <ChartEmpty />
              )}
            </ChartCard>
          </div>

          <RecentTransactions items={recent} />
        </>
      )}
    </div>
  );
}

function ChartCard({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-lg border p-4">
      <h2 className="mb-3 text-sm font-semibold">{title}</h2>
      {children}
    </section>
  );
}

function ChartEmpty() {
  return (
    <div className="flex flex-col items-center gap-2 py-10 text-center">
      <p className="text-muted-foreground text-sm">
        Bu ay için henüz veri yok.
      </p>
      <Button asChild variant="outline" size="sm">
        <Link href="/transactions">
          <Plus className="mr-2 h-4 w-4" />
          İlk işlemini ekle
        </Link>
      </Button>
    </div>
  );
}
