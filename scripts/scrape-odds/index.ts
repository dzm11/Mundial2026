/**
 * Scraper kursów correct-score z OddsPortal -> Supabase (tabela match_odds).
 *
 * Uruchomienie:        npm run scrape:odds
 * Tryb debug (okno + dump pierwszego meczu):
 *                      HEADFUL=1 SCRAPE_DEBUG=1 MATCH_LIMIT=1 npm run scrape:odds
 *
 * Wymaga w .env.local: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 * Wymaga przeglądarki: zainstalowany Google Chrome (channel "chrome").
 *   OddsPortal blokuje (503) zwykłe headless Chromium — dlatego używamy realnego Chrome.
 *
 * Jak to działa (zweryfikowane na żywo):
 *   - lista meczów: na stronie wyników turnieju linki prowadzą do /football/h2h/<a>/<b>/.
 *   - rynek correct-score: strona meczu trzyma w location.hash id w formacie "<ID>:1X2;2".
 *     Wymuszamy correct-score nawigując NA ŚWIEŻO do "<url>#<ID>:cs;2".
 *   - kursy: wiersze "1:0  ...  7.00" — parsujemy scoreline + kurs dziesiętny.
 *
 * MAPOWANIE meczu (ważne): NIE po nazwach drużyn — tytuł strony bywa raz po
 * angielsku, raz po polsku, a nazwy bywają różne ("Bosnia & Herzegovina" vs
 * "Bosnia and Herzegovina"). Mapujemy po DACIE I GODZINIE rozpoczęcia
 * (kickoff_at, w bazie unikalny) — strefa przeglądarki ustawiona na UTC, więc
 * czas ze strony = `kickoff_at` z bazy. Orientację scoreline (czy odwrócić)
 * i poprawność dopasowania potwierdzamy WYNIKIEM końcowym (gospodarz:gość).
 *
 * Idempotentny: upsert po (match_id, scoreline).
 */
import { chromium, type Browser, type BrowserContext, type Page } from "playwright"
import { createClient } from "@supabase/supabase-js"
import { flipScoreline, parseUtcMinute, orientByResult } from "./parsing"

const RESULTS_URL =
  "https://www.oddsportal.com/pl/football/world/mistrzostwa-swiata-2026/results/"

const HEADFUL = process.env.HEADFUL === "1"
const DEBUG = process.env.SCRAPE_DEBUG === "1"
const MATCH_LIMIT = process.env.MATCH_LIMIT ? Number(process.env.MATCH_LIMIT) : 0

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"

type DbMatch = {
  id: number
  kickoff_at: string
  result1: number | null
  result2: number | null
  status: string
  team1: { name: string } | null
  team2: { name: string } | null
}

// Zescrapowany mecz: kursy (perspektywa gospodarza OddsPortal) + metadane do mapowania.
type ScrapedMatch = {
  home: string // tylko do logów
  away: string // tylko do logów
  dateText: string | null // surowy tekst daty z nagłówka, np. "20 Cze 2026, 03:00"
  resHome: number | null // wynik końcowy gospodarza
  resAway: number | null // wynik końcowy gościa
  scores: Record<string, number> // { "1:0": 7.5, ..., "OTHER": 60 }
}

const minuteKey = (iso: string) => new Date(iso).toISOString().slice(0, 16)

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error("Brak NEXT_PUBLIC_SUPABASE_URL lub SUPABASE_SERVICE_ROLE_KEY")
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })
}

// Realny Chrome omija detekcję botów OddsPortal; bundled chromium dostaje 503.
async function launchBrowser(): Promise<Browser> {
  const args = ["--disable-blink-features=AutomationControlled"]
  try {
    return await chromium.launch({ channel: "chrome", headless: !HEADFUL, args })
  } catch {
    console.warn("⚠️  Brak kanału 'chrome' — fallback do bundled chromium (może zostać zablokowany przez OddsPortal).")
    return await chromium.launch({ headless: !HEADFUL, args })
  }
}

async function makeContext(browser: Browser): Promise<BrowserContext> {
  // timezoneId=UTC => czasy meczów ze strony są w UTC = zgodne z kickoff_at w bazie.
  const ctx = await browser.newContext({
    userAgent: UA,
    locale: "pl-PL",
    timezoneId: "UTC",
    viewport: { width: 1400, height: 1000 },
    extraHTTPHeaders: { "Accept-Language": "pl-PL,pl;q=0.9,en;q=0.8" },
  })
  await ctx.addInitScript(() => {
    Object.defineProperty(navigator, "webdriver", { get: () => undefined })
  })
  return ctx
}

// Nawigacja odporna na flaky-network: kilka prób, zanim się poddamy.
async function gotoWithRetry(page: Page, url: string, tries = 5): Promise<boolean> {
  for (let i = 1; i <= tries; i++) {
    try {
      await page.goto(url, { waitUntil: "commit", timeout: 30000 })
      return true
    } catch {
      if (i === tries) return false
      await page.waitForTimeout(1500)
    }
  }
  return false
}

