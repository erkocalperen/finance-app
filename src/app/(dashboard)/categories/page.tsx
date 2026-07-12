import { redirect } from "next/navigation";

import { CategoriesManager } from "@/components/categories/categories-manager";
import { createClient } from "@/lib/supabase/server";

export default async function CategoriesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: categories } = await supabase
    .from("categories")
    .select("id, name, type, color")
    .order("name");

  return <CategoriesManager categories={categories ?? []} />;
}
