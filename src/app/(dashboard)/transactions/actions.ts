"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import type { Currency } from "@/lib/constants";
import {
  makeTransactionSchema,
  type TransactionInput,
} from "@/lib/validations/transaction";

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
  input: Pick<TransactionInput, "account_id" | "category_id" | "type">,
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
  input: TransactionInput,
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
  input: TransactionInput,
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
