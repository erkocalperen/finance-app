"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import {
  categorySchema,
  type CategoryInput,
} from "@/lib/validations/category";

export type CategoryActionResult = { error: string } | undefined;

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user ? { supabase, user } : null;
}

export async function createCategory(
  input: CategoryInput,
): Promise<CategoryActionResult> {
  const ctx = await requireUser();
  if (!ctx) return { error: "Oturum bulunamadı." };

  const parsed = categorySchema.safeParse(input);
  if (!parsed.success) return { error: "Formu kontrol edin." };

  const { error } = await ctx.supabase.from("categories").insert({
    user_id: ctx.user.id,
    name: parsed.data.name,
    type: parsed.data.type,
    color: parsed.data.color,
  });

  if (error) {
    if (error.code === "23505") {
      return { error: "Bu isim ve tipte bir kategori zaten var." };
    }
    return { error: "Kategori oluşturulamadı." };
  }

  revalidatePath("/categories");
}

export async function updateCategory(
  id: string,
  input: CategoryInput,
): Promise<CategoryActionResult> {
  const ctx = await requireUser();
  if (!ctx) return { error: "Oturum bulunamadı." };

  const parsed = categorySchema.safeParse(input);
  if (!parsed.success) return { error: "Formu kontrol edin." };

  // RLS zaten user_id kontrolü yapıyor; eq user_id ekstra savunma.
  const { error } = await ctx.supabase
    .from("categories")
    .update({
      name: parsed.data.name,
      type: parsed.data.type,
      color: parsed.data.color,
    })
    .eq("id", id)
    .eq("user_id", ctx.user.id);

  if (error) {
    if (error.code === "23505") {
      return { error: "Bu isim ve tipte bir kategori zaten var." };
    }
    return { error: "Kategori güncellenemedi." };
  }

  revalidatePath("/categories");
}

export async function deleteCategory(
  id: string,
): Promise<CategoryActionResult> {
  const ctx = await requireUser();
  if (!ctx) return { error: "Oturum bulunamadı." };

  const { error } = await ctx.supabase
    .from("categories")
    .delete()
    .eq("id", id)
    .eq("user_id", ctx.user.id);

  if (error) {
    // 23503 = foreign_key_violation — categories -> transactions on delete restrict.
    if (error.code === "23503") {
      return {
        error:
          "Bu kategoriye ait işlemler var, silinemez. Önce işlemleri başka bir kategoriye taşıyın.",
      };
    }
    return { error: "Kategori silinemedi." };
  }

  revalidatePath("/categories");
}
