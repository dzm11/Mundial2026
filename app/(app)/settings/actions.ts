"use server"

import { revalidatePath } from "next/cache"
import { createClient } from "@/lib/supabase/server"
import { passwordSchema, profileNameSchema } from "@/lib/validation"

export type SettingsState = { ok?: boolean; error?: string }

export async function updateNameAction(
  _prev: SettingsState | undefined,
  formData: FormData,
): Promise<SettingsState> {
  const parsed = profileNameSchema.safeParse({
    firstName: formData.get("firstName") ?? "",
    lastName: formData.get("lastName") ?? "",
  })
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Niepoprawna nazwa" }
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: "Niezalogowany" }

  const { error } = await supabase
    .from("profiles")
    .update({
      first_name: parsed.data.firstName,
      last_name: parsed.data.lastName,
    })
    .eq("id", user.id)
  if (error) return { error: error.message }

  // Nazwa wyświetlana pojawia się w siatce, rankingu i na podium.
  revalidatePath("/", "layout")
  return { ok: true }
}

export async function uploadAvatarAction(
  _prev: SettingsState | undefined,
  formData: FormData,
): Promise<SettingsState> {
  const file = formData.get("avatar")
  if (!(file instanceof File) || file.size === 0) {
    return { error: "Wybierz plik z obrazem" }
  }
  if (file.size > 2 * 1024 * 1024) return { error: "Maks. rozmiar: 2 MB" }
  if (!file.type.startsWith("image/")) return { error: "To nie jest obraz" }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: "Niezalogowany" }

  const ext = file.name.split(".").pop()?.toLowerCase() ?? "png"
  const path = `${user.id}/${Date.now()}.${ext}`

  const { error: upErr } = await supabase.storage
    .from("avatars")
    .upload(path, file, { upsert: true, contentType: file.type })
  if (upErr) return { error: upErr.message }

  const { data: pub } = supabase.storage.from("avatars").getPublicUrl(path)

  const { error: updErr } = await supabase
    .from("profiles")
    .update({ avatar_url: pub.publicUrl })
    .eq("id", user.id)
  if (updErr) return { error: updErr.message }

  revalidatePath("/", "layout")
  return { ok: true }
}

export async function changePasswordAction(
  _prev: SettingsState | undefined,
  formData: FormData,
): Promise<SettingsState> {
  const newPassword = formData.get("password")
  const parsed = passwordSchema.safeParse(newPassword)
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Niepoprawne hasło" }
  }
  const supabase = await createClient()
  const { error } = await supabase.auth.updateUser({ password: parsed.data })
  if (error) return { error: error.message }
  return { ok: true }
}
