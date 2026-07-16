import { redirect } from "next/navigation";

import { TransactionImportWizard } from "@/components/transactions/import/transaction-import-wizard";
import { createClient } from "@/lib/supabase/server";
import type { AccountType, Currency, EntryType } from "@/lib/constants";

export default async function TransactionImportPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [accountsRes, categoriesRes] = await Promise.all([
    supabase
      .from("accounts")
      .select("id, name, currency, type, is_archived")
      .eq("user_id", user.id)
      .order("name"),
    supabase
      .from("categories")
      .select("id, name, type, color")
      .eq("user_id", user.id)
      .order("name"),
  ]);

  const accounts = (accountsRes.data ?? [])
    .filter((account) => !account.is_archived)
    .map((account) => ({
      id: account.id,
      name: account.name,
      currency: account.currency as Currency,
      type: account.type as AccountType,
    }));
  const categories = (categoriesRes.data ?? []).map((category) => ({
    id: category.id,
    name: category.name,
    type: category.type as EntryType,
    color: category.color,
  }));

  return <TransactionImportWizard accounts={accounts} categories={categories} />;
}

