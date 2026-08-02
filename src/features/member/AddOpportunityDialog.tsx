import { useMemo, useState } from 'react'
import { AlertTriangle, Plus, Trash2 } from 'lucide-react'
import { useDB } from '@/data/store'
import { useCurrentUser } from '@/state/session'
import { createCompany, createContact, createOpportunity } from '@/data/actions'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/primitives'
import { Field, Input } from '@/components/ui/Field'

interface ContactDraft { name: string; role: string; phone: string; email: string; linkedin: string }
const emptyContact = (): ContactDraft => ({ name: '', role: '', phone: '', email: '', linkedin: '' })

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '')

export function AddOpportunityDialog({ open, onClose, onCreated }: {
  open: boolean
  onClose: () => void
  onCreated: (oppId: string) => void
}) {
  const user = useCurrentUser()
  const companies = useDB((s) => s.companies)
  const allOpps = useDB((s) => s.opportunities)
  const users = useDB((s) => s.users)
  const lcs = useDB((s) => s.localCommittees)
  const [companyName, setCompanyName] = useState('')
  const [contacts, setContacts] = useState<ContactDraft[]>([emptyContact()])
  const [busy, setBusy] = useState(false)

  const setContact = (i: number, patch: Partial<ContactDraft>) =>
    setContacts((cs) => cs.map((c, j) => (j === i ? { ...c, ...patch } : c)))

  // Duplicate-partner detection: if the typed name matches a company already
  // worked by someone, surface who has it (member + LC + email). This WARNS but
  // does not block — the user can still proceed (and the existing company is reused).
  const existing = useMemo(() => {
    const n = norm(companyName)
    if (!n) return null
    const co = companies.find((c) => norm(c.name) === n)
    if (!co) return null
    const ownerIds = [...new Set(allOpps.filter((o) => o.companyId === co.id).map((o) => o.ownerId))]
    const holders = ownerIds.map((id) => {
      const u = users.find((x) => x.id === id)
      return {
        id, name: u?.name ?? 'Someone', email: u?.email ?? null,
        lc: lcs.find((l) => l.id === u?.lcId)?.name ?? 'No LC',
      }
    })
    return { company: co, holders }
  }, [companyName, companies, allOpps, users, lcs])

  const mine = !!existing && !!user && existing.holders.some((h) => h.id === user.id)
  const dup = !!existing && existing.holders.length > 0

  function reset() {
    setCompanyName(''); setContacts([emptyContact()])
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!user || !companyName.trim()) return
    setBusy(true)
    const company = existing?.company ?? (await createCompany(user, { name: companyName }))
    let firstContactId: string | null = null
    for (const c of contacts) {
      if (!c.name.trim()) continue
      const contact = await createContact(user, {
        companyId: company.id, name: c.name, role: c.role || null,
        email: c.email || null, phone: c.phone || null, linkedin: c.linkedin || null,
      })
      if (!firstContactId) firstContactId = contact.id
    }
    const opp = await createOpportunity(user, { companyId: company.id, contactId: firstContactId, lcId: user.lcId ?? 'lc_ghent' })
    setBusy(false)
    reset()
    onClose()
    onCreated(opp.id)
  }

  return (
    <Modal open={open} onOpenChange={(o) => !o && onClose()} title="New opportunity" description="Add a company and its contacts. Existing companies are reused." className="max-w-2xl">
      <form onSubmit={submit} className="space-y-4">
        <Field label="Company" hint="Pick an existing company or type a new one.">
          <Input list="company-list" placeholder="e.g. Odoo" value={companyName} onChange={(e) => setCompanyName(e.target.value)} autoFocus required />
          <datalist id="company-list">
            {companies.slice(0, 1000).map((c) => <option key={c.id} value={c.name} />)}
          </datalist>
        </Field>

        {dup && existing && (
          <div className="flex items-start gap-2.5 rounded-xl border border-warning/40 bg-warning/10 p-3 text-sm">
            <AlertTriangle size={16} className="mt-0.5 shrink-0 text-warning" />
            <div>
              <p className="font-medium text-warning">
                {mine ? 'You already work this partner.' : `${existing.company.name} is already being contacted.`}
              </p>
              <ul className="mt-1 space-y-0.5 text-ink-dim">
                {existing.holders.map((h) => (
                  <li key={h.id}>
                    {h.name} · {h.lc}{h.email ? <> · <a href={`mailto:${h.email}`} className="text-brand hover:underline">{h.email}</a></> : null}
                  </li>
                ))}
              </ul>
              <p className="mt-1 text-xs text-ink-mute">You can still proceed — the existing company will be reused.</p>
            </div>
          </div>
        )}

        <div>
          <div className="mb-2 flex items-center justify-between">
            <span className="text-sm font-medium text-ink">Contacts</span>
            <span className="text-xs text-ink-mute">Optional — add the people you'll talk to</span>
          </div>
          <div className="space-y-3">
            {contacts.map((c, i) => (
              <div key={i} className="rounded-2xl border border-line bg-bg-elev p-3">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-xs font-medium text-ink-mute">Contact {i + 1}</span>
                  {contacts.length > 1 && (
                    <button type="button" onClick={() => setContacts((cs) => cs.filter((_, j) => j !== i))}
                      className="text-ink-mute transition hover:text-danger" title="Remove contact">
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  <Input placeholder="Name" value={c.name} onChange={(e) => setContact(i, { name: e.target.value })} />
                  <Input placeholder="Position (e.g. Head of HR)" value={c.role} onChange={(e) => setContact(i, { role: e.target.value })} />
                  <Input placeholder="Phone" value={c.phone} onChange={(e) => setContact(i, { phone: e.target.value })} />
                  <Input type="email" placeholder="Email" value={c.email} onChange={(e) => setContact(i, { email: e.target.value })} />
                  <Input className="sm:col-span-2" placeholder="LinkedIn URL" value={c.linkedin} onChange={(e) => setContact(i, { linkedin: e.target.value })} />
                </div>
              </div>
            ))}
          </div>
          <button type="button" onClick={() => setContacts((cs) => [...cs, emptyContact()])}
            className="mt-2 flex items-center gap-1.5 rounded-lg border border-dashed border-line px-3 py-2 text-sm text-ink-mute transition hover:border-brand/40 hover:text-ink">
            <Plus size={14} /> Add another contact
          </button>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
          <Button type="submit" disabled={busy || !companyName.trim()}>Create opportunity</Button>
        </div>
      </form>
    </Modal>
  )
}
