import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowRight, Sparkles, TrendingUp } from 'lucide-react'
import { useDB } from '@/data/store'
import { useSession } from '@/state/session'
import { homePathFor } from '@/app/nav'
import { Avatar, Button } from '@/components/ui/primitives'
import { Field, Input } from '@/components/ui/Field'

const QUICK = [
  { id: 'usr_admin', tag: 'Admin · global view' },
  { id: 'usr_pavlos', tag: 'LCP · LC Ghent' },
  { id: 'usr_tijs', tag: 'LCVP · sales team' },
  { id: 'usr_kobe', tag: 'Member · own pipeline' },
]

export default function Login() {
  const users = useDB((s) => s.users)
  const login = useSession((s) => s.login)
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')

  function signIn(userId: string) {
    const user = users.find((u) => u.id === userId)
    if (!user) return
    login(user.id)
    navigate(homePathFor(user.role))
  }

  function submit(e: React.FormEvent) {
    e.preventDefault()
    const user = users.find((u) => u.email.toLowerCase() === email.trim().toLowerCase())
    if (!user) return setError('No account with that email. Try a quick sign-in →')
    signIn(user.id)
  }

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      {/* brand panel */}
      <div className="relative hidden flex-col justify-between overflow-hidden p-12 lg:flex">
        <div className="absolute inset-0 -z-10 bg-gradient-to-br from-brand/30 via-bg to-bg" />
        <div className="absolute -left-20 top-40 -z-10 h-80 w-80 rounded-full bg-brand/20 blur-3xl" />
        <div className="flex items-center gap-2.5">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-brand text-white shadow-glow">
            <Sparkles size={20} />
          </span>
          <div>
            <p className="font-display text-base font-bold text-ink">iGT Sales Platform</p>
            <p className="text-xs text-ink-mute">AIESEC in Belgium</p>
          </div>
        </div>
        <div>
          <h1 className="font-display text-4xl font-bold leading-tight text-ink">
            Your pipeline,<br />finally out of the spreadsheet.
          </h1>
          <p className="mt-4 max-w-md text-ink-dim">
            Outreach, meetings, contracts and goals for every Local Committee — one fast,
            role-aware workspace.
          </p>
          <div className="mt-8 flex items-center gap-2 text-sm text-ink-mute">
            <TrendingUp size={16} className="text-success" />
            Migrated from the iGT Master Sheet · live data
          </div>
        </div>
        <p className="text-xs text-ink-mute">© {new Date().getFullYear()} AIESEC in Belgium · iGT</p>
      </div>

      {/* form panel */}
      <div className="flex items-center justify-center p-6">
        <div className="w-full max-w-sm">
          <h2 className="font-display text-2xl font-bold text-ink">Welcome back</h2>
          <p className="mt-1 text-sm text-ink-mute">Sign in to continue to your workspace.</p>

          <form onSubmit={submit} className="mt-6 space-y-4">
            <Field label="Email">
              <Input
                type="email"
                placeholder="you@aiesec.be"
                value={email}
                onChange={(e) => { setEmail(e.target.value); setError('') }}
                autoFocus
              />
            </Field>
            <Field label="Password" hint="Demo build — any password works.">
              <Input type="password" placeholder="••••••••" />
            </Field>
            {error && <p className="text-sm text-danger">{error}</p>}
            <Button type="submit" className="w-full">
              Sign in <ArrowRight size={16} />
            </Button>
          </form>

          <div className="my-6 flex items-center gap-3 text-xs text-ink-mute">
            <span className="h-px flex-1 bg-line" /> or quick sign-in <span className="h-px flex-1 bg-line" />
          </div>

          <div className="space-y-2">
            {QUICK.map((q) => {
              const u = users.find((x) => x.id === q.id)
              if (!u) return null
              return (
                <button
                  key={q.id}
                  onClick={() => signIn(q.id)}
                  className="flex w-full items-center gap-3 rounded-xl border border-line bg-surface px-3 py-2.5 text-left transition hover:border-brand/40 hover:bg-surface-2"
                >
                  <Avatar name={u.name} size={34} />
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium text-ink">{u.name}</span>
                    <span className="block truncate text-xs text-ink-mute">{q.tag}</span>
                  </span>
                  <ArrowRight size={16} className="ml-auto text-ink-mute" />
                </button>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
