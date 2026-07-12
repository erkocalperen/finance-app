"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import {
  accountSchema,
  type AccountInputRaw,
} from "@/lib/validations/account";

export type AccountActionResult = { error: string } | undefined;

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user ? { supabase, user } : null;
}

export async function createAccount(
  input: AccountInputRaw,
): Promise<AccountActionResult> {
  const ctx = await requireUser();
  if (!ctx) return { error: "Oturum bulunamadı." };

  const parsed = accountSchema.safeParse(input);
  if (!parsed.success) return { error: "Formu kontrol edin." };

  const { error } = await ctx.supabase.from("accounts").insert({
    user_id: ctx.user.id,
    name: parsed.data.name,
    type: parsed.data.type,
    currency: parsed.data.currency,
    initial_balance: parsed.data.initial_balance,
  });

  if (error) return { error: "Hesap oluşturulamadı." };

  revalidatePath("/accounts");
  revalidatePath("/dashboard");
}

export async function updateAccount(
  id: string,
  input: AccountInputRaw,
): Promise<AccountActionResult> {
  const ctx = await requireUser();
  if (!ctx) return { error: "Oturum bulunamadı." };

  const parsed = accountSchema.safeParse(input);
  if (!parsed.success) return { error: "Formu kontrol edin." };

  const { error } = await ctx.supabase
    .from("accounts")
    .update({
      name: parsed.data.name,
      type: parsed.data.type,
      currency: parsed.data.currency,
      initial_balance: parsed.data.initial_balance,
    })
    .eq("id", id)
    .eq("user_id", ctx.user.id);

  if (error) return { error: "Hesap güncellenemedi." };

  revalidatePath("/accounts");
  revalidatePath("/dashboard");
}

export async function setAccountArchived(
  id: string,
  isArchived: boolean,
): Promise<AccountActionResult> {
  const ctx = await requireUser();
  if (!ctx) return { error: "Oturum bulunamadı." };

  const { error } = await ctx.supabase
    .from("accounts")
    .update({ is_archived: isArchived })
    .eq("id", id)
    .eq("user_id", ctx.user.id);

  if (error) return { error: "Hesap güncellenemedi." };

  revalidatePath("/accounts");
  revalidatePath("/dashboard");
}

export async function deleteAccount(
  id: string,
): Promise<AccountActionResult> {
  const ctx = await requireUser();
  if (!ctx) return { error: "Oturum bulunamadı." };

  const { error } = await ctx.supabase
    .from("accounts")
    .delete()
    .eq("id", id)
    .eq("user_id", ctx.user.id);

  if (error) {
    // 23503 = foreign_key_violation — accounts -> transactions on delete restrict.
    if (error.code === "23503") {
      return {
        error:
          "Bu hesaba ait işlemler var, silinemez. Kalıcı olarak kaldırmak yerine hesabı arşivleyebilirsiniz.",
      };
    }
    return { error: "Hesap silinemedi." };
  }

  revalidatePath("/accounts");
  revalidatePath("/dashboard");
}
