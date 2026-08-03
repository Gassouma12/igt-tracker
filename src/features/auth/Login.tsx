import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowRight, TrendingUp } from 'lucide-react'
import { useDB } from '@/data/store'
import { useSession } from '@/state/session'
import { signInWithPassword, signUp } from '@/data/actions'
import { supabase, useSupabaseAuth } from '@/lib/supabase'
import { homePathFor } from '@/app/nav'
import { Button } from '@/components/ui/primitives'
import { Field, Input } from '@/components/ui/Field'
import { Dropdown } from '@/components/ui/Dropdown'
import { BrandMark, Credits } from '@/components/ui/Brand'
import bg from '@/images/bg.png'
import type { Role } from '@/data/types'

const SIGNUP_ROLES = [
  { value: 'member', label: 'Sales Member' },
  { value: 'team_leader', label: 'Team Leader' },
  { value: 'lcvp', label: 'LC VP Sales' },
  { value: 'lcp', label: 'LC President' },
]

// The heartbeat hand-off plays for this long before we route into the app.
const HANDOFF_MS = 2200

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
  const [signingIn, setSigningIn] = useState(false) // heartbeat hand-off screen

  // sign-up fields (position is derived from the chosen role — no separate input)
  const [su, setSu] = useState({ name: '', email: '', phone: '', lcId: '', role: 'member', password: '' })
  const setF = (patch: Partial<typeof su>) => setSu((s) => ({ ...s, ...patch }))

  function enter(userId: string, role: Role) {
    login(userId)
    navigate(homePathFor(role))
  }

  async function submitSignIn(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (useSupabaseAuth) {
      setBusy(true)
      try {
        setSigningIn(true)
        const t0 = Date.now()
        await signInWithPassword(email, password)
        // Let the logo beat twice before routing (min HANDOFF_MS from screen show).
        await new Promise((r) => setTimeout(r, Math.max(0, HANDOFF_MS - (Date.now() - t0))))
        navigate('/') // RootRedirect routes to the right home; pending/lock gates apply
      } catch (err) {
        setSigningIn(false)
        setError((err as Error).message || 'Sign in failed.')
      } finally { setBusy(false) }
      return
    }
    const user = users.find((u) => u.email.toLowerCase() === email.trim().toLowerCase())
    if (!user) return setError('No account with that email. Create one to get started →')
    setSigningIn(true)
    setTimeout(() => enter(user.id, user.role as Role), HANDOFF_MS)
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
        name: su.name, email: su.email, phone: su.phone,
        position: SIGNUP_ROLES.find((r) => r.value === su.role)?.label,
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

  // Heartbeat hand-off: full-screen beating logo, then redirect.
  if (signingIn) {
    return (
      <div className="grid min-h-screen place-items-center bg-bg">
        <div className="flex flex-col items-center gap-6">
          <BrandMark size={112} bare className="animate-heartbeat" />
          <p className="text-sm text-ink-mute">Signing you in…</p>
        </div>
      </div>
    )
  }

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      {/* brand panel */}
      <div className="relative hidden flex-col justify-between overflow-hidden p-12 lg:flex">
        <div className="absolute inset-0 -z-10 bg-gradient-to-br from-brand/30 via-bg to-bg" />
        {/* background image — low opacity, strongest on the left, fading toward the center */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 -z-10"
          style={{
            backgroundImage: `url(${bg})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            opacity: 0.16,
            maskImage: 'linear-gradient(to right, black 0%, rgba(0,0,0,0.5) 45%, transparent 100%)',
            WebkitMaskImage: 'linear-gradient(to right, black 0%, rgba(0,0,0,0.5) 45%, transparent 100%)',
          }}
        />
        <div className="absolute -left-20 top-40 -z-10 h-80 w-80 rounded-full bg-brand/20 blur-3xl" />
        {/* Brand lockup — large unframed logo, name as wide as the tagline below */}
        <div className="flex items-center gap-5">
          <BrandMark size={96} bare className="-my-4 shrink-0" />
          <div>
            <p className="font-display text-4xl font-bold leading-none text-ink">Atom</p>
            <p className="mt-1.5 text-sm text-ink-mute">AIESEC in Belgium · iGT</p>
          </div>
        </div>
        <div>
          <h1 className="font-display text-4xl font-bold leading-tight text-ink">
            iGT sales,<br />all in one place.
          </h1>
          <p className="mt-4 max-w-md text-ink-dim">
            The central CRM for AIESEC in Belgium — outreach, meetings, contracts and goals
            for every Local Committee in one fast, role-aware workspace.
          </p>
          <div className="mt-8 flex items-center gap-2 text-sm text-ink-mute">
            <TrendingUp size={16} className="text-success" />
            One source of truth · real-time · role-aware
          </div>
        </div>
        <p className="text-xs text-ink-mute">© {new Date().getFullYear()} AIESEC in Belgium · iGT</p>
      </div>

      {/* form panel */}
      <div className="relative flex items-center justify-center overflow-hidden p-6">
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
              {useSupabaseAuth && (
                <a
                  href="mailto:kacem@aiesec.be?subject=Atom%20password%20reset"
                  className="block text-center text-xs text-ink-mute transition hover:text-brand"
                >
                  Forgot your password? Email kacem@aiesec.be
                </a>
              )}
            </form>
          ) : (
            <form key="signup" onSubmit={submitSignUp} className="mt-6 space-y-3">
              <Field label="Full name"><Input placeholder="Jane Doe" value={su.name} onChange={(e) => { setF({ name: e.target.value }); setError('') }} autoFocus /></Field>
              <Field label="Email"><Input type="email" placeholder="you@aiesec.be" value={su.email} onChange={(e) => { setF({ email: e.target.value }); setError('') }} /></Field>
              <Field label="Phone"><Input placeholder="+32 …" value={su.phone} onChange={(e) => setF({ phone: e.target.value })} /></Field>
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

          {mode === 'signin' ? (
            <button onClick={() => { setMode('signup'); setError('') }} className="mt-6 w-full text-center text-sm text-brand transition hover:underline">
              Don't have an account? Create one
            </button>
          ) : (
            <button onClick={() => { setMode('signin'); setError('') }} className="mt-6 w-full text-center text-sm text-brand transition hover:underline">
              Back to sign in
            </button>
          )}

          <Credits className="mt-8" />
        </div>
      </div>
    </div>
  )
}
