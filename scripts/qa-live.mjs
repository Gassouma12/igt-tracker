// Live end-to-end QA against the real Supabase project: exercises the RLS
// matrix and CRUD lifecycle as anon → pending user → approved user, including
// privilege-escalation attempts. Creates its own throwaway auth user and
// cleans everything up. Needs both env vars:
//
//   SUPABASE_DB_URL="<session pooler URI>" \
//   VITE_SUPABASE_URL=... VITE_SUPABASE_ANON_KEY=... node scripts/qa-live.mjs
//
import { createClient } from '@supabase/supabase-js'
import pg from 'pg'

const URL = process.env.VITE_SUPABASE_URL
const ANON = process.env.VITE_SUPABASE_ANON_KEY
const DB = process.env.SUPABASE_DB_URL
if (!URL || !ANON || !DB) { console.error('missing env'); process.exit(1) }

const admin = new pg.Client({ connectionString: DB, ssl: { rejectUnauthorized: false }, connectionTimeoutMillis: 8000 })
await admin.connect()

let pass = 0, fail = 0
const ok = (name, cond, detail = '') => {
  if (cond) { pass++; console.log(`  ✓ ${name}`) }
  else { fail++; console.error(`  ✗ ${name} ${detail}`) }
}
const ts = Date.now().toString(36)
const email = `igt.qa.${ts}@example.org`
const FOREIGN_OPP = `qa_foreign_${ts}`
let uid = null

