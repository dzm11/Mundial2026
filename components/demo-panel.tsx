"use client"

import { useTransition } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { createDemoMatch, deleteDemoMatches } from "@/app/(app)/demo-actions"

export function DemoPanel() {
  const [pending, startTransition] = useTransition()

  const onCreate = () => {
    startTransition(async () => {
      const result = await createDemoMatch()
      if (result.ok) {
        toast.success("Mecz demo dodany — kick-off za 2 minuty.")
      } else {
        toast.error(result.error ?? "Nie udało się dodać meczu demo")
      }
    })
  }

  const onDelete = () => {
    startTransition(async () => {
      const result = await deleteDemoMatches()
      if (result.ok) {
        toast.success("Mecze demo usunięte.")
      } else {
        toast.error(result.error ?? "Nie udało się usunąć meczów demo")
      }
    })
  }

  return (
    <div className="space-y-3">
      <p className="text-muted-foreground text-sm">
        Tworzy mecz testowy z kick-offem za 2 minuty, kończący się 3 minuty
        później. Wpisz na niego typ w zakładce Mecze i kliknij „Zatwierdź
        typy” — punkty naliczają się tylko dla zatwierdzonych typów. Po
        kick-offie wiersz typu się zablokuje, a po zakończeniu meczu
        zobaczysz naliczone punkty w Rankingu.
      </p>
      <div className="flex flex-wrap gap-2">
        <Button
          onClick={onCreate}
          disabled={pending}
          className="font-display font-semibold"
        >
          Dodaj mecz demo
        </Button>
        <Button
          onClick={onDelete}
          disabled={pending}
          variant="outline"
          className="font-display font-semibold"
        >
          Usuń mecze demo
        </Button>
      </div>
    </div>
  )
}
