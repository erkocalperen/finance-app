import { z } from "zod";

export const loginSchema = z.object({
  email: z
    .string()
    .min(1, { message: "E-posta gerekli." })
    .email({ message: "Geçerli bir e-posta girin." }),
  password: z
    .string()
    .min(8, { message: "Şifre en az 8 karakter olmalı." }),
});

export type LoginInput = z.infer<typeof loginSchema>;

export const registerSchema = z
  .object({
    fullName: z
      .string()
      .trim()
      .min(2, { message: "İsim en az 2 karakter olmalı." }),
    email: z
      .string()
      .min(1, { message: "E-posta gerekli." })
      .email({ message: "Geçerli bir e-posta girin." }),
    password: z
      .string()
      .min(8, { message: "Şifre en az 8 karakter olmalı." }),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Şifreler eşleşmiyor.",
    path: ["confirmPassword"],
  });

export type RegisterInput = z.infer<typeof registerSchema>;
