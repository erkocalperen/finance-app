"use client";

import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";

import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { formatCurrency } from "@/lib/format";
import type { Currency } from "@/lib/constants";

export type MonthlyBar = {
  key: string; // YYYY-MM
  label: string; // Turkish short month, e.g. "Tem"
  income: number;
  expense: number;
};

const config: ChartConfig = {
  income: { label: "Gelir", color: "oklch(0.696 0.17 162.48)" },
  expense: { label: "Gider", color: "oklch(0.645 0.246 16.439)" },
};

const compact = new Intl.NumberFormat("tr-TR", {
  notation: "compact",
  maximumFractionDigits: 1,
});

type Props = {
  data: MonthlyBar[];
  baseCurrency: Currency;
};

export function MonthlyBars({ data, baseCurrency }: Props) {
  return (
    <ChartContainer
      config={config}
      className="aspect-video max-h-72 w-full"
    >
      <BarChart data={data} margin={{ top: 10, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid vertical={false} strokeDasharray="3 3" />
        <XAxis
          dataKey="label"
          tickLine={false}
          axisLine={false}
          tickMargin={8}
        />
        <YAxis
          tickLine={false}
          axisLine={false}
          tickFormatter={(v: number) => compact.format(v)}
          width={44}
        />
        <ChartTooltip
          cursor={{ fillOpacity: 0.08 }}
          content={
            <ChartTooltipContent
              formatter={(value, name) => (
                <div className="flex w-full items-center justify-between gap-4">
                  <span>{name === "income" ? "Gelir" : "Gider"}</span>
                  <span className="tabular-nums">
                    {formatCurrency(Number(value), baseCurrency)}
                  </span>
                </div>
              )}
            />
          }
        />
        <Bar
          dataKey="income"
          fill="var(--color-income)"
          radius={[4, 4, 0, 0]}
        />
        <Bar
          dataKey="expense"
          fill="var(--color-expense)"
          radius={[4, 4, 0, 0]}
        />
      </BarChart>
    </ChartContainer>
  );
}
