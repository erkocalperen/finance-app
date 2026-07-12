"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import {
  loginSchema,
  registerSchema,
  type LoginInput,
  type RegisterInput,
} from "@/lib/validations/auth";

export type AuthActionResult = { error: string } | undefined;

export async function signIn(input: LoginInput): Promise<AuthActionResult> {
  const parsed = loginSchema.safeParse(input);
  if (!parsed.success) {
    return { error: "Formu kontrol edin." };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);

  if (error) {
    return { error: translateLoginError(error.message) };
  }

  revalidatePath("/", "layout");
  redirect("/dashboard");
}

export async function signUp(input: RegisterInput): Promise<AuthActionResult> {
  const parsed = registerSchema.safeParse(input);
  if (!parsed.success) {
    return { error: "Formu kontrol edin." };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      data: { full_name: parsed.data.fullName },
    },
  });

  if (error) {
    return { error: translateRegisterError(error.message) };
  }

  revalidatePath("/", "layout");
  redirect("/dashboard");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

// User enumeration önleme: "user not found" ile "wrong password" arasında
// ayrım yapmıyoruz. Her ikisi için de aynı generic mesaj.
function translateLoginError(message: string): string {
  const m = message.toLowerCase();
  if (
    m.includes("invalid login") ||
    m.includes("invalid credentials") ||
    m.includes("email not confirmed") ||
    m.includes("user not found")
  ) {
    return "E-posta veya şifre hatalı.";
  }
  return "Giriş yapılamadı. Lütfen tekrar deneyin.";
}

function translateRegisterError(message: string): string {
  const m = message.toLowerCase();
  if (
    m.includes("already registered") ||
    m.includes("already been registered") ||
    m.includes("user already")
  ) {
    return "Bu e-posta zaten kayıtlı.";
  }
  if (m.includes("password")) {
    return "Şifre gereksinimlerini karşılamıyor.";
  }
  if (m.includes("email")) {
    return "Geçerli bir e-posta girin.";
  }
  return "Kayıt oluşturulamadı. Lütfen tekrar deneyin.";
}
