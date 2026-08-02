// Create persistent test-login accounts (one per role, wired into a hierarchy)
// so every role can be exercised via the one-click buttons on the login screen
// (visible at /login?demo). Idempotent — safe to re-run.
//
//   SUPABASE_DB_URL="<pooler>" VITE_SUPABASE_URL=... VITE_SUPABASE_ANON_KEY=... \
//     node scripts/create-test-users.mjs
//
import { createClient } from '@supabase/supabase-js'
import pg from 'pg'

const URL = process.env.VITE_SUPABASE_URL, ANON = process.env.VITE_SUPABASE_ANON_KEY, DB = process.env.SUPABASE_DB_URL
if (!URL || !ANON || !DB) { console.error('missing env'); process.exit(1) }
export const TEST_PASSWORD = 'igtdemo123'

const admin = new pg.Client({ connectionString: DB, ssl: { rejectUnauthorized: false } })
await admin.connect()
const c = createClient(URL, ANON, { auth: { persistSession: false } })

// Ordered leaders-first so teamLeadId FKs resolve on insert.
const ACCOUNTS = [
  { email: 'admin.test@igt.aiesec.be', name: 'Adam (Test MCVP)', role: 'admin', lcId: 'lc_mc', position: 'MCVP iGT', lead: null },
  { email: 'lcp.test@igt.aiesec.be', name: 'Tess (Test LCP)', role: 'lcp', lcId: 'lc_ghent', position: 'LC President', lead: null },
  { email: 'lcvp.test@igt.aiesec.be', name: 'Vince (Test LCVP)', role: 'lcvp', lcId: 'lc_ghent', position: 'LCVP Sales', lead: null },
  { email: 'tl.test@igt.aiesec.be', name: 'Théo (Test Team Leader)', role: 'team_leader', lcId: 'lc_ghent', position: 'Team Leader', lead: 'lcvp.test@igt.aiesec.be' },
  { email: 'member.test@igt.aiesec.be', name: 'Mira (Test Member)', role: 'member', lcId: 'lc_ghent', position: 'iGT Member', lead: 'tl.test@igt.aiesec.be' },
]

const uidByEmail = {}
for (const a of ACCOUNTS) {
  const { data, error } = await c.auth.signUp({ email: a.email, password: TEST_PASSWORD })
  if (error && !/registered|already/i.test(error.message)) { console.error('signUp', a.email, error.message); process.exit(1) }
  let uid = data?.user?.id
  if (!uid) {
    const r = await admin.query('select id from auth.users where email = $1', [a.email])
    uid = r.rows[0]?.id
  }
  uidByEmail[a.email] = uid
  await c.auth.signOut()
  console.log('auth', a.email, '→', uid)
}

for (const a of ACCOUNTS) {
  const uid = uidByEmail[a.email]
  const lead = a.lead ? uidByEmail[a.lead] : null
  await admin.query(
    `insert into users (id,name,email,role,"lcId",position,"teamLeadId",active,status)
       values ($1,$2,$3,$4,$5,$6,$7,true,'approved')
     on conflict (id) do update set
       name=excluded.name, role=excluded.role, "lcId"=excluded."lcId",
       position=excluded.position, "teamLeadId"=excluded."teamLeadId", status='approved', active=true`,
    [uid, a.name, a.email, a.role, a.lcId, a.position, lead],
  )
  console.log('profile', a.email, a.role, lead ? `→ ${a.lead}` : '')
}

const { rows } = await admin.query(`select name, role, email from users where email like '%.test@igt.aiesec.be' order by role`)
console.table(rows)
await admin.end()
console.log(`\n✓ Test accounts ready. Password for all: ${TEST_PASSWORD}`)
