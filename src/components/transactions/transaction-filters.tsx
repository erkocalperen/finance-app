"use client";

import { useCallback } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { X } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DATE_RANGE_LABELS,
  DATE_RANGE_PRESETS,
  DEFAULT_DATE_RANGE,
  type DateRangePreset,
} from "@/lib/date-range";
import { ENTRY_TYPE_LABELS, type EntryType } from "@/lib/constants";

const ALL = "all";

type Option = { id: string; name: string; color?: string };

type Props = {
  range: DateRangePreset;
  type: EntryType | null;
  categoryId: string | null;
  accountId: string | null;
  categories: Option[];
  accounts: Option[];
};

export function TransactionFilters({
  range,
  type,
  categoryId,
  accountId,
  categories,
  accounts,
}: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const push = useCallback(
    (mutate: (params: URLSearchParams) => void) => {
      const params = new URLSearchParams(searchParams.toString());
      mutate(params);
      // Filter değişince sayfa 1'e dön.
      params.delete("page");
      router.push(`${pathname}?${params.toString()}`);
    },
    [router, pathname, searchParams],
  );

  const setRange = (value: DateRangePreset) =>
    push((p) => {
      if (value === DEFAULT_DATE_RANGE) p.delete("range");
      else p.set("range", value);
    });

  const setType = (value: string) =>
    push((p) => {
      if (value === ALL) p.delete("type");
      else p.set("type", value);
    });

  const setCategory = (value: string) =>
    push((p) => {
      if (value === ALL) p.delete("category");
      else p.set("category", value);
    });

  const setAccount = (value: string) =>
    push((p) => {
      if (value === ALL) p.delete("account");
      else p.set("account", value);
    });

  const clearAll = () => router.push(pathname);

  const hasActiveFilter =
    range !== DEFAULT_DATE_RANGE ||
    type !== null ||
    categoryId !== null ||
    accountId !== null;

  return (
    <div className="flex flex-wrap items-end gap-2">
      <FilterField label="Tarih">
        <Select value={range} onValueChange={(v) => setRange(v as DateRangePreset)}>
          <SelectTrigger className="w-36">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {DATE_RANGE_PRESETS.map((p) => (
              <SelectItem key={p} value={p}>
                {DATE_RANGE_LABELS[p]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </FilterField>

      <FilterField label="Tip">
        <Select value={type ?? ALL} onValueChange={setType}>
          <SelectTrigger className="w-32">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Tümü</SelectItem>
            <SelectItem value="expense">{ENTRY_TYPE_LABELS.expense}</SelectItem>
            <SelectItem value="income">{ENTRY_TYPE_LABELS.income}</SelectItem>
          </SelectContent>
        </Select>
      </FilterField>

      <FilterField label="Kategori">
        <Select value={categoryId ?? ALL} onValueChange={setCategory}>
          <SelectTrigger className="w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Tümü</SelectItem>
            {categories.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                <span className="flex items-center gap-2">
                  {c.color && (
                    <span
                      aria-hidden
                      className="h-2.5 w-2.5 rounded-full"
                      style={{ backgroundColor: c.color }}
                    />
                  )}
                  {c.name}
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </FilterField>

      <FilterField label="Hesap">
        <Select value={accountId ?? ALL} onValueChange={setAccount}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Tümü</SelectItem>
            {accounts.map((a) => (
              <SelectItem key={a.id} value={a.id}>
                {a.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </FilterField>

      {hasActiveFilter && (
        <Button
          variant="ghost"
          size="sm"
          onClick={clearAll}
          className="ml-auto sm:ml-0"
        >
          <X className="mr-1 h-4 w-4" />
          Filtreleri temizle
        </Button>
      )}
    </div>
  );
}

function FilterField({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1">
      <div className="text-muted-foreground text-xs">{label}</div>
      {children}
    </div>
  );
}
