import { createClient } from "@/lib/supabase/server"
import type { MatchWithTeams, Player, PredictionRow } from "@/lib/types"

const MATCH_SELECT =
  "id, external_id, stage, group_letter, team1_id, team2_id, kickoff_at, status, result1, result2, " +
  "team1:team1_id(id,name,iso_code,fifa_code,group_letter), " +
  "team2:team2_id(id,name,iso_code,fifa_code,group_letter)"

export async function getMatches(): Promise<MatchWithTeams[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from("matches")
    .select(MATCH_SELECT)
    .order("kickoff_at", { ascending: true })
  return (data ?? []) as unknown as MatchWithTeams[]
}

export async function getLeaderboard(): Promise<Player[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from("leaderboard")
    .select("id, username, first_name, last_name, avatar_url, total_points, exact_hits")
  return (data ?? []) as Player[]
}

export async function getPredictions(): Promise<PredictionRow[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from("predictions")
    .select("user_id, match_id, pred1, pred2, confirmed_at")
  return (data ?? []) as PredictionRow[]
}

// Sortowanie rankingu: punkty desc, dokładne trafienia desc, login asc.
export function sortPlayers(players: Player[]): Player[] {
  return [...players].sort((a, b) => {
    if (b.total_points !== a.total_points) return b.total_points - a.total_points
    if (b.exact_hits !== a.exact_hits) return b.exact_hits - a.exact_hits
    return a.username.localeCompare(b.username, "pl")
  })
}
