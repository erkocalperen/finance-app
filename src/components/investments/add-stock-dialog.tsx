"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus } from "lucide-react";
import { toast } from "sonner";

import { addStockInstrument } from "@/app/(dashboard)/investments/actions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function AddStockDialog() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [symbol, setSymbol] = useState("");
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function reset() {
    setSymbol("");
    setFieldError(null);
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setFieldError(null);

    startTransition(async () => {
      const result = await addStockInstrument(symbol);

      if ("success" in result) {
        toast.success(`${result.symbol} (${result.name}) eklendi.`);
        setOpen(false);
        reset();
        router.refresh();
        return;
      }

      if ("info" in result) {
        toast.info(result.info);
        return;
      }

      setFieldError(result.error);
    });
  }

  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)}>
        <Plus className="mr-2 h-4 w-4" />
        Hisse Ekle
      </Button>

      <Dialog
        open={open}
        onOpenChange={(nextOpen) => {
          setOpen(nextOpen);
          if (!nextOpen) reset();
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Hisse Ekle</DialogTitle>
            <DialogDescription>
              Eklediğiniz hisse otomatik fiyat çekmeye dahil olur.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={submit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="stock-symbol">BIST Sembolü</Label>
              <Input
                id="stock-symbol"
                value={symbol}
                onChange={(e) => {
                  setFieldError(null);
                  setSymbol(e.target.value.toUpperCase());
                }}
                placeholder="THYAO, GARAN, ASELS..."
                disabled={isPending}
                aria-invalid={fieldError != null}
                autoFocus
              />
              {fieldError ? (
                <p className="text-destructive text-xs">{fieldError}</p>
              ) : (
                <p className="text-muted-foreground text-xs">
                  Sembolü BIST koduyla girin.
                </p>
              )}
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpen(false)}
                disabled={isPending}
              >
                Vazgeç
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Ekle
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
