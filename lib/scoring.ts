// Klasyczny system 3/1/0:
//   3 — dokładny wynik
//   1 — poprawny zwycięzca/remis
//   0 — pudło
// Zwraca 0 dla niedokończonych meczów lub niepotwierdzonych typów.

export type MatchOutcome = {
  status: string
  result1: number | null
  result2: number | null
}

export type Prediction = {
  pred1: number
  pred2: number
  confirmedAt: string | Date | null
}

export function calculatePoints(match: MatchOutcome, pred: Prediction): number {
  if (match.status !== "FINISHED") return 0
  if (match.result1 == null || match.result2 == null) return 0
  if (!pred.confirmedAt) return 0

  if (pred.pred1 === match.result1 && pred.pred2 === match.result2) return 3

  const matchSign = Math.sign(match.result1 - match.result2)
  const predSign = Math.sign(pred.pred1 - pred.pred2)
  if (matchSign === predSign) return 1

  return 0
}
