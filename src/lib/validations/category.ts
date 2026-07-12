import { z } from "zod";

import { ENTRY_TYPES, HEX_COLOR_REGEX } from "@/lib/constants";

export const categorySchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, { message: "İsim gerekli." })
    .max(50, { message: "İsim en fazla 50 karakter olabilir." }),
  type: z.enum(ENTRY_TYPES, { message: "Kategori tipini seçin." }),
  color: z
    .string()
    .regex(HEX_COLOR_REGEX, { message: "Geçerli bir renk seçin." }),
});

export type CategoryInput = z.infer<typeof categorySchema>;
