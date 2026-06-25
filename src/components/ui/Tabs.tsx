import * as RTabs from '@radix-ui/react-tabs'
import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'

export function Tabs({
  tabs, value, onValueChange, className,
}: {
  tabs: { value: string; label: ReactNode }[]
  value: string
  onValueChange: (v: string) => void
  className?: string
}) {
  return (
    <RTabs.Root value={value} onValueChange={onValueChange} className={className}>
      <RTabs.List className="inline-flex items-center gap-1 rounded-xl border border-line bg-bg-elev p-1">
        {tabs.map((t) => (
          <RTabs.Trigger
            key={t.value}
            value={t.value}
            className={cn(
              'rounded-lg px-3 py-1.5 text-sm font-medium text-ink-mute transition',
              'hover:text-ink data-[state=active]:bg-surface-2 data-[state=active]:text-ink',
            )}
          >
            {t.label}
          </RTabs.Trigger>
        ))}
      </RTabs.List>
    </RTabs.Root>
  )
}
