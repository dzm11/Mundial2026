import { describe, it, expect } from "vitest"
import { calculatePoints } from "./scoring"

const finished = (r1: number, r2: number) => ({
  status: "FINISHED",
  result1: r1,
  result2: r2,
})

const pred = (p1: number, p2: number, confirmed = true) => ({
  pred1: p1,
  pred2: p2,
  confirmedAt: confirmed ? new Date() : null,
})

describe("calculatePoints (3/1/0)", () => {
  it("daje 3 pkt za dokładny wynik", () => {
    expect(calculatePoints(finished(2, 1), pred(2, 1))).toBe(3)
  })

  it("daje 1 pkt za poprawnego zwycięzcę bez dokładnego wyniku", () => {
    expect(calculatePoints(finished(3, 1), pred(2, 0))).toBe(1)
    expect(calculatePoints(finished(0, 2), pred(1, 4))).toBe(1)
  })

  it("daje 1 pkt za remis bez dokładnego wyniku", () => {
    expect(calculatePoints(finished(2, 2), pred(0, 0))).toBe(1)
    expect(calculatePoints(finished(1, 1), pred(3, 3))).toBe(1)
  })

  it("daje 0 pkt za pudło", () => {
    expect(calculatePoints(finished(2, 1), pred(1, 2))).toBe(0)
    expect(calculatePoints(finished(2, 2), pred(1, 0))).toBe(0)
  })

  it("daje 0 pkt gdy mecz nie zakończony", () => {
    expect(
      calculatePoints({ status: "IN_PLAY", result1: 1, result2: 0 }, pred(1, 0)),
    ).toBe(0)
    expect(
      calculatePoints({ status: "SCHEDULED", result1: null, result2: null }, pred(1, 0)),
    ).toBe(0)
  })

  it("daje 0 pkt gdy typ nie został zatwierdzony", () => {
    expect(calculatePoints(finished(2, 1), pred(2, 1, false))).toBe(0)
  })

  it("daje 0 pkt gdy result jest null mimo statusu FINISHED", () => {
    expect(calculatePoints({ status: "FINISHED", result1: null, result2: 1 }, pred(0, 1))).toBe(
      0,
    )
  })
})
