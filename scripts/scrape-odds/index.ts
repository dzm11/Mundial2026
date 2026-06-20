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
 *     Wymuszamy correct-score nawigując NA ŚWIEŻO do "<url>#<ID>:cs;2" (samo ustawienie
 *     location.hash nie przełącza rynku — SPA ma własny router; pełna nawigacja działa).
 *   - kursy: wiersze "1:0  ...  7.00" — parsujemy scoreline + kurs dziesiętny.
 *
 * Idempotentny: upsert po (match_id, scoreline).
 */
import { chromium, type Browser, type BrowserContext, type Page } from "playwright"
import { createClient } from "@supabase/supabase-js"
import { teamNameMatches, flipScoreline } from "./parsing"

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

// Mapa kursów z perspektywy GOSPODARZA OddsPortal: { "1:0": 7.5, ..., "OTHER": 60 }
type ScrapedOdds = { home: string; away: string; scores: Record<string, number> }

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
  const ctx = await browser.newContext({
    userAgent: UA,
    locale: "pl-PL",
    timezoneId: "Europe/Warsaw",
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
  // Czekaj aż SPA wyrenderuje linki meczów (linki prowadzą do /football/h2h/<a>/<b>/),
  // a następnie przewijaj stronę, by doładować WSZYSTKIE mecze (lazy-load).
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

  // poczekaj na pierwsze linki
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

// Wczytaj stronę meczu, przełącz na correct-score, odczytaj nazwy drużyn i kursy.
async function scrapeMatch(page: Page, url: string, debug = false): Promise<ScrapedOdds | null> {
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

  // 3) poczekaj aż wyrenderują się wiersze wyników (scoreline + kurs).
  let scraped: ScrapedOdds | null = null
  for (let i = 0; i < 16; i++) {
    await page.waitForTimeout(2000)
    scraped = await safeEval(page, () => {
        // Nazwy drużyn po ANGIELSKU (pasują do bazy) z tytułu/H1 — w kolejności gospodarz–gość.
        //   title: "Germany - Ivory Coast Odds, Predictions & H2H | OddsPortal"
        //   h1:    "Germany vs Ivory Coast - Odds, Predictions and H2H Results"
        let home = "",
          away = ""
        const titleM = document.title.match(/^(.+?)\s-\s(.+?)\s+(?:Odds|Kursy|H2H)/i)
        if (titleM) {
          home = titleM[1].trim()
          away = titleM[2].trim()
        } else {
          const h1 = (document.querySelector("h1")?.textContent || "").trim()
          const h1M = h1.match(/^(.+?)\s+vs\s+(.+?)\s*[-–]/i)
          if (h1M) {
            home = h1M[1].trim()
            away = h1M[2].trim()
          }
        }
        // wiersze correct-score: skanuj wiersze i wyciągaj parę (scoreline, kurs)
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
        return { home, away, scores }
    })
    if (scraped && Object.keys(scraped.scores).length > 3) break
  }

  if (debug) {
    console.log(
      `🔎 DEBUG ${base}: home="${scraped?.home}" away="${scraped?.away}" ` +
        `scores=${scraped ? Object.keys(scraped.scores).length : 0} ` +
        `(${scraped ? JSON.stringify(scraped.scores).slice(0, 120) : "null"})`,
    )
  }

  if (!scraped || Object.keys(scraped.scores).length === 0) return null
  return scraped
}

// Dopasuj scraped -> nasz mecz; zwróć czy trzeba odwrócić scoreline.
function orient(scraped: ScrapedOdds, m: DbMatch): { ok: boolean; flip: boolean } {
  const t1 = m.team1?.name ?? ""
  const t2 = m.team2?.name ?? ""
  if (teamNameMatches(t1, scraped.home) && teamNameMatches(t2, scraped.away)) return { ok: true, flip: false }
  if (teamNameMatches(t1, scraped.away) && teamNameMatches(t2, scraped.home)) return { ok: true, flip: true }
  return { ok: false, flip: false }
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

  const browser = await launchBrowser()
  const ctx = await makeContext(browser)
  try {
    const page = await ctx.newPage()

    let urls = await collectMatchUrls(page)
    console.log(`🔗 Znaleziono ${urls.length} linków meczów na OddsPortal`)
    if (MATCH_LIMIT > 0) urls = urls.slice(0, MATCH_LIMIT)

    let saved = 0
    const skipped: string[] = []

    for (const [i, url] of urls.entries()) {
      try {
        const scraped = await scrapeMatch(page, url, DEBUG && i === 0)
        if (!scraped) {
          skipped.push(`${url} (brak kursów)`)
          continue
        }
        let matched: { m: DbMatch; flip: boolean } | null = null
        for (const mm of matches) {
          const r = orient(scraped, mm)
          if (r.ok) {
            matched = { m: mm, flip: r.flip }
            break
          }
        }
        if (!matched) {
          skipped.push(`${url} (${scraped.home} vs ${scraped.away} — brak dopasowania)`)
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
        console.log(`✅ ${scraped.home} vs ${scraped.away} -> mecz #${m.id} (${rows.length} kursów)`)
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
