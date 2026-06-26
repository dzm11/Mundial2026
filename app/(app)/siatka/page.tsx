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

  const serverNow = new Date().getTime()

  return (
    /* Mobile: lock the page to the viewport (calc subtracts the app header 3.5rem +
       main's pt-6 1.5rem + pb-24 6rem) so the page itself doesn't scroll — only the
       matrix scrolls internally, which is what lets its header row stay pinned.
       Desktop (sm+): natural block flow + full-page scroll, unchanged. */
    <div className="flex h-[calc(100dvh-11rem)] flex-col gap-5 sm:block sm:h-auto sm:space-y-5">
      <header className="shrink-0 space-y-1">
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
        serverNow={serverNow}
      />
    </div>
  )
}
