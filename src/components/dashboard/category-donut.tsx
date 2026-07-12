"use client";

import { Cell, Pie, PieChart } from "recharts";

import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { formatCurrency } from "@/lib/format";
import type { Currency } from "@/lib/constants";

export type CategorySlice = {
  categoryId: string;
  name: string;
  color: string;
  total: number;
};

type Props = {
  data: CategorySlice[];
  baseCurrency: Currency;
};

export function CategoryDonut({ data, baseCurrency }: Props) {
  const total = data.reduce((sum, s) => sum + s.total, 0);

  // chart config: her kategori kendi rengiyle. Slice'ları anahtar olarak
  // categoryId kullanıyoruz — isim tekrarlanabilir (aynı ada sahip iki tip).
  const config: ChartConfig = data.reduce<ChartConfig>((acc, s) => {
    acc[s.categoryId] = { label: s.name, color: s.color };
    return acc;
  }, {});

  const chartData = data.map((s) => ({
    ...s,
    percentage: total > 0 ? (s.total / total) * 100 : 0,
  }));

  return (
    <div className="space-y-4">
      <div className="relative">
        <ChartContainer
          config={config}
          className="mx-auto aspect-square max-h-64"
        >
          <PieChart>
            <ChartTooltip
              cursor={false}
              content={
                <ChartTooltipContent
                  hideLabel
                  formatter={(value, _name, item) => {
                    const raw = item.payload as CategorySlice & {
                      percentage: number;
                    };
                    return (
                      <div className="flex w-full items-center justify-between gap-4">
                        <span className="flex items-center gap-2">
                          <span
                            aria-hidden
                            className="h-2.5 w-2.5 rounded-full"
                            style={{ backgroundColor: raw.color }}
                          />
                          {raw.name}
                        </span>
                        <span className="text-right tabular-nums">
                          {formatCurrency(Number(value), baseCurrency)}
                          <span className="text-muted-foreground ml-2">
                            %{raw.percentage.toFixed(0)}
                          </span>
                        </span>
                      </div>
                    );
                  }}
                />
              }
            />
            <Pie
              data={chartData}
              dataKey="total"
              nameKey="name"
              innerRadius="60%"
              outerRadius="90%"
              paddingAngle={2}
              stroke="none"
            >
              {chartData.map((slice) => (
                <Cell key={slice.categoryId} fill={slice.color} />
              ))}
            </Pie>
          </PieChart>
        </ChartContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <div className="text-muted-foreground text-xs">Toplam Gider</div>
          <div className="text-lg font-semibold tabular-nums">
            {formatCurrency(total, baseCurrency)}
          </div>
        </div>
      </div>

      <ul className="grid grid-cols-1 gap-1.5 text-sm sm:grid-cols-2">
        {chartData.map((slice) => (
          <li
            key={slice.categoryId}
            className="flex items-center justify-between gap-3"
          >
            <span className="flex min-w-0 items-center gap-2">
              <span
                aria-hidden
                className="h-2.5 w-2.5 shrink-0 rounded-full"
                style={{ backgroundColor: slice.color }}
              />
              <span className="truncate">{slice.name}</span>
            </span>
            <span className="tabular-nums">
              {formatCurrency(slice.total, baseCurrency)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
