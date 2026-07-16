import type { ImportPreviewRow, PdfParseResult } from "./types";

const TURKISH_MONTHS: Record<string, number> = {
  ocak: 1,
  şubat: 2,
  mart: 3,
  nisan: 4,
  mayıs: 5,
  haziran: 6,
  temmuz: 7,
  ağustos: 8,
  eylül: 9,
  ekim: 10,
  kasım: 11,
  aralık: 12,
};

const DATE_LINE_RE = /^(\d{1,2})\s+(Ocak|Şubat|Mart|Nisan|Mayıs|Haziran|Temmuz|Ağustos|Eylül|Ekim|Kasım|Aralık)\s+(\d{4})\b\s*(.*)$/iu;
const DATE_LIKE_RE = /^\d{1,2}\s+\S+\s+\d{4}\b/u;
const MONEY_RE = /[+-]?\s*(?:\d{1,3}(?:\.\d{3})+|\d+),\d{2}/g;

type TextItem = {
  str: string;
  transform: number[];
  width?: number;
};

function isTextItem(item: unknown): item is TextItem {
  if (!item || typeof item !== "object") return false;
  const candidate = item as Partial<TextItem>;
  return (
    typeof candidate.str === "string" &&
    Array.isArray(candidate.transform) &&
    candidate.transform.length >= 6
  );
}

function isoDate(dayText: string, monthText: string, yearText: string) {
  const day = Number(dayText);
  const month = TURKISH_MONTHS[monthText.toLocaleLowerCase("tr-TR")];
  const year = Number(yearText);
  if (!month || day < 1 || day > 31) return null;
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }
  return `${yearText}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function parseTurkishAmount(value: string): number | null {
  const normalized = value.replace(/\s/g, "").replace(/\./g, "").replace(",", ".");
  const amount = Number(normalized);
  return Number.isFinite(amount) ? amount : null;
}

function normalizeSpaces(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

function parseTransactionLine(
  line: string,
  id: string,
): { row?: ImportPreviewRow; payment?: boolean } {
  const match = line.match(DATE_LINE_RE);
  if (!match) {
    if (!DATE_LIKE_RE.test(line)) return {};
    return {
      row: {
        id,
        occurredOn: null,
        note: normalizeSpaces(line),
        amount: null,
        type: "expense",
        status: "uncertain",
        statusMessage: "Tarih çözümlenemedi.",
        raw: line,
      },
    };
  }

  const [, day, month, year, remainder] = match;
  const occurredOn = isoDate(day, month, year);
  const moneyMatches = Array.from(remainder.matchAll(MONEY_RE));
  if (!occurredOn || moneyMatches.length === 0) {
    return {
      row: {
        id,
        occurredOn,
        note: normalizeSpaces(remainder || line),
        amount: null,
        type: "expense",
        status: "uncertain",
        statusMessage: occurredOn ? "Tutar çözümlenemedi." : "Tarih çözümlenemedi.",
        raw: line,
      },
    };
  }

  // Yapı Kredi satırlarında tutarın ardından puan sütunu bulunabiliyor.
  // Sonda art arda iki parasal değer varsa sonuncuyu puan kabul ediyoruz.
  const amountMatch =
    moneyMatches.length > 1
      ? moneyMatches[moneyMatches.length - 2]
      : moneyMatches[moneyMatches.length - 1];
  const amountToken = amountMatch[0].replace(/\s/g, "");
  if (amountToken.startsWith("+")) return { payment: true };

  const parsedAmount = parseTurkishAmount(amountToken);
  const amount = parsedAmount == null ? null : Math.abs(parsedAmount);
  const note = normalizeSpaces(remainder.slice(0, amountMatch.index));
  if (!amount || !note) {
    return {
      row: {
        id,
        occurredOn,
        note: note || normalizeSpaces(remainder),
        amount,
        type: "expense",
        status: "uncertain",
        statusMessage: !note ? "Açıklama çözümlenemedi." : "Tutar geçersiz.",
        raw: line,
      },
    };
  }

  return {
    row: {
      id,
      occurredOn,
      note,
      amount,
      type: "expense",
      status: "ready",
    },
  };
}

function textItemsToLines(items: TextItem[]): string[] {
  const lines: Array<{ y: number; items: Array<{ x: number; text: string }> }> = [];
  for (const item of items) {
    const text = normalizeSpaces(item.str);
    if (!text) continue;
    const x = Number(item.transform[4] ?? 0);
    const y = Number(item.transform[5] ?? 0);
    let line = lines.find((candidate) => Math.abs(candidate.y - y) <= 2);
    if (!line) {
      line = { y, items: [] };
      lines.push(line);
    }
    line.items.push({ x, text });
  }

  return lines
    .sort((a, b) => b.y - a.y)
    .map((line) =>
      normalizeSpaces(
        line.items
          .sort((a, b) => a.x - b.x)
          .map((item) => item.text)
          .join(" "),
      ),
    )
    .filter(Boolean);
}

export async function parsePdfStatement(file: File): Promise<PdfParseResult> {
  const pdfjs = await import("pdfjs-dist/webpack.mjs");
  const loadingTask = pdfjs.getDocument({
    data: new Uint8Array(await file.arrayBuffer()),
  });
  const pdf = await loadingTask.promise;
  const rows: ImportPreviewRow[] = [];
  let skippedPayments = 0;

  try {
    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
      const page = await pdf.getPage(pageNumber);
      const text = await page.getTextContent();
      const textItems: TextItem[] = [];
      for (const item of text.items) {
        if (isTextItem(item)) textItems.push(item);
      }
      const lines = textItemsToLines(textItems);
      for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
        const parsed = parseTransactionLine(
          lines[lineIndex],
          `pdf-${pageNumber}-${lineIndex}`,
        );
        if (parsed.payment) skippedPayments += 1;
        if (parsed.row) rows.push(parsed.row);
      }
      page.cleanup();
    }
  } finally {
    await loadingTask.destroy();
  }

  return { rows, skippedPayments };
}
