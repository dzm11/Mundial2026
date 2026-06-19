import { createClient } from "@/lib/supabase/server"
import { getLeaderboard, getPredictions, getMatches, getMatchOdds } from "@/lib/data"
import { computeAllStats, oddsCoverage, type MatchLite } from "@/lib/stats"
import { MoneyBoard } from "@/components/money-board"
import { StatHighlights } from "@/components/stat-highlights"

export const dynamic = "force-dynamic"

export default async function StatsPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  const [players, predictions, matches, odds] = await Promise.all([
    getLeaderboard(),
    getPredictions(),
    getMatches(),
    getMatchOdds(),
  ])

  const matchLite: MatchLite[] = matches.map((m) => ({
    id: m.id,
    status: m.status,
    result1: m.result1,
    result2: m.result2,
  }))

  const stats = computeAllStats(
    players.map((p) => p.id),
    predictions,
    matchLite,
    odds,
  )
  const statsByUser = new Map(stats.map((s) => [s.userId, s]))

  const rows = players
    .map((player) => ({ player, stats: statsByUser.get(player.id)! }))
    .sort((a, b) => b.stats.moneyBalance - a.stats.moneyBalance)

  const coverage = oddsCoverage(matchLite, odds)
  const missing = coverage.finished - coverage.withOdds

  return (
    <div className="space-y-8">
      <header className="space-y-1">
        <h1 className="font-display text-2xl font-extrabold tracking-tight">Stats</h1>
        <p className="text-muted-foreground text-sm">
          Bilans, gdyby każdy stawiał 100 zł na dokładny wynik swojego typu w każdym meczu.
        </p>
      </header>

      <section className="space-y-3">
        <h2 className="font-display text-lg font-bold">💰 Bilans 100 zł / mecz</h2>
        <MoneyBoard rows={rows} currentUserId={user.id} />
        {missing > 0 && (
          <p className="text-muted-foreground text-xs">
            Bilans liczony z {coverage.withOdds} z {coverage.finished} rozegranych meczów
            (brak kursów dla {missing}).
          </p>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="font-display text-lg font-bold">Pozostałe statystyki</h2>
        <StatHighlights rows={rows} />
      </section>
    </div>
  )
}
