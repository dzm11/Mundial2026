import Link from "next/link"
import { RegisterForm } from "./form"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

export default function RegisterPage() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl font-display font-bold">
          Załóż konto
        </CardTitle>
        <CardDescription>
          Dołącz do typowania — Mistrzostwa Świata 2026
        </CardDescription>
      </CardHeader>
      <CardContent>
        <RegisterForm />
      </CardContent>
      <CardFooter className="justify-center">
        <p className="text-muted-foreground text-sm">
          Masz już konto?{" "}
          <Link
            href="/login"
            className="text-primary underline underline-offset-4 hover:text-primary/80 transition-colors"
          >
            Zaloguj się
          </Link>
        </p>
      </CardFooter>
    </Card>
  )
}
