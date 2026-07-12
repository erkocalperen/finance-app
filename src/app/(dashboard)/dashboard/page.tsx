import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // profiles select'i RLS'in gerçekten çalıştığını doğruluyor:
  // handle_new_user trigger'ı satırı zaten oluşturmuş olmalı.
  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name")
    .eq("id", user.id)
    .single();

  const metadataName =
    typeof user.user_metadata?.full_name === "string"
      ? user.user_metadata.full_name
      : undefined;
  const displayName =
    profile?.full_name ?? metadataName ?? user.email ?? "kullanıcı";

  return (
    <div className="space-y-2">
      <h1 className="text-3xl font-semibold tracking-tight">
        Hoş geldin, {displayName}
      </h1>
      <p className="text-muted-foreground text-sm">
        Panel widget&apos;ları yakında burada olacak.
      </p>
    </div>
  );
}
