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

const MONTHS = [
  "Ocak",
  "Şubat",
  "Mart",
  "Nisan",
  "Mayıs",
  "Haziran",
  "Temmuz",
  "Ağustos",
  "Eylül",
  "Ekim",
  "Kasım",
  "Aralık",
] as const;

type Option = { id: string; name: string; color?: string };

type Props = {
  range: DateRangePreset;
  year: number | null;
  month: number | null;
  currentYear: number;
  type: EntryType | null;
  categoryId: string | null;
  accountId: string | null;
  source: "manual" | "import" | null;
  categories: Option[];
  accounts: Option[];
};

export function TransactionFilters({
  range,
  year,
  month,
  currentYear,
  type,
  categoryId,
  accountId,
  source,
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
      p.delete("year");
      p.delete("month");
      if (value === DEFAULT_DATE_RANGE) p.delete("range");
      else p.set("range", value);
    });

  const setYear = (value: string) =>
    push((p) => {
      p.delete("range");
      if (value === ALL) {
        p.delete("year");
        p.delete("month");
      } else {
        p.set("year", value);
      }
    });

  const setMonth = (value: string) =>
    push((p) => {
      p.delete("range");
      if (value === ALL) {
        p.delete("month");
      } else {
        p.set("month", value);
        if (!year) p.set("year", String(currentYear));
      }
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

  const setSource = (value: string) =>
    push((p) => {
      if (value === ALL) p.delete("source");
      else p.set("source", value);
    });

  const clearAll = () => router.push(pathname);

  const hasActiveFilter =
    range !== DEFAULT_DATE_RANGE ||
    year !== null ||
    month !== null ||
    type !== null ||
    categoryId !== null ||
    accountId !== null ||
    source !== null;

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

      <FilterField label="Yıl">
        <Select value={year ? String(year) : ALL} onValueChange={setYear}>
          <SelectTrigger className="w-28">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Tümü</SelectItem>
            {Array.from({ length: currentYear - 1999 }, (_, index) => currentYear - index).map(
              (value) => (
                <SelectItem key={value} value={String(value)}>
                  {value}
                </SelectItem>
              ),
            )}
          </SelectContent>
        </Select>
      </FilterField>

      <FilterField label="Ay">
        <Select value={month ? String(month) : ALL} onValueChange={setMonth}>
          <SelectTrigger className="w-32">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Tümü</SelectItem>
            {MONTHS.map((label, index) => (
              <SelectItem key={label} value={String(index + 1)}>
                {label}
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

      <FilterField label="Kaynak">
        <Select value={source ?? ALL} onValueChange={setSource}>
          <SelectTrigger className="w-32">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Tümü</SelectItem>
            <SelectItem value="manual">Manuel</SelectItem>
            <SelectItem value="import">Import</SelectItem>
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
