"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { extendWithInvestments } from "@/types/database-investments";
import {
  manualPriceSchema,
  tradeSchema,
  type ManualPriceInputRaw,
  type TradeInputRaw,
} from "@/lib/validations/investment";

export type InvestmentActionResult = { error: string } | undefined;

type ExtendedClient = ReturnType<typeof extendWithInvestments>;

async function requireContext() {
  const base = await createClient();
  const {
    data: { user },
  } = await base.auth.getUser();
  if (!user) return null;
  return { supabase: extendWithInvestments(base), user };
}

async function loadAccount(
  supabase: ExtendedClient,
  userId: string,
  accountId: string,
): Promise<{ error: string } | { currency: string }> {
  const { data } = await supabase
    .from("accounts")
    .select("id, is_archived, currency")
    .eq("id", accountId)
    .eq("user_id", userId)
    .maybeSingle();
  if (!data) return { error: "Hesap bulunamadı." };
  if (data.is_archived) {
    return { error: "Arşivlenmiş hesapta işlem yapılamaz." };
  }
  return { currency: data.currency };
}

async function loadInstrument(
  supabase: ExtendedClient,
  instrumentId: string,
): Promise<{ error: string } | { currency: string; unit: string; name: string }> {
  const { data } = await supabase
    .from("instruments")
    .select("id, currency, unit, name, is_active")
    .eq("id", instrumentId)
    .maybeSingle();
  if (!data) return { error: "Enstrüman bulunamadı." };
  if (!data.is_active) {
    return { error: "Bu enstrüman artık aktif değil." };
  }
  return { currency: data.currency, unit: data.unit, name: data.name };
}

async function currentHolding(
  supabase: ExtendedClient,
  userId: string,
  instrumentId: string,
): Promise<number> {
  const { data } = await supabase
    .from("portfolio_holdings")
    .select("quantity")
    .eq("user_id", userId)
    .eq("instrument_id", instrumentId)
    .maybeSingle();
  return Number(data?.quantity ?? 0);
}

function formatQuantity(n: number, unit: string): string {
  const s = new Intl.NumberFormat("tr-TR", {
    maximumFractionDigits: 6,
    minimumFractionDigits: 0,
  }).format(n);
  return `${s} ${unit}`;
}

export async function createTrade(
  input: TradeInputRaw,
): Promise<InvestmentActionResult> {
  const ctx = await requireContext();
  if (!ctx) return { error: "Oturum bulunamadı." };

  const parsed = tradeSchema.safeParse(input);
  if (!parsed.success) return { error: "Formu kontrol edin." };
  const data = parsed.data;

  const acc = await loadAccount(ctx.supabase, ctx.user.id, data.account_id);
  if ("error" in acc) return acc;

  const ins = await loadInstrument(ctx.supabase, data.instrument_id);
  if ("error" in ins) return ins;

  if (acc.currency !== ins.currency) {
    return {
      error: `Hesap (${acc.currency}) ve enstrüman (${ins.currency}) aynı para biriminde olmalı.`,
    };
  }

  if (data.side === "sell") {
    const available = await currentHolding(
      ctx.supabase,
      ctx.user.id,
      data.instrument_id,
    );
    if (available < data.quantity) {
      return {
        error: `Elinizde sadece ${formatQuantity(available, ins.unit)} var, daha fazlasını satamazsınız.`,
      };
    }
  }

  const { error } = await ctx.supabase.from("investment_trades").insert({
    user_id: ctx.user.id,
    instrument_id: data.instrument_id,
    account_id: data.account_id,
    side: data.side,
    quantity: data.quantity,
    unit_price: data.unit_price,
    fee: data.fee,
    counts_as_cash_flow: data.counts_as_cash_flow,
    occurred_on: data.occurred_on,
    note: data.note?.trim() ? data.note.trim() : null,
  });

  if (error) return { error: "İşlem kaydedilemedi." };

  revalidatePath("/investments");
  revalidatePath("/transactions");
  revalidatePath("/accounts");
  revalidatePath("/dashboard");
}

