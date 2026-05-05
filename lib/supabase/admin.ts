import { createClient as createSupabaseClient } from "@supabase/supabase-js"

// Klient z service-role — używać TYLKO na serwerze (route handlery, server actions, scripts).
// Omija RLS — wymagane do rejestracji (signUp przez admin) i crona aktualizującego mecze.
export function createAdminClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  )
}
