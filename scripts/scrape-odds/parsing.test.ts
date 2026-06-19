import { describe, it, expect } from "vitest"
import {
  normalizeTeamName,
  teamNameMatches,
  flipScoreline,
  parseScore,
} from "./parsing"

describe("normalizeTeamName", () => {
  it("lowercase + bez diakrytyków + trim", () => {
    expect(normalizeTeamName("  Korea Płd. ")).toBe("korea pld.")
    expect(normalizeTeamName("Côte d'Ivoire")).toBe("cote d'ivoire")
  })
})

describe("teamNameMatches", () => {
  it("dopasowuje identyczne po normalizacji", () => {
    expect(teamNameMatches("USA", "usa")).toBe(true)
  })
  it("dopasowuje przez alias", () => {
    // alias: "korea republic" (OddsPortal) -> "south korea" (nasza baza)
    // dbName="South Korea" to realny klucz z lib/wc2026-teams.ts
    // scrapedName="Korea Republic" to etykieta z OddsPortal rozwiązywana przez TEAM_ALIASES
    expect(teamNameMatches("South Korea", "Korea Republic")).toBe(true)
  })
  it("odrzuca różne drużyny", () => {
    expect(teamNameMatches("Brazil", "Argentina")).toBe(false)
  })
})

describe("flipScoreline", () => {
  it("odwraca wynik", () => {
    expect(flipScoreline("2:1")).toBe("1:2")
  })
  it("nie rusza OTHER", () => {
    expect(flipScoreline("OTHER")).toBe("OTHER")
  })
})

describe("parseScore", () => {
  it("parsuje '2:1' i '2 - 1'", () => {
    expect(parseScore("2:1")).toEqual({ r1: 2, r2: 1 })
    expect(parseScore("2 - 1")).toEqual({ r1: 2, r2: 1 })
  })
  it("zwraca null dla śmieci", () => {
    expect(parseScore("inny wynik")).toBeNull()
  })
})
