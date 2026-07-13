import { describe, it, expect } from "vitest"
import {
  normalizeTeamName,
  teamNameMatches,
  flipScoreline,
  parseScore,
  parseUtcMinute,
  orientByResult,
  extractEventInfo,
  csFeedPath,
  regularTimeFromPartial,
  parseCsScores,
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

describe("regularTimeFromPartial", () => {
  it("mecz bez dogrywki: suma dwóch połów = wynik 90 min", () => {
    expect(regularTimeFromPartial("2:0, 1:1")).toEqual({ home: 3, away: 1 })
  })
  it("mecz po dogrywce: bierzemy TYLKO dwie pierwsze połowy (90 min)", () => {
    // Argentyna 3:1 dcz., partial 1:0, 0:1, 2:0 -> 90 min = 1:1
    expect(regularTimeFromPartial("1:0, 0:1, 2:0")).toEqual({ home: 1, away: 1 })
  })
  it("za mało segmentów / brak → null", () => {
    expect(regularTimeFromPartial("1:0")).toBeNull()
    expect(regularTimeFromPartial(null)).toBeNull()
    expect(regularTimeFromPartial("")).toBeNull()
  })
})

describe("csFeedPath", () => {
  it("buduje ścieżkę feedu correct-score (bet=8, scope=2)", () => {
    expect(csFeedPath({ versionId: 5, sportId: 1, hash: "Wv4IS6zg", xhash: "yj559" })).toBe(
      "5-1-Wv4IS6zg-8-2-yj559",
    )
  })
})

describe("extractEventInfo", () => {
  const html =
    'x<div id="react-event-header" data=\'{"eventData":{"id":"Wv4IS6zg","xhash":"%79%6a%35%62%66",' +
    '"xhashf":"%79%6a%35%35%39","versionId":5,"sportId":1,"home":"Argentyna","away":"Szwajcaria",' +
    '"tournamentId":77311}}\'></div>' +
    '<script>var x={"startDate":1783818000,"partialresult":"1:0, 0:1, 2:0","homeResult":"3"}</script>'
  it("wyciąga hash, xhash (z xhashf, url-decoded), wersję, sport, kickoff, partial", () => {
    const info = extractEventInfo(html)!
    expect(info.hash).toBe("Wv4IS6zg")
    expect(info.xhash).toBe("yj559")
    expect(info.versionId).toBe(5)
    expect(info.sportId).toBe(1)
    expect(info.home).toBe("Argentyna")
    expect(info.startDate).toBe(1783818000)
    expect(info.partial).toBe("1:0, 0:1, 2:0")
  })
  it("brak kluczowych pól → null", () => {
    expect(extractEventInfo("<html>nic</html>")).toBeNull()
  })
})

describe("parseCsScores", () => {
  it("bierze najwyższy kurs per scoreline z oddsdata.back", () => {
    const feed = {
      d: {
        oddsdata: {
          back: {
            a: { mixedParameterName: "1:1", odds: { "163": [6], "572": [6.4] } },
            b: { mixedParameterName: "2:0", odds: { "163": [6.8], "572": [6.8] } },
            c: { mixedParameterName: "0:0", odds: {} },
          },
        },
      },
    }
    expect(parseCsScores(feed)).toEqual({ "1:1": 6.4, "2:0": 6.8 })
  })
  it("brak danych → pusty obiekt", () => {
    expect(parseCsScores({})).toEqual({})
    expect(parseCsScores(null)).toEqual({})
  })
})
