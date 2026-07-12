import { z } from "zod";

import { ACCOUNT_TYPES, CURRENCIES } from "@/lib/constants";

export const accountSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, { message: "İsim gerekli." })
    .max(50, { message: "İsim en fazla 50 karakter olabilir." }),
  type: z.enum(ACCOUNT_TYPES, { message: "Hesap tipini seçin." }),
  currency: z.enum(CURRENCIES, { message: "Para birimini seçin." }),
  // Kredi kartı borcu için negatif olabilir.
  initial_balance: z
    .number({ message: "Bakiye sayısal olmalı." })
    .finite({ message: "Geçerli bir bakiye girin." }),
});

export type AccountInput = z.infer<typeof accountSchema>;
