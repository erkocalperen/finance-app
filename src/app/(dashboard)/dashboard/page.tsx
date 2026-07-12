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

export default async function DashboardPage({ searchParams }: PageProps) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const params = await searchParams;
  const monthRaw =
    typeof params.month === "string" ? params.month : null;
  const selected = parseMonthParam(monthRaw) ?? currentMonth();
  const prev = shiftMonth(selected, -1);
  const chartStart = shiftMonth(selected, -5);

  const [
    profileRes,
    balancesRes,
    countRes,
    accountsCountRes,
    monthlyRes,
    categoryRes,
    recentRes,
  ] = await Promise.all([
    supabase
      .from("profiles")
      .select("base_currency")
      .eq("id", user.id)
      .single(),
    supabase
      .from("account_balances")
      .select("currency, balance")
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
  ]);

  const baseCurrency = (profileRes.data?.base_currency ?? "TRY") as Currency;
  const hasAnyData = (countRes.count ?? 0) > 0;
  const hasAccounts = (accountsCountRes.count ?? 0) > 0;

  // Bakiyeleri para birimine göre grupla.
  const balanceMap = new Map<Currency, number>();
  for (const b of balancesRes.data ?? []) {
    if (!b.currency || b.balance == null) continue;
    const c = b.currency as Currency;
    balanceMap.set(c, (balanceMap.get(c) ?? 0) + Number(b.balance));
  }
  const balancesByCurrency = Array.from(balanceMap.entries())
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

  const currentRow = monthlyByKey.get(toMonthDate(selected));
  const prevRow = monthlyByKey.get(toMonthDate(prev));
  const currentIncome = currentRow?.income ?? 0;
  const currentExpense = currentRow?.expense ?? 0;
  const prevIncome = prevRow?.income ?? 0;
  const prevExpense = prevRow?.expense ?? 0;

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
  const slices: CategorySlice[] = (categoryRes.data ?? [])
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
    }))
    .sort((a, b) => b.total - a.total);

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
            prevIncome={prevIncome}
            prevExpense={prevExpense}
            balancesByCurrency={balancesByCurrency}
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
