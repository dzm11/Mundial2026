import { describe, it, expect } from "vitest"

import {
  matchClock,
  DEMO_HALF1_MS,
  DEMO_BREAK_MS,
  DEMO_HALF2_MS,
} from "./match-clock"
import type { MatchWithTeams } from "./types"

const NOW = Date.UTC(2026, 5, 15, 12, 0, 0)

function match(overrides: Partial<MatchWithTeams>): MatchWithTeams {
  return {
    id: 1,
    external_id: null,
    stage: "GROUP",
    group_letter: "A",
    team1_id: null,
    team2_id: null,
    kickoff_at: new Date(NOW).toISOString(),
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

describe("matchClock — mecz demo", () => {
  const demo = (kickoffOffsetMs: number) =>
    match({ is_demo: true, kickoff_at: new Date(NOW - kickoffOffsetMs).toISOString() })

  it("przed kick-offem: scheduled z msToKickoff", () => {
    const c = matchClock(demo(-10_000), NOW)
    expect(c.phase).toBe("scheduled")
    if (c.phase === "scheduled") expect(c.msToKickoff).toBe(10_000)
  })

  it("1. połowa: live, minuta 1..45", () => {
    const c = matchClock(demo(1_000), NOW)
    expect(c.phase).toBe("live")
    if (c.phase === "live") {
      expect(c.minute).toBeGreaterThanOrEqual(1)
      expect(c.minute).toBeLessThanOrEqual(45)
    }
  })

  it("przerwa: halftime", () => {
    const c = matchClock(demo(DEMO_HALF1_MS + 1_000), NOW)
    expect(c.phase).toBe("halftime")
  })

  it("2. połowa: live, minuta 46..90", () => {
    const c = matchClock(demo(DEMO_HALF1_MS + DEMO_BREAK_MS + 1_000), NOW)
    expect(c.phase).toBe("live")
    if (c.phase === "live") {
      expect(c.minute).toBeGreaterThanOrEqual(46)
      expect(c.minute).toBeLessThanOrEqual(90)
    }
  })

  it("po meczu: finished", () => {
    const c = matchClock(demo(DEMO_HALF1_MS + DEMO_BREAK_MS + DEMO_HALF2_MS + 1_000), NOW)
    expect(c.phase).toBe("finished")
  })
})

describe("matchClock — prawdziwy mecz", () => {
  it("IN_PLAY → live z minutą z pola minute", () => {
    const c = matchClock(match({ status: "IN_PLAY", minute: 67 }), NOW)
    expect(c).toEqual({ phase: "live", minute: 67 })
  })

  it("PAUSED → halftime", () => {
    expect(matchClock(match({ status: "PAUSED" }), NOW).phase).toBe("halftime")
  })

  it("FINISHED → finished", () => {
    expect(matchClock(match({ status: "FINISHED" }), NOW).phase).toBe("finished")
  })

  it("SCHEDULED → scheduled", () => {
    const future = match({ status: "SCHEDULED", kickoff_at: new Date(NOW + 600_000).toISOString() })
    const c = matchClock(future, NOW)
    expect(c.phase).toBe("scheduled")
    if (c.phase === "scheduled") expect(c.msToKickoff).toBe(600_000)
  })

  it("TIMED → scheduled (status spoza IN_PLAY/PAUSED/FINISHED)", () => {
    const timed = match({ status: "TIMED", kickoff_at: new Date(NOW + 60_000).toISOString() })
    expect(matchClock(timed, NOW).phase).toBe("scheduled")
  })
})
