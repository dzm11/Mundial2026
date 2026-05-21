import { createClient } from "@/lib/supabase/server"
import { getMatches, getLeaderboard, getPredictions, sortPlayers } from "@/lib/data"
import { PredictionsMatrix } from "@/components/predictions-matrix"
import { EmptyState } from "@/components/empty-state"

export const dynamic = "force-dynamic"

export default async function SiatkaPage() {
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

  if (matches.length === 0) return <EmptyState />

  return (
    <div className="space-y-5">
      <header className="space-y-1">
        <h1 className="font-display text-2xl font-extrabold tracking-tight">Siatka typów</h1>
        <p className="text-muted-foreground text-sm">
          {matches.length} meczów · {players.length} graczy
        </p>
      </header>
      <PredictionsMatrix
        matches={matches}
        players={sortPlayers(players)}
        predictions={predictions}
        currentUserId={user.id}
      />
    </div>
  )
}
