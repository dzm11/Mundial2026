/**
 * Scraper kursów correct-score z OddsPortal -> Supabase (tabela match_odds).
 *
 * Uruchomienie:        npm run scrape:odds
 * Tryb debug (okno + dump zakładek pierwszego meczu):
 *                      HEADFUL=1 SCRAPE_DEBUG=1 MATCH_LIMIT=1 npm run scrape:odds
 *
 * Wymaga w .env.local: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 * Wymaga przeglądarki: zainstalowany Google Chrome (channel "chrome").
 *   OddsPortal blokuje (503) zwykłe headless Chromium — dlatego używamy realnego Chrome.
 *   Fallback do `npx playwright install chromium`, jeśli Chrome niedostępny (może być blokowany).
 *
 * Uwaga geo: OddsPortal przekierowuje klienta z PL na ścieżkę /pl/ ze slugiem
 *   "mistrzostwa-swiata-2026" (angielski slug 404-uje), więc startujemy od polskiego URL-a.
 *
 * Idempotentny: upsert po (match_id, scoreline).
 */
import { chromium, type Browser, type BrowserContext, type Page } from "playwright"
import { createClient } from "@supabase/supabase-js"
import { teamNameMatches, flipScoreline, parseScore } from "./parsing"

const RESULTS_URL =
  "https://www.oddsportal.com/pl/football/world/mistrzostwa-swiata-2026/results/"
const TOURNAMENT_SLUG = "mistrzostwa-swiata-2026"

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
async function gotoWithRetry(page: Page, url: string, tries = 4): Promise<boolean> {
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
  // Czekaj aż SPA wyrenderuje linki meczów (zaszyfrowany feed jest odszyfrowywany po stronie strony).
  let links: string[] = []
  for (let i = 0; i < 18; i++) {
    await page.waitForTimeout(2000)
    const res = await safeEval(page, () =>
      Array.from(document.querySelectorAll("a"))
        .map((a) => (a as HTMLAnchorElement).href)
        .filter(Boolean),
    )
    if (!res) continue
    links = Array.from(
      new Set(
        res.filter(
          (h) =>
            h.includes(`${TOURNAMENT_SLUG}/`) &&
            !/\/(results|outrights|standings)\/?$/.test(h) &&
            /-[A-Za-z0-9]{6,}\/?$/.test(h),
        ),
      ),
    )
    if (links.length > 3) break
  }
  return links
}

// Otwórz zakładkę correct-score i odczytaj kursy. Selektory rynku correct-score nie były
// w pełni zweryfikowane na żywo (flaky network) — przy pierwszym uruchomieniu użyj
// SCRAPE_DEBUG=1, by wypisać dostępne etykiety zakładek rynków i dostroić matcher.
async function scrapeMatch(page: Page, url: string, debug = false): Promise<ScrapedOdds | null> {
  if (!(await gotoWithRetry(page, url))) return null
  await page.waitForTimeout(2500)

  if (debug) {
    const tabs = await safeEval(page, () =>
      Array.from(document.querySelectorAll("a,button,div"))
        .map((e) => (e.textContent || "").trim())
        .filter((t) => t.length > 0 && t.length < 30)
        .filter((t) => /wynik|score|correct|1x2|handicap|over|under/i.test(t)),
    )
    console.log(`🔎 DEBUG zakładki rynków @ ${url}:`, JSON.stringify(Array.from(new Set(tabs ?? [])).slice(0, 20)))
  }

  // Zakładka "Correct Score" / pol. "Dokładny wynik".
  const tab = page.getByText(/correct score|dok[łl]adny wynik/i).first()
  try {
    if (await tab.count()) {
      await tab.click({ timeout: 5000 })
      await page.waitForTimeout(2500)
    }
  } catch {
    /* zostań na domyślnym widoku — i tak spróbujemy odczytać wiersze */
  }

  const home =
    (await page.locator("[class*='participant'] >> nth=0").innerText().catch(() => "")) || ""
  const away =
    (await page.locator("[class*='participant'] >> nth=1").innerText().catch(() => "")) || ""

  // Wiersze kursów: każdy ma etykietę wyniku (np. "1:0") i kurs dziesiętny.
  const raw =
    (await safeEval(page, () =>
      Array.from(document.querySelectorAll("[class*='row'],[class*='Row']"))
        .map((r) => (r as HTMLElement).innerText ?? "")
        .filter((t) => /\d+\s*[:\-]\s*\d+|inny wynik|other/i.test(t)),
    )) ?? []

  const scores: Record<string, number> = {}
  for (const line of raw) {
    const oddsMatch = line.match(/(\d+\.\d{1,2})/)
    if (!oddsMatch) continue
    const odds = Number(oddsMatch[1])
    if (/inny wynik|other/i.test(line)) {
      scores["OTHER"] = odds
      continue
    }
    const sc = parseScore(line)
    if (sc) scores[`${sc.r1}:${sc.r2}`] = odds
  }

  if (Object.keys(scores).length === 0) return null
  return { home: home.trim(), away: away.trim(), scores }
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
