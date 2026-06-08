import { z } from "zod"

// Hasło: min. 8 znaków
export const passwordSchema = z.string().min(8, "Hasło musi mieć minimum 8 znaków")

export const usernameSchema = z
  .string()
  .min(3, "Login musi mieć minimum 3 znaki")
  .max(24, "Login może mieć maksymalnie 24 znaki")
  .regex(/^[a-z0-9_.-]+$/i, "Login może zawierać tylko litery, cyfry, _ . -")

// Imię / nazwisko (nazwa wyświetlana) — dozwolone litery (w tym polskie),
// spacje oraz . ' - . Pole opcjonalne (może być puste).
export const nameFieldSchema = z
  .string()
  .trim()
  .max(40, "Maksymalnie 40 znaków")
  .regex(/^[\p{L} .'-]*$/u, "Dozwolone tylko litery, spacje oraz . ' -")

export const profileNameSchema = z.object({
  firstName: nameFieldSchema,
  lastName: nameFieldSchema,
})

export const registerSchema = z.object({
  username: usernameSchema,
  password: passwordSchema,
  firstName: nameFieldSchema,
  lastName: nameFieldSchema,
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
