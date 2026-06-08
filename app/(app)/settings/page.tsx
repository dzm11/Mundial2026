import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { AvatarForm, PasswordForm, NameForm } from "./forms"
import { displayName, getInitials } from "@/lib/utils"

export default async function SettingsPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const { data: profile } = await supabase
    .from("profiles")
    .select("username, first_name, last_name, avatar_url")
    .eq("id", user.id)
    .single()

  const initials = profile ? getInitials(profile) : "?"
  const shownName = profile ? displayName(profile) : ""

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
            <div className="font-medium text-foreground">{shownName}</div>
            <div className="text-muted-foreground text-sm">@{profile?.username}</div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="font-display font-bold tracking-tight">Nazwa wyświetlana</CardTitle>
        </CardHeader>
        <CardContent>
          <NameForm
            firstName={profile?.first_name ?? ""}
            lastName={profile?.last_name ?? ""}
          />
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
    </div>
  )
}
