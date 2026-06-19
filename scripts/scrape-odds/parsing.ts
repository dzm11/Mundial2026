// Czyste helpery scrapera OddsPortal — bez I/O, testowalne.

// Znaki, których NFD nie rozkłada (np. ł → l). Uzupełniać w razie potrzeby.
const PRECOMPOSED_MAP: Record<string, string> = {
  ł: "l", Ł: "l",
  ø: "o", Ø: "o",
  đ: "d", Đ: "d",
  ß: "ss",
}

export function normalizeTeamName(name: string): string {
  return name
    .split("")
    .map((c) => PRECOMPOSED_MAP[c] ?? c)
    .join("")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // usuń diakrytyki (combining marks)
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ")
}

// Klucz = znormalizowana nazwa z OddsPortal; wartość = znormalizowana nazwa z naszej bazy.
// Tabela uzupełniana na bieżąco podczas realnego backfilla (Task 8), gdy obserwujemy
// rzeczywiste etykiety OddsPortal i porównujemy z kluczami w lib/wc2026-teams.ts.
export const TEAM_ALIASES: Record<string, string> = {
  // OddsPortal/Flashscore używa "Korea Republic"; w bazie mamy "South Korea"
  "korea republic": "south korea",
  // OddsPortal może używać "IR Iran"; w bazie mamy "Iran"
  "ir iran": "iran",
  // "usa" zgadza się z kluczem "USA" po normalizacji — alias zbędny, usunięty
}

export function teamNameMatches(dbName: string, scrapedName: string): boolean {
  const db = normalizeTeamName(dbName)
  const scraped = normalizeTeamName(scrapedName)
  if (db === scraped) return true
  const aliased = TEAM_ALIASES[scraped]
  return aliased === db
}

export function flipScoreline(scoreline: string): string {
  if (scoreline === "OTHER") return "OTHER"
  if (!scoreline.includes(":")) return scoreline
  const [a, b] = scoreline.split(":")
  return `${b}:${a}`
}

export function parseScore(text: string): { r1: number; r2: number } | null {
  const m = text.match(/(\d+)\s*[:\-]\s*(\d+)/)
  if (!m) return null
  return { r1: Number(m[1]), r2: Number(m[2]) }
}
