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
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@/components/ui/toggle-group";
import { CurrencyInput } from "@/components/currency-input";
import type { Currency } from "@/lib/constants";
import { formatCurrency, formatDate, toIsoDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { InstrumentKind, TradeSide } from "@/types/database-investments";
import {
  tradeSchema,
  type TradeInput,
  type TradeInputRaw,
} from "@/lib/validations/investment";
import {
  createTrade,
  updateTrade,
} from "@/app/(dashboard)/investments/actions";

export type TradeInstrumentOption = {
  id: string;
  symbol: string;
  name: string;
  kind: InstrumentKind;
  unit: string;
  currency: Currency;
};

export type TradeAccountOption = {
  id: string;
  name: string;
  currency: Currency;
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "create" | "edit";
  initial?: { id: string } & TradeInput;
  instruments: TradeInstrumentOption[];
  accounts: TradeAccountOption[];
};

function emptyFormValues(): TradeInputRaw {
  return {
    instrument_id: "",
    account_id: "",
    side: "buy",
    quantity: "",
    unit_price: "",
    fee: "",
    occurred_on: toIsoDate(new Date()),
    note: "",
  };
}

function initialToFormValues(
  init: ({ id: string } & TradeInput) | undefined,
): TradeInputRaw {
  if (!init) return emptyFormValues();
  return {
    instrument_id: init.instrument_id,
    account_id: init.account_id,
    side: init.side,
    quantity: String(init.quantity),
    unit_price: String(init.unit_price),
    fee: String(init.fee),
    occurred_on: init.occurred_on,
    note: init.note ?? "",
  };
}

function parseNumber(v: unknown): number {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const cleaned = v.trim().replace(",", ".");
    const n = Number(cleaned);
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}

const KIND_ORDER: InstrumentKind[] = ["gold", "silver", "stock"];
const KIND_LABEL: Record<InstrumentKind, string> = {
  gold: "Altın",
  silver: "Gümüş",
  stock: "Hisse",
};

export function TradeFormDialog({
  open,
  onOpenChange,
  mode,
  initial,
  instruments,
  accounts,
}: Props) {
  const [isPending, startTransition] = useTransition();

  const defaults = useMemo(() => initialToFormValues(initial), [initial]);

  const form = useForm<TradeInputRaw>({
    resolver: zodResolver(tradeSchema),
    defaultValues: defaults,
  });

  useEffect(() => {
    if (open) form.reset(defaults);
  }, [open, defaults, form]);

  const side = form.watch("side") as TradeSide;
  const instrumentId = form.watch("instrument_id");
  const quantity = form.watch("quantity");
  const unitPrice = form.watch("unit_price");
  const fee = form.watch("fee");

  const selectedInstrument = useMemo(
    () =>
      typeof instrumentId === "string"
        ? instruments.find((i) => i.id === instrumentId)
        : undefined,
    [instrumentId, instruments],
  );

  const groupedInstruments = useMemo(() => {
    const groups = new Map<InstrumentKind, TradeInstrumentOption[]>();
    for (const i of instruments) {
      const list = groups.get(i.kind) ?? [];
      list.push(i);
      groups.set(i.kind, list);
    }
    for (const list of groups.values()) {
      list.sort((a, b) => a.name.localeCompare(b.name, "tr"));
    }
    return KIND_ORDER.filter((k) => groups.has(k)).map((k) => ({
      kind: k,
      items: groups.get(k) ?? [],
    }));
  }, [instruments]);

  // Instrument seçilince hesap listesini o currency ile uyumlu olanlara daralt.
  const matchingAccounts = useMemo(() => {
    if (!selectedInstrument) return accounts;
    return accounts.filter((a) => a.currency === selectedInstrument.currency);
  }, [accounts, selectedInstrument]);

  // Enstrüman değişince, mevcut hesap uyuşmuyorsa sıfırla.
  useEffect(() => {
    if (!open || !selectedInstrument) return;
    const currentAccId = form.getValues("account_id");
    if (!currentAccId) return;
    const acc = accounts.find((a) => a.id === currentAccId);
    if (acc && acc.currency !== selectedInstrument.currency) {
      form.setValue("account_id", "", { shouldValidate: false });
    }
  }, [selectedInstrument, accounts, form, open]);

  const qty = parseNumber(quantity);
  const price = parseNumber(unitPrice);
  const feeNum = parseNumber(fee);
  const gross = qty * price;
  const total = side === "buy" ? gross + feeNum : gross - feeNum;
  const canPreview =
    selectedInstrument != null && qty > 0 && price > 0;

  function onSubmit(values: TradeInputRaw) {
    startTransition(async () => {
      const result =
        mode === "edit" && initial
          ? await updateTrade(initial.id, values)
          : await createTrade(values);

      if (result?.error) {
        toast.error(result.error);
        return;
      }
      toast.success(
        mode === "edit"
          ? "Yatırım işlemi güncellendi."
          : "Yatırım işlemi eklendi.",
      );
      onOpenChange(false);
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {mode === "edit" ? "Yatırım İşlemini Düzenle" : "Yeni Yatırım İşlemi"}
          </DialogTitle>
          <DialogDescription>
            Alım nakiti azaltır, satış artırır. Gelir/gider raporlarına
            dahil olmaz.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="space-y-4"
          >
            <FormField
              control={form.control}
              name="side"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="sr-only">Yön</FormLabel>
                  <FormControl>
                    <ToggleGroup
                      type="single"
                      variant="outline"
                      value={typeof field.value === "string" ? field.value : ""}
                      onValueChange={(v) => v && field.onChange(v)}
                      className="w-full"
                    >
                      <ToggleGroupItem value="buy" className="flex-1">
                        Al
                      </ToggleGroupItem>
                      <ToggleGroupItem value="sell" className="flex-1">
                        Sat
                      </ToggleGroupItem>
                    </ToggleGroup>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="instrument_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Enstrüman</FormLabel>
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
                        <SelectValue placeholder="Enstrüman seçin" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {groupedInstruments.map((group) => (
                        <SelectGroup key={group.kind}>
                          <SelectLabel>{KIND_LABEL[group.kind]}</SelectLabel>
                          {group.items.map((i) => (
                            <SelectItem key={i.id} value={i.id}>
                              <span className="flex items-center gap-2">
                                <span>{i.name}</span>
                                <span className="text-muted-foreground text-xs">
                                  {i.symbol}
                                </span>
                              </span>
                            </SelectItem>
                          ))}
                        </SelectGroup>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-3">
              <FormField
                control={form.control}
                name="quantity"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      Miktar {selectedInstrument ? `(${selectedInstrument.unit})` : ""}
                    </FormLabel>
                    <FormControl>
                      <CurrencyInput
                        value={field.value}
                        onChange={field.onChange}
                        disabled={isPending}
                        placeholder="0"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="unit_price"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      Birim Fiyat {selectedInstrument ? `(${selectedInstrument.currency})` : ""}
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
            </div>

            <FormField
              control={form.control}
              name="fee"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Komisyon (opsiyonel)</FormLabel>
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

            <FormField
              control={form.control}
              name="account_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Hesap</FormLabel>
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
                        <SelectValue
                          placeholder={
                            selectedInstrument
                              ? `${selectedInstrument.currency} hesabı seçin`
                              : "Önce enstrüman seçin"
                          }
                        />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {matchingAccounts.length === 0 ? (
                        <div className="text-muted-foreground px-3 py-2 text-sm">
                          {selectedInstrument
                            ? `${selectedInstrument.currency} para biriminde aktif hesap yok.`
                            : "Enstrüman seçildikten sonra hesap listelenir."}
                        </div>
                      ) : (
                        matchingAccounts.map((a) => (
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

            {canPreview && selectedInstrument && (
              <div className="bg-muted/50 rounded-md border p-3 text-sm">
                <div className="text-muted-foreground text-xs">
                  {side === "buy" ? "Toplam maliyet" : "Net gelen"}
                </div>
                <div className="mt-1 tabular-nums">
                  {new Intl.NumberFormat("tr-TR", {
                    maximumFractionDigits: 6,
                  }).format(qty)}{" "}
                  {selectedInstrument.unit} ×{" "}
                  {formatCurrency(price, selectedInstrument.currency)}
                  {feeNum > 0 && (
                    <>
                      {" "}
                      {side === "buy" ? "+" : "−"}{" "}
                      {formatCurrency(feeNum, selectedInstrument.currency)}{" "}
                      masraf
                    </>
                  )}{" "}
                  ={" "}
                  <span className="font-semibold">
                    {formatCurrency(total, selectedInstrument.currency)}
                  </span>
                </div>
              </div>
            )}

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
                {mode === "edit" ? "Kaydet" : "Ekle"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
