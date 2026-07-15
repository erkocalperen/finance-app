import { redirect } from "next/navigation";

import { Button } from "@/components/ui/button";
import { DashboardNav } from "@/components/dashboard/dashboard-nav";
import { MobileNav } from "@/components/dashboard/mobile-nav";
import { ModeToggle } from "@/components/mode-toggle";
import { createClient } from "@/lib/supabase/server";
import { signOut } from "../(auth)/actions";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Middleware zaten korumalı ama sunucuda ekstra güvenlik.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  return (
    <div className="flex min-h-screen">
      <aside className="hidden w-64 shrink-0 flex-col border-r md:flex">
        <div className="px-6 py-5 text-lg font-semibold">finance-app</div>
        <DashboardNav />
      </aside>

      <div className="flex flex-1 flex-col">
        <header className="flex items-center gap-3 border-b px-4 py-3 md:px-6">
          <MobileNav />
          <div className="ml-auto flex items-center gap-2">
            <span className="text-muted-foreground hidden text-sm sm:inline">
              {user.email}
            </span>
            <ModeToggle />
            <form action={signOut}>
              <Button type="submit" variant="outline" size="sm">
                Çıkış Yap
              </Button>
            </form>
          </div>
        </header>
        <main className="flex-1 p-4 md:p-6">{children}</main>
      </div>
    </div>
  );
}
