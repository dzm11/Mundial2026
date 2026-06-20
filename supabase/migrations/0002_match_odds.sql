-- Kursy correct-score (dokładny wynik) per mecz, źródło: OddsPortal (scraper).

create table public.match_odds (
  match_id    int  not null references public.matches(id) on delete cascade,
  scoreline   text not null,                      -- "team1:team2" np. "1:0"; "OTHER" = inny wynik
  odds        numeric(8,2) not null check (odds > 0),
  source      text not null default 'oddsportal',
  captured_at timestamptz not null default now(),
  primary key (match_id, scoreline)
);

create index match_odds_match_idx on public.match_odds (match_id);

alter table public.match_odds enable row level security;

-- czyta każdy zalogowany; zapis tylko service-role (RLS bypass) — brak policy write
create policy "match_odds read" on public.match_odds
  for select to authenticated using (true);
