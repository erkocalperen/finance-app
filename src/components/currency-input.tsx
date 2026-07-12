"use client";

import * as React from "react";

import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type BaseInputProps = Omit<
  React.ComponentProps<"input">,
  "value" | "onChange" | "type"
>;

type Props = BaseInputProps & {
  value: unknown;
  onChange: (value: string) => void;
  /** Kredi kartı borcu gibi durumlar için "-" başlangıcı serbest bırakır. */
  allowNegative?: boolean;
};

/**
 * Ondalık sayı girişi için ortak bileşen. Ana amacı:
 * - Form state'i sayı değil string tutmak (baştaki-0 sorunu yok, silinebilir).
 * - Sadece geçerli ondalık formatı yazılmasına izin vermek (regex filtresi).
 * - TR locale'de virgül kullanımını kabul etmek — zod tarafında noktaya çevrilir.
 *
 * type="text" + inputMode="decimal" seçimi bilinçli: browser'ın leading-zero
 * ve locale kaprisleri devre dışı, tam kontrol bizde.
 */
export function CurrencyInput({
  value,
  onChange,
  allowNegative = false,
  className,
  ...rest
}: Props) {
  const strValue =
    value == null
      ? ""
      : typeof value === "string"
        ? value
        : String(value);

  // Leading-zero engelli. Kabul: "", "-", "0", "0.", "0.5", "10", "10.25".
  // Reddedilen: "05", "abc", "1.2.3".
  const pattern = allowNegative
    ? /^-?(0|[1-9]\d*)?([.,]\d*)?$/
    : /^(0|[1-9]\d*)?([.,]\d*)?$/;

  return (
    <Input
      {...rest}
      type="text"
      inputMode="decimal"
      value={strValue}
      onChange={(e) => {
        const next = e.target.value;
        if (next === "" || pattern.test(next)) {
          onChange(next);
        }
      }}
      className={cn("tabular-nums", className)}
    />
  );
}
