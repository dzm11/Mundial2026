# Zbieranie kursów correct-score (OddsPortal → Supabase)

> **Dla asystenta / CI:** to jest kanoniczna strategia. Przeczytaj ten plik
> ZAWSZE, zanim zaczniesz zbierać kursy meczów. Zweryfikowana na żywo:
> czerwiec 2026 (backfill ~830 wierszy / 27 meczów) oraz **lipiec 2026** po
> przejściu OddsPortal na zaszyfrowany feed kursów + zmianie bazy na wynik 90 min
> (skrypt odszyfrowuje feed i mapuje po wyniku regulaminowym — patrz niżej).

## TL;DR — jak odpalić

```bash
# Wymaga: zainstalowany Google Chrome + .env.local z kluczami Supabase (poniżej)
npm run scrape:odds
```

Skrypt jest **idempotentny** (upsert po `match_id,scoreline`) — można go odpalać
wielokrotnie; dociąga brakujące/nowe kursy bez duplikatów.

Tryb debug (widoczne okno + dump pierwszego meczu):

```bash
HEADFUL=1 SCRAPE_DEBUG=1 MATCH_LIMIT=1 npm run scrape:odds
```

Zmienne sterujące:
- `HEADFUL=1` — pokaż okno przeglądarki (domyślnie headless).
- `SCRAPE_DEBUG=1` — wypisz dla 1. meczu: drużyny, kickoff, wynik 90 min, liczbę
  kursów (oraz etap, na którym mecz odpadł, jeśli się nie udało).
- `MATCH_LIMIT=N` — ogranicz do pierwszych N linków (szybki smoke test).
- `MATCH_URL=<url h2h>` — pomiń listę i zescrapuj tylko jeden mecz (diagnostyka).

## Wymagania

- **Google Chrome** zainstalowany lokalnie (Playwright `channel: "chrome"`).
  Powód: OddsPortal blokuje zwykłe headless Chromium **HTTP 503** (detekcja
  botów). Realny Chrome przechodzi. Fallback do bundled chromium jest w kodzie,
  ale bywa blokowany.
- `.env.local` z:
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `SUPABASE_SERVICE_ROLE_KEY` (zapis omija RLS — tabela `match_odds` nie ma
    polityki write).
- Playwright (`devDependency`, już w repo). Jeśli brak Chrome:
  `npx playwright install chromium` (gorzej — patrz wyżej).

## Jak to działa (kluczowe obejścia)

> **Zmiana (lipiec 2026):** OddsPortal przestał renderować kursy w DOM — dociąga
> je jako **zaszyfrowany feed `.dat`**. Skrypt nie skrobie już tabeli ze strony;
> pobiera i **odszyfrowuje feed** (`decrypt.ts`). Równolegle baza przeszła na
> **wynik regulaminowy (90 min)** — dlatego mapowanie porównuje 90 min, a nie
> wynik po dogrywce (patrz pkt 4). To te dwie rzeczy „popsuły" starą wersję.

1. **Strona wyników (geo PL):**
   `https://www.oddsportal.com/pl/football/world/mistrzostwa-swiata-2026/results/`
   - OddsPortal przekierowuje klienta z PL na ścieżkę `/pl/`; **angielski slug
     404-uje**. Dlatego startujemy od polskiego URL-a (`mistrzostwa-swiata-2026`).
2. **Linki meczów:** prowadzą do `/football/h2h/<a>/<b>/`. Zbieramy je
   **przewijając** stronę do końca (lazy-load), aż liczba linków przestanie rosnąć.
   Anonimowo OddsPortal listuje tylko część meczów (te z kursami wybranych
   domyślnie bukmacherów) — reszta bazy to i tak zwykle fikstury demo rozbieżne
   z realnym turniejem (patrz „Pułapki”).
3. **Kursy correct-score = zaszyfrowany feed, nie DOM:**
   1. wczytujemy `/football/h2h/<a>/<b>/` w realnym Chrome (omija anty-bota),
   2. z **surowego HTML-a** (nie live-DOM — React po hydratacji kasuje atrybut
      `data` z `#react-event-header`) czytamy `EventInfo`: `hash`, `xhash`
      (pole `xhashf`, url-decoded), `versionId`, `sportId`, `startDate`,
      `partialresult` (`extractEventInfo`),
   3. budujemy URL feedu correct-score: `<ver>-<sport>-<hash>-8-2-<xhash>.dat`
      (betType **8** = correct-score, scope **2**; `csFeedPath`),
   4. pobieramy feed **w kontekście przeglądarki** (`fetch` same-origin — te same
      ciasteczka/UA, brak 503) i **odszyfrowujemy** (`decrypt.ts`).
4. **Deszyfracja feedu (`decrypt.ts`):** payload to `base64("<b64_ct>:<hex_iv>")`,
   klucz = PBKDF2(SHA-256, hasło+sól zaszyte w bundlu OddsPortal, 1000 iter, 256b),
   szyfr AES-256-CBC; jeśli wynik ma magic gzip → gunzip. JSON ma `d.oddsdata.back`
   z pozycjami `{ mixedParameterName: "1:0", odds: { <bookieId>: [kurs] } }`.
   Jeśli kiedyś przestanie działać: w `app-*.js` znajdź `deriveKey({name:"PBKDF2"…})`
   i odczytaj nowe hasło/sól z tablicy stringów.
