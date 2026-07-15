import { formatCurrency } from "@/lib/format";
import type { Currency } from "@/lib/constants";

type Props = {
  totalIncome: number;
  totalExpense: number;
  net: number;
  baseCurrency: Currency;
};

export function TransactionsSummary({
  totalIncome,
  totalExpense,
  net,
  baseCurrency,
}: Props) {
  return (
    <div className="grid gap-3 sm:grid-cols-3">
      <Tile label="Toplam Gelir" tone="income">
        {formatCurrency(totalIncome, baseCurrency)}
      </Tile>
      <Tile label="Toplam Gider" tone="expense">
        {formatCurrency(totalExpense, baseCurrency)}
      </Tile>
      <Tile label="Net" tone={net >= 0 ? "income" : "expense"}>
        {formatCurrency(net, baseCurrency)}
      </Tile>
    </div>
  );
}

function Tile({
  label,
  tone,
  children,
}: {
  label: string;
  tone: "income" | "expense";
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border p-4">
      <div className="text-muted-foreground text-xs font-medium tracking-[0.08em] uppercase">
        {label}
      </div>
      <div
        className={
          "font-display mt-1 text-2xl font-semibold tabular-nums leading-tight " +
          (tone === "income"
            ? "text-income"
            : "text-expense")
        }
      >
        {children}
      </div>
    </div>
  );
}
