-- Security hardening — odpowiedź na ostrzeżenia Supabase Security Advisor.
-- Uruchom w Supabase → SQL Editor (DDL, nie przechodzi przez PostgREST).

-- ============================================================
-- 1) Security Definer View (CRITICAL) — leaderboard, prediction_points
-- ============================================================
-- W Postgres 15+ widoki domyślnie wykonują się z uprawnieniami właściciela
-- (omijają RLS pytającego). Włączamy security_invoker, by widok respektował
-- RLS bieżącego użytkownika.
--
-- Poprawność rankingu zachowana: punkty naliczają się TYLKO dla meczów
-- FINISHED (a więc rozpoczętych), których typy są — zgodnie z polityką
-- "predictions read own or started" — widoczne dla każdego zalogowanego.
alter view public.prediction_points set (security_invoker = on);
alter view public.leaderboard set (security_invoker = on);

-- ============================================================
-- 2) SECURITY DEFINER function dostępna dla public/anon — match_started
-- ============================================================
-- Funkcja używana wyłącznie w politykach RLS dla zalogowanych. Odbieramy
-- prawo wykonania anonimom i ogólnemu PUBLIC, zostawiamy authenticated.
revoke execute on function public.match_started(int) from public;
revoke execute on function public.match_started(int) from anon;
grant execute on function public.match_started(int) to authenticated;
