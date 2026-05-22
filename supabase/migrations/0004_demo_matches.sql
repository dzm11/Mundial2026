-- Mecz demo — flaga is_demo na matches.
-- Demo: mecz testowy przechodzący statusy w czasie (test blokady + punktacji).

alter table public.matches
  add column is_demo boolean not null default false;
