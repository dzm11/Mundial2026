# Mecz demo — test blokady typów i punktacji — projekt

**Data:** 2026-05-22
**Status:** zatwierdzony do planu wdrożenia

## Cel

Mechanizm testowy: przycisk w Ustawieniach tworzy fikcyjny mecz z kick-offem
za 2 minuty, kończący się 3 minuty później. Pozwala zaobserwować na żywo:

- blokadę wierszy typu o godzinie kick-offu,
- odsłonięcie cudzych typów po kick-offie,
- naliczanie punktów po zakończeniu meczu.

Mecz demo „dzieje się sam" w czasie — bez ręcznego klikania kolejnych kroków.

## Kontekst — istniejący model danych

- **Blokada typów** jest czysto czasowa: RLS na `predictions` pozwala na
  INSERT/UPDATE tylko gdy `kickoff_at > now()` (funkcja `match_started`).
  Działa automatycznie, bez dodatkowego mechanizmu.
- **Widoczność cudzych typów**: RLS `predictions read own or started` —
  cudze typy widoczne dopiero po `kickoff_at`. Również automatyczne.
- **Punkty**: widok SQL `prediction_points` nalicza punkty tylko gdy mecz ma
  `status = 'FINISHED'`, ustawione `result1`/`result2` oraz typ jest
  zatwierdzony (`confirmed_at is not null`). Widok `leaderboard` to sumuje.
- **Status meczu** (SCHEDULED → … → FINISHED) zmienia normalnie cron
  synchronizujący z football-data.org. Fikcyjny mecz demo nie jest przez
  niego ruszany — status musi przesuwać dedykowany mechanizm.
- Tabela `matches` ma RLS tylko na SELECT — INSERT/UPDATE/DELETE wymaga
  klienta z rolą serwisową (`createAdminClient`).

## Decyzje (z burzy mózgów)

- Mecz kończy się **automatycznie po czasie** (nie ręcznym przyciskiem) —
  „tak jak naprawdę będzie". Kick-off za 2 min, koniec po 3 min.
- Sposób przesuwania statusu: **realne zapisy** zmieniające `status`
  (SCHEDULED → IN_PLAY → FINISHED). Widok `prediction_points` pozostaje
  nietknięty — działa na zapisanym `status`. (Odrzucono: uczynienie widoku
  SQL świadomym czasu — komplikuje rdzeń punktacji.)
- Panel demo: w **Ustawieniach, widoczny dla wszystkich zalogowanych**.
  Bez bramki admina. Działa też na wdrożonej aplikacji.
- Baza zostanie wyczyszczona przed startem Mundialu — nie projektujemy
  rozbudowanego oznaczania/sprzątania ponad to, co tu opisane.

## Zmiana w bazie danych

Migracja `supabase/migrations/0004_demo_matches.sql`:

```sql
alter table public.matches
  add column is_demo boolean not null default false;
```

Jedyna zmiana schematu. Widoki `prediction_points` i `leaderboard` —
bez zmian (działają na `status = 'FINISHED'`, który ustawia mechanizm
przesuwania). Istniejące wiersze dostają `is_demo = false`.

## Akcje serwerowe

Plik `app/(app)/settings/demo-actions.ts`. Wszystkie akcje:

- używają klienta admina (`createAdminClient`) — `matches` nie ma RLS na
  zapis,
- weryfikują, że wywołujący jest zalogowany (`supabase.auth.getUser()`),
- po zmianie wołają `revalidatePath` dla dotkniętych tras.

### `createDemoMatch()`

Wstawia jeden mecz:
- `is_demo = true`, `stage = 'GROUP'`, `status = 'SCHEDULED'`,
- `kickoff_at = now() + 2 minuty`,
- `result1 = null`, `result2 = null`, `external_id = null`,
- `team1_id`/`team2_id` — dwie różne, losowe drużyny z tabeli `teams`;
  jeśli tabela `teams` jest pusta — `null` (UI pokazuje „—").

Zwraca `{ ok, error? }`.

### `settleDemoMatches()`

Idempotentne. Dla meczów `is_demo`:
- jeśli `now() >= kickoff_at` i `status = 'SCHEDULED'` → ustaw
  `status = 'IN_PLAY'` oraz losowy wynik (`result1`/`result2`, każdy 0–4),
  ustawiany tylko gdy aktualnie `null`,
- jeśli `now() >= kickoff_at + 3 minuty` i `status <> 'FINISHED'` → ustaw
  `status = 'FINISHED'` (wynik już ustawiony przy przejściu w IN_PLAY).

Obie reguły stosowane w jednym wywołaniu, w kolejności (najpierw IN_PLAY,
potem FINISHED) — mecz, który „przegapił" okno IN_PLAY (żadna strona nie
odświeżyła się w trakcie), w jednym wywołaniu trafia do FINISHED z
ustawionym wynikiem. Bezpieczne przy równoległych wywołaniach (wielu
użytkowników) — zapisy ustawiają te same wartości. Zwraca `{ ok, error? }`.

