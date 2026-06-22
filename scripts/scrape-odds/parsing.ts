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

// ── Mapowanie meczu po DACIE+GODZINIE (zamiast po nazwach drużyn) ──

// PL + EN skróty miesięcy (po lowercase + bez diakrytyków, pierwsze 3 znaki) -> numer
export const MONTHS: Record<string, number> = {
  sty: 1, lut: 2, mar: 3, kwi: 4, maj: 5, cze: 6, lip: 7, sie: 8, wrz: 9, paz: 10, lis: 11, gru: 12,
  jan: 1, feb: 2, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
}

const pad2 = (n: number) => String(n).padStart(2, "0")

// "20 Cze 2026, 03:00" / "Sobota, 20 Cze 2026, 03:00" -> "2026-06-20T03:00" (UTC, minutowo).
// Zakłada, że tekst jest w UTC (strefa przeglądarki = UTC). Zwraca null, gdy nie da się sparsować.
export function parseUtcMinute(dateText: string | null | undefined): string | null {
  if (!dateText) return null
  const m = dateText.match(/(\d{1,2})\s+([A-Za-zżźćńółęąśŻŹĆĄŚĘŁÓŃ]{3,})\s+(20\d\d)[, ]+(\d{1,2}):(\d{2})/)
  if (!m) return null
  const day = Number(m[1])
  const year = Number(m[3])
  const hh = Number(m[4])
  const mm = Number(m[5])
  const key = m[2].normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().slice(0, 3)
  const month = MONTHS[key]
  if (!month) return null
  return `${year}-${pad2(month)}-${pad2(day)}T${pad2(hh)}:${pad2(mm)}`
}

// Orientacja scoreline z wyniku końcowego: czy kolejność gospodarz:gość (OddsPortal)
// zgadza się z team1:team2 (baza). Zwraca null, gdy wynik nie pasuje w żadnej orientacji
// (czyli to NIE jest ten mecz) — służy też jako weryfikacja dopasowania.
export function orientByResult(
  resHome: number | null | undefined,
  resAway: number | null | undefined,
  result1: number | null,
  result2: number | null,
): { flip: boolean } | null {
  if (resHome == null || resAway == null || result1 == null || result2 == null) return null
  if (resHome === result1 && resAway === result2) return { flip: false }
  if (resHome === result2 && resAway === result1) return { flip: true }
  return null
}
