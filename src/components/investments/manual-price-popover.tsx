"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { CurrencyInput } from "@/components/currency-input";
import { setManualPrice } from "@/app/(dashboard)/investments/actions";

type Props = {
  instrumentId: string;
  instrumentName: string;
  currency: string;
  currentPrice?: number | null;
  trigger: React.ReactNode;
};

export function ManualPricePopover({
  instrumentId,
  instrumentName,
  currency,
  currentPrice,
  trigger,
}: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState("");
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (open) {
      setValue(currentPrice != null ? String(currentPrice) : "");
    }
  }, [open, currentPrice]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const result = await setManualPrice({
        instrument_id: instrumentId,
        price: value,
      });
      if (result?.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Fiyat güncellendi.");
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      <PopoverContent className="w-72" align="end">
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <Label className="text-xs">{instrumentName} — güncel fiyat</Label>
            <p className="text-muted-foreground text-xs">
              Manuel giriş; kayıt zaman damgasıyla saklanır.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <CurrencyInput
              value={value}
              onChange={setValue}
              disabled={isPending}
              placeholder="0,00"
              autoFocus
              className="flex-1"
            />
            <span className="text-muted-foreground text-xs">{currency}</span>
          </div>
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setOpen(false)}
              disabled={isPending}
            >
              Vazgeç
            </Button>
            <Button type="submit" size="sm" disabled={isPending}>
              {isPending && <Loader2 className="mr-2 h-3 w-3 animate-spin" />}
              Kaydet
            </Button>
          </div>
        </form>
      </PopoverContent>
    </Popover>
  );
}