// Bezpieczny evaluate — strona bywa nawigowana w trakcie (SPA), więc ponawiamy.
async function safeEval<T>(page: Page, fn: () => T): Promise<T | null> {
  for (let i = 0; i < 6; i++) {
    try {
      return await page.evaluate(fn)
    } catch {
      await page.waitForTimeout(1000)
    }
  }
  return null
}

async function collectMatchUrls(page: Page): Promise<string[]> {
  if (!(await gotoWithRetry(page, RESULTS_URL))) {
    throw new Error("Nie udało się załadować strony wyników OddsPortal (timeout).")
  }
  const collect = async () =>
    (await safeEval(page, () =>
      Array.from(document.querySelectorAll("a"))
        .map((a) => (a as HTMLAnchorElement).href)
        .filter(Boolean),
    )) ?? []

  const found = new Set<string>()
  const addFrom = (hrefs: string[]) => {
    for (const h of hrefs) {
      const clean = h.split("#")[0]
      if (/\/football\/h2h\/[^/]+\/[^/]+\/?$/.test(clean)) found.add(clean)
    }
  }

  for (let i = 0; i < 18 && found.size === 0; i++) {
    await page.waitForTimeout(2000)
    addFrom(await collect())
  }

  // przewijaj do końca, aż liczba linków przestanie rosnąć
  let stable = 0
  for (let i = 0; i < 40 && stable < 3; i++) {
    const before = found.size
    await safeEval(page, () => window.scrollTo(0, document.body.scrollHeight))
    await page.waitForTimeout(1500)
    addFrom(await collect())
    stable = found.size === before ? stable + 1 : 0
  }

  return Array.from(found)
}

