import type {
  ImportPreviewRow,
  TabularData,
  TabularMapping,
} from "./types";

function cell(value: unknown): string {
  if (value == null) return "";
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10);
  }
  return String(value).trim();
}

function makeHeaders(row: string[], width: number): string[] {
  const seen = new Map<string, number>();
  return Array.from({ length: width }, (_, index) => {
    const base = row[index]?.trim() || `Sütun ${index + 1}`;
    const count = (seen.get(base) ?? 0) + 1;
    seen.set(base, count);
    return count === 1 ? base : `${base} (${count})`;
  });
}

function normalizeTable(rawRows: unknown[][]): TabularData {
  const rows = rawRows
    .map((row) => row.map(cell))
    .filter((row) => row.some(Boolean));
  if (rows.length === 0) return { headers: [], rows: [] };
  const width = Math.max(...rows.map((row) => row.length));
  return {
    headers: makeHeaders(rows[0], width),
    rows: rows.slice(1).map((row) =>
      Array.from({ length: width }, (_, index) => row[index] ?? ""),
    ),
  };
}

export async function readCsv(file: File): Promise<TabularData> {
  const Papa = (await import("papaparse")).default;
  const result = Papa.parse<string[]>(await file.text(), {
    skipEmptyLines: "greedy",
  });
  if (result.errors.length > 0 && result.data.length === 0) {
    throw new Error("CSV dosyası okunamadı.");
  }
  return normalizeTable(result.data);
}

export async function readExcel(file: File): Promise<TabularData> {
  const XLSX = await import("xlsx");
  const workbook = XLSX.read(await file.arrayBuffer(), {
    type: "array",
    cellDates: true,
  });
  const firstSheet = workbook.SheetNames[0];
  if (!firstSheet) throw new Error("Excel dosyasında çalışma sayfası yok.");
  const rows = XLSX.utils.sheet_to_json<unknown[]>(workbook.Sheets[firstSheet], {
    header: 1,
    defval: "",
    raw: false,
  });
  return normalizeTable(rows);
}

function parseNumber(value: string, format: TabularMapping["numberFormat"]): number | null {
  const trimmed = value.trim().replace(/\s/g, "");
  if (!trimmed) return null;
  const normalized =
    format === "tr"
      ? trimmed.replace(/\./g, "").replace(",", ".")
      : trimmed.replace(/,/g, "");
  const amount = Number(normalized.replace(/[^0-9.+-]/g, ""));
  return Number.isFinite(amount) ? amount : null;
}

function parseDate(value: string, format: TabularMapping["dateFormat"]): string | null {
  const trimmed = value.trim();
  const iso = trimmed.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  let year: number;
  let month: number;
  let day: number;
  if (iso) {
    year = Number(iso[1]);
    month = Number(iso[2]);
    day = Number(iso[3]);
  } else {
    const parts = trimmed.match(/^(\d{1,4})[./-](\d{1,2})[./-](\d{1,4})$/);
    if (!parts) return null;
    const [a, b, c] = parts.slice(1).map(Number);
    if (format === "dmy") [day, month, year] = [a, b, c];
    else if (format === "mdy") [month, day, year] = [a, b, c];
    else [year, month, day] = [a, b, c];
  }
  if (year < 100) year += 2000;
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) return null;
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function mapTabularRows(
  table: TabularData,
  mapping: TabularMapping,
): ImportPreviewRow[] {
  return table.rows.map((row, index) => {
    const occurredOn = parseDate(row[mapping.dateColumn] ?? "", mapping.dateFormat);
    const note = (row[mapping.descriptionColumn] ?? "").trim().replace(/\s+/g, " ");
    let amount: number | null = null;
    let type: "income" | "expense" = "expense";

    if (mapping.typeMode === "signed") {
      const signed = parseNumber(row[mapping.amountColumn] ?? "", mapping.numberFormat);
      if (signed != null) {
        type = signed < 0 ? "expense" : "income";
        amount = Math.abs(signed);
      }
    } else {
      const debit = parseNumber(row[mapping.debitColumn] ?? "", mapping.numberFormat);
      const credit = parseNumber(row[mapping.creditColumn] ?? "", mapping.numberFormat);
      if (debit && debit !== 0) {
        type = "expense";
        amount = Math.abs(debit);
      } else if (credit && credit !== 0) {
        type = "income";
        amount = Math.abs(credit);
      }
    }

    const problems = [
      !occurredOn && "Tarih çözümlenemedi",
      !note && "Açıklama boş",
      (!amount || amount <= 0) && "Tutar çözümlenemedi",
    ].filter(Boolean);

    return {
      id: `table-${index}`,
      occurredOn,
      note,
      amount,
      type,
      status: problems.length === 0 ? "ready" : "uncertain",
      statusMessage: problems.length > 0 ? problems.join(" · ") : undefined,
      raw: row.join(" | "),
    };
  });
}

