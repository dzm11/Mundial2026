"use client"

import { useActionState, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  uploadAvatarAction,
  changePasswordAction,
  updateNameAction,
  type SettingsState,
} from "./actions"

export function NameForm({
  firstName,
  lastName,
}: {
  firstName: string
  lastName: string
}) {
  const [state, action, pending] = useActionState<SettingsState | undefined, FormData>(
    updateNameAction,
    undefined,
  )

  return (
    <form action={action} className="space-y-3">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="firstName">Imię</Label>
          <Input
            id="firstName"
            name="firstName"
            defaultValue={firstName}
            maxLength={40}
            autoComplete="given-name"
            placeholder="np. Paweł"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="lastName">Nazwisko</Label>
          <Input
            id="lastName"
            name="lastName"
            defaultValue={lastName}
            maxLength={40}
            autoComplete="family-name"
            placeholder="np. Nowak"
          />
        </div>
      </div>
      <p className="text-muted-foreground text-xs">
        Widoczne w siatce, rankingu i na podium. Login pozostaje bez zmian.
      </p>
      {state?.error && <p className="text-destructive text-sm">{state.error}</p>}
      {state?.ok && <p className="text-success text-sm">Nazwa zaktualizowana.</p>}
      <Button type="submit" disabled={pending} className="font-display font-semibold">
        {pending ? "Zapisuję…" : "Zapisz nazwę"}
      </Button>
    </form>
  )
}

export function AvatarForm() {
  const [state, action, pending] = useActionState<SettingsState | undefined, FormData>(
    uploadAvatarAction,
    undefined,
  )
  const inputRef = useRef<HTMLInputElement>(null)

  return (
    <form action={action} className="space-y-3">
      <div className="space-y-2">
        <Label htmlFor="avatar">Plik (max 2 MB, PNG/JPG)</Label>
        <Input
          ref={inputRef}
          id="avatar"
          name="avatar"
          type="file"
          accept="image/png,image/jpeg,image/webp"
          required
        />
      </div>
      {state?.error && <p className="text-destructive text-sm">{state.error}</p>}
      {state?.ok && <p className="text-success text-sm">Avatar zaktualizowany.</p>}
      <Button type="submit" disabled={pending} className="font-display font-semibold">
        {pending ? "Wgrywam…" : "Wgraj avatar"}
      </Button>
    </form>
  )
}

export function PasswordForm() {
  const [state, action, pending] = useActionState<SettingsState | undefined, FormData>(
    changePasswordAction,
    undefined,
  )

  return (
    <form action={action} className="space-y-3">
      <div className="space-y-2">
        <Label htmlFor="password">Nowe hasło</Label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          required
        />
        <p className="text-muted-foreground text-xs">Minimum 8 znaków.</p>
      </div>
      {state?.error && <p className="text-destructive text-sm">{state.error}</p>}
      {state?.ok && <p className="text-success text-sm">Hasło zmienione.</p>}
      <Button type="submit" disabled={pending} className="font-display font-semibold">
        {pending ? "Zapisuję…" : "Zmień hasło"}
      </Button>
    </form>
  )
}