### `deleteDemoMatches()`

`delete from matches where is_demo = true`. Typy do tych meczów znikają
kaskadą (FK `predictions.match_id ... on delete cascade`). Zwraca
`{ ok, error? }`.

## Auto-postęp w czasie

Komponent kliencki `components/auto-refresh.tsx`, zamontowany w
`app/(app)/layout.tsx`:

- przy zamontowaniu oraz co ~30 sekund wywołuje akcję `settleDemoMatches()`,
  a następnie `router.refresh()`,
- dzięki temu mecz demo przechodzi swoje statusy „sam", a strony pokazują
  świeże dane z granulacją ~30 s,
- mutacja dzieje się w akcji serwerowej, nie w renderze komponentu
  serwerowego.

Auto-odświeżanie działa globalnie dla wszystkich zalogowanych — celowo;
przyda się też jako odświeżanie wyników na żywo podczas Mundialu. Można je
później ograniczyć (np. tylko gdy istnieje mecz na żywo), ale nie w tym
zakresie.

## UI — panel w Ustawieniach

Nowa karta „Tryb demo" w `app/(app)/settings/page.tsx`. Treść karty w
komponencie klienckim `components/demo-panel.tsx` (widoczny dla każdego
zalogowanego):

- krótki opis działania,
- instrukcja: wpisz typ na mecz demo **i zatwierdź** („Zatwierdź typy") —
  punkty naliczają się tylko dla zatwierdzonych typów,
- przycisk **„Dodaj mecz demo"** → `createDemoMatch()`, toast sukcesu/błędu,
- przycisk **„Usuń mecze demo"** → `deleteDemoMatches()`, toast.

Przyciski w trakcie akcji w stanie `disabled` (`useTransition`).

## Blokada i odsłanianie typów

Bez zmian w kodzie. Działają już dziś, czysto czasowo po `kickoff_at`
(RLS + kliencki tick czasu w `prediction-cell.tsx`). Mecz demo jedynie
tworzy obserwowalne okno czasowe.

## Pliki

**Nowe:**
- `supabase/migrations/0004_demo_matches.sql`
- `app/(app)/settings/demo-actions.ts`
- `components/demo-panel.tsx`
- `components/auto-refresh.tsx`

**Zmieniane:**
- `app/(app)/settings/page.tsx` — dodanie karty „Tryb demo"
- `app/(app)/layout.tsx` — montaż `<AutoRefresh />`

`lib/types.ts` i `lib/data.ts` — bez zmian; UI nie musi rozróżniać meczów
demo (przechodzą zwykłą ścieżką renderowania).

## Scenariusz testu

1. Ustawienia → „Dodaj mecz demo".
2. Mecze → wpisz typ na mecz demo → „Zatwierdź typy".
3. Po ~2 min: kick-off — wiersz typu staje się tylko do odczytu (blokada
   RLS + UI), pojawia się znacznik LIVE.
4. Po kolejnych ~3 min: status FINISHED, widoczny wynik, punkty w Rankingu
   i na karcie meczu. Strona odświeża się sama.
5. Odsłonięcie cudzych typów: wymaga drugiego konta typującego ten sam
   mecz — przed kick-offem ukryte, po kick-offie widoczne.
6. Sprzątanie: „Usuń mecze demo".

## Kryteria ukończenia

- `npm run build`, `npm run typecheck`, `npm run lint`, `npm run test`
  przechodzą.
- Migracja `0004` wgrana do Supabase (ręcznie, jak poprzednie migracje).
- Ręczny przebieg scenariusza testu potwierdza: blokada wiersza o
  kick-offie, status FINISHED po 3 min, naliczenie punktów dla
  zatwierdzonego trafnego typu.
