"use client";

import { useEffect, useTransition } from "react";
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
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { cn } from "@/lib/utils";
import { CATEGORY_COLOR_PRESETS, ENTRY_TYPE_LABELS } from "@/lib/constants";
import {
  categorySchema,
  type CategoryInput,
} from "@/lib/validations/category";
import {
  createCategory,
  updateCategory,
} from "@/app/(dashboard)/categories/actions";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "create" | "edit";
  initial?: { id: string } & CategoryInput;
  defaultType?: CategoryInput["type"];
};

export function CategoryFormDialog({
  open,
  onOpenChange,
  mode,
  initial,
  defaultType = "expense",
}: Props) {
  const [isPending, startTransition] = useTransition();

  const form = useForm<CategoryInput>({
    resolver: zodResolver(categorySchema),
    defaultValues: initial ?? {
      name: "",
      type: defaultType,
      color: CATEGORY_COLOR_PRESETS[0],
    },
  });

  // Dialog her açıldığında formu ilgili initial değerlerle sıfırla.
  useEffect(() => {
    if (open) {
      form.reset(
        initial ?? {
          name: "",
          type: defaultType,
          color: CATEGORY_COLOR_PRESETS[0],
        },
      );
    }
  }, [open, initial, defaultType, form]);

  function onSubmit(values: CategoryInput) {
    startTransition(async () => {
      const result =
        mode === "edit" && initial
          ? await updateCategory(initial.id, values)
          : await createCategory(values);

      if (result?.error) {
        toast.error(result.error);
        return;
      }

      toast.success(
        mode === "edit" ? "Kategori güncellendi." : "Kategori oluşturuldu.",
      );
      onOpenChange(false);
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {mode === "edit" ? "Kategoriyi Düzenle" : "Yeni Kategori"}
          </DialogTitle>
          <DialogDescription>
            {mode === "edit"
              ? "Bu kategorinin bilgilerini güncelleyin."
              : "İşlemleri gruplamak için yeni bir kategori ekleyin."}
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
                      placeholder="Örn. Market"
                      disabled={isPending}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Tip</FormLabel>
                  <FormControl>
                    <RadioGroup
                      className="flex gap-6"
                      value={field.value}
                      onValueChange={field.onChange}
                      disabled={isPending}
                    >
                      <label className="flex items-center gap-2 text-sm">
                        <RadioGroupItem value="expense" />
                        {ENTRY_TYPE_LABELS.expense}
                      </label>
                      <label className="flex items-center gap-2 text-sm">
                        <RadioGroupItem value="income" />
                        {ENTRY_TYPE_LABELS.income}
                      </label>
                    </RadioGroup>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="color"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Renk</FormLabel>
                  <div className="flex flex-wrap gap-2">
                    {CATEGORY_COLOR_PRESETS.map((c) => (
                      <button
                        key={c}
                        type="button"
                        aria-label={c}
                        onClick={() => field.onChange(c)}
                        disabled={isPending}
                        className={cn(
                          "h-7 w-7 rounded-full border-2 transition",
                          field.value === c
                            ? "border-foreground"
                            : "border-transparent",
                        )}
                        style={{ backgroundColor: c }}
                      />
                    ))}
                  </div>
                  <FormControl>
                    <Input
                      placeholder="#RRGGBB"
                      disabled={isPending}
                      className="mt-2 font-mono"
                      {...field}
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
