import { z } from "zod";

import { positiveAmount } from "./coerce";

export const transferSchema = z
  .object({
    from_account_id: z
      .string()
      .uuid({ message: "Kimden hesabını seçin." }),
    to_account_id: z
      .string()
      .uuid({ message: "Kime hesabını seçin." }),
    amount: positiveAmount({
      requiredMessage: "Tutar zorunludur.",
      positiveMessage: "Tutar 0'dan büyük olmalı.",
    }),
    received_amount: positiveAmount({
      requiredMessage: "Alınan tutar zorunludur.",
      positiveMessage: "Alınan tutar 0'dan büyük olmalı.",
    }),
    occurred_on: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, { message: "Geçerli bir tarih girin." }),
    note: z
      .string()
      .max(200, { message: "Not en fazla 200 karakter olabilir." })
      .optional(),
    counts_as_expense: z.boolean().optional().default(false),
  })
  .refine((d) => d.from_account_id !== d.to_account_id, {
    message: "Kimden ve kime hesapları farklı olmalı.",
    path: ["to_account_id"],
  });

export type TransferInput = z.infer<typeof transferSchema>;
export type TransferInputRaw = z.input<typeof transferSchema>;
