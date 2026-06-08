"use client"

import { useActionState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { registerAction, type AuthState } from "../actions"

export function RegisterForm() {
  const [state, action, pending] = useActionState<AuthState | undefined, FormData>(
    registerAction,
    undefined,
  )

  return (
    <form action={action} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="username">Login</Label>
        <Input
          id="username"
          name="username"
          autoComplete="username"
          defaultValue={state?.values?.username ?? ""}
          required
        />
        {state?.fieldErrors?.username && (
          <p className="text-destructive text-sm">{state.fieldErrors.username}</p>
        )}
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="firstName">
            Imię <span className="text-muted-foreground font-normal">(opcjonalnie)</span>
          </Label>
          <Input
            id="firstName"
            name="firstName"
            autoComplete="given-name"
            defaultValue={state?.values?.firstName ?? ""}
            maxLength={40}
            placeholder="np. Paweł"
          />
          {state?.fieldErrors?.firstName && (
            <p className="text-destructive text-sm">{state.fieldErrors.firstName}</p>
          )}
        </div>
        <div className="space-y-2">
          <Label htmlFor="lastName">
            Nazwisko <span className="text-muted-foreground font-normal">(opcjonalnie)</span>
          </Label>
          <Input
            id="lastName"
            name="lastName"
            autoComplete="family-name"
            defaultValue={state?.values?.lastName ?? ""}
            maxLength={40}
            placeholder="np. Nowak"
          />
          {state?.fieldErrors?.lastName && (
            <p className="text-destructive text-sm">{state.fieldErrors.lastName}</p>
          )}
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="password">Hasło</Label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          minLength={8}
          required
        />
        <p className="text-muted-foreground text-xs">Minimum 8 znaków.</p>
        {state?.fieldErrors?.password && (
          <p className="text-destructive text-sm">{state.fieldErrors.password}</p>
        )}
      </div>
      {state?.error && <p className="text-destructive text-sm">{state.error}</p>}
      <Button type="submit" className="w-full font-display font-bold" disabled={pending}>
        {pending ? "Zakładam konto…" : "Zarejestruj"}
      </Button>
    </form>
  )
}
