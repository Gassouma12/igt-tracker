import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowRight, TrendingUp } from 'lucide-react'
import { useDB } from '@/data/store'
import { useSession } from '@/state/session'
import { signInWithPassword, signUp } from '@/data/actions'
import { supabase, useSupabaseAuth } from '@/lib/supabase'
import { homePathFor } from '@/app/nav'
import { Avatar, Button } from '@/components/ui/primitives'
import { Field, Input } from '@/components/ui/Field'
import { Dropdown } from '@/components/ui/Dropdown'
import { BrandMark, Credits } from '@/components/ui/Brand'
import bg from '@/images/bg.png'
import type { Role } from '@/data/types'

const QUICK = [
  { id: 'usr_admin', tag: 'Admin · global view' },
  { id: 'usr_pavlos', tag: 'LCP · LC Ghent' },
  { id: 'usr_tijs', tag: 'LCVP · sales team' },
  { id: 'usr_kobe', tag: 'Member · own pipeline' },
]

const SIGNUP_ROLES = [
  { value: 'member', label: 'Sales Member' },
  { value: 'lcvp', label: 'LC VP Sales' },
  { value: 'lcp', label: 'LC President' },
]

export default function Login() {
  const users = useDB((s) => s.users)
  const lcs = useDB((s) => s.localCommittees)
  const login = useSession((s) => s.login)
  const navigate = useNavigate()
  const [mode, setMode] = useState<'signin' | 'signup'>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  // sign-up fields
  const [su, setSu] = useState({ name: '', email: '', phone: '', position: '', lcId: '', role: 'member', password: '' })
  const setF = (patch: Partial<typeof su>) => setSu((s) => ({ ...s, ...patch }))

  function enter(userId: string, role: Role) {
    login(userId)
    navigate(homePathFor(role))
  }

  function signIn(userId: string) {
    const user = users.find((u) => u.id === userId)
    if (user) enter(user.id, user.role as Role)
  }

  async function submitSignIn(e: React.FormEvent) {
    e.preventDefault()
    if (useSupabaseAuth) {
      setBusy(true)
      try {
        await signInWithPassword(email, password)
        navigate('/') // RootRedirect routes to the right home; pending gate applies
      } catch (err) {
        setError((err as Error).message || 'Sign in failed.')
      } finally { setBusy(false) }
      return
    }
    const user = users.find((u) => u.email.toLowerCase() === email.trim().toLowerCase())
    if (!user) return setError('No account with that email. Create one or try a quick sign-in →')
    signIn(user.id)
  }

  async function submitSignUp(e: React.FormEvent) {
    e.preventDefault()
    if (!su.name.trim() || !su.email.trim()) return setError('Name and email are required.')
    if (useSupabaseAuth && su.password.length < 6) return setError('Password must be at least 6 characters.')
    if (!useSupabaseAuth && users.some((u) => u.email.toLowerCase() === su.email.trim().toLowerCase())) {
      return setError('An account with that email already exists.')
    }
    setBusy(true)
    try {
      const user = await signUp({
        name: su.name, email: su.email, phone: su.phone, position: su.position,
        lcId: su.lcId || null, role: su.role as Role, password: su.password,
      })
      if (useSupabaseAuth) {
        const { data } = await supabase!.auth.getSession()
        if (data.session) navigate('/') // logged in -> pending gate
        else { setMode('signin'); setError('Account created. Confirm your email, then sign in.') }
      } else {
        enter(user.id, user.role) // mock: lands on the pending screen until approved
      }
    } catch (err) {
      setError((err as Error).message || 'Sign up failed.')
    } finally { setBusy(false) }
  }

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      {/* brand panel */}
      <div className="relative hidden flex-col justify-between overflow-hidden p-12 lg:flex">
        <div className="absolute inset-0 -z-10 bg-gradient-to-br from-brand/30 via-bg to-bg" />
        <div className="absolute -left-20 top-40 -z-10 h-80 w-80 rounded-full bg-brand/20 blur-3xl" />
        <div className="flex items-center gap-2.5">
          <BrandMark size={40} />
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
      <div className="relative flex items-center justify-center overflow-hidden p-6">
        {/* background image — low opacity, fading in from left to right */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 -z-10"
          style={{
            backgroundImage: `url(${bg})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            opacity: 0.16,
            maskImage: 'linear-gradient(to right, transparent 0%, rgba(0,0,0,0.5) 55%, black 100%)',
            WebkitMaskImage: 'linear-gradient(to right, transparent 0%, rgba(0,0,0,0.5) 55%, black 100%)',
          }}
        />
        <div className="w-full max-w-sm">
          <h2 className="font-display text-2xl font-bold text-ink">{mode === 'signin' ? 'Welcome back' : 'Create your account'}</h2>
          <p className="mt-1 text-sm text-ink-mute">
            {mode === 'signin' ? 'Sign in to continue to your workspace.' : 'New accounts are reviewed by an MCVP before access.'}
          </p>

          {mode === 'signin' ? (
            <form key="signin" onSubmit={submitSignIn} className="mt-6 space-y-4">
              <Field label="Email">
                <Input type="email" placeholder="you@aiesec.be" value={email} onChange={(e) => { setEmail(e.target.value); setError('') }} autoFocus />
              </Field>
              <Field label="Password" hint={useSupabaseAuth ? undefined : 'Demo build — any password works.'}>
                <Input type="password" placeholder="••••••••" value={password} onChange={(e) => { setPassword(e.target.value); setError('') }} />
              </Field>
              {error && <p className="text-sm text-danger">{error}</p>}
              <Button type="submit" className="w-full" disabled={busy}>Sign in <ArrowRight size={16} /></Button>
            </form>
          ) : (
            <form key="signup" onSubmit={submitSignUp} className="mt-6 space-y-3">
              <Field label="Full name"><Input placeholder="Jane Doe" value={su.name} onChange={(e) => { setF({ name: e.target.value }); setError('') }} autoFocus /></Field>
              <Field label="Email"><Input type="email" placeholder="you@aiesec.be" value={su.email} onChange={(e) => { setF({ email: e.target.value }); setError('') }} /></Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Phone"><Input placeholder="+32 …" value={su.phone} onChange={(e) => setF({ phone: e.target.value })} /></Field>
                <Field label="Position"><Input placeholder="iGT Member" value={su.position} onChange={(e) => setF({ position: e.target.value })} /></Field>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Local Committee">
                  <Dropdown
                    className="w-full"
                    value={su.lcId}
                    onChange={(v) => setF({ lcId: v })}
                    options={[{ value: '', label: 'Select your LC…' }, ...lcs.map((l) => ({ value: l.id, label: l.name }))]}
                  />
                </Field>
                <Field label="Role">
                  <Dropdown className="w-full" value={su.role} onChange={(v) => setF({ role: v })} options={SIGNUP_ROLES} />
                </Field>
              </div>
              {useSupabaseAuth && (
                <Field label="Password" hint="At least 6 characters.">
                  <Input type="password" placeholder="••••••••" value={su.password} onChange={(e) => { setF({ password: e.target.value }); setError('') }} />
                </Field>
              )}
              {error && <p className="text-sm text-danger">{error}</p>}
              <Button type="submit" className="w-full" disabled={busy}>Request access <ArrowRight size={16} /></Button>
            </form>
          )}

          <div className="my-6 flex items-center gap-3 text-xs text-ink-mute">
            <span className="h-px flex-1 bg-line" />
            {mode === 'signin' ? (useSupabaseAuth ? 'new here?' : 'or quick sign-in') : 'already have access?'}
            <span className="h-px flex-1 bg-line" />
          </div>

          {mode === 'signin' ? (
            <div className="space-y-2">
              {!useSupabaseAuth && QUICK.map((q) => {
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
              <button onClick={() => { setMode('signup'); setError('') }} className="w-full pt-2 text-center text-sm text-brand transition hover:underline">
                Don't have an account? Create one
              </button>
            </div>
          ) : (
            <button onClick={() => { setMode('signin'); setError('') }} className="w-full text-center text-sm text-brand transition hover:underline">
              Back to sign in
            </button>
          )}

          <Credits className="mt-8" />
        </div>
      </div>
    </div>
  )
}
