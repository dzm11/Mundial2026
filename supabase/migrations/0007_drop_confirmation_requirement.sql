-- Punkty bez wymogu zatwierdzania typu.
--
-- Typ zapisany autosave'em w momencie startu meczu jest ostateczny — RLS
-- ("predictions insert/update own pre-kickoff") blokuje zmiany po kick-offie,
-- więc osobne "Zatwierdź typy" (confirmed_at) nie niesie żadnej informacji.
-- Użytkownicy zapominali klikać przycisk i tracili punkty mimo trafionych
-- typów. Widok przelicza się w locie, więc zaległe punkty pojawią się
-- natychmiast po migracji — bez backfilla.
--
-- Kolumna predictions.confirmed_at zostaje (nieużywana) — usuwanie kolumny
-- to niepotrzebne ryzyko w trakcie trwającego turnieju.

create or replace view public.prediction_points as
select
  p.user_id,
  p.match_id,
  case
    when m.status <> 'FINISHED'
      or m.result1 is null or m.result2 is null then 0
    when p.pred1 = m.result1 and p.pred2 = m.result2 then 3
    when sign(p.pred1 - p.pred2) = sign(m.result1 - m.result2) then 1
    else 0
  end as points,
  case
    when m.status = 'FINISHED'
      and p.pred1 = m.result1 and p.pred2 = m.result2 then 1
    else 0
  end as exact_hit
from public.predictions p
join public.matches m on m.id = p.match_id;

-- Widok musi respektować RLS pytającego (patrz 0006_security_hardening.sql).
alter view public.prediction_points set (security_invoker = on);
