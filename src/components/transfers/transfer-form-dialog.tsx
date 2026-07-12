"use client";

import { useEffect, useMemo, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { tr } from "date-fns/locale";
import { CalendarIcon, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { CurrencyInput } from "@/components/currency-input";
import type { Currency } from "@/lib/constants";
import { formatDate, toIsoDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import {
  transferSchema,
  type TransferInput,
  type TransferInputRaw,
} from "@/lib/validations/transfer";
import {
  createTransfer,
  updateTransfer,
} from "@/app/(dashboard)/transfers/actions";

export type TransferAccountOption = {
  id: string;
  name: string;
  currency: Currency;
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "create" | "edit";
  initial?: { id: string } & TransferInput;
  /** Ön-doldurma için: "Borç Öde" akışı. mode === "create" iken kullanılır. */
  prefill?: Partial<TransferInputRaw>;
  accounts: TransferAccountOption[];
};

function emptyFormValues(): TransferInputRaw {
  return {
    from_account_id: "",
    to_account_id: "",
    amount: "",
    received_amount: "",
    occurred_on: toIsoDate(new Date()),
    note: "",
  };
}

function initialToFormValues(
  init: ({ id: string } & TransferInput) | undefined,
  prefill?: Partial<TransferInputRaw>,
): TransferInputRaw {
  if (init) {
    return {
      from_account_id: init.from_account_id,
      to_account_id: init.to_account_id,
      amount: String(init.amount),
      received_amount: String(init.received_amount),
      occurred_on: init.occurred_on,
      note: init.note ?? "",
    };
  }
  return { ...emptyFormValues(), ...(prefill ?? {}) };
}

export function TransferFormDialog({
  open,
  onOpenChange,
  mode,
  initial,
  prefill,
  accounts,
}: Props) {
  const [isPending, startTransition] = useTransition();

  const defaults = useMemo(
    () => initialToFormValues(initial, prefill),
    [initial, prefill],
  );

  const form = useForm<TransferInputRaw>({
    resolver: zodResolver(transferSchema),
    defaultValues: defaults,
  });

  useEffect(() => {
    if (open) form.reset(defaults);
  }, [open, defaults, form]);

  const fromId = form.watch("from_account_id");
  const toId = form.watch("to_account_id");
  const amount = form.watch("amount");

  const fromAccount =
    typeof fromId === "string" ? accounts.find((a) => a.id === fromId) : null;
  const toAccount =
    typeof toId === "string" ? accounts.find((a) => a.id === toId) : null;

  const sameCurrency =
    fromAccount != null &&
    toAccount != null &&
    fromAccount.currency === toAccount.currency;

  const showReceivedAmount =
    fromAccount != null &&
    toAccount != null &&
    fromAccount.currency !== toAccount.currency;

  // Aynı para birimindeyse received_amount'ı amount ile senkronize tut
  // (görünmez alanın zod validation'ından geçebilmesi için).
  useEffect(() => {
    if (!open) return;
    if (sameCurrency) {
      const currentAmount = form.getValues("amount");
      form.setValue(
        "received_amount",
        typeof currentAmount === "string" ? currentAmount : "",
        { shouldValidate: false },
      );
    }
  }, [open, sameCurrency, amount, form]);

  // Kime listesinden Kimden'de seçileni çıkar.
  const toOptions = useMemo(
    () => accounts.filter((a) => a.id !== fromId),
    [accounts, fromId],
  );

  function onSubmit(values: TransferInputRaw) {
    const payload: TransferInputRaw =
      fromAccount &&
      toAccount &&
      fromAccount.currency === toAccount.currency
        ? { ...values, received_amount: values.amount }
        : values;

    startTransition(async () => {
      const result =
        mode === "edit" && initial
          ? await updateTransfer(initial.id, payload)
          : await createTransfer(payload);

      if (result?.error) {
        toast.error(result.error);
        return;
      }
      toast.success(
        mode === "edit" ? "Transfer güncellendi." : "Transfer oluşturuldu.",
      );
      onOpenChange(false);
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {mode === "edit" ? "Transferi Düzenle" : "Yeni Transfer"}
          </DialogTitle>
          <DialogDescription>
            {mode === "edit"
              ? "Bu transferin bilgilerini güncelleyin."
              : "İki hesap arasında para hareketi kaydedin. Gelir/gider raporlarına girmez."}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="space-y-4"
          >
            <FormField
              control={form.control}
              name="from_account_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Kimden</FormLabel>
                  <Select
                    value={
                      typeof field.value === "string" && field.value
                        ? field.value
                        : undefined
                    }
                    onValueChange={field.onChange}
                    disabled={isPending}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Kaynak hesap seçin" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {accounts.length === 0 ? (
                        <div className="text-muted-foreground px-3 py-2 text-sm">
                          Aktif hesap yok.
                        </div>
                      ) : (
                        accounts.map((a) => (
                          <SelectItem key={a.id} value={a.id}>
                            <span className="flex items-center gap-2">
                              <span>{a.name}</span>
                              <span className="text-muted-foreground text-xs">
                                {a.currency}
                              </span>
                            </span>
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="to_account_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Kime</FormLabel>
                  <Select
                    value={
                      typeof field.value === "string" && field.value
                        ? field.value
                        : undefined
                    }
                    onValueChange={field.onChange}
                    disabled={isPending}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Hedef hesap seçin" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {toOptions.length === 0 ? (
                        <div className="text-muted-foreground px-3 py-2 text-sm">
                          Kaynaktan farklı bir hesap yok.
                        </div>
                      ) : (
                        toOptions.map((a) => (
                          <SelectItem key={a.id} value={a.id}>
                            <span className="flex items-center gap-2">
                              <span>{a.name}</span>
                              <span className="text-muted-foreground text-xs">
                                {a.currency}
                              </span>
                            </span>
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="amount"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    Tutar {fromAccount ? `(${fromAccount.currency})` : ""}
                  </FormLabel>
                  <FormControl>
                    <CurrencyInput
                      value={field.value}
                      onChange={field.onChange}
                      disabled={isPending}
                      placeholder="0,00"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {showReceivedAmount && (
              <FormField
                control={form.control}
                name="received_amount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      Alınan Tutar {toAccount ? `(${toAccount.currency})` : ""}
                    </FormLabel>
                    <FormControl>
                      <CurrencyInput
                        value={field.value}
                        onChange={field.onChange}
                        disabled={isPending}
                        placeholder="0,00"
                      />
                    </FormControl>
                    <p className="text-muted-foreground text-xs">
                      {fromAccount?.currency} → {toAccount?.currency}:
                      karşı hesaba ulaşan miktar.
                    </p>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            <FormField
              control={form.control}
              name="occurred_on"
              render={({ field }) => {
                const dateStr =
                  typeof field.value === "string" ? field.value : "";
                return (
                  <FormItem>
                    <FormLabel>Tarih</FormLabel>
                    <Popover>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button
                            type="button"
                            variant="outline"
                            disabled={isPending}
                            className={cn(
                              "w-full justify-start font-normal",
                              !dateStr && "text-muted-foreground",
                            )}
                          >
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {dateStr ? formatDate(dateStr) : "Tarih seç"}
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={dateStr ? new Date(dateStr) : undefined}
                          onSelect={(d) => d && field.onChange(toIsoDate(d))}
                          locale={tr}
                        />
                      </PopoverContent>
                    </Popover>
                    <FormMessage />
                  </FormItem>
                );
              }}
            />

            <FormField
              control={form.control}
              name="note"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Not (opsiyonel)</FormLabel>
                  <FormControl>
                    <Textarea
                      rows={2}
                      maxLength={200}
                      disabled={isPending}
                      placeholder="Kısa açıklama..."
                      name={field.name}
                      ref={field.ref}
                      onBlur={field.onBlur}
                      onChange={field.onChange}
                      value={typeof field.value === "string" ? field.value : ""}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isPending}
              >
                Vazgeç
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                {mode === "edit" ? "Kaydet" : "Oluştur"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
