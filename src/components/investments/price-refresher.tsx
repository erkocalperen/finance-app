"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

type Props = {
  /**
   * Sunucu tarafında hesaplanır: en yeni stock fiyatı 6 saatten eski mi
   * ya da hiç yok mu? Sadece true iken arka planda /api/prices/refresh
   * tetiklenir. Sayfa açılışı için idempotent — session başına 1 kez.
   */
  shouldRefresh: boolean;
};

/**
 * Sayfa render'ını BLOKLAMADAN arka planda fiyat çekimi tetikler.
 * Başarısız olursa sessizce geç; kullanıcıyı rahatsız etme (manuel
 * "Fiyatları güncelle" butonu ayrı bir sinyal verir zaten).
 */
export function PriceRefresher({ shouldRefresh }: Props) {
  const router = useRouter();
  const [visible, setVisible] = useState(false);
  const triggered = useRef(false);

  useEffect(() => {
    if (!shouldRefresh || triggered.current) return;
    triggered.current = true;

    let cancelled = false;
    setVisible(true);

    (async () => {
      try {
        const res = await fetch("/api/prices/refresh", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
        });
        if (!res.ok) return;
        const data = (await res.json().catch(() => null)) as {
          updated?: number;
        } | null;
        if (!cancelled && data?.updated && data.updated > 0) {
          router.refresh();
        }
      } catch (err) {
        console.warn("Fiyat çekme başarısız:", err);
      } finally {
        if (!cancelled) setVisible(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [shouldRefresh, router]);

  if (!visible) return null;
  return (
    <div className="border-border bg-card text-muted-foreground fixed right-4 bottom-4 z-40 flex items-center gap-2 rounded-md border px-3 py-2 text-xs shadow-sm">
      <Loader2 className="h-3 w-3 animate-spin" />
      Fiyatlar güncelleniyor…
    </div>
  );
}
