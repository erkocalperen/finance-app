"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ExternalLink, Loader2, Save } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { tr } from "date-fns/locale";
import { toast } from "sonner";

import { setManualPrice } from "@/app/(dashboard)/investments/actions";
import { CurrencyInput } from "@/components/currency-input";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/format";
import type { Currency } from "@/lib/constants";
import type { InstrumentKind } from "@/types/database-investments";

export type ManualPriceItem = {
  instrumentId: string;
  name: string;
  symbol: string;
  kind: InstrumentKind;
  currency: Currency;
  currentPrice: number | null;
  priceAsOf: string | null;
};

type Props = {
  items: ManualPriceItem[];
};

export function ManualPriceQuickUpdate({ items }: Props) {
  const router = useRouter();
  const [values, setValues] = useState<Record<string, string>>({});
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  if (items.length === 0) return null;

  function save(item: ManualPriceItem) {
    const value = values[item.instrumentId] ?? "";
    if (!value.trim()) {
      toast.error("Fiyat girin.");
      return;
    }

    setPendingId(item.instrumentId);
    startTransition(async () => {
      const result = await setManualPrice({
        instrument_id: item.instrumentId,
        price: value,
      });

      if (result?.error) {
        toast.error(result.error);
        setPendingId(null);
        return;
      }

      toast.success(`${item.name} fiyatı kaydedildi.`);
      setValues((prev) => ({ ...prev, [item.instrumentId]: "" }));
      setPendingId(null);
      router.refresh();
    });
  }

  return (
    <section className="space-y-3 rounded-xl border p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold">Manuel Fiyat Güncelleme</h2>
          <p className="text-muted-foreground text-xs">
            Altın ve gümüş fiyatlarını hızlıca elle güncelle.
          </p>
        </div>
        <Button asChild variant="outline" size="sm">
          <Link
            href="https://bigpara.hurriyet.com.tr/altin/"
            target="_blank"
            rel="noreferrer"
          >
            Bigpara Altın
            <ExternalLink className="ml-2 h-3.5 w-3.5" />
          </Link>
        </Button>
      </div>

      <div className="divide-y rounded-lg border">
        {items.map((item) => {
          const pending = isPending && pendingId === item.instrumentId;
          return (
            <div
              key={item.instrumentId}
              className="grid gap-3 px-3 py-3 sm:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_minmax(160px,0.8fr)_auto] sm:items-center"
            >
              <div className="min-w-0">
                <div className="truncate text-sm font-medium">{item.name}</div>
                <div className="text-muted-foreground text-xs">
                  {item.symbol}
                </div>
              </div>

              <div className="text-sm">
                <div className="tabular-nums">
                  {item.currentPrice == null
                    ? "-"
                    : formatCurrency(item.currentPrice, item.currency)}
                </div>
                <div className="text-muted-foreground text-xs">
                  {item.priceAsOf
                    ? formatDistanceToNow(new Date(item.priceAsOf), {
                        locale: tr,
                        addSuffix: true,
                      })
                    : "Henüz fiyat yok"}
                </div>
              </div>

              <CurrencyInput
                value={values[item.instrumentId] ?? ""}
                onChange={(value) =>
                  setValues((prev) => ({
                    ...prev,
                    [item.instrumentId]: value,
                  }))
                }
                disabled={pending}
                placeholder="0,00"
              />

              <Button
                type="button"
                size="sm"
                onClick={() => save(item)}
                disabled={pending}
              >
                {pending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Save className="mr-2 h-4 w-4" />
                )}
                Kaydet
              </Button>
            </div>
          );
        })}
      </div>
    </section>
  );
}
