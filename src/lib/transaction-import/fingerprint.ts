export function normalizeImportNote(note: string): string {
  return note
    .normalize("NFKC")
    .trim()
    .replace(/\s+/g, " ")
    .toLocaleLowerCase("tr-TR");
}

export function importFingerprintSource(input: {
  occurredOn: string;
  amount: number;
  note: string;
  accountId: string;
}): string {
  return [
    input.occurredOn,
    input.amount.toFixed(2),
    normalizeImportNote(input.note),
    input.accountId,
  ].join("|");
}

export async function createImportFingerprint(input: {
  occurredOn: string;
  amount: number;
  note: string;
  accountId: string;
}): Promise<string> {
  const bytes = new TextEncoder().encode(importFingerprintSource(input));
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
}
