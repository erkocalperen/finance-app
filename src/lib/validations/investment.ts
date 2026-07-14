import { z } from "zod";

import { nonnegativeWithDefault, positiveAmount } from "./coerce";

export const TRADE_SIDES = ["buy", "sell"] as const;
export type TradeSideValue = (typeof TRADE_SIDES)[number];

export const tradeSchema = z.object({
  instrument_id: z.string().uuid({ message: "Enstrüman seçin." }),
  account_id: z.string().uuid({ message: "Hesap seçin." }),
  side: z.enum(TRADE_SIDES, { message: "Al veya sat seçin." }),
  quantity: positiveAmount({
    requiredMessage: "Miktar zorunludur.",
    positiveMessage: "Miktar 0'dan büyük olmalı.",
  }),
  unit_price: positiveAmount({
    requiredMessage: "Birim fiyat zorunludur.",
    positiveMessage: "Birim fiyat 0'dan büyük olmalı.",
  }),
  fee: nonnegativeWithDefault(0),
  occurred_on: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, { message: "Geçerli bir tarih girin." }),
  note: z
    .string()
    .max(200, { message: "Not en fazla 200 karakter olabilir." })
    .optional(),
});

export type TradeInput = z.infer<typeof tradeSchema>;
export type TradeInputRaw = z.input<typeof tradeSchema>;

export const manualPriceSchema = z.object({
  instrument_id: z.string().uuid({ message: "Enstrüman gerekli." }),
  price: positiveAmount({
    requiredMessage: "Fiyat zorunludur.",
    positiveMessage: "Fiyat 0'dan büyük olmalı.",
  }),
});

export type ManualPriceInput = z.infer<typeof manualPriceSchema>;
export type ManualPriceInputRaw = z.input<typeof manualPriceSchema>;
