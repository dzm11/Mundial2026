"use client"

import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { PHASE_TABS, type PhaseKey } from "@/lib/groups"

type Props = {
  value: PhaseKey
  onValueChange: (value: PhaseKey) => void
}

export function PhaseFilter({ value, onValueChange }: Props) {
  return (
    <Tabs value={value} onValueChange={(v) => onValueChange(v as PhaseKey)}>
      <TabsList className="no-scrollbar flex w-full justify-start overflow-x-auto overflow-y-hidden sm:w-auto">
        {PHASE_TABS.map((t) => (
          <TabsTrigger key={t.key} value={t.key} className="font-display whitespace-nowrap">
            {t.label}
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  )
}
