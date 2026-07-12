import Link from "next/link";
import { Plus, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";

export function EmptyDashboard({ hasAccounts }: { hasAccounts: boolean }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed py-16 text-center">
      <div className="bg-muted rounded-full p-3">
        <Sparkles className="text-muted-foreground h-6 w-6" />
      </div>
      <h2 className="text-lg font-medium">Panelinize hoş geldiniz</h2>
      <p className="text-muted-foreground max-w-md text-sm">
        {hasAccounts
          ? "Nakit akışını takip etmek için ilk gelir veya gider hareketinizi ekleyin."
          : "Başlamak için önce Hesaplar sayfasından bir hesap tanımlayın, sonra ilk işleminizi ekleyin."}
      </p>
      <div className="mt-2 flex gap-2">
        {hasAccounts ? (
          <Button asChild>
            <Link href="/transactions">
              <Plus className="mr-2 h-4 w-4" />
              İlk işlemini ekle
            </Link>
          </Button>
        ) : (
          <Button asChild>
            <Link href="/accounts">
              <Plus className="mr-2 h-4 w-4" />
              İlk hesabını ekle
            </Link>
          </Button>
        )}
      </div>
    </div>
  );
}
