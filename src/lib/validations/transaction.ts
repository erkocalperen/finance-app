import { z } from "zod";

import { CURRENCIES, ENTRY_TYPES, type Currency } from "@/lib/constants";
import { optionalPositiveAmount, positiveAmount } from "./coerce";

// Şema factory: fx_rate refine'i kullanıcının base_currency'sine bağlı.
// Hem client (form) hem server (action) aynı factory'yi çağırır.
export function makeTransactionSchema(baseCurrency: Currency) {
  return z
    .object({
      type: z.enum(ENTRY_TYPES, { message: "Tip seçin." }),
      account_id: z.string().uuid({ message: "Hesap seçin." }),
      category_id: z.string().uuid({ message: "Kategori seçin." }),
      amount: positiveAmount({
        requiredMessage: "Tutar zorunludur.",
        positiveMessage: "Tutar 0'dan büyük olmalı.",
      }),
      currency: z.enum(CURRENCIES, { message: "Para birimini seçin." }),
      // Kur opsiyonel — same-currency durumunda form gizler, submit'te
      // server 1 olarak yollar. superRefine farklı currency'de zorunlu kılar.
      fx_rate: optionalPositiveAmount(),
      occurred_on: z
        .string()
        .regex(/^\d{4}-\d{2}-\d{2}$/, { message: "Geçerli bir tarih girin." }),
      note: z
        .string()
        .max(200, { message: "Not en fazla 200 karakter olabilir." })
        .optional(),
    })
    .superRefine((data, ctx) => {
      if (data.currency === baseCurrency) {
        if (data.fx_rate !== undefined && data.fx_rate !== 1) {
          ctx.addIssue({
            code: "custom",
            path: ["fx_rate"],
            message: "Aynı para birimi için kur 1 olmalı.",
          });
        }
      } else if (data.fx_rate === undefined) {
        ctx.addIssue({
          code: "custom",
          path: ["fx_rate"],
          message: "Kur zorunludur.",
        });
      }
    });
}

/** Sunucuya gönderdikten sonraki parse edilmiş şekil (server tarafında kullanılır). */
export type TransactionInput = z.infer<
  ReturnType<typeof makeTransactionSchema>
>;

/**
 * Form state'inin şekli — amount / fx_rate string veya undefined olabilir.
 * defaultValues bu tipi kullanır; safeParse client ve server'da preprocess'ler.
 */
export type TransactionInputRaw = z.input<
  ReturnType<typeof makeTransactionSchema>
>;
