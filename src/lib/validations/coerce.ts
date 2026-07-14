import { z } from "zod";

/**
 * Form input'ları sayı değil string tutar (baştaki-0 ve silinemezlik
 * sorunlarını önlemek için). Bu preprocess:
 * - "" / null / undefined → undefined (zod "gerekli" hatası tetikler)
 * - Kısmi yazım ("-", ".", ",") → undefined
 * - "12,5" → 12.5 (TR ondalık ayracı desteği)
 * - Zaten number ise olduğu gibi geçer
 */
const parseNumericInput = (val: unknown): unknown => {
  if (val === "" || val === null || val === undefined) return undefined;
  if (typeof val === "number") return val;
  if (typeof val === "string") {
    const cleaned = val.trim().replace(",", ".");
    if (cleaned === "" || cleaned === "-" || cleaned === ".") return undefined;
    const n = Number(cleaned);
    return Number.isFinite(n) ? n : val;
  }
  return val;
};

/** Pozitif, sonlu bir tutar. Boş girişte "gerekli" hatası verir. */
export function positiveAmount(opts: {
  requiredMessage: string;
  positiveMessage: string;
}) {
  return z.preprocess(
    parseNumericInput,
    z
      .number({ message: opts.requiredMessage })
      .finite({ message: "Geçerli bir tutar girin." })
      .positive({ message: opts.positiveMessage }),
  );
}

/** Sonlu bir tutar; negatif olabilir (ör. kredi kartı borcu). */
export function finiteAmount(opts: { requiredMessage: string }) {
  return z.preprocess(
    parseNumericInput,
    z
      .number({ message: opts.requiredMessage })
      .finite({ message: "Geçerli bir tutar girin." }),
  );
}

/** Opsiyonel pozitif tutar (fx_rate gibi koşullu alanlar için). */
export function optionalPositiveAmount() {
  return z.preprocess(
    parseNumericInput,
    z.number().finite().positive().optional(),
  );
}

/**
 * Negatif olmayan tutar; boş giriş default'a düşer (komisyon/masraf gibi).
 * Boş bırakıldığında hata yerine 0 kabul edilir.
 */
export function nonnegativeWithDefault(defaultValue = 0) {
  return z.preprocess(
    (val) => {
      const parsed = parseNumericInput(val);
      return parsed === undefined ? defaultValue : parsed;
    },
    z
      .number({ message: "Geçerli bir tutar girin." })
      .finite({ message: "Geçerli bir tutar girin." })
      .nonnegative({ message: "Negatif olamaz." }),
  );
}
