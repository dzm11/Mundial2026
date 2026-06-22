import { describe, it, expect } from "vitest"
import {
  normalizeTeamName,
  teamNameMatches,
  flipScoreline,
  parseScore,
  parseUtcMinute,
  orientByResult,
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
  it("zwraca bez zmian malformed input bez dwukropka", () => {
    expect(flipScoreline("5")).toBe("5")
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

describe("parseUtcMinute", () => {
  it("parsuje polski skrót miesiąca (dane z OddsPortal)", () => {
    // realny nagłówek meczu Turcja-Paragwaj (#344): kickoff 2026-06-20T03:00 UTC
    expect(parseUtcMinute("20 Cze 2026, 03:00")).toBe("2026-06-20T03:00")
  })
  it("ignoruje prefiks z dniem tygodnia", () => {
    expect(parseUtcMinute("Sobota, 20 Cze 2026, 03:00")).toBe("2026-06-20T03:00")
  })
  it("parsuje angielski skrót miesiąca", () => {
    expect(parseUtcMinute("20 Jun 2026, 20:00")).toBe("2026-06-20T20:00")
  })
  it("parsuje Paź (diakrytyk) jako październik", () => {
    expect(parseUtcMinute("5 Paź 2026, 18:30")).toBe("2026-10-05T18:30")
  })
  it("zwraca null dla braku/śmieci", () => {
    expect(parseUtcMinute(null)).toBeNull()
    expect(parseUtcMinute("brak daty")).toBeNull()
  })
})

describe("orientByResult", () => {
  it("ta sama kolejność wyniku → bez odwracania", () => {
    // OddsPortal gospodarz:gość 0:1 == baza team1:team2 0:1 (#344 Turcja 0-1 Paragwaj)
    expect(orientByResult(0, 1, 0, 1)).toEqual({ flip: false })
  })
  it("odwrócony wynik → flip", () => {
    expect(orientByResult(2, 1, 1, 2)).toEqual({ flip: true })
  })
  it("remis → bez odwracania", () => {
    expect(orientByResult(1, 1, 1, 1)).toEqual({ flip: false })
  })
  it("wynik niezgodny w żadnej orientacji → null (to nie ten mecz)", () => {
    expect(orientByResult(3, 0, 1, 0)).toBeNull()
  })
  it("brak danych → null", () => {
    expect(orientByResult(null, 1, 0, 1)).toBeNull()
    expect(orientByResult(0, 1, null, 1)).toBeNull()
  })
})