5. **Mapowanie meczu — po CZASIE + WYNIKU 90 MIN (NIE po nazwach):**
   - `startDate` (unix, UTC) z feedu == `kickoff_at` w bazie (unikalny) →
     mapujemy po minucie (`minuteKey`),
   - **wynik 90 min** liczymy z `partialresult` (`regularTimeFromPartial`):
     segmenty są przyrostowe per okres, więc 90 min = suma **dwóch pierwszych**
     połów (dogrywkę/karne pomijamy). To zgadza się z `result1/result2` w bazie,
     które też są po 90 min. **Uwaga:** feedowe `homeResult/awayResult` to wynik
     **po dogrywce** — dlatego NIE ich używamy do orientacji,
   - orientację scoreline potwierdzamy tym 90-min wynikiem (`orientByResult`):
     musi się zgadzać z `team1:team2` w którejś orientacji (inaczej to nie ten mecz).
6. **Parsowanie kursów (`parseCsScores`):** dla każdego scoreline bierzemy
   **najwyższy kurs** spośród bukmacherów (best odds — jak w tabeli zbiorczej
   OddsPortal). Klucz to `mixedParameterName` (perspektywa gospodarza).
7. **Zapis:** upsert do `public.match_odds` (`match_id, scoreline, odds, source`),
   scoreline w perspektywie `team1:team2` (jeśli gospodarz OddsPortal = nasze
   `team2`, scoreline jest odwracany przez `flipScoreline`).

Pliki: `scripts/scrape-odds/index.ts` (I/O + Playwright),
`scripts/scrape-odds/decrypt.ts` (deszyfracja feedu),
`scripts/scrape-odds/parsing.ts` (czyste helpery, testowane w `parsing.test.ts`:
`extractEventInfo`, `csFeedPath`, `regularTimeFromPartial`, `parseCsScores`,
`orientByResult`, `flipScoreline`).

## Pułapki / na co uważać

- **Bundled chromium = 503.** Zawsze realny Chrome (`channel: "chrome"`).
- **Geo-redirect.** Używaj polskiego URL-a wyników.
- **Flaky network.** SPA bywa kapryśna — w kodzie są retry (`gotoWithRetry`,
  `safeEval`). Pojedynczy mecz potrafi się nie doczytać; ponowny przebieg go dobierze.
- **Buforowanie stdout.** Przy uruchomieniu nie-TTY (CI/background) logi nie
  pojawiają się na bieżąco. **Postęp sprawdzaj zapytaniem do bazy**, nie po stdout.
- **Rozbieżność fikstur.** Mecz mapuje się tylko, gdy istnieje **i** w bazie
  (`status = 'FINISHED'`), **i** na OddsPortal, o **tej samej godzinie**, z **tym
  samym wynikiem**. Mecze pucharowe z demo-drabinki, które różnią się od realnych
  par OddsPortal, mają inny wynik/godzinę → pomijane (log „brak dopasowania").
  To oczekiwane i bezpieczne (nie przypiszemy kursów do złego meczu).
- **Throttling OddsPortal.** Po intensywnym scrapowaniu z jednego IP strona
  potrafi przestać renderować kursy (puste strony, `kursy=0` dla wszystkich).
  To przejściowe — odczekaj / odpal z innego łącza. Diagnostyka jednego meczu:
  `MATCH_URL="<url h2h>" SCRAPE_DEBUG=1 npm run scrape:odds`.

## Weryfikacja po przebiegu

```bash
# Liczba wierszy + pokrytych meczów (skrypt pomocniczy ad-hoc — patrz niżej)
```

Sensowne sprawdzenia:
- `select count(*) from match_odds;` oraz `count(distinct match_id)`.
- **Pokrycie bilansu:** ile zakończonych meczów ma kurs dla *faktycznego* wyniku
  (`"{result1}:{result2}"` lub `OTHER`) — tylko te liczą się do bilansu na `/stats`.
- Spot-check orientacji: weź znany mecz (np. Turkey 0-1 Paraguay) i sprawdź, czy
  kurs `0:1` odpowiada realnemu rezultatowi.

Przykładowy skrypt weryfikujący można złożyć ad-hoc na bazie `lib/stats.ts`
(`computeAllStats`, `oddsCoverage`) — nie commitujemy go na stałe.

## Wskazówki pod CI (gdy zrobimy automat)

- Runner z **Google Chrome** (np. GitHub Actions: `browser-actions/setup-chrome`
  lub obraz z Chrome) — `channel: "chrome"`.
- `SUPABASE_SERVICE_ROLE_KEY` + `NEXT_PUBLIC_SUPABASE_URL` jako **sekrety**.
- Idempotentność → bezpieczne ponawianie; można odpalać po cronie w trakcie turnieju.
- Skrypt sam kończy się kodem ≠ 0 przy twardym błędzie (brak kluczy, brak strony).
  Pojedyncze pominięte mecze nie przerywają przebiegu (raport „zapisano / pominięto").
- Rozważ retry całego joba (network flakiness) + krótki `MATCH_LIMIT` smoke test
  jako gate przed pełnym przebiegiem.
