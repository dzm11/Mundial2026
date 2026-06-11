/**
 * Ustawia nowe hasło dla użytkownika (po username z tabeli profiles).
 * Hasła trzyma Supabase Auth (bcrypt) — zmieniamy je przez admin API,
 * nie da się ich odczytać, można tylko nadpisać.
 *
 * Uruchomienie: npm run set:password -- "<username>" "<noweHaslo>"
 * Przykład:     npm run set:password -- "Marta" "kefir2%"
 *
 * Wymaga w .env.local:
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 */

import { createClient } from "@supabase/supabase-js"

async function main() {
  const username = process.argv[2]
  const password = process.argv[3]
  if (!username || !password) {
    throw new Error('Użycie: npm run set:password -- "<username>" "<noweHaslo>"')
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    throw new Error("Brak NEXT_PUBLIC_SUPABASE_URL lub SUPABASE_SERVICE_ROLE_KEY w env")
  }
  const supabase = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  // Znajdź profil po username (case-insensitive, tak jak rejestracja).
  const { data: profile, error: lookupErr } = await supabase
    .from("profiles")
    .select("id, username, first_name, last_name")
    .ilike("username", username)
    .maybeSingle()
  if (lookupErr) throw lookupErr
  if (!profile) {
    throw new Error(`Nie znaleziono użytkownika o loginie "${username}"`)
  }

  const { error: updErr } = await supabase.auth.admin.updateUserById(profile.id, { password })
  if (updErr) throw updErr

  const name = [profile.first_name, profile.last_name].filter(Boolean).join(" ")
  console.log(`✅ Ustawiono nowe hasło dla "${profile.username}"${name ? ` (${name})` : ""}`)
}

main().catch((e) => {
  console.error("❌ Nie udało się ustawić hasła:", e)
  process.exit(1)
})
