import { calculatePoints, type MatchOutcome, type Prediction } from "@/lib/scoring"

export const STAKE = 100

// match_id -> { "1:0": 7.5, ..., "OTHER": 60 }
export type OddsByMatch = Map<number, Record<string, number>>

export type MatchLite = {
  id: number
  status: string
  result1: number | null
  result2: number | null
}

export type PredictionLite = {
  user_id: string
  match_id: number
  pred1: number
  pred2: number
}

// Pojedynczy trafiony (dodatni) kupon — składnik dodatni bilansu.
export type WinDetail = { matchId: number; scoreline: string; odds: number; amount: number }

export type PlayerStats = {
  userId: string
  moneyBalance: number
  evaluatedBets: number
  exactHits: number
  outcomeHits: number
  scored: number
  accuracy: number
  bestWin: { matchId: number; odds: number; amount: number } | null
  // Trafione kupony (amount > 0) — pozwalają zweryfikować dodatnią część bilansu.
  wins: WinDetail[]
}

export function scorelineKey(r1: number, r2: number): string {
  return `${r1}:${r2}`
}

export function oddsForResult(
  odds: Record<string, number> | undefined,
  r1: number,
  r2: number,
): number | null {
  if (!odds) return null
  const exact = odds[scorelineKey(r1, r2)]
  if (typeof exact === "number") return exact
  const other = odds["OTHER"]
  return typeof other === "number" ? other : null
}

function isFinished(m: MatchLite): boolean {
  return m.status === "FINISHED" && m.result1 != null && m.result2 != null
}

export function computePlayerStats(
  userId: string,
  predictions: PredictionLite[],
  matchesById: Map<number, MatchLite>,
  odds: OddsByMatch,
): PlayerStats {
  let moneyBalance = 0
  let evaluatedBets = 0
  let exactHits = 0
  let outcomeHits = 0
  let scored = 0
  let bestWin: PlayerStats["bestWin"] = null
  const wins: WinDetail[] = []

  for (const p of predictions) {
    if (p.user_id !== userId) continue
    const m = matchesById.get(p.match_id)
    if (!m || !isFinished(m)) continue

    const pts = calculatePoints(m as MatchOutcome, p as Prediction)
    scored++
    if (pts === 3) exactHits++
    else if (pts === 1) outcomeHits++

    const kurs = oddsForResult(odds.get(p.match_id), m.result1!, m.result2!)
    if (kurs == null) continue // brak kursu — poza bilansem pieniężnym

    evaluatedBets++
    if (pts === 3) {
      const win = STAKE * (kurs - 1)
      moneyBalance += win
      wins.push({
        matchId: p.match_id,
        scoreline: scorelineKey(m.result1!, m.result2!),
        odds: kurs,
        amount: win,
      })
      // Ties keep the first maximum encountered (deterministic by prediction iteration order).
      if (!bestWin || win > bestWin.amount) {
        bestWin = { matchId: p.match_id, odds: kurs, amount: win }
      }
    } else {
      moneyBalance -= STAKE
    }
  }

  // Największe wygrane na górze — czytelniejsza weryfikacja.
  wins.sort((a, b) => b.amount - a.amount)
  const accuracy = scored > 0 ? (exactHits + outcomeHits) / scored : 0
  return { userId, moneyBalance, evaluatedBets, exactHits, outcomeHits, scored, accuracy, bestWin, wins }
}

export function computeAllStats(
  userIds: string[],
  predictions: PredictionLite[],
  matches: MatchLite[],
  odds: OddsByMatch,
): PlayerStats[] {
  const matchesById = new Map(matches.map((m) => [m.id, m]))
  return userIds.map((id) => computePlayerStats(id, predictions, matchesById, odds))
}

export function oddsCoverage(
  matches: MatchLite[],
  odds: OddsByMatch,
): { finished: number; withOdds: number } {
  let finished = 0
  let withOdds = 0
  for (const m of matches) {
    if (!isFinished(m)) continue
    finished++
    if (oddsForResult(odds.get(m.id), m.result1!, m.result2!) != null) withOdds++
  }
  return { finished, withOdds }
}
