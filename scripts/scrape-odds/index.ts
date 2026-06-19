/**
 * Scraper kursów correct-score z OddsPortal -> Supabase (tabela match_odds).
 *
 * Uruchomienie: npm run scrape:odds
 * Wymaga w .env.local: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 * Wymaga przeglądarki Playwright: npx playwright install chromium
 *
 * Idempotentny: upsert po (match_id, scoreline).
 */
import { chromium, type Page } from "playwright"
import { createClient } from "@supabase/supabase-js"
import { teamNameMatches, flipScoreline, parseScore } from "./parsing"

const RESULTS_URL =
  "https://www.oddsportal.com/football/world/world-championship-2026/results/"

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

async function collectMatchUrls(page: Page): Promise<string[]> {
  await page.goto(RESULTS_URL, { waitUntil: "domcontentloaded" })
  // TODO(step 2): potwierdź selektor linków meczów na żywo.
  await page.waitForSelector("a[href*='/football/world/world-championship-2026/']", { timeout: 30000 })
  const hrefs = await page.$$eval(
    "a[href*='/football/world/world-championship-2026/']",
    (els) =>
      els
        .map((e) => (e as HTMLAnchorElement).href)
        .filter((h) => /-[A-Za-z0-9]{6,}\/$/.test(h)), // linki konkretnych meczów
  )
  return Array.from(new Set(hrefs))
}

async function scrapeMatch(page: Page, url: string): Promise<ScrapedOdds | null> {
  await page.goto(url, { waitUntil: "domcontentloaded" })
  // Otwórz zakładkę "Correct Score".
  // TODO(step 2): potwierdź tekst/selektor zakładki i wierszy kursów na żywo.
  const tab = page.getByText(/Correct Score/i).first()
  if (await tab.count()) await tab.click()
  await page.waitForTimeout(2500)

  const home = (await page.locator("[class*='participant'] >> nth=0").innerText().catch(() => "")) || ""
  const away = (await page.locator("[class*='participant'] >> nth=1").innerText().catch(() => "")) || ""

  // Wiersze kursów: każdy ma etykietę wyniku (np. "1:0") i kurs.
  const raw = await page.$$eval("[class*='row']", (rows) =>
    rows
      .map((r) => r.textContent ?? "")
      .filter((t) => /\d+\s*[:\-]\s*\d+|other/i.test(t)),
  )

  const scores: Record<string, number> = {}
  for (const line of raw) {
    const oddsMatch = line.match(/(\d+\.\d{1,2})/)
    if (!oddsMatch) continue
    const odds = Number(oddsMatch[1])
    if (/other/i.test(line)) {
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

  const browser = await chromium.launch()
  const page = await browser.newPage()

  const urls = await collectMatchUrls(page)
  console.log(`🔗 Znaleziono ${urls.length} linków meczów na OddsPortal`)

  let saved = 0
  const skipped: string[] = []

  for (const url of urls) {
    try {
      const scraped = await scrapeMatch(page, url)
      if (!scraped) {
        skipped.push(`${url} (brak kursów)`)
        continue
      }
      // znajdź pasujący mecz po nazwach drużyn
      const m = matches.find((mm) => orient(scraped, mm).ok)
      if (!m) {
        skipped.push(`${url} (${scraped.home} vs ${scraped.away} — brak dopasowania)`)
        continue
      }
      const { flip } = orient(scraped, m)
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

  await browser.close()
  console.log(`\n🎉 Zapisano ${saved} wierszy kursów. Pominięto ${skipped.length}:`)
  for (const s of skipped) console.log(`   - ${s}`)
}

main().catch((e) => {
  console.error("❌ Scraper nie powiódł się:", e)
  process.exit(1)
})
