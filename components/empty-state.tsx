import { CircleDot } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"

export function EmptyState() {
  return (
    <Card className="max-w-md mx-auto mt-10">
      <CardContent className="flex flex-col items-center text-center gap-4">
        <div className="size-12 rounded-full bg-primary/15 text-primary flex items-center justify-center">
          <CircleDot className="size-6" aria-hidden />
        </div>
        <h2 className="font-display font-bold text-lg text-card-foreground">
          Brak meczów do wyświetlenia
        </h2>
        <p className="text-muted-foreground text-sm max-w-xs">
          Wygląda na to, że harmonogram nie został jeszcze zaimportowany. Uruchom{" "}
          <code className="rounded bg-muted px-1">npm run seed</code> żeby pobrać kalendarz Mundialu
          2026.
        </p>
      </CardContent>
    </Card>
  )
}
