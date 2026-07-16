import type { EntryType } from "@/lib/constants";

export type ImportFileKind = "pdf" | "csv" | "xlsx";

export type ImportPreviewRow = {
  id: string;
  occurredOn: string | null;
  note: string;
  amount: number | null;
  type: EntryType;
  status: "ready" | "uncertain";
  statusMessage?: string;
  raw?: string;
};

export type PdfParseResult = {
  rows: ImportPreviewRow[];
  skippedPayments: number;
};

export type TabularData = {
  headers: string[];
  rows: string[][];
};

export type TabularMapping = {
  dateColumn: number;
  descriptionColumn: number;
  typeMode: "signed" | "debit-credit";
  amountColumn: number;
  debitColumn: number;
  creditColumn: number;
  dateFormat: "dmy" | "mdy" | "ymd";
  numberFormat: "tr" | "en";
};

