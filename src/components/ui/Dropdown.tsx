import * as Select from '@radix-ui/react-select'
import { Check, ChevronDown } from 'lucide-react'
import { cn } from '@/lib/cn'

export interface Option {
  value: string
  label: string
}

// Empty-string is a valid "All" value for our filters, but Radix forbids it as
// an item value — map it to a sentinel internally so callers keep using ''.
const ALL = '__all__'

export function Dropdown({
  value, onChange, options, placeholder, className, size = 'md', ariaLabel, disabled,
}: {
  value: string
  onChange: (value: string) => void
  options: Option[]
  placeholder?: string
  className?: string
  size?: 'sm' | 'md'
  ariaLabel?: string
  disabled?: boolean
}) {
  return (
    <Select.Root value={value === '' ? ALL : value} onValueChange={(v) => onChange(v === ALL ? '' : v)} disabled={disabled}>
      <Select.Trigger
        aria-label={ariaLabel}
        className={cn(
          'inline-flex items-center justify-between gap-2 rounded-xl border border-line bg-bg-elev text-ink',
          'outline-none transition hover:border-line-soft hover:bg-surface-2',
          'focus:border-brand focus:ring-2 focus:ring-brand/30 data-[state=open]:border-brand',
          'disabled:cursor-not-allowed disabled:opacity-50',
          size === 'sm' ? 'h-8 px-2.5 text-xs' : 'h-10 px-3 text-sm',
          className,
        )}
      >
        <Select.Value placeholder={placeholder} />
        <Select.Icon><ChevronDown size={size === 'sm' ? 14 : 16} className="text-ink-mute" /></Select.Icon>
      </Select.Trigger>
      <Select.Portal>
        <Select.Content
          position="popper"
          sideOffset={6}
          className="z-[60] max-h-[320px] min-w-[var(--radix-select-trigger-width)] overflow-hidden rounded-xl border border-line bg-surface shadow-pop"
        >
          <Select.Viewport className="p-1">
            {options.map((o) => (
              <Select.Item
                key={o.value}
                value={o.value === '' ? ALL : o.value}
                className={cn(
                  'flex cursor-pointer select-none items-center justify-between gap-3 rounded-lg px-2.5 py-2 text-sm text-ink-dim outline-none',
                  'data-[highlighted]:bg-surface-2 data-[highlighted]:text-ink data-[state=checked]:font-medium data-[state=checked]:text-ink',
                )}
              >
                <Select.ItemText>{o.label}</Select.ItemText>
                <Select.ItemIndicator><Check size={14} className="text-brand" /></Select.ItemIndicator>
              </Select.Item>
            ))}
          </Select.Viewport>
        </Select.Content>
      </Select.Portal>
    </Select.Root>
  )
}
