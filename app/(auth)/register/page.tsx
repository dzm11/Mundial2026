import Link from "next/link"
import { RegisterForm } from "./form"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

export default function RegisterPage() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Załóż konto</CardTitle>
      </CardHeader>
      <CardContent>
        <RegisterForm />
        <p className="text-muted-foreground mt-4 text-sm text-center">
          Masz już konto?{" "}
          <Link href="/login" className="text-primary underline">
            Zaloguj się
          </Link>
        </p>
      </CardContent>
    </Card>
  )
}
