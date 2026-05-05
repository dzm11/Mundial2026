"use server"

import { revalidatePath } from "next/cache"
import { createClient } from "@/lib/supabase/server"
import { predictionSchema } from "@/lib/validation"

export type PredictionResult = { ok: boolean; error?: string }

export async function upsertPrediction(
  matchId: number,
  pred1: number,
  pred2: number,
): Promise<PredictionResult> {
  const parsed = predictionSchema.safeParse({ matchId, pred1, pred2 })
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Niepoprawny typ" }
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: "Niezalogowany" }

  const { error } = await supabase.from("predictions").upsert(
    {
      user_id: user.id,
      match_id: parsed.data.matchId,
      pred1: parsed.data.pred1,
      pred2: parsed.data.pred2,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id,match_id" },
  )

  if (error) return { ok: false, error: humanizeDbError(error.message) }

  revalidatePath("/")
  return { ok: true }
}

function humanizeDbError(raw: string): string {
  if (/check constraint.*pred[12]/i.test(raw)) return "Wynik poza zakresem 0–99"
  if (/violates row-level security/i.test(raw)) return "Mecz już się rozpoczął — typy zablokowane"
  if (/duplicate key/i.test(raw)) return "Konflikt zapisu, odśwież stronę"
  return raw
}

export async function confirmAllPredictions(): Promise<PredictionResult> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: "Niezalogowany" }

  const { error } = await supabase
    .from("predictions")
    .update({ confirmed_at: new Date().toISOString() })
    .eq("user_id", user.id)
    .is("confirmed_at", null)

  if (error) return { ok: false, error: error.message }

  revalidatePath("/")
  return { ok: true }
}
