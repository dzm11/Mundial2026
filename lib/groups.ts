// Pomocnicze funkcje grupujące mecze do widoku tabeli.

export const STAGE_LABELS: Record<string, string> = {
  GROUP: "Faza grupowa",
  R32: "1/16 finału",
  R16: "1/8 finału",
  QF: "Ćwierćfinały",
  SF: "Półfinały",
  "3RD": "Mecz o 3. miejsce",
  F: "Finał",
}

export const STAGE_ORDER = ["GROUP", "R32", "R16", "QF", "SF", "3RD", "F"] as const

export function stageHeader(stage: string, groupLetter?: string | null) {
  if (stage === "GROUP" && groupLetter) return `Grupa ${groupLetter}`
  return STAGE_LABELS[stage] ?? stage
}
