/**
 * Kasuje WSZYSTKICH użytkowników auth (kaskadowo: profiles → predictions).
 * Używać przy resecie edycji typera, by gracze rejestrowali się od nowa.
 *
 * Uruchomienie: npm run reset:users
 *
 * Wymaga w .env.local:
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 */

import { createClient } from "@supabase/supabase-js"

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    throw new Error("Brak NEXT_PUBLIC_SUPABASE_URL lub SUPABASE_SERVICE_ROLE_KEY w env")
  }
  const supabase = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  // Zbierz wszystkich userów (paginacja).
  const all: { id: string; email?: string }[] = []
  let page = 1
  for (;;) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 200 })
    if (error) throw error
    all.push(...data.users.map((u) => ({ id: u.id, email: u.email })))
    if (data.users.length < 200) break
    page++
  }

  console.log(`🧹 Znaleziono ${all.length} użytkowników do usunięcia`)
  let ok = 0
  for (const u of all) {
    const { error } = await supabase.auth.admin.deleteUser(u.id)
    if (error) {
      console.error(`   ❌ ${u.email ?? u.id}: ${error.message}`)
    } else {
      ok++
    }
  }
  console.log(`✅ Usunięto ${ok}/${all.length} użytkowników (profiles + predictions kaskadą)`)
}

main().catch((e) => {
  console.error("❌ Reset użytkowników nie powiódł się:", e)
  process.exit(1)
})