try {
  // ---- anon --------------------------------------------------------------
  console.log('— anon —')
  const anon = createClient(URL, ANON, { auth: { persistSession: false } })
  const lcs = await anon.from('local_committees').select('id')
  ok('anon reads LCs (signup dropdown)', (lcs.data ?? []).length === 3, JSON.stringify(lcs.error))
  const anonUsers = await anon.from('users').select('id')
  ok('anon reads zero users', (anonUsers.data ?? []).length === 0)
  const anonWrite = await anon.from('companies').insert({ id: `qa_x_${ts}`, name: 'x' })
  ok('anon insert denied', !!anonWrite.error)

  // ---- sign up → pending ---------------------------------------------------
  console.log('— pending user —')
  const qa = createClient(URL, ANON, { auth: { persistSession: false } })
  const su = await qa.auth.signUp({ email, password: `Qa!${ts}Aa1` })
  ok('signup returns session (email confirm off)', !!su.data.session, JSON.stringify(su.error))
  uid = su.data.user?.id
  const prof = await qa.from('users').insert({
    id: uid, name: 'QA Bot', email, role: 'member', lcId: 'lc_ghent',
    position: 'QA', teamLeadId: null, active: true, phone: null, status: 'pending',
  })
  ok('pending profile insert (own row)', !prof.error, JSON.stringify(prof.error))
  const esc0 = await qa.from('users').insert({ id: `evil_${ts}`, name: 'Evil', email: `e${ts}@x.io`, role: 'admin', position: 'x', lcId: null, teamLeadId: null, active: true, status: 'approved' })
  ok('inserting a foreign/admin/approved user row denied', !!esc0.error)
  const esc1 = await qa.from('users').update({ role: 'admin', status: 'approved' }).eq('id', uid).select()
  ok('PENDING self-escalation to admin blocked', (esc1.data ?? []).length === 0)
  const oppPending = await qa.from('opportunities').insert({ id: `qa_opp_p_${ts}`, companyId: 'x', ownerId: uid, lcId: 'lc_ghent', status: 'Prospect', value: 0, revenueReceived: false })
  ok('pending user cannot create opportunities', !!oppPending.error)
  const ntf = await qa.from('notifications').insert({ id: `qa_ntf_${ts}`, recipientId: 'usr_admin', actorId: uid, opportunityId: null, kind: 'goal', message: 'QA requested an account', read: false, at: new Date().toISOString() })
  ok('signup notification to admin allowed (actor = self)', !ntf.error, JSON.stringify(ntf.error))
  const readUsersPending = await qa.from('users').select('id')
  ok('pending user sees only own row', (readUsersPending.data ?? []).length === 1)

  // ---- admin approves (simulated server-side) -------------------------------
  await admin.query(`update users set status='approved' where id=$1`, [uid])
  console.log('— approved member —')
  const readUsers = await qa.from('users').select('id')
  ok('approved sees the org (≥22 users)', (readUsers.data ?? []).length >= 22)
  const esc2 = await qa.from('users').update({ role: 'admin' }).eq('id', uid).select()
  ok('APPROVED self-escalation still blocked', (esc2.data ?? []).length === 0)
  await admin.query(`select role from users where id=$1`, [uid]).then(({ rows }) =>
    ok('role verified unchanged in DB', rows[0]?.role === 'member'))

  // full CRUD lifecycle on own data
  const coIns = await qa.from('companies').insert({ id: `qa_co_${ts}`, name: `QA Co ${ts}`, industry: null, country: 'Belgium', website: null, linkedin: null, notes: null })
  ok('create company', !coIns.error, JSON.stringify(coIns.error))
  const ctIns = await qa.from('contacts').insert({ id: `qa_ct_${ts}`, companyId: `qa_co_${ts}`, name: 'Jane QA', role: null, email: null, phone: null, linkedin: null })
  ok('create contact', !ctIns.error)
  const oppIns = await qa.from('opportunities').insert({ id: `qa_opp_${ts}`, companyId: `qa_co_${ts}`, contactId: `qa_ct_${ts}`, ownerId: uid, lcId: 'lc_ghent', status: 'Prospect', value: 500, revenueReceived: false, expectedPaymentDate: '2026-09-01' })
  ok('create own opportunity (with expectedPaymentDate)', !oppIns.error, JSON.stringify(oppIns.error))
  const actIns = await qa.from('activities').insert({ id: `qa_act_${ts}`, opportunityId: `qa_opp_${ts}`, ownerId: uid, type: 'Email', phase: 'first', count: 1, outcome: 'neutral', date: '2026-07-06', notes: 'qa' })
  ok('log activity', !actIns.error)
  const mtgIns = await qa.from('meetings').insert({ id: `qa_mtg_${ts}`, opportunityId: `qa_opp_${ts}`, ownerId: uid, date: '2026-07-06', number: 1, outcome: 'Held', nextAction: null, notes: 'qa meeting' })
  ok('log meeting (with notes)', !mtgIns.error)
  const conIns = await qa.from('contracts').insert({ id: `qa_con_${ts}`, opportunityId: `qa_opp_${ts}`, dateSent: '2026-07-06', dateSigned: null, daysUntilSigned: null })
  ok('create contract on own opp', !conIns.error, JSON.stringify(conIns.error))
  const upd = await qa.from('opportunities').update({ status: 'Contacted' }).eq('id', `qa_opp_${ts}`).select()
  ok('advance own stage', (upd.data ?? []).length === 1)

  // canEditOwned server-enforced: foreign opp untouchable
  await admin.query(`insert into opportunities (id,"companyId","ownerId","lcId",status,value,"revenueReceived")
    values ($1,$2,'usr_tijs','lc_ghent','Prospect',0,false)`, [FOREIGN_OPP, `qa_co_${ts}`])
  const updF = await qa.from('opportunities').update({ status: 'Lost' }).eq('id', FOREIGN_OPP).select()
  ok("cannot edit another member's opportunity", (updF.data ?? []).length === 0)
  const delF = await qa.from('opportunities').delete().eq('id', FOREIGN_OPP).select()
  ok("cannot delete another member's opportunity", (delF.data ?? []).length === 0)

  // goal hierarchy: member sets nobody's goals
  const goal = await qa.from('goals').insert({ id: `qa_goal_${ts}`, scope: 'member', ownerId: uid, lcId: 'lc_ghent', period: '2026-S2', cadence: 'semester', metric: 'meetings', planned: 5 })
  ok('member cannot set goals (even own)', !!goal.error)

  // privacy
  const log = await qa.from('activity_log').select('id')
  ok('audit log hidden from non-admin', (log.data ?? []).length === 0)
  const ntfs = await qa.from('notifications').select('id,recipientId')
  ok('sees only own notifications', (ntfs.data ?? []).every((x) => x.recipientId === uid))

  // cascade delete of own lead
  const delOwn = await qa.from('opportunities').delete().eq('id', `qa_opp_${ts}`).select()
  ok('delete own opportunity', (delOwn.data ?? []).length === 1)
  const { rows: kids } = await admin.query(
    `select (select count(*) from activities where "opportunityId"=$1)::int a,
            (select count(*) from meetings where "opportunityId"=$1)::int m,
            (select count(*) from contracts where "opportunityId"=$1)::int c`, [`qa_opp_${ts}`])
  ok('children cascaded (activities/meetings/contracts gone)', kids[0].a === 0 && kids[0].m === 0 && kids[0].c === 0)
} finally {
  // ---- cleanup ---------------------------------------------------------------
  await admin.query(`delete from opportunities where id like 'qa_%_${ts}' or id = $1`, [FOREIGN_OPP]).catch(() => {})
  await admin.query(`delete from contacts where id like 'qa_%_${ts}'`).catch(() => {})
  await admin.query(`delete from companies where id like 'qa_%_${ts}'`).catch(() => {})
  await admin.query(`delete from notifications where id like 'qa_%_${ts}'`).catch(() => {})
  if (uid) {
    await admin.query(`delete from users where id=$1`, [uid]).catch(() => {})
    await admin.query(`delete from auth.users where id=$1::uuid`, [uid]).catch(() => {})
  }
  await admin.end()
  console.log(`\nQA: ${pass} passed, ${fail} failed (test data cleaned up)`)
  if (fail) process.exitCode = 1
}
