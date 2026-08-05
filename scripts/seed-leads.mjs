// One-off: load the 30 prospection leads (companies + contacts) into the MCVP
// (kacem@aiesec.be) pipeline as Prospect opportunities. Signs in as the admin
// test account (RLS lets an admin insert opportunities for another owner).
// Idempotent: rows are id-tagged `*_lead_*` and cleared before re-inserting.
//
//   node scripts/seed-leads.mjs
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const env = Object.fromEntries(
  readFileSync(join(root, '.env'), 'utf8').split('\n')
    .map((l) => l.trim()).filter((l) => l && !l.startsWith('#'))
    .map((l) => { const i = l.indexOf('='); return [l.slice(0, i), l.slice(i + 1)] }),
)
const URL = process.env.VITE_SUPABASE_URL || env.VITE_SUPABASE_URL
const ANON = process.env.VITE_SUPABASE_ANON_KEY || env.VITE_SUPABASE_ANON_KEY
const ADMIN_EMAIL = 'admin.test@igt.aiesec.be'
const ADMIN_PASS = 'igtdemo123'
const MCVP_EMAIL = 'kacem@aiesec.be'

const li = (u) => u && u.replace(/%25/g, '%') // undo the double-encoding in the source doc
const TODAY = (() => { const d = new Date(); const p = (n) => String(n).padStart(2, '0'); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}` })()

// name, industry, country, website, linkedin(company), notes, contacts[{name,role,linkedin}]
const LEADS = [
  // --- Luxembourg ---
  { name: 'Elisabeth', industry: 'Non-profit / Social impact', country: 'Luxembourg', website: 'https://www.elisabeth.lu/', linkedin: null,
    notes: 'Social-impact org, active hiring, iGV/CSR fit, employer branding for non-profit, access to mission-driven youth. Target: HR/Talent Acquisition or CSR Manager. Channel: LinkedIn InMail + CSR/volunteering angle. Hiring page: elisabeth.lu/rejoignez-elisabeth/nos-offres-demploi', contacts: [] },
  { name: 'Afrilanthropy', industry: 'Philanthropy / Social enterprise', country: 'Luxembourg', website: null, linkedin: null,
    notes: 'Philanthropy/social enterprise needing international volunteers (iGV), CSR partnership, youth engagement. Target: Founder / Partnerships Manager. Channel: LinkedIn, website contact, CSR networks.', contacts: [] },
  { name: 'Datathings', industry: 'Technology', country: 'Luxembourg', website: 'https://datathings.com/', linkedin: null,
    notes: 'Tech startup/scale-up needing niche IT talent (iGT/iGE), employer branding among young pros. Target: CTO / Head of Talent. Channel: LinkedIn, tech meetups.', contacts: [] },
  { name: 'Movify', industry: 'Digital agency', country: 'Luxembourg', website: 'https://www.movify.lu/', linkedin: null,
    notes: 'Digital agency scaling team; iGT for developers/designers, employer branding, young creative talent. Target: Head of People / Talent Acquisition. Channel: LinkedIn, creative/digital events.', contacts: [] },
  { name: 'Kyū Solution', industry: 'Web development', country: 'Luxembourg', website: 'https://www.kyu-solution.fr/', linkedin: null,
    notes: 'Web-development SME in growth phase; junior tech talent, internships/iGT, employer branding. Target: Founder / Project Manager. Channel: LinkedIn, web-agency communities.', contacts: [] },
  { name: 'Avocado Technology', industry: 'Mobile & web development', country: 'Luxembourg', website: 'https://avocadotechnology.com/', linkedin: null,
    notes: 'Mobile & web dev company; QA/UX/Product talent, young international grads (iGT), scale-up mindset. Target: Head of Development / HR. Channel: LinkedIn, tech conferences.', contacts: [] },
  { name: 'Inside Communication', industry: 'Communication services', country: 'Luxembourg', website: 'https://inside-communication.lu/', linkedin: null,
    notes: 'Communication-services SME; marketing/comms talent, client-facing youth skills (iGT). Target: Managing Director / HR. Channel: LinkedIn, marketing/comms events.', contacts: [] },
  { name: 'KPMG Luxembourg', industry: 'Professional services (Big 4)', country: 'Luxembourg', website: null, linkedin: null,
    notes: 'Big4 with massive early-career hiring, graduate programmes, D&I, ex-AIESECer in team; iGT/iGV for leadership development. Target: Talent Acquisition Manager / Campus Recruiter. Channel: LinkedIn (warm, ex-AIESECer).',
    contacts: [
      { name: 'Chiara Rum', role: 'Talent Acquisition / Campus Recruiter', linkedin: 'https://www.linkedin.com/in/chiara-rum/' },
      { name: 'Noemi Signorelli', role: 'Talent Acquisition / Campus Recruiter', linkedin: 'https://www.linkedin.com/in/noemi-signorelli-790b441ab/' },
    ] },
  { name: 'EY Luxembourg', industry: 'Professional services (Big 4)', country: 'Luxembourg', website: null, linkedin: null,
    notes: 'Big4 talent pipeline for audit/consulting; global mobility, ex-AIESECer connection, graduate/internship hiring. Target: Talent Acquisition / Early Career. Channel: LinkedIn (warm, ex-AIESECer).',
    contacts: [{ name: 'Alain Marcel', role: 'Talent Acquisition / Early Career', linkedin: 'https://www.linkedin.com/in/alain-marcel-5567215/' }] },
  { name: 'PwC Luxembourg', industry: 'Professional services (Big 4)', country: 'Luxembourg', website: null, linkedin: null,
    notes: 'Big4; young-professional talent, employer branding, D&I, ex-AIESECer, cross-border talent; iGT for assurance/tax/consulting. Target: Campus Recruitment / Employer Branding. Channel: LinkedIn (warm, ex-AIESECer).',
    contacts: [{ name: 'Andrean Malini', role: 'Campus Recruitment / Employer Branding', linkedin: 'https://www.linkedin.com/in/andreanmalini/' }] },
  // --- Flanders (Belgium) ---
  { name: 'Abbott', industry: 'Healthcare', country: 'Belgium', website: null, linkedin: null,
    notes: 'Global healthcare; graduate/internship programmes, STEM talent, D&I, ex-AIESECer; iGT for science/business roles. Target: Early-Career Talent Acquisition / Employer Branding. Channel: LinkedIn (warm, ex-AIESECer), AIESEC referral.',
    contacts: [
      { name: 'Abir Al Helou', role: 'Early-Career Talent Acquisition', linkedin: 'https://www.linkedin.com/in/abiralhelou/' },
      { name: 'Celia Abchiche', role: 'Employer Branding / Talent', linkedin: 'https://www.linkedin.com/in/celia-abchiche/' },
    ] },
  { name: 'Deloitte Belgium', industry: 'Professional services (Big 4)', country: 'Belgium', website: null, linkedin: null,
    notes: 'Big4 with continuous early-career hiring; employer branding, ex-AIESECer; iGT for consulting/finance. Target: Graduate Recruitment / Talent Manager. Channel: LinkedIn (warm, ex-AIESECer).',
    contacts: [{ name: 'Camille De Borger', role: 'Graduate Recruitment / Talent Manager', linkedin: 'https://www.linkedin.com/in/camille-de-borger/' }] },
  { name: 'clearXperts', industry: 'IT consultancy / Engineering', country: 'Belgium', website: null, linkedin: null,
    notes: 'IT consultancy/engineering; young technical talent, ex-AIESECer; iGT for engineers, PM track. Target: Head of People / Technical Recruitment Lead. Channel: LinkedIn (warm, ex-AIESECer).',
    contacts: [{ name: 'Joris Reynders', role: 'Head of People / Technical Recruitment', linkedin: 'https://www.linkedin.com/in/jorisreynders/' }] },
  { name: 'Narviflex Group', industry: 'Industrial packaging / Manufacturing', country: 'Belgium', website: null, linkedin: null,
    notes: 'Industrial packaging; sales/engineering talent, employer branding in manufacturing, ex-AIESECer; iGT for business development. Less traditional employer = strong differentiation. Target: Sales Director / HR Manager. Channel: LinkedIn (warm, ex-AIESECer).',
    contacts: [{ name: 'Christophe Geerkens', role: 'Sales Director / HR Manager', linkedin: 'https://www.linkedin.com/in/christophegeerkens/' }] },
  { name: 'Cargill', industry: 'Agribusiness', country: 'Belgium', website: null, linkedin: null,
    notes: 'Agribusiness giant; graduate programmes, international STEM & business profiles, ex-AIESECer; iGT for trading/supply chain. Target: Early Careers Recruiter / Talent Acquisition. Channel: LinkedIn (warm, ex-AIESECer).',
    contacts: [{ name: 'Axelle Leysens', role: 'Early Careers Recruiter / Talent Acquisition', linkedin: 'https://www.linkedin.com/in/axelle-leysens-59028a61/' }] },
  { name: 'Trane Technologies', industry: 'Climate innovation / Engineering', country: 'Belgium', website: null, linkedin: 'https://www.linkedin.com/company/64259963/',
    notes: 'Climate innovation; engineering talent, graduate schemes, ex-AIESECer; iGT for sustainability roles. Target: HR / Talent Acquisition (Engineering). Channel: LinkedIn (warm, ex-AIESECer).',
    contacts: [{ name: 'Sonja Cornakov Zivkovic', role: 'HR / Talent Acquisition (Engineering)', linkedin: 'https://www.linkedin.com/in/sonja-cornakov-zivkovic-41644441/' }] },
  { name: 'Amplifon', industry: 'Retail healthcare', country: 'Belgium', website: null, linkedin: null,
    notes: 'Retail healthcare; customer-facing talent, ex-AIESECer, inclusive brand; iGT for sales/marketing. Target: Retail HR / Talent Manager. Channel: LinkedIn (warm, ex-AIESECer).',
    contacts: [{ name: 'Stijn Mutsaers', role: 'Retail HR / Talent Manager', linkedin: 'https://www.linkedin.com/in/stijn-mutsaers-a0bbb29/' }] },
  { name: 'Cegelec Belgium', industry: 'Technical services / Energy', country: 'Belgium', website: null, linkedin: null,
    notes: 'Technical services/energy; technical talent pipeline, ex-AIESECer; iGT for electrical/mechanical engineers. Target: HR Business Partner / Technical Recruiter. Channel: LinkedIn (warm, ex-AIESECer).',
    contacts: [{ name: 'Jill Boeren', role: 'HR Business Partner / Technical Recruiter', linkedin: 'https://www.linkedin.com/in/jillboeren/' }] },
  { name: 'Barco', industry: 'Visualization / Technology', country: 'Belgium', website: null, linkedin: null,
    notes: 'Visualization/tech corporate; innovation-driven talent, ex-AIESECer, global mindset; iGT for software/R&D. Target: Talent Acquisition / Early-Career Programme Manager. Channel: LinkedIn (warm, ex-AIESECer).',
    contacts: [{ name: 'Alexis Capili', role: 'Talent Acquisition / Early-Career Programme', linkedin: 'https://www.linkedin.com/in/alexiscapili/' }] },
  { name: 'PwC Belgium', industry: 'Professional services (Big 4)', country: 'Belgium', website: null, linkedin: null,
    notes: 'Big4; massive graduate/internship pipeline, D&I, ex-AIESECer; iGT for audit/consulting, leadership development. Target: Campus Recruitment / Employer Branding. Channel: LinkedIn (warm, ex-AIESECer).',
    contacts: [{ name: 'Nele Parys', role: 'Campus Recruitment / Employer Branding', linkedin: 'https://www.linkedin.com/in/neleparys/' }] },
  // --- Wallonia (Belgium) ---
  { name: 'BDO Belgium', industry: 'Professional services', country: 'Belgium', website: null, linkedin: null,
    notes: 'Professional-services firm; growing talent needs, graduate hiring, ex-AIESECer; iGT for accounting/audit trainees. Target: Talent Acquisition / HR Manager. Channel: LinkedIn (warm, ex-AIESECer).',
    contacts: [{ name: 'Florence Cornélis', role: 'Talent Acquisition / HR Manager', linkedin: li('https://www.linkedin.com/in/florence-corn%25C3%25A9lis-91187a36/') }] },
  { name: 'Olivia Garden Europe', industry: 'Consumer goods', country: 'Belgium', website: null, linkedin: 'https://www.linkedin.com/company/oliviagarden/',
    notes: 'Consumer-goods SME in expansion; marketing/sales talent, ex-AIESECer; iGT for international commercial roles. Target: Marketing / HR Manager. Channel: LinkedIn (warm, ex-AIESECer).',
    contacts: [
      { name: 'Cindy Jamar', role: 'Marketing / HR Manager', linkedin: 'https://www.linkedin.com/in/cindy-jamar-69aa6012a/' },
      { name: 'Silvia Verdes', role: 'Marketing / Commercial', linkedin: 'https://www.linkedin.com/in/silvia-verdes-36749319b/' },
    ] },
  { name: 'GAMING1', industry: 'Gaming / Technology', country: 'Belgium', website: null, linkedin: null,
    notes: 'Gaming/tech, active junior hiring; employer branding among youth, ex-AIESECer; iGT for product/project management. Active job: Junior Program Manager (Liège). Target: HR / Talent Development. Channel: LinkedIn (warm, ex-AIESECer).',
    contacts: [
      { name: 'Valérie Moré', role: 'HR / Talent Development', linkedin: li('https://www.linkedin.com/in/val%25C3%25A9riemor%25C3%25A9/') },
      { name: 'Thomas Henriet', role: 'Talent / Junior Programme', linkedin: 'https://www.linkedin.com/in/thomas-henriet-125663aa/' },
    ] },
  { name: 'Bel', industry: 'FMCG / Food', country: 'Belgium', website: null, linkedin: null,
    notes: 'FMCG with structured graduate programme (sales track); commercial young talent, ex-AIESECer; iGT for FMCG business roles. Active job: Young Graduate Program – Sales Track. Target: Early-Career Programme Manager / Sales HR. Channel: LinkedIn (warm, ex-AIESECer), referral.',
    contacts: [
      { name: 'Aricia Nisol', role: 'Early-Career Programme / Sales HR', linkedin: 'https://www.linkedin.com/in/aricia-nisol/' },
      { name: 'Marine Bisson', role: 'Graduate Programme / Sales', linkedin: 'https://www.linkedin.com/in/marine-bisson-660abb5b/' },
    ] },
  { name: 'Nexans', industry: 'Industrial / Manufacturing', country: 'Belgium', website: null, linkedin: null,
    notes: 'Industrial graduate program (PowerUP) advertised; manufacturing/engineering youth talent, ex-AIESECer; iGT for engineering/business graduates. Active job: Industrial Graduate Program – PowerUP. Target: Graduate Programme Manager / Industrial HR. Channel: LinkedIn (warm, ex-AIESECer).',
    contacts: [{ name: 'Sarah Fichefet', role: 'Graduate Programme Manager / Industrial HR', linkedin: 'https://www.linkedin.com/in/sarahfichefet/' }] },
  { name: 'Giftify', industry: 'Fintech', country: 'Belgium', website: null, linkedin: null,
    notes: 'Fintech scale-up; marketing/sales talent, multiple ex-AIESECers, startup energy; iGT for growth/tech roles. Target: Head of Growth / Marketing Manager. Channel: LinkedIn (warm), referral.',
    contacts: [
      { name: 'Amandine Behets Wydemans', role: 'Head of Growth / Marketing', linkedin: 'https://www.linkedin.com/in/amandinebehetswydemans/' },
      { name: 'Artem Shostak', role: 'Growth Marketer', linkedin: 'https://www.linkedin.com/in/growth-marketer-be/' },
    ] },
  { name: 'Start it Accelerate | @KBC', industry: 'Startup ecosystem / Accelerator', country: 'Belgium', website: null, linkedin: null,
    notes: 'Startup ecosystem/accelerator; active internship (marketing/events), iGV support, ex-AIESECer; talent for portfolio startups. Active job: Stage en marketing & événementiel. Target: Community Manager / Partnerships Lead. Channel: LinkedIn (warm, ex-AIESECer), ecosystem events.',
    contacts: [{ name: 'Artem Shostak', role: 'Community / Partnerships', linkedin: 'https://www.linkedin.com/in/growth-marketer-be/' }] },
  { name: 'NSI IT Software & Services', industry: 'IT services', country: 'Belgium', website: null, linkedin: 'https://www.linkedin.com/company/165245/',
    notes: 'IT-services corporate with open speculative intern call; junior IT talent, ex-AIESECer; iGT for developers/support. Active job: Candidature Spontanée – Stagiaires BE. Target: HR Manager / Recruitment Lead. Channel: LinkedIn (warm, ex-AIESECer).',
    contacts: [{ name: 'Clara Coulée', role: 'HR Manager / Recruitment Lead', linkedin: li('https://www.linkedin.com/in/clara-coul%25C3%25A9e-83288111a/') }] },
  { name: 'Softway Medical Group', industry: 'Healthtech software', country: 'Belgium', website: null, linkedin: 'https://www.linkedin.com/company/groupe-softway-medical/',
    notes: 'Healthtech software; niche IT/health talent, ex-AIESECer; iGT for developers and PMs in health IT. Target: Talent Acquisition / HR Manager. Channel: LinkedIn (warm, ex-AIESECer).',
    contacts: [{ name: 'Marianne Lohier', role: 'Talent Acquisition / HR Manager', linkedin: 'https://www.linkedin.com/in/marianne-lohier/' }] },
  { name: 'Sonaca', industry: 'Aerospace engineering', country: 'Belgium', website: null, linkedin: null,
    notes: 'Aerospace engineering leader; young engineers, STEM employer branding, multiple ex-AIESECers, international mindset; iGT for R&D/manufacturing. Target: Engineering HR / Graduate Programme Manager. Channel: LinkedIn (warm, ex-AIESECers).',
    contacts: [
      { name: 'Cabrelle Toukam Kaffo', role: 'Engineering HR / Graduate Programme', linkedin: 'https://www.linkedin.com/in/cabrelle-toukam-kaffo-30ba9083/' },
      { name: 'Viviane Marques', role: 'Engineering HR / Talent', linkedin: 'https://www.linkedin.com/in/viviane-marques-902b29326/' },
    ] },
]

const sb = createClient(URL, ANON)

async function main() {
  const { error: authErr } = await sb.auth.signInWithPassword({ email: ADMIN_EMAIL, password: ADMIN_PASS })
  if (authErr) throw new Error(`admin sign-in failed: ${authErr.message}`)

  const { data: mcvp, error: uErr } = await sb.from('users').select('id, lcId, name').eq('email', MCVP_EMAIL).maybeSingle()
  if (uErr) throw uErr
  if (!mcvp) throw new Error(`no user with email ${MCVP_EMAIL} — cannot assign the pipeline`)
  const ownerId = mcvp.id
  const lcId = mcvp.lcId || 'lc_mc'
  console.log(`MCVP = ${mcvp.name} (${ownerId}), LC=${lcId}`)

  // idempotent: clear any previously seeded lead rows (children first)
  for (const t of ['opportunities', 'contacts', 'companies']) {
    const { error } = await sb.from(t).delete().like('id', `%_lead_%`)
    if (error) throw new Error(`clear ${t}: ${error.message}`)
  }

  const companies = [], contacts = [], opportunities = []
  LEADS.forEach((lead, i) => {
    const cid = `co_lead_${i}`
    companies.push({ id: cid, name: lead.name, industry: lead.industry, country: lead.country, website: lead.website, linkedin: lead.linkedin, notes: lead.notes })
    let firstContactId = null
    lead.contacts.forEach((c, j) => {
      const ctid = `ct_lead_${i}_${j}`
      if (!firstContactId) firstContactId = ctid
      contacts.push({ id: ctid, companyId: cid, name: c.name, role: c.role ?? null, email: null, phone: null, linkedin: c.linkedin ?? null })
    })
    opportunities.push({
      id: `opp_lead_${i}`, companyId: cid, contactId: firstContactId, ownerId, lcId,
      status: 'Prospect', value: 0, revenueReceived: false,
      nextAction: null, nextActionDate: null, expectedPaymentDate: null,
      lastActivityAt: TODAY, createdAt: TODAY, updatedAt: new Date().toISOString(),
    })
  })

  for (const [t, rows] of [['companies', companies], ['contacts', contacts], ['opportunities', opportunities]]) {
    const { error } = await sb.from(t).insert(rows)
    if (error) throw new Error(`insert ${t}: ${error.message}`)
    console.log(`inserted ${rows.length} ${t}`)
  }

  const { count } = await sb.from('opportunities').select('id', { count: 'exact', head: true }).eq('ownerId', ownerId)
  console.log(`✓ done — ${MCVP_EMAIL} now owns ${count} opportunities total`)
}

main().catch((e) => { console.error('FAILED:', e.message); process.exit(1) })
