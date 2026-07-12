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
import { Input } from "@/components/ui/input";
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
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@/components/ui/toggle-group";
import {
  CURRENCIES,
  type Currency,
  type EntryType,
} from "@/lib/constants";
import { formatDate, toIsoDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import {
  makeTransactionSchema,
  type TransactionInput,
} from "@/lib/validations/transaction";
import {
  createTransaction,
  updateTransaction,
} from "@/app/(dashboard)/transactions/actions";

export type FormAccountOption = {
  id: string;
  name: string;
  currency: Currency;
};

export type FormCategoryOption = {
  id: string;
  name: string;
  type: EntryType;
  color: string;
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "create" | "edit";
  initial?: { id: string } & TransactionInput;
  accounts: FormAccountOption[]; // parent yalnızca arşivsizleri gönderir
  categories: FormCategoryOption[];
  baseCurrency: Currency;
};

function makeEmpty(baseCurrency: Currency): TransactionInput {
  return {
    type: "expense",
    account_id: "",
    category_id: "",
    amount: 0,
    currency: baseCurrency,
    fx_rate: 1,
    occurred_on: toIsoDate(new Date()),
    note: "",
  };
}

export function TransactionFormDialog({
  open,
  onOpenChange,
  mode,
  initial,
  accounts,
  categories,
  baseCurrency,
}: Props) {
  const [isPending, startTransition] = useTransition();

  const schema = useMemo(
    () => makeTransactionSchema(baseCurrency),
    [baseCurrency],
  );
  const empty = useMemo(() => makeEmpty(baseCurrency), [baseCurrency]);

  const form = useForm<TransactionInput>({
    resolver: zodResolver(schema),
    defaultValues: initial ?? empty,
  });

  useEffect(() => {
    if (open) form.reset(initial ?? empty);
  }, [open, initial, empty, form]);

  const type = form.watch("type");
  const currency = form.watch("currency");
  const showFxRate = currency !== baseCurrency;

  const filteredCategories = useMemo(
    () =>
      categories
        .filter((c) => c.type === type)
        .sort((a, b) => a.name.localeCompare(b.name, "tr")),
    [categories, type],
  );

  // Tip değişince mevcut kategori artık uyuşmuyorsa temizle.
  useEffect(() => {
    if (!open) return;
    const current = form.getValues("category_id");
    if (!current) return;
    const cat = categories.find((c) => c.id === current);
    if (cat && cat.type !== type) {
      form.setValue("category_id", "", { shouldValidate: false });
    }
  }, [type, categories, form, open]);

  function onSubmit(values: TransactionInput) {
    // Kullanıcı fx_rate'i görmediğinde bile 1 gitmesini garantile.
    const payload =
      values.currency === baseCurrency
        ? { ...values, fx_rate: 1 }
        : values;

    startTransition(async () => {
      const result =
        mode === "edit" && initial
          ? await updateTransaction(initial.id, payload)
          : await createTransaction(payload);

      if (result?.error) {
        toast.error(result.error);
        return;
      }
      toast.success(
        mode === "edit" ? "İşlem güncellendi." : "İşlem eklendi.",
      );
      onOpenChange(false);
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {mode === "edit" ? "İşlemi Düzenle" : "Yeni İşlem"}
          </DialogTitle>
          <DialogDescription>
            {mode === "edit"
              ? "Bu işlemin bilgilerini güncelleyin."
              : "Bir gelir veya gider hareketi ekleyin."}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="space-y-4"
          >
            <FormField
              control={form.control}
              name="type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="sr-only">Tip</FormLabel>
                  <FormControl>
                    <ToggleGroup
                      type="single"
                      variant="outline"
                      value={field.value}
                      onValueChange={(v) => v && field.onChange(v)}
                      className="w-full"
                    >
                      <ToggleGroupItem value="expense" className="flex-1">
                        Gider
                      </ToggleGroupItem>
                      <ToggleGroupItem value="income" className="flex-1">
                        Gelir
                      </ToggleGroupItem>
                    </ToggleGroup>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-[1fr_7rem] gap-2">
              <FormField
                control={form.control}
                name="amount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tutar</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        inputMode="decimal"
                        disabled={isPending}
                        value={
                          Number.isFinite(field.value) && field.value !== 0
                            ? field.value
                            : field.value === 0
                              ? 0
                              : ""
                        }
                        onChange={(e) => {
                          const v = e.target.valueAsNumber;
                          field.onChange(Number.isFinite(v) ? v : 0);
                        }}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="currency"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Birim</FormLabel>
                    <Select
                      value={field.value}
                      onValueChange={field.onChange}
                      disabled={isPending}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {CURRENCIES.map((c) => (
                          <SelectItem key={c} value={c}>
                            {c}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {showFxRate && (
              <FormField
                control={form.control}
                name="fx_rate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Kur</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="0.000001"
                        min="0"
                        inputMode="decimal"
                        disabled={isPending}
                        value={
                          Number.isFinite(field.value) ? field.value : ""
                        }
                        onChange={(e) => {
                          const v = e.target.valueAsNumber;
                          field.onChange(Number.isFinite(v) ? v : 0);
                        }}
                      />
                    </FormControl>
                    <p className="text-muted-foreground text-xs">
                      1 {currency} = ? {baseCurrency} (işlem anındaki kur)
                    </p>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            <FormField
              control={form.control}
              name="account_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Hesap</FormLabel>
                  <Select
                    value={field.value || undefined}
                    onValueChange={field.onChange}
                    disabled={isPending}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Hesap seçin" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {accounts.length === 0 ? (
                        <div className="text-muted-foreground px-3 py-2 text-sm">
                          Önce bir hesap ekleyin.
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
              name="category_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Kategori</FormLabel>
                  <Select
                    value={field.value || undefined}
                    onValueChange={field.onChange}
                    disabled={isPending}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Kategori seçin" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {filteredCategories.length === 0 ? (
                        <div className="text-muted-foreground px-3 py-2 text-sm">
                          Bu tipte kategori yok.
                        </div>
                      ) : (
                        filteredCategories.map((c) => (
                          <SelectItem key={c.id} value={c.id}>
                            <span className="flex items-center gap-2">
                              <span
                                aria-hidden
                                className="h-2.5 w-2.5 rounded-full"
                                style={{ backgroundColor: c.color }}
                              />
                              {c.name}
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
              render={({ field }) => (
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
                            !field.value && "text-muted-foreground",
                          )}
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {field.value ? formatDate(field.value) : "Tarih seç"}
                        </Button>
                      </FormControl>
                    </PopoverTrigger>
                    <PopoverContent
                      className="w-auto p-0"
                      align="start"
                    >
                      <Calendar
                        mode="single"
                        selected={
                          field.value ? new Date(field.value) : undefined
                        }
                        onSelect={(d) => d && field.onChange(toIsoDate(d))}
                        locale={tr}
                      />
                    </PopoverContent>
                  </Popover>
                  <FormMessage />
                </FormItem>
              )}
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
                      {...field}
                      value={field.value ?? ""}
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
                {mode === "edit" ? "Kaydet" : "Ekle"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
