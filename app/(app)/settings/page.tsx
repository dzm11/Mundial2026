import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { AvatarForm, PasswordForm } from "./forms"
import { DemoPanel } from "@/components/demo-panel"

export default async function SettingsPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const { data: profile } = await supabase
    .from("profiles")
    .select("username, avatar_url")
    .eq("id", user.id)
    .single()

  const initials = profile?.username ? profile.username.slice(0, 2).toUpperCase() : "?"

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <h1 className="font-display text-3xl font-extrabold tracking-tight">Ustawienia</h1>

      <Card>
        <CardHeader>
          <CardTitle className="font-display font-bold tracking-tight">Profil</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center gap-4">
          <Avatar className="size-16">
            {profile?.avatar_url && <AvatarImage src={profile.avatar_url} />}
            <AvatarFallback className="text-lg font-display font-bold">
              {initials}
            </AvatarFallback>
          </Avatar>
          <div>
            <div className="font-medium text-foreground">@{profile?.username}</div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="font-display font-bold tracking-tight">Avatar</CardTitle>
        </CardHeader>
        <CardContent>
          <AvatarForm />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="font-display font-bold tracking-tight">Zmiana hasła</CardTitle>
        </CardHeader>
        <CardContent>
          <PasswordForm />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="font-display font-bold tracking-tight">Tryb demo</CardTitle>
        </CardHeader>
        <CardContent>
          <DemoPanel />
        </CardContent>
      </Card>
    </div>
  )
}
