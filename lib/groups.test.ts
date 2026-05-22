import { describe, it, expect } from "vitest"

import { matchInPhase, type PhaseKey } from "./groups"
import type { MatchWithTeams } from "./types"

const NOW = Date.UTC(2026, 5, 15, 12, 0, 0)
const PAST = new Date(NOW - 3_600_000).toISOString()
const FUTURE = new Date(NOW + 3_600_000).toISOString()

function match(overrides: Partial<MatchWithTeams>): MatchWithTeams {
  return {
    id: 1,
    external_id: null,
    stage: "GROUP",
    group_letter: "A",
    team1_id: null,
    team2_id: null,
    kickoff_at: FUTURE,
    status: "SCHEDULED",
    result1: null,
    result2: null,
    minute: null,
    is_demo: false,
    team1: null,
    team2: null,
    ...overrides,
  }
}

const ALL_PHASES: PhaseKey[] = ["upcoming", "GROUP", "R32", "R16", "QF", "SF", "F"]

describe("matchInPhase", () => {
  it("keeps a demo match visible in 'upcoming' even after kickoff", () => {
    const demo = match({ is_demo: true, kickoff_at: PAST, status: "FINISHED" })
    expect(matchInPhase(demo, "upcoming", NOW)).toBe(true)
  })

  it("keeps a demo match visible in every phase tab", () => {
    const demo = match({ is_demo: true, stage: "GROUP", kickoff_at: PAST })
    for (const phase of ALL_PHASES) {
      expect(matchInPhase(demo, phase, NOW)).toBe(true)
    }
  })

  it("excludes a non-demo started match from 'upcoming'", () => {
    const started = match({ is_demo: false, kickoff_at: PAST })
    expect(matchInPhase(started, "upcoming", NOW)).toBe(false)
  })

  it("includes a non-demo future match in 'upcoming'", () => {
    const upcoming = match({ is_demo: false, kickoff_at: FUTURE })
    expect(matchInPhase(upcoming, "upcoming", NOW)).toBe(true)
  })

  it("matches a non-demo match by its stage", () => {
    const qf = match({ is_demo: false, stage: "QF", kickoff_at: PAST })
    expect(matchInPhase(qf, "QF", NOW)).toBe(true)
    expect(matchInPhase(qf, "GROUP", NOW)).toBe(false)
  })
})
