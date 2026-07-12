import { ArrowDownRight, ArrowUpRight, Scale, Wallet } from "lucide-react";

import { formatCurrency } from "@/lib/format";
import type { Currency } from "@/lib/constants";
import { cn } from "@/lib/utils";

type Props = {
  currentIncome: number;
  currentExpense: number;
  prevIncome: number;
  prevExpense: number;
  balancesByCurrency: Array<{ currency: Currency; total: number }>;
  baseCurrency: Currency;
};

/**
 * pct'nin metin karşılığı. prev = 0 iken bölme yok — "—" göster.
 * Net için prev negatifse |prev| kullan (semantik olarak "iyileşme/kötüleşme"
 * artı-eksi yönü tutarlı kalsın).
 */
function formatDelta(current: number, prev: number): string {
  if (prev === 0) return "—";
  const denom = Math.abs(prev);
  const pct = ((current - prev) / denom) * 100;
  const abs = Math.abs(pct);
  const direction = pct >= 0 ? "artış" : "azalış";
  return `Geçen aya göre %${abs.toFixed(0)} ${direction}`;
}

export function SummaryTiles({
  currentIncome,
  currentExpense,
  prevIncome,
  prevExpense,
  balancesByCurrency,
  baseCurrency,
}: Props) {
  const net = currentIncome - currentExpense;
  const prevNet = prevIncome - prevExpense;

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
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
        label="Net"
        value={formatCurrency(net, baseCurrency)}
        icon={<Scale className="h-4 w-4" />}
        tone={net >= 0 ? "income" : "expense"}
        subtitle={formatDelta(net, prevNet)}
      />
      <Tile
        label="Toplam Varlık"
        value={
          balancesByCurrency.length === 0 ? (
            <span className="text-muted-foreground">—</span>
          ) : (
            <span className="flex flex-wrap items-baseline gap-x-2">
              {balancesByCurrency.map((b, i) => (
                <span key={b.currency}>
                  {formatCurrency(b.total, b.currency)}
                  {i < balancesByCurrency.length - 1 && (
                    <span className="text-muted-foreground ml-2">·</span>
                  )}
                </span>
              ))}
            </span>
          )
        }
        icon={<Wallet className="h-4 w-4" />}
        tone="neutral"
        subtitle="Şu anki bakiye"
      />
    </div>
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
      <div
        className={cn(
          "mt-2 text-2xl font-semibold tabular-nums",
          toneClass,
        )}
      >
        {value}
      </div>
      <div className="text-muted-foreground mt-2 text-xs">{subtitle}</div>
    </div>
  );
}
