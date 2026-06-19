export type Team = {
  id: number
  name: string
  iso_code: string
  fifa_code: string
  group_letter: string | null
}

export type Match = {
  id: number
  external_id: number | null
  stage: "GROUP" | "R32" | "R16" | "QF" | "SF" | "3RD" | "F"
  group_letter: string | null
  team1_id: number | null
  team2_id: number | null
  kickoff_at: string
  status: string
  result1: number | null
  result2: number | null
  minute: number | null
  is_demo: boolean
}

export type MatchWithTeams = Match & {
  team1: Team | null
  team2: Team | null
}

export type Player = {
  id: string
  username: string
  first_name: string
  last_name: string
  avatar_url: string | null
  total_points: number
  exact_hits: number
}

export type PredictionRow = {
  user_id: string
  match_id: number
  pred1: number
  pred2: number
}

export type MatchOddsRow = {
  match_id: number
  scoreline: string
  odds: number
}
