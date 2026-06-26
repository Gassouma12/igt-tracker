import * as Dialog from '@radix-ui/react-dialog'
import { X } from 'lucide-react'
import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'

export function Modal({
  open, onOpenChange, title, description, children, className,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description?: string
  children: ReactNode
  className?: string
}) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/60 data-[state=open]:animate-[fade-up_0.15s_ease]" />
        <Dialog.Content
          className={cn(
            // NOTE: centering uses -translate-*-1/2, so the entrance animation must
            // be opacity-only — a transform-based animation would clobber centering.
            'fixed left-1/2 top-1/2 z-50 flex max-h-[88vh] w-[92vw] max-w-lg -translate-x-1/2 -translate-y-1/2 flex-col',
            'overflow-hidden rounded-2xl border border-line bg-surface shadow-pop',
            'data-[state=open]:animate-fade-in focus:outline-none',
            className,
          )}
        >
          <div className="flex items-start justify-between gap-4 border-b border-line p-6 pb-4">
            <div>
              <Dialog.Title className="font-display text-lg font-semibold text-ink">{title}</Dialog.Title>
              {description && <Dialog.Description className="mt-1 text-sm text-ink-mute">{description}</Dialog.Description>}
            </div>
            <Dialog.Close className="rounded-lg p-1 text-ink-mute transition hover:bg-surface-2 hover:text-ink">
              <X size={18} />
            </Dialog.Close>
          </div>
          <div className="overflow-y-auto p-6">{children}</div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
