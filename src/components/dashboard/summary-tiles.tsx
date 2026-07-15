import {
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  CreditCard,
  Scale,
  Wallet,
} from "lucide-react";

import { formatCurrency } from "@/lib/format";
import type { Currency } from "@/lib/constants";
import { cn } from "@/lib/utils";

type CurrencyTotal = { currency: Currency; total: number };

type Props = {
  currentIncome: number;
  currentExpense: number;
  currentCashFlow: number;
  prevIncome: number;
  prevExpense: number;
  prevCashFlow: number;
  cashByCurrency: CurrencyTotal[];
  portfolioByCurrency: CurrencyTotal[];
  debtByCurrency: CurrencyTotal[];
  hasMissingPrices: boolean;
  baseCurrency: Currency;
};

function formatDelta(current: number, prev: number): string {
  if (prev === 0) return "-";
  const denom = Math.abs(prev);
  const pct = ((current - prev) / denom) * 100;
  const abs = Math.abs(pct);
  const direction = pct >= 0 ? "artış" : "azalış";
  return `Geçen aya göre %${abs.toFixed(0)} ${direction}`;
}

function sortCurrencyTotals(
  rows: CurrencyTotal[],
  baseCurrency: Currency,
): CurrencyTotal[] {
  return rows.slice().sort((a, b) => {
    if (a.currency === baseCurrency && b.currency !== baseCurrency) return -1;
    if (b.currency === baseCurrency && a.currency !== baseCurrency) return 1;
    return a.currency.localeCompare(b.currency);
  });
}

export function SummaryTiles({
  currentIncome,
  currentExpense,
  currentCashFlow,
  prevIncome,
  prevExpense,
  prevCashFlow,
  cashByCurrency,
  portfolioByCurrency,
  debtByCurrency,
  hasMissingPrices,
  baseCurrency,
}: Props) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
      <Tile
        label="Bu Ay Gelir"
        value={formatCurrency(currentIncome, baseCurrency)}
        icon={<ArrowUpRight className="h-4 w-4" />}
        tone="income"
        subtitle={formatDelta(currentIncome, prevIncome)}
      />
      <Tile
        label="Bu Ay Gider"
        value={formatCurrency(currentExpense, baseCurrency)}
        icon={<ArrowDownRight className="h-4 w-4" />}
        tone="expense"
        subtitle={formatDelta(currentExpense, prevExpense)}
      />
      <Tile
        label="Nakit Akışı"
        value={formatCurrency(currentCashFlow, baseCurrency)}
        icon={<Scale className="h-4 w-4" />}
        tone={currentCashFlow >= 0 ? "income" : "expense"}
        subtitle={formatDelta(currentCashFlow, prevCashFlow)}
      />
      <TotalAssetsTile
        cashByCurrency={cashByCurrency}
        portfolioByCurrency={portfolioByCurrency}
        hasMissingPrices={hasMissingPrices}
        baseCurrency={baseCurrency}
      />
      <DebtTile debtByCurrency={debtByCurrency} baseCurrency={baseCurrency} />
      <NetWorthTile
        cashByCurrency={cashByCurrency}
        portfolioByCurrency={portfolioByCurrency}
        debtByCurrency={debtByCurrency}
        baseCurrency={baseCurrency}
      />
    </div>
  );
}

