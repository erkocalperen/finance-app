import { redirect } from "next/navigation";

import {
  AccountsManager,
  type AccountRow,
} from "@/components/accounts/accounts-manager";
import { createClient } from "@/lib/supabase/server";
import type { AccountType, Currency } from "@/lib/constants";

export default async function AccountsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Hesap alanları + bakiye ayrı ayrı sorgulanıp id üzerinden eşleştirilir.
  // account_balances view'ı is_archived tutmadığı için accounts tablosunu
  // ayrıca çekiyoruz; bakiyeyi VİEW'DAN alıyoruz — elle hesaplama yok.
  const [{ data: accounts }, { data: balances }] = await Promise.all([
    supabase
      .from("accounts")
      .select("id, name, type, currency, initial_balance, is_archived")
      .order("name"),
    supabase.from("account_balances").select("account_id, balance"),
  ]);

  const balanceById = new Map<string, number>();
  for (const b of balances ?? []) {
    if (b.account_id != null && b.balance != null) {
      balanceById.set(b.account_id, Number(b.balance));
    }
  }

  const rows: AccountRow[] = (accounts ?? []).map((a) => ({
    id: a.id,
    name: a.name,
    type: a.type as AccountType,
    currency: a.currency as Currency,
    initial_balance: Number(a.initial_balance),
    is_archived: a.is_archived,
    balance: balanceById.get(a.id) ?? Number(a.initial_balance),
  }));

  return <AccountsManager accounts={rows} />;
}
