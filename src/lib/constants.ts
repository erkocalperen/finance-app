export const CURRENCIES = ["TRY", "USD", "EUR"] as const;
export type Currency = (typeof CURRENCIES)[number];
export const DEFAULT_CURRENCY: Currency = "TRY";

export const ACCOUNT_TYPES = ["cash", "bank", "credit_card"] as const;
export type AccountType = (typeof ACCOUNT_TYPES)[number];

export const ACCOUNT_TYPE_LABELS: Record<AccountType, string> = {
  cash: "Nakit",
  bank: "Banka",
  credit_card: "Kredi Kartı",
};

export const ENTRY_TYPES = ["income", "expense"] as const;
export type EntryType = (typeof ENTRY_TYPES)[number];

export const ENTRY_TYPE_LABELS: Record<EntryType, string> = {
  income: "Gelir",
  expense: "Gider",
};

// Kategori seçici için önceden tanımlı palet.
export const CATEGORY_COLOR_PRESETS = [
  "#ef4444",
  "#f97316",
  "#f59e0b",
  "#eab308",
  "#84cc16",
  "#22c55e",
  "#14b8a6",
  "#06b6d4",
  "#3b82f6",
  "#8b5cf6",
  "#d946ef",
  "#64748b",
] as const;

export const HEX_COLOR_REGEX = /^#[0-9a-fA-F]{6}$/;
