// ============================================================================
// cleanup-demo-data.mjs — remove demo/test users and their data from the LIVE
// Supabase DB so the platform is production-ready. Kacem is ALWAYS protected.
//
// It targets accounts that are clearly demo/test:
//   • profile ids starting with "usr_" (the bundled seed ids)
//   • emails matching test / mock / demo (e.g. *.test@igt.aiesec.be)
//   • the @aib.org demo domain (admin@aib.org)
// Deleting a user cascades their opportunities/activities/meetings/contracts/
// goals/notifications/audit rows (FKs are ON DELETE CASCADE). It also removes the
// matching Supabase Auth user. With --prune-companies it additionally deletes
// companies that have NO opportunities left (orphans) — Kacem's 30 leads keep
// their companies, so those are never touched.
//
// SAFETY: dry-run by default. Nothing is deleted unless you pass --apply. Review
// the printed list first.
//
// Usage (PowerShell / bash):
//   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/cleanup-demo-data.mjs            # preview
//   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/cleanup-demo-data.mjs --apply    # delete
//   ... node scripts/cleanup-demo-data.mjs --apply --prune-companies                              # + orphan companies
//
// The service_role key is in Supabase dashboard → Project Settings → API →
// "service_role" (secret — never commit it). VITE_SUPABASE_URL from .env works
// for the URL too.
// ============================================================================

import { createClient } from '@supabase/supabase-js'

const URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const APPLY = process.argv.includes('--apply')
const PRUNE_COMPANIES = process.argv.includes('--prune-companies')

const PROTECTED_EMAIL = 'kacem@aiesec.be' // the MCVP — never touched

if (!URL || !KEY) {
  console.error('Set SUPABASE_URL (or VITE_SUPABASE_URL) and SUPABASE_SERVICE_ROLE_KEY.')
  console.error('The service_role key is under Supabase dashboard → Settings → API → service_role.')
  process.exit(1)
}

const db = createClient(URL, KEY, { auth: { persistSession: false } })

// What counts as a demo/test account.
function isDemo({ id, email }) {
  const e = (email || '').toLowerCase()
  if (e === PROTECTED_EMAIL) return false // hard guard
  if (id && id.startsWith('usr_')) return true // bundled seed ids
  if (/(^|[._+-])(test|mock|demo)([._+-]|@|$)/i.test(e)) return true
  if (e.endsWith('@aib.org')) return true
  return false
}

async function fetchAllProfiles() {
  const rows = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await db.from('users').select('id,email,name,role').range(from, from + 999)
    if (error) throw error
    rows.push(...(data ?? []))
    if ((data ?? []).length < 1000) break
  }
  return rows
}

async function fetchAllAuthUsers() {
  const rows = []
  for (let page = 1; ; page++) {
    const { data, error } = await db.auth.admin.listUsers({ page, perPage: 1000 })
    if (error) throw error
    rows.push(...(data.users ?? []))
    if ((data.users ?? []).length < 1000) break
  }
  return rows
}

async function countOwned(id) {
  const one = async (table, col) => {
    const { count } = await db.from(table).select('id', { count: 'exact', head: true }).eq(col, id)
    return count ?? 0
  }
  const [opps, acts, mtgs] = await Promise.all([
    one('opportunities', 'ownerId'), one('activities', 'ownerId'), one('meetings', 'ownerId'),
  ])
  return { opps, acts, mtgs }
}

async function main() {
  console.log(`\n=== cleanup-demo-data (${APPLY ? 'APPLY — will delete' : 'DRY RUN — preview only'}) ===`)
  console.log(`Protected: ${PROTECTED_EMAIL}\n`)

  const profiles = await fetchAllProfiles()
  const authUsers = await fetchAllAuthUsers()
  const authByEmail = new Map(authUsers.map((u) => [(u.email || '').toLowerCase(), u]))

  // Union of demo profiles + demo auth users (some may exist only in one place).
  const demoProfiles = profiles.filter(isDemo)
  const demoAuthOnly = authUsers.filter(
    (u) => isDemo({ id: '', email: u.email }) && !demoProfiles.some((p) => p.id === u.id),
  )

  // Absolute safety: refuse if Kacem somehow got flagged.
  const kacemFlagged = [...demoProfiles, ...demoAuthOnly].some((u) => (u.email || '').toLowerCase() === PROTECTED_EMAIL)
  if (kacemFlagged) { console.error('ABORT: protected account matched a demo pattern. No changes made.'); process.exit(2) }

  console.log(`Profiles: ${profiles.length} total · ${demoProfiles.length} demo/test`)
  for (const p of demoProfiles) {
    const owned = await countOwned(p.id)
    const auth = authByEmail.get((p.email || '').toLowerCase())
    console.log(`  - ${p.email || '(no email)'}  [${p.role}]  id=${p.id}  owns opps:${owned.opps} acts:${owned.acts} mtgs:${owned.mtgs}${auth ? '  (+auth)' : ''}`)
  }
  if (demoAuthOnly.length) {
    console.log(`\nAuth users with no profile but demo/test email: ${demoAuthOnly.length}`)
    for (const u of demoAuthOnly) console.log(`  - ${u.email}  authId=${u.id}`)
  }

  const keptProfiles = profiles.filter((p) => !isDemo(p))
  console.log(`\nWill KEEP ${keptProfiles.length} account(s): ${keptProfiles.map((p) => p.email).join(', ') || '(none)'}`)

  if (!APPLY) {
    console.log('\nDry run only. Re-run with --apply to delete the above.')
    if (PRUNE_COMPANIES) await previewOrphanCompanies()
    return
  }

  // ---- apply -------------------------------------------------------------
  let del = 0
  for (const p of demoProfiles) {
    const { error } = await db.from('users').delete().eq('id', p.id) // cascades children
    if (error) { console.error(`  ! profile ${p.email}: ${error.message}`); continue }
    const auth = authByEmail.get((p.email || '').toLowerCase())
    if (auth) await db.auth.admin.deleteUser(auth.id).catch((e) => console.error(`  ! auth ${p.email}: ${e.message}`))
    del++
    console.log(`  deleted ${p.email}`)
  }
  for (const u of demoAuthOnly) {
    await db.auth.admin.deleteUser(u.id).catch((e) => console.error(`  ! auth ${u.email}: ${e.message}`))
    console.log(`  deleted auth-only ${u.email}`)
  }
  console.log(`\nDeleted ${del} profile(s) + ${demoAuthOnly.length} auth-only user(s).`)

  if (PRUNE_COMPANIES) await pruneOrphanCompanies(true)
}

async function orphanCompanies() {
  const { data: companies } = await db.from('companies').select('id,name')
  const { data: opps } = await db.from('opportunities').select('companyId')
  const withOpps = new Set((opps ?? []).map((o) => o.companyId))
  return (companies ?? []).filter((c) => !withOpps.has(c.id))
}
async function previewOrphanCompanies() {
  const orphans = await orphanCompanies()
  console.log(`\nOrphan companies (no opportunities): ${orphans.length}`)
  orphans.slice(0, 50).forEach((c) => console.log(`  - ${c.name}  id=${c.id}`))
  console.log('  (--apply --prune-companies would delete these; their contacts cascade.)')
}
async function pruneOrphanCompanies() {
  const orphans = await orphanCompanies()
  for (const c of orphans) {
    const { error } = await db.from('companies').delete().eq('id', c.id) // contacts cascade
    if (error) console.error(`  ! company ${c.name}: ${error.message}`)
  }
  console.log(`Pruned ${orphans.length} orphan company(ies).`)
}

main().catch((e) => { console.error(e); process.exit(1) })
