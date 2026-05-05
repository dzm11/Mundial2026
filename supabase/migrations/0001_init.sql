-- Mundial 2026 typer — schema, views, RLS

-- ============================================================
-- profiles (1:1 z auth.users)
-- ============================================================
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique not null,
  first_name text not null,
  last_name text not null,
  avatar_url text,
  created_at timestamptz not null default now()
);

create index profiles_username_idx on public.profiles (lower(username));

-- ============================================================
-- teams (48 drużyn WC 2026)
-- ============================================================
create table public.teams (
  id serial primary key,
  name text not null,
  iso_code text not null,            -- ISO 3166-1 alpha-2 (np. 'AR')
  fifa_code text unique not null,    -- np. 'ARG'
  group_letter text                  -- 'A'..'L'
);

-- ============================================================
-- matches (104 mecze)
-- ============================================================
create table public.matches (
  id serial primary key,
  external_id integer unique,
  stage text not null check (stage in ('GROUP','R32','R16','QF','SF','3RD','F')),
  group_letter text,
  team1_id int references public.teams(id),
  team2_id int references public.teams(id),
  kickoff_at timestamptz not null,
  status text not null default 'SCHEDULED'
    check (status in ('SCHEDULED','TIMED','IN_PLAY','PAUSED','FINISHED','POSTPONED','SUSPENDED','CANCELLED')),
  result1 int,
  result2 int,
  updated_at timestamptz not null default now()
);

create index matches_kickoff_idx on public.matches (kickoff_at);
create index matches_stage_idx on public.matches (stage, group_letter);

-- ============================================================
-- predictions (typy graczy)
-- ============================================================
create table public.predictions (
  id bigserial primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  match_id int not null references public.matches(id) on delete cascade,
  pred1 int not null check (pred1 >= 0 and pred1 <= 99),
  pred2 int not null check (pred2 >= 0 and pred2 <= 99),
  confirmed_at timestamptz,
  updated_at timestamptz not null default now(),
  unique (user_id, match_id)
);

create index predictions_user_idx on public.predictions (user_id);
create index predictions_match_idx on public.predictions (match_id);

-- ============================================================
-- helper: czy mecz wystartował
-- ============================================================
create or replace function public.match_started(mid int)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.matches m
    where m.id = mid and m.kickoff_at <= now()
  );
$$;

-- ============================================================
-- view: punkty 3/1/0
-- ============================================================
create or replace view public.prediction_points as
select
  p.user_id,
  p.match_id,
  case
    when m.status <> 'FINISHED' or p.confirmed_at is null
      or m.result1 is null or m.result2 is null then 0
    when p.pred1 = m.result1 and p.pred2 = m.result2 then 3
    when sign(p.pred1 - p.pred2) = sign(m.result1 - m.result2) then 1
    else 0
  end as points,
  case
    when m.status = 'FINISHED' and p.confirmed_at is not null
      and p.pred1 = m.result1 and p.pred2 = m.result2 then 1
    else 0
  end as exact_hit
from public.predictions p
join public.matches m on m.id = p.match_id;

-- ============================================================
-- view: leaderboard
-- ============================================================
create or replace view public.leaderboard as
select
  pr.id,
  pr.username,
  pr.first_name,
  pr.last_name,
  pr.avatar_url,
  coalesce(sum(pp.points), 0)::int as total_points,
  coalesce(sum(pp.exact_hit), 0)::int as exact_hits,
  pr.created_at
from public.profiles pr
left join public.prediction_points pp on pp.user_id = pr.id
group by pr.id;

-- ============================================================
-- RLS
-- ============================================================

alter table public.profiles enable row level security;
alter table public.teams enable row level security;
alter table public.matches enable row level security;
alter table public.predictions enable row level security;

-- profiles: każdy zalogowany czyta wszystkie, pisze tylko swój
create policy "profiles read" on public.profiles
  for select to authenticated using (true);

create policy "profiles update own" on public.profiles
  for update to authenticated using (auth.uid() = id) with check (auth.uid() = id);

create policy "profiles insert own" on public.profiles
  for insert to authenticated with check (auth.uid() = id);

-- teams: czyta każdy zalogowany, write tylko service-role (RLS bypass)
create policy "teams read" on public.teams
  for select to authenticated using (true);

-- matches: czyta każdy zalogowany
create policy "matches read" on public.matches
  for select to authenticated using (true);

-- predictions:
--   SELECT — własne zawsze; cudze tylko gdy mecz wystartował
create policy "predictions read own or started" on public.predictions
  for select to authenticated
  using (
    user_id = auth.uid()
    or public.match_started(match_id)
  );

--   INSERT — tylko swoje, tylko jeśli mecz jeszcze nie wystartował
create policy "predictions insert own pre-kickoff" on public.predictions
  for insert to authenticated
  with check (
    user_id = auth.uid()
    and not public.match_started(match_id)
  );

--   UPDATE — tylko swoje, tylko jeśli mecz jeszcze nie wystartował
create policy "predictions update own pre-kickoff" on public.predictions
  for update to authenticated
  using (
    user_id = auth.uid()
    and not public.match_started(match_id)
  )
  with check (
    user_id = auth.uid()
    and not public.match_started(match_id)
  );

-- views są widoczne dla authenticated (Postgres views dziedziczą RLS bazowych tabel)
grant select on public.prediction_points to authenticated;
grant select on public.leaderboard to authenticated;

-- ============================================================
-- avatars storage bucket policies (utworzyć bucket "avatars" jako public)
-- ============================================================
-- create policies via SQL after bucket exists:
--   read: public
--   insert/update/delete: storage.foldername(name)[1] = auth.uid()::text
