import type { ReactNode } from 'react'
import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react'
import { cn } from '@/lib/cn'
import type { SortState } from '@/lib/useSort'

export function Table({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn('overflow-x-auto rounded-2xl border border-line', className)}>
      <table className="w-full border-collapse text-sm">{children}</table>
    </div>
  )
}

export function THead({ children }: { children: ReactNode }) {
  return (
    <thead className="bg-bg-elev text-left text-xs uppercase tracking-wide text-ink-mute">
      {children}
    </thead>
  )
}

export function TH({ children, className }: { children?: ReactNode; className?: string }) {
  return <th className={cn('whitespace-nowrap px-4 py-3 font-medium', className)}>{children}</th>
}

export function TBody({ children }: { children: ReactNode }) {
  return <tbody className="divide-y divide-line">{children}</tbody>
}

export function TR({ children, className, onClick }: { children: ReactNode; className?: string; onClick?: () => void }) {
  return (
    <tr
      className={cn('transition hover:bg-surface-2/60', onClick && 'cursor-pointer', className)}
      onClick={onClick}
    >
      {children}
    </tr>
  )
}

export function TD({ children, className }: { children?: ReactNode; className?: string }) {
  return <td className={cn('px-4 py-3 align-middle text-ink-dim', className)}>{children}</td>
}

/** Clickable, stackable sort header. Cycles asc → desc → off. */
export function SortHeader({
  label, sortKey, sorts, onToggle, className,
}: {
  label: string
  sortKey: string
  sorts: SortState[]
  onToggle: (key: string) => void
  className?: string
}) {
  const idx = sorts.findIndex((s) => s.key === sortKey)
  const dir = idx !== -1 ? sorts[idx].dir : null
  const Icon = dir === 'asc' ? ArrowUp : dir === 'desc' ? ArrowDown : ArrowUpDown
  return (
    <th className={cn('whitespace-nowrap px-4 py-3 font-medium', className)}>
      <button
        onClick={() => onToggle(sortKey)}
        className={cn('inline-flex items-center gap-1.5 transition hover:text-ink', dir ? 'text-ink' : 'text-ink-mute')}
      >
        {label}
        <Icon size={13} className={dir ? 'text-brand' : 'opacity-40'} />
        {sorts.length > 1 && idx !== -1 && (
          <span className="grid h-4 w-4 place-items-center rounded bg-brand/20 text-[9px] font-bold text-brand">{idx + 1}</span>
        )}
      </button>
    </th>
  )
}
