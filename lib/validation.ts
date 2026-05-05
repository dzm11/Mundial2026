import { z } from "zod"

// Hasło: min. 8 znaków, ≥1 wielka, ≥1 cyfra, ≥1 znak specjalny
export const passwordSchema = z
  .string()
  .min(8, "Hasło musi mieć minimum 8 znaków")
  .regex(/[A-Z]/, "Hasło musi zawierać przynajmniej jedną wielką literę")
  .regex(/\d/, "Hasło musi zawierać przynajmniej jedną cyfrę")
  .regex(/[^A-Za-z0-9]/, "Hasło musi zawierać przynajmniej jeden znak specjalny")

export const usernameSchema = z
  .string()
  .min(3, "Login musi mieć minimum 3 znaki")
  .max(24, "Login może mieć maksymalnie 24 znaki")
  .regex(/^[a-z0-9_.-]+$/i, "Login może zawierać tylko litery, cyfry, _ . -")

export const registerSchema = z.object({
  username: usernameSchema,
  firstName: z.string().min(1, "Podaj imię").max(40),
  lastName: z.string().min(1, "Podaj nazwisko").max(60),
  password: passwordSchema,
})

export const loginSchema = z.object({
  username: usernameSchema,
  password: z.string().min(1, "Podaj hasło"),
})

export const predictionSchema = z.object({
  matchId: z.coerce.number().int().positive(),
  pred1: z.coerce.number().int().min(0).max(99),
  pred2: z.coerce.number().int().min(0).max(99),
})

// Synthetic email — Supabase Auth wymaga emaila, ale my logujemy po username.
export function usernameToEmail(username: string): string {
  return `${username.toLowerCase()}@meczyki.local`
}
