"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Manuel tetikleyici. Otomatiğe ek — kullanıcı "şimdi güncelle" diyebilsin.
 * Sonuç toast'ı: kaç fiyat güncellendi, hiç güncellenmediyse manuel giriş
 * hatırlatması.
 */
export function RefreshPricesButton() {
  const router = useRouter();
  const [isPending, setIsPending] = useState(false);

  async function handleClick() {
    setIsPending(true);
    try {
      const res = await fetch("/api/prices/refresh", { method: "POST" });
      if (!res.ok) {
        toast.error("Fiyatlar güncellenemedi, manuel girebilirsiniz.");
        return;
      }
      const data = (await res.json().catch(() => null)) as {
        updated?: number;
      } | null;
      if (data?.updated && data.updated > 0) {
        toast.success(`${data.updated} fiyat güncellendi.`);
        router.refresh();
      } else {
        toast.error("Fiyatlar güncellenemedi, manuel girebilirsiniz.");
      }
    } catch {
      toast.error("Fiyatlar güncellenemedi, manuel girebilirsiniz.");
    } finally {
      setIsPending(false);
    }
  }

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleClick}
      disabled={isPending}
    >
      <RefreshCw
        className={cn("mr-2 h-4 w-4", isPending && "animate-spin")}
      />
      Fiyatları güncelle
    </Button>
  );
}
