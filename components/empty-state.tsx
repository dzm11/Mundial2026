export function EmptyState() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center text-center">
      <p className="text-2xl">⚽️</p>
      <h2 className="mt-4 text-lg font-semibold">Brak meczów do wyświetlenia</h2>
      <p className="text-muted-foreground mt-2 max-w-md text-sm">
        Wygląda na to, że harmonogram nie został jeszcze zaimportowany. Uruchom{" "}
        <code className="rounded bg-muted px-1">npm run seed</code> żeby pobrać kalendarz Mundialu
        2026.
      </p>
    </div>
  )
}
