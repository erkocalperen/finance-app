"use server";

import { createHash } from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";
import type { Currency, EntryType } from "@/lib/constants";
import {
  makeTransactionSchema,
  type TransactionInputRaw,
} from "@/lib/validations/transaction";
import { importFingerprintSource } from "@/lib/transaction-import/fingerprint";

export type TransactionActionResult = { error: string } | undefined;

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

async function requireContext() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("base_currency")
    .eq("id", user.id)
    .single();

  const baseCurrency = (profile?.base_currency ?? "TRY") as Currency;
  return { supabase, user, baseCurrency };
}

// Ownership + tutarlılık kontrolü. RLS zaten user_id'ye göre filtreliyor,
// ancak bu ekstra katman kullanıcıya anlamlı Türkçe mesaj döner.
async function verifyReferences(
  supabase: SupabaseServerClient,
  userId: string,
  input: { account_id: string; category_id: string; type: EntryType },
): Promise<TransactionActionResult> {
  const [{ data: account }, { data: category }] = await Promise.all([
    supabase
      .from("accounts")
      .select("id")
      .eq("id", input.account_id)
      .eq("user_id", userId)
      .maybeSingle(),
    supabase
      .from("categories")
      .select("id, type")
      .eq("id", input.category_id)
      .eq("user_id", userId)
      .maybeSingle(),
  ]);

  if (!account) return { error: "Seçilen hesap bulunamadı." };
  if (!category) return { error: "Seçilen kategori bulunamadı." };
  if (category.type !== input.type) {
    return {
      error:
        "Seçilen kategori bu işlem tipine uygun değil (gelir/gider eşleşmiyor).",
    };
  }
  return undefined;
}

export async function createTransaction(
  input: TransactionInputRaw,
): Promise<TransactionActionResult> {
  const ctx = await requireContext();
  if (!ctx) return { error: "Oturum bulunamadı." };

  const parsed = makeTransactionSchema(ctx.baseCurrency).safeParse(input);
  if (!parsed.success) return { error: "Formu kontrol edin." };
  const data = parsed.data;

  const refError = await verifyReferences(ctx.supabase, ctx.user.id, {
    account_id: data.account_id,
    category_id: data.category_id,
    type: data.type,
  });
  if (refError) return refError;

  // base_amount generated column — INSERT'te YAZMA.
  const { error } = await ctx.supabase.from("transactions").insert({
    user_id: ctx.user.id,
    type: data.type,
    account_id: data.account_id,
    category_id: data.category_id,
    amount: data.amount,
    currency: data.currency,
    fx_rate: data.fx_rate,
    occurred_on: data.occurred_on,
    note: data.note?.trim() ? data.note.trim() : null,
  });

  if (error) return { error: "İşlem oluşturulamadı." };

  revalidatePath("/transactions");
  revalidatePath("/dashboard");
}

export async function updateTransaction(
  id: string,
  input: TransactionInputRaw,
): Promise<TransactionActionResult> {
  const ctx = await requireContext();
  if (!ctx) return { error: "Oturum bulunamadı." };

  const parsed = makeTransactionSchema(ctx.baseCurrency).safeParse(input);
  if (!parsed.success) return { error: "Formu kontrol edin." };
  const data = parsed.data;

  const refError = await verifyReferences(ctx.supabase, ctx.user.id, {
    account_id: data.account_id,
    category_id: data.category_id,
    type: data.type,
  });
  if (refError) return refError;

  const { error } = await ctx.supabase
    .from("transactions")
    .update({
      type: data.type,
      account_id: data.account_id,
      category_id: data.category_id,
      amount: data.amount,
      currency: data.currency,
      fx_rate: data.fx_rate,
      occurred_on: data.occurred_on,
      note: data.note?.trim() ? data.note.trim() : null,
    })
    .eq("id", id)
    .eq("user_id", ctx.user.id);

  if (error) return { error: "İşlem güncellenemedi." };

  revalidatePath("/transactions");
  revalidatePath("/dashboard");
}

export async function deleteTransaction(
  id: string,
): Promise<TransactionActionResult> {
  const ctx = await requireContext();
  if (!ctx) return { error: "Oturum bulunamadı." };

  const { error } = await ctx.supabase
    .from("transactions")
    .delete()
    .eq("id", id)
    .eq("user_id", ctx.user.id);

  if (error) return { error: "İşlem silinemedi." };

  revalidatePath("/transactions");
  revalidatePath("/dashboard");
}

const transactionIdsSchema = z
  .array(z.string().uuid())
  .min(1)
  .max(200)
  .transform((ids) => Array.from(new Set(ids)));

export type DeleteTransactionsResult =
  | { error: string }
  | { deleted: number; skipped: number };

export async function deleteTransactions(
  ids: string[],
): Promise<DeleteTransactionsResult> {
  const ctx = await requireContext();
  if (!ctx) return { error: "Oturum bulunamadı." };

  const parsed = transactionIdsSchema.safeParse(ids);
  if (!parsed.success) return { error: "Silinecek işlemleri kontrol edin." };

  const { data, error } = await ctx.supabase
    .from("transactions")
    .delete()
    .eq("user_id", ctx.user.id)
    .in("id", parsed.data)
    .select("id");

  if (error) return { error: "İşlemler silinemedi." };

  const deleted = data?.length ?? 0;
  revalidatePath("/transactions");
  revalidatePath("/dashboard");
  return { deleted, skipped: parsed.data.length - deleted };
}