export async function updateTrade(
  id: string,
  input: TradeInputRaw,
): Promise<InvestmentActionResult> {
  const ctx = await requireContext();
  if (!ctx) return { error: "Oturum bulunamadı." };

  const parsed = tradeSchema.safeParse(input);
  if (!parsed.success) return { error: "Formu kontrol edin." };
  const data = parsed.data;

  const { data: existing } = await ctx.supabase
    .from("investment_trades")
    .select("id, instrument_id, side, quantity")
    .eq("id", id)
    .eq("user_id", ctx.user.id)
    .maybeSingle();
  if (!existing) return { error: "İşlem bulunamadı." };

  const acc = await loadAccount(ctx.supabase, ctx.user.id, data.account_id);
  if ("error" in acc) return acc;

  const ins = await loadInstrument(ctx.supabase, data.instrument_id);
  if ("error" in ins) return ins;

  if (acc.currency !== ins.currency) {
    return {
      error: `Hesap (${acc.currency}) ve enstrüman (${ins.currency}) aynı para biriminde olmalı.`,
    };
  }

  if (data.side === "sell") {
    // Mevcut trade'in etkisini geri alarak "eğer bu trade olmasaydı"
    // pozisyonunu hesapla.
    let available = await currentHolding(
      ctx.supabase,
      ctx.user.id,
      data.instrument_id,
    );
    if (existing.instrument_id === data.instrument_id) {
      if (existing.side === "buy") available -= Number(existing.quantity);
      if (existing.side === "sell") available += Number(existing.quantity);
    }
    if (available < data.quantity) {
      return {
        error: `Elinizde sadece ${formatQuantity(available, ins.unit)} var, daha fazlasını satamazsınız.`,
      };
    }
  }

  const { error } = await ctx.supabase
    .from("investment_trades")
    .update({
      instrument_id: data.instrument_id,
      account_id: data.account_id,
      side: data.side,
      quantity: data.quantity,
      unit_price: data.unit_price,
      fee: data.fee,
      counts_as_cash_flow: data.counts_as_cash_flow,
      occurred_on: data.occurred_on,
      note: data.note?.trim() ? data.note.trim() : null,
    })
    .eq("id", id)
    .eq("user_id", ctx.user.id);

  if (error) return { error: "İşlem güncellenemedi." };

  revalidatePath("/investments");
  revalidatePath("/transactions");
  revalidatePath("/accounts");
  revalidatePath("/dashboard");
}

export async function deleteTrade(
  id: string,
): Promise<InvestmentActionResult> {
  const ctx = await requireContext();
  if (!ctx) return { error: "Oturum bulunamadı." };

  const { error } = await ctx.supabase
    .from("investment_trades")
    .delete()
    .eq("id", id)
    .eq("user_id", ctx.user.id);

  if (error) return { error: "İşlem silinemedi." };

  revalidatePath("/investments");
  revalidatePath("/transactions");
  revalidatePath("/accounts");
  revalidatePath("/dashboard");
}

export async function setManualPrice(
  input: ManualPriceInputRaw,
): Promise<InvestmentActionResult> {
  const ctx = await requireContext();
  if (!ctx) return { error: "Oturum bulunamadı." };

  const parsed = manualPriceSchema.safeParse(input);
  if (!parsed.success) return { error: "Formu kontrol edin." };
  const data = parsed.data;

  const ins = await loadInstrument(ctx.supabase, data.instrument_id);
  if ("error" in ins) return ins;

  const { error } = await ctx.supabase.from("instrument_prices").insert({
    instrument_id: data.instrument_id,
    price: data.price,
    source: "manual",
  });

  if (error) return { error: "Fiyat kaydedilemedi." };

  revalidatePath("/investments");
  revalidatePath("/dashboard");
}
