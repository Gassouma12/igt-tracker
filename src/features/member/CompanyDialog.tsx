import { useMemo, useState } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { Building2, Mail, Phone, Plus, UserPlus, X } from 'lucide-react'
import { useDB } from '@/data/store'
import { useCurrentUser } from '@/state/session'
import { createContact } from '@/data/actions'
import { visibleOwnerIds } from '@/lib/rbac'
import { Avatar, Button } from '@/components/ui/primitives'
import { Field, Input } from '@/components/ui/Field'
import { LinkedInLink } from '@/components/ui/LinkedInLink'
import { CompanyPanelButtons } from './CompanyPanels'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { relativeDays } from '@/lib/format'

export function CompanyDialog({
  companyId, onClose, onOpenOpp,
}: {
  companyId: string | null
  onClose: () => void
  onOpenOpp: (oppId: string) => void
}) {
  const user = useCurrentUser()
  const company = useDB((s) => s.companies.find((c) => c.id === companyId))
  const allContacts = useDB((s) => s.contacts)
  const allOpps = useDB((s) => s.opportunities)
  const users = useDB((s) => s.users)

  const contacts = useMemo(() => allContacts.filter((c) => c.companyId === companyId), [allContacts, companyId])
  const opps = useMemo(() => {
    if (!user) return []
    const owners = visibleOwnerIds(user, users)
    return allOpps.filter((o) => o.companyId === companyId && (!owners || owners.has(o.ownerId)))
  }, [allOpps, companyId, user, users])

  const [name, setName] = useState('')
  const [role, setRole] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [linkedin, setLinkedin] = useState('')
  const [adding, setAdding] = useState(false)

  if (!company || !user) return null

  async function addContact(e: React.FormEvent) {
    e.preventDefault()
    if (!user || !name.trim()) return
    await createContact(user, {
      companyId: company!.id, name, role: role || null, email: email || null,
      phone: phone || null, linkedin: linkedin || null,
    })
    setName(''); setRole(''); setEmail(''); setPhone(''); setLinkedin(''); setAdding(false)
  }

  return (
    <Dialog.Root open={!!companyId} onOpenChange={(o) => !o && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/60" />
        <Dialog.Content className="fixed right-0 top-0 z-50 flex h-full w-full max-w-xl flex-col border-l border-line bg-bg shadow-pop data-[state=open]:animate-fade-in focus:outline-none">
          <div className="flex items-start justify-between gap-4 border-b border-line p-5">
            <div className="flex items-center gap-3">
              <span className="grid h-11 w-11 place-items-center rounded-xl bg-surface-2 text-ink-dim"><Building2 size={20} /></span>
              <div>
                <Dialog.Title className="font-display text-xl font-bold text-ink">{company.name}</Dialog.Title>
                <p className="text-sm text-ink-mute">{company.industry ?? 'Company'}{company.country ? ` · ${company.country}` : ''}</p>
                <div className="mt-2"><CompanyPanelButtons companyId={company.id} /></div>
              </div>
            </div>
            <Dialog.Close className="rounded-lg p-1 text-ink-mute transition hover:bg-surface-2 hover:text-ink"><X size={18} /></Dialog.Close>
          </div>

          <div className="flex-1 space-y-6 overflow-y-auto p-5">
            {/* contacts */}
            <section>
              <div className="mb-3 flex items-center justify-between">
                <p className="text-sm font-semibold text-ink">Contacts · {contacts.length}</p>
                <Button size="sm" variant="secondary" onClick={() => setAdding((a) => !a)}><UserPlus size={14} /> Add contact</Button>
              </div>

              {adding && (
                <form onSubmit={addContact} className="mb-3 space-y-3 rounded-2xl border border-line bg-surface p-4">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Field label="Name"><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Jane Doe" autoFocus required /></Field>
                    <Field label="Role"><Input value={role} onChange={(e) => setRole(e.target.value)} placeholder="Head of HR" /></Field>
                    <Field label="Email"><Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="jane@company.com" /></Field>
                    <Field label="Phone"><Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+32 …" /></Field>
                  </div>
                  <Field label="LinkedIn URL"><Input value={linkedin} onChange={(e) => setLinkedin(e.target.value)} placeholder="linkedin.com/in/…" /></Field>
                  <div className="flex justify-end gap-2">
                    <Button size="sm" variant="ghost" type="button" onClick={() => setAdding(false)}>Cancel</Button>
                    <Button size="sm" type="submit" disabled={!name.trim()}>Save contact</Button>
                  </div>
                </form>
              )}

              {contacts.length === 0 && !adding && <p className="text-sm text-ink-mute">No contacts yet. Add the people you talk to here.</p>}

              <div className="space-y-2">
                {contacts.map((ct) => (
                  <div key={ct.id} className="flex items-center gap-3 rounded-xl border border-line bg-surface p-3">
                    <Avatar name={ct.name} size={34} />
                    <div className="min-w-0 flex-1">
                      <p className="flex items-center gap-1.5 truncate text-sm font-medium text-ink">
                        <LinkedInLink url={ct.linkedin} /> {ct.name}
                        {ct.role && <span className="truncate text-xs font-normal text-ink-mute">· {ct.role}</span>}
                      </p>
                      <p className="flex flex-wrap gap-x-3 text-xs text-ink-mute">
                        {ct.email && <span className="inline-flex items-center gap-1"><Mail size={11} /> {ct.email}</span>}
                        {ct.phone && <span className="inline-flex items-center gap-1"><Phone size={11} /> {ct.phone}</span>}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* opportunities */}
            <section>
              <p className="mb-3 text-sm font-semibold text-ink">Opportunities · {opps.length}</p>
              <div className="space-y-2">
                {opps.map((o) => (
                  <button
                    key={o.id}
                    onClick={() => onOpenOpp(o.id)}
                    className="flex w-full items-center justify-between gap-3 rounded-xl border border-line bg-surface p-3 text-left transition hover:border-brand/40"
                  >
                    <span className="min-w-0">
                      <span className="block text-sm text-ink">{users.find((u) => u.id === o.ownerId)?.name ?? '—'}</span>
                      <span className="text-xs text-ink-mute">{relativeDays(o.lastActivityAt)}</span>
                    </span>
                    <StatusBadge status={o.status} />
                  </button>
                ))}
                {opps.length === 0 && <p className="text-sm text-ink-mute">No opportunities yet.</p>}
              </div>
            </section>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
