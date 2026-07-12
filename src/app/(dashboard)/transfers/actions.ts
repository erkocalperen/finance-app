"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { extendWithTransfers } from "@/types/database-transfers";
import {
  transferSchema,
  type TransferInputRaw,
} from "@/lib/validations/transfer";

export type TransferActionResult = { error: string } | undefined;

async function requireContext() {
  const base = await createClient();
  const {
    data: { user },
  } = await base.auth.getUser();
  if (!user) return null;
  return { supabase: extendWithTransfers(base), user };
}

async function loadAccountsPair(
  supabase: ReturnType<typeof extendWithTransfers>,
  userId: string,
  fromId: string,
  toId: string,
): Promise<
  | { error: string }
  | { fromCurrency: string; toCurrency: string }
> {
  const [fromRes, toRes] = await Promise.all([
    supabase
      .from("accounts")
      .select("id, currency, is_archived")
      .eq("id", fromId)
      .eq("user_id", userId)
      .maybeSingle(),
    supabase
      .from("accounts")
      .select("id, currency, is_archived")
      .eq("id", toId)
      .eq("user_id", userId)
      .maybeSingle(),
  ]);

  if (!fromRes.data) return { error: "Kaynak hesap bulunamadı." };
  if (!toRes.data) return { error: "Hedef hesap bulunamadı." };
  if (fromRes.data.is_archived || toRes.data.is_archived) {
    return { error: "Arşivlenmiş hesap üzerinde transfer yapılamaz." };
  }
  return {
    fromCurrency: fromRes.data.currency,
    toCurrency: toRes.data.currency,
  };
}

export async function createTransfer(
  input: TransferInputRaw,
): Promise<TransferActionResult> {
  const ctx = await requireContext();
  if (!ctx) return { error: "Oturum bulunamadı." };

  const parsed = transferSchema.safeParse(input);
  if (!parsed.success) return { error: "Formu kontrol edin." };
  const data = parsed.data;

  const accountsResult = await loadAccountsPair(
    ctx.supabase,
    ctx.user.id,
    data.from_account_id,
    data.to_account_id,
  );
  if ("error" in accountsResult) return accountsResult;

  // Aynı para birimindeyse received_amount = amount olmalı (form da yolluyor
  // ama server tarafında da normalize edelim).
  const receivedAmount =
    accountsResult.fromCurrency === accountsResult.toCurrency
      ? data.amount
      : data.received_amount;

  const { error } = await ctx.supabase.from("transfers").insert({
    user_id: ctx.user.id,
    from_account_id: data.from_account_id,
    to_account_id: data.to_account_id,
    amount: data.amount,
    currency: accountsResult.fromCurrency,
    received_amount: receivedAmount,
    occurred_on: data.occurred_on,
    note: data.note?.trim() ? data.note.trim() : null,
  });

  if (error) return { error: "Transfer oluşturulamadı." };

  revalidatePath("/transfers");
  revalidatePath("/accounts");
  revalidatePath("/dashboard");
}

export async function updateTransfer(
  id: string,
  input: TransferInputRaw,
): Promise<TransferActionResult> {
  const ctx = await requireContext();
  if (!ctx) return { error: "Oturum bulunamadı." };

  const parsed = transferSchema.safeParse(input);
  if (!parsed.success) return { error: "Formu kontrol edin." };
  const data = parsed.data;

  const accountsResult = await loadAccountsPair(
    ctx.supabase,
    ctx.user.id,
    data.from_account_id,
    data.to_account_id,
  );
  if ("error" in accountsResult) return accountsResult;

  const receivedAmount =
    accountsResult.fromCurrency === accountsResult.toCurrency
      ? data.amount
      : data.received_amount;

  const { error } = await ctx.supabase
    .from("transfers")
    .update({
      from_account_id: data.from_account_id,
      to_account_id: data.to_account_id,
      amount: data.amount,
      currency: accountsResult.fromCurrency,
      received_amount: receivedAmount,
      occurred_on: data.occurred_on,
      note: data.note?.trim() ? data.note.trim() : null,
    })
    .eq("id", id)
    .eq("user_id", ctx.user.id);

  if (error) return { error: "Transfer güncellenemedi." };

  revalidatePath("/transfers");
  revalidatePath("/accounts");
  revalidatePath("/dashboard");
}

export async function deleteTransfer(
  id: string,
): Promise<TransferActionResult> {
  const ctx = await requireContext();
  if (!ctx) return { error: "Oturum bulunamadı." };

  const { error } = await ctx.supabase
    .from("transfers")
    .delete()
    .eq("id", id)
    .eq("user_id", ctx.user.id);

  if (error) return { error: "Transfer silinemedi." };

  revalidatePath("/transfers");
  revalidatePath("/accounts");
  revalidatePath("/dashboard");
}
