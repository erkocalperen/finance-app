/**
 * URL param formatı: YYYY-MM (örn. "2026-07")
 * View'lardaki `month` sütunu formatı: YYYY-MM-01 (ayın 1'i)
 * Aylar 1-tabanlı: Ocak=1, Aralık=12.
 */

export type MonthKey = { year: number; month: number };

const MONTH_PARAM_REGEX = /^\d{4}-(0[1-9]|1[0-2])$/;

export function parseMonthParam(
  value: string | null | undefined,
): MonthKey | null {
  if (!value || !MONTH_PARAM_REGEX.test(value)) return null;
  const [y, m] = value.split("-").map(Number);
  return { year: y, month: m };
}

export function currentMonth(): MonthKey {
  const now = new Date();
  return { year: now.getFullYear(), month: now.getMonth() + 1 };
}

export function toMonthParam({ year, month }: MonthKey): string {
  return `${year}-${String(month).padStart(2, "0")}`;
}

/** view'lardaki `month` sütununa uygun ISO tarih (YYYY-MM-01) */
export function toMonthDate({ year, month }: MonthKey): string {
  return `${year}-${String(month).padStart(2, "0")}-01`;
}

export function shiftMonth(base: MonthKey, offset: number): MonthKey {
  const idx = base.year * 12 + (base.month - 1) + offset;
  return {
    year: Math.floor(idx / 12),
    month: (idx % 12) + 1,
  };
}

export function isSameMonth(a: MonthKey, b: MonthKey): boolean {
  return a.year === b.year && a.month === b.month;
}

/** a > b ? */
export function isAfterMonth(a: MonthKey, b: MonthKey): boolean {
  if (a.year !== b.year) return a.year > b.year;
  return a.month > b.month;
}

const TR_MONTH_NAMES = [
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

const TR_MONTH_SHORT = [
  "Oca",
  "Şub",
  "Mar",
  "Nis",
  "May",
  "Haz",
  "Tem",
  "Ağu",
  "Eyl",
  "Eki",
  "Kas",
  "Ara",
] as const;

export function formatMonthLong({ year, month }: MonthKey): string {
  return `${TR_MONTH_NAMES[month - 1]} ${year}`;
}

export function formatMonthShort({ month }: MonthKey): string {
  return TR_MONTH_SHORT[month - 1];
}
