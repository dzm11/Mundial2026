import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"

export const metadata = {
  title: "Regulamin",
}

export default function RegulaminPage() {
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <header className="space-y-2">
        <div className="flex items-center gap-3">
          <h1 className="font-display text-2xl font-extrabold tracking-tight">Regulamin typowania</h1>
          <Badge variant="secondary">Wersja 1.0</Badge>
        </div>
        <p className="text-muted-foreground text-sm">
          Mistrzostwa Świata 2026 · 11.06.2026 – 19.07.2026
        </p>
      </header>

      <Card>
        <CardContent className="space-y-6 py-6 text-sm leading-relaxed">
          <section className="space-y-3">
            <h2 className="font-display text-base font-bold">Zasady ogólne</h2>
            <ol className="text-muted-foreground list-decimal space-y-2 pl-5">
              <li>
                Edycja typera trwa przez cały czas trwania Mistrzostw Świata 2026, tj. od 11.06.2026 r.
                do 19.07.2026 r., dalej zwanych w regulaminie&nbsp;— <strong>MŚ 2026</strong>.
              </li>
              <li>W typowane mecze zawierają się wszystkie spotkania, które rozegrane zostaną podczas MŚ 2026.</li>
              <li>Wpisowe w tej edycji typera wynosić będzie <strong>30&nbsp;zł</strong> od każdego uczestnika.</li>
              <li>
                Wpisowe należy wpłacić do organizatora najpóźniej do 11.06.2026 r. w postaci BLIK na nr tel.
                organizatora&nbsp;— <strong>601&nbsp;862&nbsp;766</strong>. W przeciwnym wypadku osoba nie będzie
                miała możliwości uczestnictwa w tej edycji typera.
              </li>
            </ol>
          </section>

          <Separator />

          <section className="space-y-3">
            <h2 className="font-display text-base font-bold">Typowanie</h2>
            <ol className="text-muted-foreground list-decimal space-y-2 pl-5" start={5}>
              <li>
                Typowanie odbywa się poprzez wpisanie swojego wyniku meczu do odpowiednich komórek na stronie,
                na której należy się uprzednio zarejestrować i założyć konto. Typ określony jest przez liczbę,
                jaką uczestnik wpisuje w okno danej drużyny, co jednoznacznie składa się na wynik meczu.
              </li>
              <li>
                Typ na dany mecz należy wpisać najpóźniej do momentu rozpoczęcia danego meczu, tzn. jeśli mecz
                zaczyna się o godzinie 18:00, to do godziny 18:00 należy wpisać swój typ.
              </li>
              <li>
                W przypadku braku możliwości wpisania typów na stronie należy niezwłocznie podać swoje typy na
                podane mecze organizatorowi, który uzupełni komórki danej osoby do dwóch dni roboczych.
              </li>
              <li>
                Przez cały czas obstawiania pod uwagę brany jest <strong>TYLKO regulaminowy czas trwania gry</strong>{" "}
                (tzn. z pominięciem dogrywki oraz rzutów karnych).
              </li>
            </ol>
          </section>

          <Separator />

          <section className="space-y-3">
            <h2 className="font-display text-base font-bold">Punktacja</h2>
            <ul className="space-y-2">
              <li className="flex items-start gap-3">
                <Badge className="mt-0.5 shrink-0">3 pkt</Badge>
                <span className="text-muted-foreground">
                  za wytypowanie dokładnego wyniku w regulaminowym czasie gry.
                </span>
              </li>
              <li className="flex items-start gap-3">
                <Badge variant="secondary" className="mt-0.5 shrink-0">1 pkt</Badge>
                <span className="text-muted-foreground">
                  za wytypowanie zwycięzcy meczu lub remisu niedokładnym wynikiem w regulaminowym czasie gry.
                </span>
              </li>
              <li className="flex items-start gap-3">
                <Badge variant="outline" className="mt-0.5 shrink-0">0 pkt</Badge>
                <span className="text-muted-foreground">
                  za błędne wytypowanie zwycięzcy meczu bądź wytypowanie remisu, podczas gdy jedna z drużyn
                  zwyciężyła w regulaminowym czasie gry.
                </span>
              </li>
            </ul>
          </section>

          <Separator />

          <section className="space-y-3">
            <h2 className="font-display text-base font-bold">Nagrody</h2>
            <ul className="space-y-2">
              <li className="flex items-center gap-3">
                <Badge className="shrink-0">1. miejsce</Badge>
                <span className="text-muted-foreground">50% z puli wpisowego.</span>
              </li>
              <li className="flex items-center gap-3">
                <Badge variant="secondary" className="shrink-0">2. miejsce</Badge>
                <span className="text-muted-foreground">30% z puli wpisowego.</span>
              </li>
              <li className="flex items-center gap-3">
                <Badge variant="outline" className="shrink-0">3. miejsce</Badge>
                <span className="text-muted-foreground">20% z puli wpisowego.</span>
              </li>
            </ul>
            <p className="text-muted-foreground">
              Organizator zobowiązuje się wypłacić nagrody do dnia 15.08.2026 r.
            </p>
          </section>

          <Separator />

          <section className="space-y-3">
            <h2 className="font-display text-base font-bold">Postanowienia końcowe</h2>
            <ol className="text-muted-foreground list-decimal space-y-2 pl-5" start={9}>
              <li>
                Organizator zastrzega sobie prawo zmian w regulaminie w czasie trwania typowania i zobowiązuje
                się do natychmiastowego opublikowania zmienionego regulaminu w miejscu, w którym uprzednio
                opublikował dany regulamin konkursu.
              </li>
              <li>
                Wszelkie ewentualne spory mogące wynikać w związku z typowaniem lub interpretacją postanowień
                niniejszego Regulaminu poddane będą pod rozstrzygnięcie organizatora.
              </li>
              <li>
                W przypadku jakichkolwiek problemów występujących podczas trwania konkursu uczestnik zobowiązany
                jest niezwłocznie powiadomić o nich organizatora.
              </li>
            </ol>
          </section>

          <Separator />

          <p className="text-muted-foreground text-right text-sm">
            Organizator
            <br />
            <strong className="text-foreground">Szymon Olejniczak</strong>
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
