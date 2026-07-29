import { X } from 'lucide-react'
import { useToasts, type ToastTone } from '@/lib/toast'
import { cn } from '@/lib/cn'

const TONE: Record<ToastTone, string> = {
  error: 'border-danger/40 bg-danger/15 text-danger',
  info: 'border-line bg-surface-2 text-ink',
  success: 'border-success/40 bg-success/15 text-success',
}

export function Toaster() {
  const toasts = useToasts((s) => s.toasts)
  const dismiss = useToasts((s) => s.dismiss)
  if (!toasts.length) return null
  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-[100] flex w-full max-w-sm flex-col gap-2">
      {toasts.map((t) => (
        <div
          key={t.id}
          role="status"
          className={cn(
            'pointer-events-auto flex items-start gap-3 rounded-xl border px-4 py-3 text-sm shadow-lg animate-fade-in',
            TONE[t.tone],
          )}
        >
          <span className="flex-1">{t.message}</span>
          <button onClick={() => dismiss(t.id)} className="opacity-70 transition hover:opacity-100" aria-label="Dismiss">
            <X size={15} />
          </button>
        </div>
      ))}
    </div>
  )
}
