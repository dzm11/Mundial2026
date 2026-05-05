import Image from "next/image"
import { cn } from "@/lib/utils"

type Props = {
  isoCode: string | null | undefined
  className?: string
  alt?: string
}

export function Flag({ isoCode, className, alt }: Props) {
  if (!isoCode) {
    return (
      <span
        className={cn(
          "bg-muted inline-block h-4 w-6 rounded-sm border align-middle",
          className,
        )}
        aria-hidden
      />
    )
  }
  // flagcdn obsługuje zarówno kody krajów (np. "pl") jak i subdivisions ("gb-eng", "gb-sct").
  const code = isoCode.toLowerCase()
  return (
    <Image
      src={`https://flagcdn.com/w40/${code}.png`}
      width={24}
      height={16}
      alt={alt ?? isoCode.toUpperCase()}
      unoptimized
      className={cn("inline-block rounded-sm align-middle ring-1 ring-black/10", className)}
    />
  )
}
