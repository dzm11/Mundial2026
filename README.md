# Meczyki — typer Mundial 2026

Aplikacja do gry typerskiej dla zamkniętej grupy znajomych. Każdy gracz wpisuje typy
na 104 mecze MŚ 2026 (USA/Kanada/Meksyk, 11.06–19.07.2026), system punktuje 3/1/0,
a tabela aktualizuje się w czasie rzeczywistym.

## Stack

- **Next.js 16** (App Router, RSC, Server Actions, turbopack dev)
- **shadcn/ui** (preset `bIqKxRg`: vega · neutral · yellow · lucide · inter · large radius)
- **Supabase** — Postgres + Auth + Storage (avatary)
- **Vercel** — hosting + Cron Jobs (synchronizacja wyników co 5 min)
- Źródła danych: [`openfootball/worldcup.json`](https://github.com/openfootball/worldcup.json)
  (seed harmonogramu) + [football-data.org](https://www.football-data.org/) (live wyniki, kompetycja
  WC, id 2000, TIER_ONE — dostępna na free)
- Flagi: [flagcdn.com](https://flagcdn.com) (PNG po kodzie ISO 3166-1)

## Mechanika

- **Punktacja**: 3 pkt dokładny wynik, 1 pkt poprawny zwycięzca/remis, 0 pkt pudło. Faza
  pucharowa: tylko regulaminowe 90 min.
- **Lock typu**: dokładnie o godzinie kick-offu (egzekwowane RLS-em w Postgresie).
- **Widoczność**: cudze typy ukryte do gwizdka; po rozpoczęciu meczu odsłaniają się wszystkim.
- **Tiebreaker**: dzielone miejsce ex aequo, sortowanie wizualne alfabetyczne.
- **Auth**: login + hasło (bez e-maila). Hasło: ≥8 znaków, ≥1 wielka litera, ≥1 cyfra,
  ≥1 znak specjalny.

## Setup lokalnie

```bash
# 1. Zależności
npm install

# 2. Supabase
#  — utwórz projekt na https://supabase.com
#  — wgraj migracje z supabase/migrations/ (Dashboard → SQL Editor lub Supabase CLI)
#  — w Storage utwórz bucket "avatars" jako PUBLIC (lub uruchom 0002_storage_avatars.sql)

# 3. Env
cp .env.local.example .env.local
# uzupełnij SUPABASE_*, FOOTBALL_DATA_API_TOKEN
# (z https://www.football-data.org/client/register),
# CRON_SECRET (np. `openssl rand -hex 32`)

# 4. Seed harmonogramu
npm run seed

# 5. Dev server
npm run dev
```

Otwórz http://localhost:3000, zarejestruj konto i typuj.

## Deploy na Vercel

1. `git push` → import w Vercel.
2. Wgraj te same env vars w **Project Settings → Environment Variables**.
3. Cron z `vercel.json` ruszy automatycznie (`*/5 * * * *`). Vercel sam doda nagłówek
   `Authorization: Bearer $CRON_SECRET`.

## Skrypty

```bash
npm run dev        # development z turbopack
npm run build      # production build
npm run typecheck  # tsc --noEmit
npm run lint       # eslint
npm test           # vitest (lib/scoring)
npm run seed       # zaimportuj 104 mecze z openfootball
```

## Architektura

```
app/
  (auth)/         # logowanie + rejestracja (server actions)
  (app)/          # główna tabela, ustawienia (chronione middleware)
  api/cron/       # endpointy crona (sekret w Authorization)
components/
  leaderboard-table.tsx   # desktop: pełna macierz mecz × gracz
  mobile-match-list.tsx   # mobile: lista + sheet z typami
  prediction-cell.tsx     # input/lock/odsłonięcie (RLS dba o resztę)
  flag.tsx
lib/
  supabase/{server,client,admin,middleware}.ts
  scoring.ts              # czysta funkcja 3/1/0
  validation.ts           # zod schemas
  fifa-to-iso.ts          # FIFA code → ISO 3166-1 alpha-2
  groups.ts               # nazwy faz turnieju
supabase/migrations/      # schema + RLS
scripts/seed.ts           # import openfootball worldcup.json
```

## RLS — kluczowa logika "ukryte do kick-offu"

W `predictions` polityka SELECT pozwala zobaczyć cudzy typ tylko gdy
`public.match_started(match_id)` zwraca `true` (czyli `kickoff_at <= now()`). Próba
INSERT/UPDATE po kick-offie jest blokowana. Dzięki temu **klient nie ma żadnej
możliwości obejścia blokady** — egzekwuje to baza.

## Otwarte / TODO

- Po losowaniu interkontynentalnych baraży uzupełnić mapowanie FIFA→ISO
  w `lib/fifa-to-iso.ts` dla 3 ostatnich uczestniczek.
- Vercel Cron — sprawdzić, czy plan Hobby pokrywa nasze potrzeby; alternatywnie GitHub
  Actions schedule wywołujący `/api/cron/sync-matches`.
- Realtime (Supabase Channels) na `matches` + `predictions` jako rozszerzenie — UI samo się
  odświeża co minutę przez `dynamic = 'force-dynamic'`, więc to opcjonalne.
