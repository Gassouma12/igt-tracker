import { useState } from 'react'
import { useDB } from '@/data/store'
import { useCurrentUser } from '@/state/session'
import { createCompany, createContact, createOpportunity } from '@/data/actions'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/primitives'
import { Field, Input } from '@/components/ui/Field'

export function AddOpportunityDialog({ open, onClose, onCreated }: {
  open: boolean
  onClose: () => void
  onCreated: (oppId: string) => void
}) {
  const user = useCurrentUser()
  const companies = useDB((s) => s.companies)
  const [companyName, setCompanyName] = useState('')
  const [contactName, setContactName] = useState('')
  const [contactRole, setContactRole] = useState('')
  const [contactEmail, setContactEmail] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!user || !companyName.trim()) return
    setBusy(true)
    const existing = companies.find((c) => c.name.toLowerCase() === companyName.trim().toLowerCase())
    const company = existing ?? (await createCompany(user, { name: companyName }))
    let contactId: string | null = null
    if (contactName.trim()) {
      const contact = await createContact(user, {
        companyId: company.id, name: contactName, role: contactRole || null, email: contactEmail || null,
      })
      contactId = contact.id
    }
    const opp = await createOpportunity(user, { companyId: company.id, contactId, lcId: user.lcId ?? 'lc_ghent' })
    setBusy(false)
    setCompanyName(''); setContactName(''); setContactRole(''); setContactEmail('')
    onClose()
    onCreated(opp.id)
  }

  return (
    <Modal open={open} onOpenChange={(o) => !o && onClose()} title="New opportunity" description="Add a company to your pipeline. Existing companies are reused.">
      <form onSubmit={submit} className="space-y-4">
        <Field label="Company" hint="Pick an existing company or type a new one.">
          <Input list="company-list" placeholder="e.g. Odoo" value={companyName} onChange={(e) => setCompanyName(e.target.value)} autoFocus required />
          <datalist id="company-list">
            {companies.slice(0, 1000).map((c) => <option key={c.id} value={c.name} />)}
          </datalist>
        </Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Contact name (optional)">
            <Input placeholder="Jane Doe" value={contactName} onChange={(e) => setContactName(e.target.value)} />
          </Field>
          <Field label="Role (optional)">
            <Input placeholder="Head of HR" value={contactRole} onChange={(e) => setContactRole(e.target.value)} />
          </Field>
        </div>
        <Field label="Contact email (optional)">
          <Input type="email" placeholder="jane@company.com" value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} />
        </Field>
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
          <Button type="submit" disabled={busy || !companyName.trim()}>Create opportunity</Button>
        </div>
      </form>
    </Modal>
  )
}
