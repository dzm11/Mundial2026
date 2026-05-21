import { createClient } from "@/lib/supabase/server"
import { getLeaderboard, sortPlayers } from "@/lib/data"
import { Podium } from "@/components/podium"
import { RankingList } from "@/components/ranking-list"

export const dynamic = "force-dynamic"

export default async function RankingPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  const players = sortPlayers(await getLeaderboard())

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="font-display text-2xl font-extrabold tracking-tight">Ranking</h1>
        <p className="text-muted-foreground text-sm">{players.length} graczy w grze</p>
      </header>
      {players.length > 0 && <Podium players={players} currentUserId={user.id} />}
      <RankingList players={players} currentUserId={user.id} />
    </div>
  )
}