const importRowSchema = z.object({
  account_id: z.string().uuid(),
  category_id: z.string().uuid(),
  type: z.enum(["income", "expense"]),
  amount: z.number().finite().positive(),
  occurred_on: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  note: z.string().trim().min(1).max(1000),
});

const importRowsSchema = z.array(importRowSchema).min(1).max(1000);

export type ImportTransactionRow = z.input<typeof importRowSchema>;

export type ImportTransactionsResult =
  | { error: string }
  | { inserted: number; skipped: number };

function serverFingerprint(row: z.infer<typeof importRowSchema>): string {
  return createHash("sha256")
    .update(
      importFingerprintSource({
        occurredOn: row.occurred_on,
        amount: row.amount,
        note: row.note,
        accountId: row.account_id,
      }),
    )
    .digest("hex");
}

export async function findExistingImportFingerprints(
  accountId: string,
  fingerprints: string[],
): Promise<{ error?: string; fingerprints?: string[] }> {
  const ctx = await requireContext();
  if (!ctx) return { error: "Oturum bulunamadı." };

  if (!z.string().uuid().safeParse(accountId).success) {
    return { error: "Geçerli bir hesap seçin." };
  }
  const parsed = z.array(z.string().regex(/^[a-f0-9]{64}$/)).max(1000).safeParse(
    Array.from(new Set(fingerprints)),
  );
  if (!parsed.success) return { error: "Tekrar kontrolü yapılamadı." };

  const { data: account } = await ctx.supabase
    .from("accounts")
    .select("id")
    .eq("id", accountId)
    .eq("user_id", ctx.user.id)
    .maybeSingle();
  if (!account) return { error: "Seçilen hesap bulunamadı." };
  if (parsed.data.length === 0) return { fingerprints: [] };

  const { data, error } = await ctx.supabase
    .from("transactions")
    .select("import_fingerprint")
    .eq("user_id", ctx.user.id)
    .in("import_fingerprint", parsed.data);

  if (error) return { error: "Tekrar kontrolü yapılamadı." };
  return {
    fingerprints: (data ?? [])
      .map((row) => row.import_fingerprint)
      .filter((value): value is string => Boolean(value)),
  };
}

export async function importTransactions(
  input: ImportTransactionRow[],
): Promise<ImportTransactionsResult> {
  const ctx = await requireContext();
  if (!ctx) return { error: "Oturum bulunamadı." };

  const parsed = importRowsSchema.safeParse(input);
  if (!parsed.success) return { error: "İçe aktarılacak satırları kontrol edin." };
  const rows = parsed.data;

  const accountIds = Array.from(new Set(rows.map((row) => row.account_id)));
  if (accountIds.length !== 1) {
    return { error: "Bir ekstre yalnızca tek bir hesaba aktarılabilir." };
  }

  const categoryIds = Array.from(new Set(rows.map((row) => row.category_id)));
  const [{ data: accounts }, { data: categories }] = await Promise.all([
    ctx.supabase
      .from("accounts")
      .select("id, currency")
      .eq("user_id", ctx.user.id)
      .in("id", accountIds),
    ctx.supabase
      .from("categories")
      .select("id, type")
      .eq("user_id", ctx.user.id)
      .in("id", categoryIds),
  ]);

  if ((accounts ?? []).length !== accountIds.length) {
    return { error: "Seçilen hesap bulunamadı." };
  }
  if (accounts?.some((account) => account.currency !== "TRY")) {
    return { error: "Ekstre importu şu anda yalnızca TRY hesapları destekliyor." };
  }
  if ((categories ?? []).length !== categoryIds.length) {
    return { error: "Seçilen kategorilerden biri bulunamadı." };
  }

  const categoryTypes = new Map(
    (categories ?? []).map((category) => [category.id, category.type]),
  );
  if (rows.some((row) => categoryTypes.get(row.category_id) !== row.type)) {
    return { error: "Kategori ile gelir/gider tipi eşleşmeyen satırlar var." };
  }

  const withFingerprints = rows.map((row) => ({
    row,
    fingerprint: serverFingerprint(row),
  }));
  const fingerprints = withFingerprints.map((item) => item.fingerprint);
  const { data: existing, error: existingError } = await ctx.supabase
    .from("transactions")
    .select("import_fingerprint")
    .eq("user_id", ctx.user.id)
    .in("import_fingerprint", fingerprints);
  if (existingError) return { error: "Tekrar kontrolü yapılamadı." };

  const existingSet = new Set(
    (existing ?? [])
      .map((item) => item.import_fingerprint)
      .filter((value): value is string => Boolean(value)),
  );
  const uniqueInRequest = new Set<string>();
  const newRows = withFingerprints.filter(({ fingerprint }) => {
    if (existingSet.has(fingerprint) || uniqueInRequest.has(fingerprint)) {
      return false;
    }
    uniqueInRequest.add(fingerprint);
    return true;
  });

  if (newRows.length > 0) {
    const { error } = await ctx.supabase.from("transactions").insert(
      newRows.map(({ row, fingerprint }) => ({
        user_id: ctx.user.id,
        account_id: row.account_id,
        category_id: row.category_id,
        type: row.type,
        amount: row.amount,
        currency: "TRY",
        fx_rate: 1,
        occurred_on: row.occurred_on,
        note: row.note,
        source: "import",
        import_fingerprint: fingerprint,
      })),
    );
    if (error) return { error: "İşlemler içe aktarılamadı." };
  }

  revalidatePath("/transactions");
  revalidatePath("/dashboard");
  return { inserted: newRows.length, skipped: rows.length - newRows.length };
}
