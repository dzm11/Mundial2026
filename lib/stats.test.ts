import { describe, it, expect } from "vitest"
import {
  STAKE,
  scorelineKey,
  oddsForResult,
  computePlayerStats,
  computeAllStats,
  oddsCoverage,
  type MatchLite,
  type PredictionLite,
  type OddsByMatch,
} from "./stats"

const finished = (id: number, r1: number, r2: number): MatchLite => ({
  id,
  status: "FINISHED",
  result1: r1,
  result2: r2,
})

const pred = (user: string, match: number, p1: number, p2: number): PredictionLite => ({
  user_id: user,
  match_id: match,
  pred1: p1,
  pred2: p2,
})

describe("scorelineKey / oddsForResult", () => {
  it("buduje klucz wyniku", () => {
    expect(scorelineKey(1, 0)).toBe("1:0")
  })

  it("zwraca kurs dokładnego wyniku", () => {
    expect(oddsForResult({ "1:0": 7.5 }, 1, 0)).toBe(7.5)
  })

  it("spada na OTHER, gdy brak dokładnego wyniku", () => {
    expect(oddsForResult({ "1:0": 7.5, OTHER: 60 }, 4, 3)).toBe(60)
  })

  it("zwraca null, gdy nic nie pasuje", () => {
    expect(oddsForResult({ "1:0": 7.5 }, 4, 3)).toBeNull()
    expect(oddsForResult(undefined, 1, 0)).toBeNull()
  })
})

describe("computePlayerStats — bilans", () => {
  const matches = [finished(1, 1, 0), finished(2, 2, 1), finished(3, 0, 0)]
  const matchesById = new Map(matches.map((m) => [m.id, m]))

  it("trafiony dokładny wynik daje +100*(kurs-1) netto", () => {
    const odds: OddsByMatch = new Map([[1, { "1:0": 7.5 }]])
    const s = computePlayerStats("u", [pred("u", 1, 1, 0)], matchesById, odds)
    expect(s.moneyBalance).toBeCloseTo(650)
    expect(s.exactHits).toBe(1)
    expect(s.evaluatedBets).toBe(1)
    expect(s.bestWin).toEqual({ matchId: 1, odds: 7.5, amount: 650 })
  })

  it("trafiony tylko zwykły wynik daje -100 w kasie", () => {
    // pred 2:1 vs finished 1:1 → outcome MISS (home win vs draw), money −100
    // Actually: pred("u", 1, 2, 1) vs finished(1, 1, 0) → home win in both → outcomeHit=1, exactHit=0
    const odds: OddsByMatch = new Map([[1, { "1:0": 7.5, "2:1": 9 }]])
    const s = computePlayerStats("u", [pred("u", 1, 2, 1)], matchesById, odds)
    expect(s.moneyBalance).toBeCloseTo(-100)
    expect(s.exactHits).toBe(0)
    expect(s.outcomeHits).toBe(1)
    expect(s.evaluatedBets).toBe(1)
    expect(s.bestWin).toBeNull()
  })

  it("zwykłe trafienie (1 pkt) liczy się jako -100 w kasie, ale jako outcomeHit", () => {
    // mecz 2 = 2:1, typ 3:0 -> ten sam znak (gosp. wygrywa) = 1 pkt, ale nie dokładny
    const odds: OddsByMatch = new Map([[2, { "2:1": 9 }]])
    const s = computePlayerStats("u", [pred("u", 2, 3, 0)], matchesById, odds)
    expect(s.outcomeHits).toBe(1)
    expect(s.exactHits).toBe(0)
    expect(s.moneyBalance).toBeCloseTo(-100)
  })

  it("używa kursu OTHER dla rzadkiego trafionego wyniku", () => {
    const m = new Map([[9, finished(9, 4, 3)]])
    const odds: OddsByMatch = new Map([[9, { OTHER: 60 }]])
    const s = computePlayerStats("u", [pred("u", 9, 4, 3)], m, odds)
    expect(s.moneyBalance).toBeCloseTo(5900)
  })

  it("mecz bez kursu nie wchodzi do bilansu, ale liczy się do trafień/scored", () => {
    const odds: OddsByMatch = new Map() // brak kursów
    const s = computePlayerStats("u", [pred("u", 1, 1, 0)], matchesById, odds)
    expect(s.moneyBalance).toBe(0)
    expect(s.evaluatedBets).toBe(0)
    expect(s.exactHits).toBe(1)
    expect(s.scored).toBe(1)
  })

  it("ignoruje mecze bez typu gracza i mecze niezakończone", () => {
    const m = new Map<number, MatchLite>([
      [1, finished(1, 1, 0)],
      [5, { id: 5, status: "IN_PLAY", result1: 1, result2: 1 }],
    ])
    const odds: OddsByMatch = new Map([[1, { "1:0": 7.5 }]])
    // typ tylko na mecz 5 (niezakończony) -> nic nie liczone
    const s = computePlayerStats("u", [pred("u", 5, 1, 1)], m, odds)
    expect(s.scored).toBe(0)
    expect(s.moneyBalance).toBe(0)
  })

  it("accuracy = 0 gdy brak ocenionych meczów", () => {
    const odds: OddsByMatch = new Map()
    const s = computePlayerStats("u", [], matchesById, odds)
    expect(s.scored).toBe(0)
    expect(s.accuracy).toBe(0)
  })

  it("accuracy = (dokładne+zwykłe)/scored", () => {
    const odds: OddsByMatch = new Map()
    const preds = [pred("u", 1, 1, 0), pred("u", 2, 5, 0), pred("u", 3, 1, 0)]
    // m1 1:0 typ 1:0 -> dokładny; m2 2:1 typ 5:0 -> zwykły; m3 0:0 typ 1:0 -> pudło (remis vs gosp.wygrana)
    const s = computePlayerStats("u", preds, matchesById, odds)
    expect(s.scored).toBe(3)
    expect(s.exactHits).toBe(1)
    expect(s.outcomeHits).toBe(1)
    expect(s.accuracy).toBeCloseTo(2 / 3)
  })
})

describe("computeAllStats", () => {
  it("liczy statystyki dla wielu graczy", () => {
    const matches = [finished(1, 1, 0)]
    const odds: OddsByMatch = new Map([[1, { "1:0": 7.5 }]])
    const preds = [pred("a", 1, 1, 0), pred("b", 1, 0, 1)]
    const all = computeAllStats(["a", "b"], preds, matches, odds)
    expect(all.find((s) => s.userId === "a")!.moneyBalance).toBeCloseTo(650)
    expect(all.find((s) => s.userId === "b")!.moneyBalance).toBeCloseTo(-100)
  })
})

describe("oddsCoverage", () => {
  it("liczy zakończone mecze i te z kursem padłego wyniku", () => {
    const matches = [finished(1, 1, 0), finished(2, 2, 2), { id: 3, status: "SCHEDULED", result1: null, result2: null }]
    const odds: OddsByMatch = new Map([[1, { "1:0": 7.5 }]]) // mecz 2 bez kursu
    expect(oddsCoverage(matches, odds)).toEqual({ finished: 2, withOdds: 1 })
  })
})

describe("STAKE", () => {
  it("wynosi 100", () => {
    expect(STAKE).toBe(100)
  })
})
