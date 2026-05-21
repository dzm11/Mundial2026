import { Archivo, Geist_Mono, Inter } from "next/font/google"

import "./globals.css"
import { cn } from "@/lib/utils"

export const metadata = {
  title: "Meczyki — Mundial 2026",
  description: "Aplikacja typerska na Mistrzostwa Świata 2026.",
}

const fontSans = Inter({ subsets: ["latin"], variable: "--font-sans" })
const fontMono = Geist_Mono({ subsets: ["latin"], variable: "--font-mono" })
const fontDisplay = Archivo({
  subsets: ["latin"],
  variable: "--font-display",
  weight: ["600", "700", "800"],
})

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="pl"
      className={cn(
        "dark antialiased",
        fontSans.variable,
        fontMono.variable,
        fontDisplay.variable,
      )}
    >
      <body>{children}</body>
    </html>
  )
}