function TotalAssetsTile({
  cashByCurrency,
  portfolioByCurrency,
  hasMissingPrices,
  baseCurrency,
}: {
  cashByCurrency: CurrencyTotal[];
  portfolioByCurrency: CurrencyTotal[];
  hasMissingPrices: boolean;
  baseCurrency: Currency;
}) {
  const currencies = Array.from(
    new Set([
      ...cashByCurrency.map((c) => c.currency),
      ...portfolioByCurrency.map((p) => p.currency),
    ]),
  ).sort((a, b) => {
    if (a === baseCurrency && b !== baseCurrency) return -1;
    if (b === baseCurrency && a !== baseCurrency) return 1;
    return a.localeCompare(b);
  });

  const rows = currencies.map((c) => {
    const cash = cashByCurrency.find((x) => x.currency === c)?.total ?? 0;
    const portfolio =
      portfolioByCurrency.find((x) => x.currency === c)?.total ?? 0;
    return { currency: c, cash, portfolio, total: cash + portfolio };
  });

  return (
    <div className="rounded-lg border p-4">
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">Brüt Varlık</span>
        <span className="text-foreground flex shrink-0 items-center gap-1">
          {hasMissingPrices && (
            <AlertTriangle
              className="h-4 w-4 text-amber-500"
              aria-label="Bazı enstrümanların güncel fiyatı yok"
            />
          )}
          <Wallet className="h-4 w-4" />
        </span>
      </div>

      {rows.length === 0 ? (
        <EmptyValue />
      ) : (
        <div className="mt-2 space-y-1.5">
          {rows.map((r) => (
            <div key={r.currency} className="space-y-0.5">
              <div className="text-xl font-semibold tabular-nums">
                {formatCurrency(r.total, r.currency)}
              </div>
              {r.portfolio > 0 && (
                <div className="text-muted-foreground text-xs tabular-nums">
                  Nakit {formatCurrency(r.cash, r.currency)} · Yatırım{" "}
                  {formatCurrency(r.portfolio, r.currency)}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="text-muted-foreground mt-2 text-xs">
        {hasMissingPrices ? "Bazı fiyatlar eksik" : "Borç düşülmeden"}
      </div>
    </div>
  );
}

function DebtTile({
  debtByCurrency,
  baseCurrency,
}: {
  debtByCurrency: CurrencyTotal[];
  baseCurrency: Currency;
}) {
  const rows = sortCurrencyTotals(debtByCurrency, baseCurrency);

  return (
    <div className="rounded-lg border p-4">
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">Borç</span>
        <CreditCard className="h-4 w-4 text-rose-600 dark:text-rose-400" />
      </div>
      {rows.length === 0 ? (
        <EmptyValue />
      ) : (
        <div className="mt-2 space-y-1.5">
          {rows.map((r) => (
            <div
              key={r.currency}
              className="text-xl font-semibold tabular-nums text-rose-600 dark:text-rose-400"
            >
              {formatCurrency(r.total, r.currency)}
            </div>
          ))}
        </div>
      )}
      <div className="text-muted-foreground mt-2 text-xs">
        Kredi kartı borcu
      </div>
    </div>
  );
}

function NetWorthTile({
  cashByCurrency,
  portfolioByCurrency,
  debtByCurrency,
  baseCurrency,
}: {
  cashByCurrency: CurrencyTotal[];
  portfolioByCurrency: CurrencyTotal[];
  debtByCurrency: CurrencyTotal[];
  baseCurrency: Currency;
}) {
  const currencies = Array.from(
    new Set([
      ...cashByCurrency.map((c) => c.currency),
      ...portfolioByCurrency.map((p) => p.currency),
      ...debtByCurrency.map((d) => d.currency),
    ]),
  ).sort((a, b) => {
    if (a === baseCurrency && b !== baseCurrency) return -1;
    if (b === baseCurrency && a !== baseCurrency) return 1;
    return a.localeCompare(b);
  });

  const rows = currencies.map((c) => {
    const cash = cashByCurrency.find((x) => x.currency === c)?.total ?? 0;
    const portfolio =
      portfolioByCurrency.find((x) => x.currency === c)?.total ?? 0;
    const debt = debtByCurrency.find((x) => x.currency === c)?.total ?? 0;
    return { currency: c, total: cash + portfolio - debt };
  });

  return (
    <div className="rounded-lg border p-4">
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">Net Değer</span>
        <Scale className="h-4 w-4" />
      </div>
      {rows.length === 0 ? (
        <EmptyValue />
      ) : (
        <div className="mt-2 space-y-1.5">
          {rows.map((r) => (
            <div
              key={r.currency}
              className={cn(
                "text-xl font-semibold tabular-nums",
                r.total >= 0
                  ? "text-emerald-600 dark:text-emerald-400"
                  : "text-rose-600 dark:text-rose-400",
              )}
            >
              {formatCurrency(r.total, r.currency)}
            </div>
          ))}
        </div>
      )}
      <div className="text-muted-foreground mt-2 text-xs">
        Brüt varlık - borç
      </div>
    </div>
  );
}

function EmptyValue() {
  return (
    <div className="text-muted-foreground mt-2 text-2xl font-semibold">-</div>
  );
}

function Tile({
  label,
  value,
  icon,
  tone,
  subtitle,
}: {
  label: string;
  value: React.ReactNode;
  icon: React.ReactNode;
  tone: "income" | "expense" | "neutral";
  subtitle: string;
}) {
  const toneClass =
    tone === "income"
      ? "text-emerald-600 dark:text-emerald-400"
      : tone === "expense"
        ? "text-rose-600 dark:text-rose-400"
        : "text-foreground";

  return (
    <div className="rounded-lg border p-4">
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">{label}</span>
        <span className={cn("shrink-0", toneClass)}>{icon}</span>
      </div>
      <div className={cn("mt-2 text-2xl font-semibold tabular-nums", toneClass)}>
        {value}
      </div>
      <div className="text-muted-foreground mt-2 text-xs">{subtitle}</div>
    </div>
  );
}
