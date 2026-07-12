"use client";

import { useEffect, useMemo, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CurrencyInput } from "@/components/currency-input";
import {
  ACCOUNT_TYPES,
  ACCOUNT_TYPE_LABELS,
  CURRENCIES,
  DEFAULT_CURRENCY,
  type AccountType,
  type Currency,
} from "@/lib/constants";
import {
  accountSchema,
  type AccountInput,
  type AccountInputRaw,
} from "@/lib/validations/account";
import {
  createAccount,
  updateAccount,
} from "@/app/(dashboard)/accounts/actions";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "create" | "edit";
  initial?: { id: string } & AccountInput;
};

const EMPTY: AccountInputRaw = {
  name: "",
  type: "cash",
  currency: DEFAULT_CURRENCY,
  initial_balance: "",
};

function initialToFormValues(
  init: ({ id: string } & AccountInput) | undefined,
): AccountInputRaw {
  if (!init) return EMPTY;
  return {
    name: init.name,
    type: init.type,
    currency: init.currency,
    initial_balance: String(init.initial_balance),
  };
}

export function AccountFormDialog({
  open,
  onOpenChange,
  mode,
  initial,
}: Props) {
  const [isPending, startTransition] = useTransition();

  const defaults = useMemo(() => initialToFormValues(initial), [initial]);

  const form = useForm<AccountInputRaw>({
    resolver: zodResolver(accountSchema),
    defaultValues: defaults,
  });

  useEffect(() => {
    if (open) form.reset(defaults);
  }, [open, defaults, form]);

  function onSubmit(values: AccountInputRaw) {
    startTransition(async () => {
      const result =
        mode === "edit" && initial
          ? await updateAccount(initial.id, values)
          : await createAccount(values);

      if (result?.error) {
        toast.error(result.error);
        return;
      }

      toast.success(
        mode === "edit" ? "Hesap güncellendi." : "Hesap oluşturuldu.",
      );
      onOpenChange(false);
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {mode === "edit" ? "Hesabı Düzenle" : "Yeni Hesap"}
          </DialogTitle>
          <DialogDescription>
            {mode === "edit"
              ? "Bu hesabın bilgilerini güncelleyin."
              : "Nakit, banka veya kredi kartı için bir hesap ekleyin."}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="space-y-4"
          >
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>İsim</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Örn. Vadesiz Hesap"
                      disabled={isPending}
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

            <div className="grid grid-cols-2 gap-3">
              <FormField
                control={form.control}
                name="type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tip</FormLabel>
                    <Select
                      value={
                        typeof field.value === "string"
                          ? (field.value as AccountType)
                          : "cash"
                      }
                      onValueChange={field.onChange}
                      disabled={isPending}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {ACCOUNT_TYPES.map((t) => (
                          <SelectItem key={t} value={t}>
                            {ACCOUNT_TYPE_LABELS[t]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="currency"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Para Birimi</FormLabel>
                    <Select
                      value={
                        typeof field.value === "string"
                          ? (field.value as Currency)
                          : DEFAULT_CURRENCY
                      }
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

            <FormField
              control={form.control}
              name="initial_balance"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Başlangıç Bakiyesi</FormLabel>
                  <FormControl>
                    <CurrencyInput
                      value={field.value}
                      onChange={field.onChange}
                      allowNegative
                      disabled={isPending}
                      placeholder="0,00"
                    />
                  </FormControl>
                  <p className="text-muted-foreground text-xs">
                    Kredi kartı borcu için negatif değer girebilirsiniz.
                  </p>
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
