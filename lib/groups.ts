// Pomocnicze funkcje grupujące mecze do widoku tabeli.

import type { MatchWithTeams } from "@/lib/types"

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

export type PhaseKey = "upcoming" | "GROUP" | "R32" | "R16" | "QF" | "SF" | "F"

export const PHASE_TABS: { key: PhaseKey; label: string }[] = [
  { key: "upcoming", label: "Nadchodzące" },
  { key: "GROUP", label: "Grupy" },
  { key: "R32", label: "1/16" },
  { key: "R16", label: "1/8" },
  { key: "QF", label: "ĆF" },
  { key: "SF", label: "PF" },
  { key: "F", label: "Finał" },
]

// Etykieta krótka fazy na kartach/wierszach.
export function shortStage(stage: string, groupLetter: string | null): string {
  if (stage === "GROUP") return `Grupa ${groupLetter ?? "?"}`
  if (stage === "R32") return "1/16 finału"
  if (stage === "R16") return "1/8 finału"
  if (stage === "QF") return "Ćwierćfinał"
  if (stage === "SF") return "Półfinał"
  if (stage === "3RD") return "Mecz o 3. miejsce"
  if (stage === "F") return "Finał"
  return stage
}

// Czy mecz należy do wybranej fazy. "Finał" zawiera też mecz o 3. miejsce.
// "upcoming" = mecz jeszcze się nie rozpoczął.
export function matchInPhase(match: MatchWithTeams, phase: PhaseKey, now: number): boolean {
  if (phase === "upcoming") return new Date(match.kickoff_at).getTime() > now
  if (phase === "F") return match.stage === "F" || match.stage === "3RD"
  return match.stage === phase
}
