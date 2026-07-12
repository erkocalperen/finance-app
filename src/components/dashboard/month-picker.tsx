"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  currentMonth,
  formatMonthLong,
  isAfterMonth,
  isSameMonth,
  shiftMonth,
  toMonthParam,
  type MonthKey,
} from "@/lib/month-utils";

type Props = {
  selected: MonthKey;
};

export function MonthPicker({ selected }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const now = currentMonth();

  const nextDisabled =
    isSameMonth(selected, now) || isAfterMonth(selected, now);

  function go(offset: number) {
    const target = shiftMonth(selected, offset);
    const params = new URLSearchParams(searchParams.toString());
    if (isSameMonth(target, now)) {
      params.delete("month");
    } else {
      params.set("month", toMonthParam(target));
    }
    const qs = params.toString();
    router.push(qs ? `?${qs}` : "?");
  }

  return (
    <div className="flex items-center gap-1">
      <Button
        variant="outline"
        size="icon"
        onClick={() => go(-1)}
        aria-label="Önceki ay"
      >
        <ChevronLeft className="h-4 w-4" />
      </Button>
      <div className="min-w-36 text-center text-sm font-medium tabular-nums">
        {formatMonthLong(selected)}
      </div>
      <Button
        variant="outline"
        size="icon"
        onClick={() => go(1)}
        disabled={nextDisabled}
        aria-label="Sonraki ay"
      >
        <ChevronRight className="h-4 w-4" />
      </Button>
    </div>
  );
}
