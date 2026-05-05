"use client"

import { useActionState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { loginAction, type AuthState } from "../actions"

export function LoginForm() {
  const [state, action, pending] = useActionState<AuthState | undefined, FormData>(
    loginAction,
    undefined,
  )

  return (
    <form action={action} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="username">Login</Label>
        <Input id="username" name="username" autoComplete="username" required />
        {state?.fieldErrors?.username && (
          <p className="text-destructive text-sm">{state.fieldErrors.username}</p>
        )}
      </div>
      <div className="space-y-2">
        <Label htmlFor="password">Hasło</Label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
        />
        {state?.fieldErrors?.password && (
          <p className="text-destructive text-sm">{state.fieldErrors.password}</p>
        )}
      </div>
      {state?.error && <p className="text-destructive text-sm">{state.error}</p>}
      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? "Logowanie…" : "Zaloguj"}
      </Button>
    </form>
  )
}
