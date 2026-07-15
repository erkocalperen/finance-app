import Link from "next/link";

import { formatCurrency, formatDate } from "@/lib/format";
import type { Currency, EntryType } from "@/lib/constants";
import { cn } from "@/lib/utils";

export type RecentTransaction = {
  id: string;
  type: EntryType;
  amount: number;
  currency: Currency;
  occurred_on: string;
  note: string | null;
  categoryName: string;
  categoryColor: string;
  accountName: string;
};

type Props = {
  items: RecentTransaction[];
};

export function RecentTransactions({ items }: Props) {
  return (
    <div className="rounded-lg border">
      <div className="flex items-center justify-between border-b px-4 py-3">
        <h2 className="text-sm font-semibold">Son işlemler</h2>
        <Link
          href="/transactions"
          className="text-muted-foreground hover:text-foreground text-xs underline"
        >
          Tümünü gör
        </Link>
      </div>
      {items.length === 0 ? (
        <div className="text-muted-foreground p-6 text-center text-sm">
          Henüz işlem yok.
        </div>
      ) : (
        <ul className="divide-y">
          {items.map((row) => (
            <li
              key={row.id}
              className="flex items-center gap-3 px-4 py-3"
            >
              <span
                aria-hidden
                className="h-2.5 w-2.5 shrink-0 rounded-full"
                style={{ backgroundColor: row.categoryColor }}
              />
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate text-sm font-medium">
                    {row.categoryName}
                  </span>
                  <span
                    className={cn(
                      "shrink-0 text-sm font-medium tabular-nums",
                      row.type === "income"
                        ? "text-income"
                        : "text-expense",
                    )}
                  >
                    {row.type === "income" ? "+" : "−"}{" "}
                    {formatCurrency(row.amount, row.currency)}
                  </span>
                </div>
                <div className="text-muted-foreground mt-0.5 flex items-center gap-2 text-xs">
                  <span>{formatDate(row.occurred_on)}</span>
                  <span aria-hidden>·</span>
                  <span className="truncate">{row.accountName}</span>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
