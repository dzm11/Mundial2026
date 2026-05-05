import Link from "next/link"
import { LoginForm } from "./form"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

export default function LoginPage() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Zaloguj się</CardTitle>
      </CardHeader>
      <CardContent>
        <LoginForm />
        <p className="text-muted-foreground mt-4 text-sm text-center">
          Nie masz jeszcze konta?{" "}
          <Link href="/register" className="text-primary underline">
            Zarejestruj się
          </Link>
        </p>
      </CardContent>
    </Card>
  )
}
