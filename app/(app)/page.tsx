import { getMatches, getLeaderboard, getPredictions, sortPlayers } from "@/lib/data"
import { LeaderboardTable } from "@/components/leaderboard-table"
import { MobileMatchList } from "@/components/mobile-match-list"
import { EmptyState } from "@/components/empty-state"
import { createClient } from "@/lib/supabase/server"

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
  const sortedPlayers = sortPlayers(players)

  if (matches.length === 0) return <EmptyState />

  return (
    <>
      <div className="hidden lg:block">
        <LeaderboardTable
          matches={matches}
          players={sortedPlayers}
          predictions={predictions}
          currentUserId={user.id}
        />
      </div>
      <div className="lg:hidden">
        <MobileMatchList
          matches={matches}
          players={sortedPlayers}
          predictions={predictions}
          currentUserId={user.id}
        />
      </div>
    </>
  )
}
