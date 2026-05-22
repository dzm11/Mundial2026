# Licznik kick-offu + znacznik live + minuta meczu — projekt

**Data:** 2026-05-22
**Status:** zatwierdzony do planu wdrożenia

## Cel

Na karcie meczu (widok Mecze) i kompaktowo w Siatce:

1. **Odliczanie** do kick-offu — dla meczów *dzisiaj* przed rozpoczęciem:
   „za 14 min", „za 2 godz 10 min", a przy meczu demo „za 12 s".
2. **Znacznik live** — gdy mecz trwa: zielone pulsujące kółko + **minuta
   meczu** („67'").
3. **Przerwa** — gdy mecz jest w przerwie: znacznik „Przerwa" (bez minuty).
4. Po przerwie — **druga połowa** znów pokazuje kółko + minutę.

## Źródła danych

Minuta i faza zależą od typu meczu:

- **Prawdziwe mecze MŚ** — z API football-data.org. API udostępnia `minute`
  oraz `status` (w tym `PAUSED` = przerwa). `status` już jest
  synchronizowany; dochodzi synchronizacja pola `minute`.
- **Mecz demo** — nie ma danych w API. Faza i minuta liczone po stronie
  klienta z `kickoff_at` + stałych faz demo. `settleDemoMatches` steruje
  kolumną `status` w bazie (potrzebną widokowi punktów).

Powód podziału: dla prawdziwych meczów liczenie `teraz − kickoff` po stronie
klienta jest błędne (nie uwzględnia przerwy) — dlatego API. Mecz demo API
nie zna, więc jego oś czasu jest deterministyczna i liczona z `kickoff_at`.

## `lib/match-clock.ts` (nowy)

Jedno źródło prawdy. Eksportuje:

**Stałe faz demo** (czas rzeczywisty od kliknięcia / od kick-offu):
- `DEMO_KICKOFF_DELAY_MS = 15_000` — kick-off 15 s po kliknięciu
- `DEMO_HALF1_MS = 15_000` — 1. połowa 15 s
- `DEMO_BREAK_MS = 5_000` — przerwa 5 s
- `DEMO_HALF2_MS = 15_000` — 2. połowa 15 s

**`matchClock(match: MatchWithTeams, now: number): MatchClock`** — czysta
funkcja. `MatchClock` to suma typów:
- `{ phase: "scheduled"; msToKickoff: number }` — przed kick-offem
- `{ phase: "live"; minute: number }` — mecz trwa
- `{ phase: "halftime" }` — przerwa
- `{ phase: "finished" }` — po meczu

Logika:
- **Mecz demo** (`match.is_demo`): `elapsed = now − kickoff`.
  - `elapsed < 0` → `scheduled`, `msToKickoff = −elapsed`
  - `0 ≤ elapsed < HALF1` → `live`, minuta liniowo 1→45 w oknie `HALF1`
  - `HALF1 ≤ elapsed < HALF1+BREAK` → `halftime`
  - `HALF1+BREAK ≤ elapsed < HALF1+BREAK+HALF2` → `live`, minuta 46→90
  - dalej → `finished`
- **Prawdziwy mecz**: z `match.status` + `match.minute`.
  - `SCHEDULED`/`TIMED` → `scheduled` (`msToKickoff` z `kickoff_at`)
  - `IN_PLAY` → `live`, `minute = match.minute ?? 0`
  - `PAUSED` → `halftime`
  - `FINISHED` → `finished`
  - pozostałe (`POSTPONED`/`SUSPENDED`/`CANCELLED`) → `scheduled`

Pokryte testem `lib/match-clock.test.ts`.

## Baza danych

Migracja `supabase/migrations/0005_match_minute.sql`:

```sql
alter table public.matches add column minute int;
```

Dla prawdziwych meczów (z API). Mecz demo kolumny nie używa — minuta demo
jest liczona po stronie klienta. Widoki punktów bez zmian.

## Synchronizacja z API (`app/api/cron/sync-matches/route.ts`)

Do typu `FdMatch` dochodzi `minute: number | null`; w `update` na `matches`
dopisywane jest `minute: m.minute ?? null`. `status` (w tym `PAUSED`) już
jest synchronizowany — bez zmian. Cron co 5 min — minuta prawdziwego meczu
odświeża się co synchronizację (akceptowalne; do ewentualnego dociśnięcia
w trakcie Mundialu).

## `settleDemoMatches` (`app/(app)/demo-actions.ts`)

Nowa oś czasu demo, fazy ze stałych z `lib/match-clock.ts`:
- `elapsed < 0` → `SCHEDULED`
- `0 ≤ elapsed < HALF1` → `IN_PLAY` (1. połowa); losowy wynik ustawiany raz
- `HALF1 ≤ elapsed < HALF1+BREAK` → `PAUSED` (przerwa)
- `HALF1+BREAK ≤ elapsed < HALF1+BREAK+HALF2` → `IN_PLAY` (2. połowa)
- dalej → `FINISHED`

Wszystkie reguły w jednym wywołaniu, w kolejności (mecz, który „przegapił"
fazy między tickami, trafia do właściwego stanu). Idempotentne. `minute`
w bazie dla meczu demo nie jest zapisywana (klient liczy ją sam).

`createDemoMatch` — `kickoff_at = now + DEMO_KICKOFF_DELAY_MS` (15 s).

## UI — karta meczu (`components/match-card.tsx`)

Render zależny od `matchClock(match, now)`:
- `scheduled` — gdy kick-off dziś: odliczanie. Format: `< 60 s` → „za Xs",
  `< 60 min` → „za X min", więcej → „za Xh Ym". Gdy kick-off nie dziś —
  bez odliczania (sama godzina/data).
- `live` — zielone pulsujące kółko (pierścień `animate-ping` + kropka) +
  „{minute}'".
- `halftime` — znacznik „Przerwa".
- `finished` — znacznik „FT".

**Płynność meczu demo:** karta meczu, gdy `match.is_demo`, prowadzi własny
licznik `now` odświeżany co **1 s** (`useState` zainicjowane wartością
propa `now`, dalej `setInterval` w `useEffect`) — fazy demo (15 s) są
krótsze niż globalny tick 30 s, więc bez tego nie byłyby widoczne. Dla
prawdziwych meczów karta korzysta z propa `now` (tick 30 s). Inicjalizacja
`useState` wartością propa = brak rozjazdu hydratacji.

## UI — Siatka (`components/predictions-matrix.tsx`)

W komórce statusu, kompaktowo: zielone kółko + minuta gdy `live`,
„Przerwa" gdy `halftime`, „FT" gdy `finished` — zamiast obecnego badge'a
„LIVE"/„FT". Bez odliczania (Siatka pokazuje godzinę).

## Pozostałe pliki

- `lib/types.ts` — `Match` dostaje `minute: number | null`
- `lib/data.ts` — `minute` w `MATCH_SELECT`
- `components/demo-panel.tsx` — tekst zaktualizowany (kick-off 15 s, połowy
  15 s / przerwa 5 s / 15 s)

## Bez zmian

Blokada typów (RLS po `kickoff_at`), scoring, widoki `prediction_points` /
`leaderboard`, odsłanianie cudzych typów.

## Kryteria ukończenia

- `npm run build`, `typecheck`, `lint`, `test` przechodzą
- `lib/match-clock.test.ts` pokrywa `matchClock` (demo i prawdziwe mecze,
  wszystkie fazy)
- Migracja `0005` wgrana do Supabase
- Przebieg demo: kliknij „Dodaj mecz demo" → odliczanie „za 15 s…" →
  kick-off → zielone kółko + minuta rośnie → „Przerwa" → 2. połowa, kółko
  + minuta → „FT" + wynik + punkty w Rankingu
