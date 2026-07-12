import { z } from "zod";

import { CURRENCIES, ENTRY_TYPES, type Currency } from "@/lib/constants";

// Şema factory: fx_rate refine'i kullanıcının base_currency'sine bağlı.
// Hem client (form) hem server (action) aynı factory'yi çağırır.
export function makeTransactionSchema(baseCurrency: Currency) {
  return z
    .object({
      type: z.enum(ENTRY_TYPES, { message: "Tip seçin." }),
      account_id: z
        .string()
        .uuid({ message: "Hesap seçin." }),
      category_id: z
        .string()
        .uuid({ message: "Kategori seçin." }),
      amount: z
        .number({ message: "Tutar gerekli." })
        .positive({ message: "Tutar 0'dan büyük olmalı." })
        .finite({ message: "Geçerli bir tutar girin." }),
      currency: z.enum(CURRENCIES, { message: "Para birimini seçin." }),
      fx_rate: z
        .number({ message: "Kur gerekli." })
        .positive({ message: "Kur 0'dan büyük olmalı." })
        .finite({ message: "Geçerli bir kur girin." }),
      occurred_on: z
        .string()
        .regex(/^\d{4}-\d{2}-\d{2}$/, { message: "Geçerli bir tarih girin." }),
      note: z
        .string()
        .max(200, { message: "Not en fazla 200 karakter olabilir." })
        .optional(),
    })
    .superRefine((data, ctx) => {
      // Base currency ile aynıysa fx_rate 1 olmak zorunda.
      // Farklıysa kur > 0 (schema'da zaten var), bu case'de sadece 1
      // olmadığını enforce ederiz.
      if (data.currency === baseCurrency && data.fx_rate !== 1) {
        ctx.addIssue({
          code: "custom",
          path: ["fx_rate"],
          message: "Aynı para birimi için kur 1 olmalı.",
        });
      }
    });
}

export type TransactionInput = z.infer<
  ReturnType<typeof makeTransactionSchema>
>;