// Wczytaj stronę meczu, przełącz na correct-score, odczytaj datę, wynik i kursy.
async function scrapeMatch(page: Page, url: string, debug = false): Promise<ScrapedMatch | null> {
  const base = url.split("#")[0]
  if (!(await gotoWithRetry(page, base))) return null

  // 1) odczytaj id rynku z domyślnego hasha (np. "#KnyuOLXH:1X2;2" -> "KnyuOLXH").
  let id: string | null = null
  for (let i = 0; i < 12; i++) {
    await page.waitForTimeout(1500)
    const h = await safeEval(page, () => location.hash)
    if (h && h.includes(":")) {
      id = h.replace(/^#/, "").split(":")[0]
      break
    }
  }
  if (!id) return null

  // 2) wymuś correct-score świeżą nawigacją do pełnego hasha.
  if (!(await gotoWithRetry(page, `${base}#${id}:cs;2`))) return null

  // 3) poczekaj aż wyrenderują się wiersze wyników (scoreline + kurs) i nagłówek.
  let scraped: ScrapedMatch | null = null
  for (let i = 0; i < 16; i++) {
    await page.waitForTimeout(2000)
    scraped = await safeEval(page, () => {
      // pomocniczo: czy element jest w panelu bocznym (inny mecz)
      function inSidebar(el: Element | null): boolean {
        let p: Element | null = el
        while (p) {
          const c = (p.className || "").toString().toLowerCase()
          const tag = p.tagName?.toLowerCase() || ""
          if (tag === "aside" || /sidebar|right-?col|menu|nav/.test(c)) return true
          p = p.parentElement
        }
        return false
      }

      // nazwy tylko do logów (mogą być PL lub EN — nie używamy ich do mapowania)
      let home = "",
        away = ""
      const titleM = document.title.match(/^(.+?)\s-\s(.+?)\s+(?:Odds|Kursy|H2H)/i)
      if (titleM) {
        home = titleM[1].trim()
        away = titleM[2].trim()
      }

      // data z NAGŁÓWKA meczu (nie z panelu bocznego)
      let dateText: string | null = null
      const dateRe = /\d{1,2}\s+[A-Za-zżźćńółęąśŻŹĆĄŚĘŁÓŃ]{3,}\s+20\d\d[, ]+\d{1,2}:\d{2}/
      for (const el of Array.from(document.querySelectorAll("div,span,p,h1,h2"))) {
        const t = ((el as HTMLElement).innerText || "").replace(/\n+/g, " ").trim()
        if (t.length < 6 || t.length > 60) continue
        const m = t.match(dateRe)
        if (m && !inSidebar(el)) {
          dateText = m[0]
          break
        }
      }

      // wynik końcowy gospodarz:gość (do orientacji i weryfikacji)
      let resHome: number | null = null,
        resAway: number | null = null
      const body = document.body.innerText.replace(/\n+/g, " ")
      const rm = body.match(/(?:wynik\s*końcowy|final\s*result)\D{0,6}(\d{1,2})\s*[:\-–]\s*(\d{1,2})/i)
      if (rm) {
        resHome = Number(rm[1])
        resAway = Number(rm[2])
      }

      // wiersze correct-score: scoreline + kurs dziesiętny
      const scores: Record<string, number> = {}
      for (const el of Array.from(document.querySelectorAll("div,tr"))) {
        const t = ((el as HTMLElement).innerText || "").replace(/\n/g, " ").trim()
        if (t.length > 45) continue
        const sc = t.match(/^(\d{1,2})\s*[:]\s*(\d{1,2})\b/)
        const od = t.match(/\b(\d{1,3}\.\d{2})\b/)
        if (sc && od) {
          scores[`${Number(sc[1])}:${Number(sc[2])}`] = Number(od[1])
        } else if (/inny wynik|other/i.test(t) && od) {
          scores["OTHER"] = Number(od[1])
        }
      }

      return { home, away, dateText, resHome, resAway, scores }
    })
    if (scraped && Object.keys(scraped.scores).length > 3 && scraped.dateText) break
  }

  if (debug) {
    console.log(
      `🔎 DEBUG ${base}: "${scraped?.home}" vs "${scraped?.away}" | data="${scraped?.dateText}" ` +
        `wynik=${scraped?.resHome}:${scraped?.resAway} | kursy=${scraped ? Object.keys(scraped.scores).length : 0}`,
    )
  }

  if (!scraped || Object.keys(scraped.scores).length === 0) return null
  return scraped
}

// Dopasuj zescrapowany mecz do bazy po dacie+godzinie, orientuj scoreline wynikiem.
function matchByDateTime(
  scraped: ScrapedMatch,
  byTime: Map<string, DbMatch[]>,
): { m: DbMatch; flip: boolean } | null {
  const iso = parseUtcMinute(scraped.dateText)
  if (!iso) return null
  const candidates = byTime.get(iso)
  if (!candidates || candidates.length === 0) return null

  const { resHome, resAway } = scraped
  for (const m of candidates) {
    // wynik musi się zgadzać w jakiejś orientacji (potwierdza dopasowanie + ustala flip)
    const o = orientByResult(resHome, resAway, m.result1, m.result2)
    if (o) return { m, flip: o.flip }
  }
  // brak danych o wyniku, ale dokładnie 1 kandydat o tej godzinie -> dopasuj;
  // flip ustalamy tylko gdy remis (bez znaczenia), inaczej odpuszczamy (orientacja nieznana)
  if ((resHome == null || resAway == null) && candidates.length === 1) {
    const m = candidates[0]
    if (m.result1 != null && m.result1 === m.result2) return { m, flip: false }
  }
  return null
}

async function main() {
  const supabase = getSupabase()
  const { data, error } = await supabase
    .from("matches")
    .select("id, kickoff_at, result1, result2, status, team1:team1_id(name), team2:team2_id(name)")
    .eq("status", "FINISHED")
  if (error) throw error
  const matches = (data ?? []) as unknown as DbMatch[]
  console.log(`📋 ${matches.length} zakończonych meczów do pokrycia kursami`)

  // indeks meczów po minucie rozpoczęcia (kickoff_at)
  const byTime = new Map<string, DbMatch[]>()
  for (const m of matches) {
    const k = minuteKey(m.kickoff_at)
    const arr = byTime.get(k)
    if (arr) arr.push(m)
    else byTime.set(k, [m])
  }

  const browser = await launchBrowser()
  const ctx = await makeContext(browser)
  try {
    const page = await ctx.newPage()

    // MATCH_URL=<url> — pomiń listę i scrapuj tylko jeden mecz (diagnostyka).
    let urls = process.env.MATCH_URL ? [process.env.MATCH_URL] : await collectMatchUrls(page)
    if (!process.env.MATCH_URL) console.log(`🔗 Znaleziono ${urls.length} linków meczów na OddsPortal`)
    if (MATCH_LIMIT > 0) urls = urls.slice(0, MATCH_LIMIT)

    let saved = 0
    const skipped: string[] = []

    for (const [i, url] of urls.entries()) {
      try {
        const scraped = await scrapeMatch(page, url, DEBUG && i === 0)
        if (!scraped) {
          skipped.push(`${url} (brak kursów/danych)`)
          continue
        }
        const matched = matchByDateTime(scraped, byTime)
        if (!matched) {
          skipped.push(
            `${url} (${scraped.home} vs ${scraped.away}, ${scraped.dateText}, wynik ${scraped.resHome}:${scraped.resAway} — brak dopasowania)`,
          )
          continue
        }
        const { m, flip } = matched
        const rows = Object.entries(scraped.scores).map(([scoreline, odds]) => ({
          match_id: m.id,
          scoreline: flip ? flipScoreline(scoreline) : scoreline,
          odds,
          source: "oddsportal",
        }))
        const { error: upErr } = await supabase
          .from("match_odds")
          .upsert(rows, { onConflict: "match_id,scoreline" })
        if (upErr) throw upErr
        saved += rows.length
        console.log(
          `✅ ${m.team1?.name} ${m.result1}-${m.result2} ${m.team2?.name} -> mecz #${m.id} (${rows.length} kursów${flip ? ", odwrócone" : ""})`,
        )
      } catch (e) {
        skipped.push(`${url} (błąd: ${(e as Error).message})`)
      }
    }

    console.log(`\n🎉 Zapisano ${saved} wierszy kursów. Pominięto ${skipped.length}:`)
    for (const s of skipped) console.log(`   - ${s}`)
  } finally {
    await browser.close()
  }
}

main().catch((e) => {
  console.error("❌ Scraper nie powiódł się:", e)
  process.exit(1)
})
