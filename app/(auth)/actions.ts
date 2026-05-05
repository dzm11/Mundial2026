"use server"

import { redirect } from "next/navigation"
import { revalidatePath } from "next/cache"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { loginSchema, registerSchema, usernameToEmail } from "@/lib/validation"

export type AuthState = { error?: string; fieldErrors?: Record<string, string> }

export async function registerAction(
  _prev: AuthState | undefined,
  formData: FormData,
): Promise<AuthState> {
  const parsed = registerSchema.safeParse({
    username: formData.get("username"),
    firstName: formData.get("firstName"),
    lastName: formData.get("lastName"),
    password: formData.get("password"),
  })

  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {}
    for (const issue of parsed.error.issues) {
      const path = issue.path[0]
      if (typeof path === "string" && !fieldErrors[path]) {
        fieldErrors[path] = issue.message
      }
    }
    return { fieldErrors }
  }

  const { username, firstName, lastName, password } = parsed.data
  const admin = createAdminClient()

  // Sprawdź unikalność loginu
  const { data: existing } = await admin
    .from("profiles")
    .select("id")
    .ilike("username", username)
    .maybeSingle()
  if (existing) return { fieldErrors: { username: "Login jest już zajęty" } }

  // Stwórz usera z syntetycznym e-mailem
  const email = usernameToEmail(username)
  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { username, first_name: firstName, last_name: lastName },
  })
  if (createErr || !created.user) {
    return { error: createErr?.message ?? "Nie udało się utworzyć konta" }
  }

  const { error: profileErr } = await admin.from("profiles").insert({
    id: created.user.id,
    username,
    first_name: firstName,
    last_name: lastName,
  })
  if (profileErr) {
    await admin.auth.admin.deleteUser(created.user.id)
    return { error: profileErr.message }
  }

  // Zaloguj od razu
  const supabase = await createClient()
  const { error: signInErr } = await supabase.auth.signInWithPassword({ email, password })
  if (signInErr) return { error: signInErr.message }

  revalidatePath("/", "layout")
  redirect("/")
}

export async function loginAction(
  _prev: AuthState | undefined,
  formData: FormData,
): Promise<AuthState> {
  const parsed = loginSchema.safeParse({
    username: formData.get("username"),
    password: formData.get("password"),
  })
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {}
    for (const issue of parsed.error.issues) {
      const path = issue.path[0]
      if (typeof path === "string" && !fieldErrors[path]) {
        fieldErrors[path] = issue.message
      }
    }
    return { fieldErrors }
  }

  const supabase = await createClient()
  const { error } = await supabase.auth.signInWithPassword({
    email: usernameToEmail(parsed.data.username),
    password: parsed.data.password,
  })
  if (error) return { error: "Nieprawidłowy login lub hasło" }

  revalidatePath("/", "layout")
  redirect("/")
}

export async function logoutAction() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  revalidatePath("/", "layout")
  redirect("/login")
}
