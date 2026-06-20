import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Minimalny kształt potrzebny do nazwy wyświetlanej / inicjałów.
type NamedUser = {
  first_name?: string | null
  last_name?: string | null
  username: string
}

// Nazwa wyświetlana: imię + nazwisko, a gdy brak — fallback na @login.
export function displayName(p: NamedUser): string {
  const full = [p.first_name, p.last_name]
    .map((s) => s?.trim() ?? "")
    .filter(Boolean)
    .join(" ")
  return full || p.username
}

// Inicjały: pierwsze litery imienia i nazwiska, a gdy brak — z loginu.
export function getInitials(p: NamedUser): string {
  const first = p.first_name?.trim()?.[0] ?? ""
  const last = p.last_name?.trim()?.[0] ?? ""
  return (first + last).toUpperCase() || p.username.slice(0, 2).toUpperCase()
}

// Formatuje kwotę w zł ze znakiem: +650 zł / −100 zł / 0 zł
export function formatPln(amount: number): string {
  const rounded = Math.round(amount)
  if (rounded === 0) return "0 zł"
  const sign = rounded > 0 ? "+" : "−"
  return `${sign}${Math.abs(rounded)} zł`
}
