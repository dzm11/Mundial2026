import { createClient } from "@/lib/supabase/server"
import { getMatches, getLeaderboard, getPredictions, sortPlayers } from "@/lib/data"
import { MatchesBoard } from "@/components/matches-board"
import { EmptyState } from "@/components/empty-state"

export const dynamic = "force-dynamic"

export default async function HomePage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  const [matches, players, predictions] = await Promise.all([
    getMatches(),
    getLeaderboard(),
    getPredictions(),
  ])

  // Pasek "Twoja kolej": liczba nadchodzących meczów bez typu bieżącego gracza.
  const nowDate = new Date()
  const serverNow = nowDate.getTime()
  const ownPredMatchIds = new Set(
    predictions.filter((p) => p.user_id === user.id).map((p) => p.match_id),
  )
  const todoCount = matches.filter(
    (m) => new Date(m.kickoff_at) > nowDate && !ownPredMatchIds.has(m.id),
  ).length

  return (
    <div className="space-y-5">
      <header className="space-y-1">
        <h1 className="font-display text-2xl font-extrabold tracking-tight">Mecze</h1>
        <p className="text-muted-foreground text-sm">
          {matches.length === 0
            ? "Brak meczów."
            : todoCount > 0
              ? `${todoCount} ${todoCount === 1 ? "mecz bez typu" : "meczów bez typu"} — Twoja kolej.`
              : "Wszystkie nadchodzące mecze obstawione."}
        </p>
      </header>

      {matches.length === 0 ? (
        <EmptyState />
      ) : (
        <MatchesBoard
          matches={matches}
          players={sortPlayers(players)}
          predictions={predictions}
          currentUserId={user.id}
          serverNow={serverNow}
        />
      )}
    </div>
  )
}
