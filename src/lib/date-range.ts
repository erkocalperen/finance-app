import { toIsoDate } from "./format";

export const DATE_RANGE_PRESETS = [
  "this_month",
  "last_month",
  "last_3_months",
  "this_year",
  "all",
] as const;

export type DateRangePreset = (typeof DATE_RANGE_PRESETS)[number];
export const DEFAULT_DATE_RANGE: DateRangePreset = "this_month";

export const DATE_RANGE_LABELS: Record<DateRangePreset, string> = {
  this_month: "Bu ay",
  last_month: "Geçen ay",
  last_3_months: "Son 3 ay",
  this_year: "Bu yıl",
  all: "Tümü",
};

export function isDateRangePreset(
  value: unknown,
): value is DateRangePreset {
  return (
    typeof value === "string" &&
    (DATE_RANGE_PRESETS as readonly string[]).includes(value)
  );
}

// URL'de yalnızca `range=<preset>` saklıyoruz.
// from/to türetilmiş değerlerdir, DB filtresine dönüştürülür.
export function computeDateRange(
  preset: DateRangePreset,
  today: Date = new Date(),
): { from?: string; to?: string } {
  switch (preset) {
    case "this_month": {
      const from = new Date(today.getFullYear(), today.getMonth(), 1);
      const to = new Date(today.getFullYear(), today.getMonth() + 1, 0);
      return { from: toIsoDate(from), to: toIsoDate(to) };
    }
    case "last_month": {
      const from = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      const to = new Date(today.getFullYear(), today.getMonth(), 0);
      return { from: toIsoDate(from), to: toIsoDate(to) };
    }
    case "last_3_months": {
      // Bu ay dahil son 3 takvim ayı — from: (bu ay - 2)'nin 1'i
      const from = new Date(today.getFullYear(), today.getMonth() - 2, 1);
      return { from: toIsoDate(from), to: toIsoDate(today) };
    }
    case "this_year": {
      const from = new Date(today.getFullYear(), 0, 1);
      return { from: toIsoDate(from), to: toIsoDate(today) };
    }
    case "all":
      return {};
  }
}
