import Link from "next/link"
import { LoginForm } from "./form"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

export default function LoginPage() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl font-display font-bold">
          Zaloguj się
        </CardTitle>
        <CardDescription>
          Wpisz swój login i hasło, aby przejść dalej
        </CardDescription>
      </CardHeader>
      <CardContent>
        <LoginForm />
      </CardContent>
      <CardFooter className="justify-center">
        <p className="text-muted-foreground text-sm">
          Nie masz jeszcze konta?{" "}
          <Link
            href="/register"
            className="text-primary underline underline-offset-4 hover:text-primary/80 transition-colors"
          >
            Zarejestruj się
          </Link>
        </p>
      </CardFooter>
    </Card>
  )
}
