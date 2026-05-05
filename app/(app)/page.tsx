import { createClient } from "@/lib/supabase/server"
import { LeaderboardTable } from "@/components/leaderboard-table"
import { MobileMatchList } from "@/components/mobile-match-list"
import { EmptyState } from "@/components/empty-state"
import type { MatchWithTeams, Player, PredictionRow } from "@/lib/types"

export const dynamic = "force-dynamic"

export default async function HomePage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  const [{ data: matchesData }, { data: leaderboardData }, { data: predictionsData }] =
    await Promise.all([
      supabase
        .from("matches")
        .select(
          "id, external_id, stage, group_letter, team1_id, team2_id, kickoff_at, status, result1, result2, team1:team1_id(id,name,iso_code,fifa_code,group_letter), team2:team2_id(id,name,iso_code,fifa_code,group_letter)",
        )
        .order("kickoff_at", { ascending: true }),
      supabase
        .from("leaderboard")
        .select("id, username, first_name, last_name, avatar_url, total_points, exact_hits"),
      supabase
        .from("predictions")
        .select("user_id, match_id, pred1, pred2, confirmed_at"),
    ])

  const matches = (matchesData ?? []) as unknown as MatchWithTeams[]
  const players = (leaderboardData ?? []) as Player[]
  const predictions = (predictionsData ?? []) as PredictionRow[]

  // Sortowanie: punkty desc, exact_hits desc (drugorzędnie), nazwisko asc
  const sortedPlayers = [...players].sort((a, b) => {
    if (b.total_points !== a.total_points) return b.total_points - a.total_points
    if (b.exact_hits !== a.exact_hits) return b.exact_hits - a.exact_hits
    return a.last_name.localeCompare(b.last_name, "pl")
  })

  if (matches.length === 0) {
    return <EmptyState />
  }

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
