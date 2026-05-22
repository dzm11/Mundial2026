import type { MatchWithTeams } from "@/lib/types"

// Stałe faz meczu demo (czas rzeczywisty).
export const DEMO_KICKOFF_DELAY_MS = 15_000
export const DEMO_HALF1_MS = 15_000
export const DEMO_BREAK_MS = 5_000
export const DEMO_HALF2_MS = 15_000

export type MatchClock =
  | { phase: "scheduled"; msToKickoff: number }
  | { phase: "live"; minute: number }
  | { phase: "halftime" }
  | { phase: "finished" }

// Faza i minuta meczu. Mecz demo — liczone z kickoff_at + stałych faz.
// Prawdziwy mecz — z status + minute (synchronizowane z API).
export function matchClock(match: MatchWithTeams, now: number): MatchClock {
  const kickoff = new Date(match.kickoff_at).getTime()

  if (match.is_demo) {
    const elapsed = now - kickoff
    if (elapsed < 0) return { phase: "scheduled", msToKickoff: -elapsed }
    if (elapsed < DEMO_HALF1_MS) {
      return { phase: "live", minute: 1 + Math.floor((45 * elapsed) / DEMO_HALF1_MS) }
    }
    if (elapsed < DEMO_HALF1_MS + DEMO_BREAK_MS) return { phase: "halftime" }
    const half2End = DEMO_HALF1_MS + DEMO_BREAK_MS + DEMO_HALF2_MS
    if (elapsed < half2End) {
      const inHalf2 = elapsed - DEMO_HALF1_MS - DEMO_BREAK_MS
      return { phase: "live", minute: 46 + Math.floor((45 * inHalf2) / DEMO_HALF2_MS) }
    }
    return { phase: "finished" }
  }

  switch (match.status) {
    case "IN_PLAY":
      return { phase: "live", minute: match.minute ?? 0 }
    case "PAUSED":
      return { phase: "halftime" }
    case "FINISHED":
      return { phase: "finished" }
    default:
      // SCHEDULED, TIMED, POSTPONED, SUSPENDED, CANCELLED
      return { phase: "scheduled", msToKickoff: kickoff - now }
  }
}
