// One-shot Supabase setup: runs schema.sql, seed.sql, realtime.sql against the
// project's Postgres. Idempotent (IF NOT EXISTS / ON CONFLICT DO NOTHING).
//
//   1) npm install pg
//   2) Supabase dashboard -> Settings -> Database -> Connection string ->
//      "Session pooler" (URI). It looks like:
//      postgresql://postgres.<ref>:PASSWORD@aws-0-<region>.pooler.supabase.com:5432/postgres
//   3) SUPABASE_DB_URL="<that URI>" node scripts/setup-supabase.mjs
//
// (The direct db.<ref>.supabase.co host is IPv6-only on newer projects; use the
//  pooler URI above, which is IPv4 and works everywhere.)
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import pg from 'pg'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const url = process.env.SUPABASE_DB_URL
if (!url) { console.error('Set SUPABASE_DB_URL'); process.exit(1) }

const client = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: false } })

async function runFile(name, { ignoreErrors = false } = {}) {
  const sql = readFileSync(join(root, 'supabase', name), 'utf8')
  if (!ignoreErrors) {
    await client.query(sql)
    console.log(`✓ ${name}`)
    return
  }
  // Run statement-by-statement so one "already exists" doesn't abort the rest.
  for (const stmt of sql.split(';').map((s) => s.trim()).filter((s) => s && !s.startsWith('--'))) {
    try { await client.query(stmt) } catch (e) { console.log(`  · skipped: ${e.message}`) }
  }
  console.log(`✓ ${name}`)
}

try {
  await client.connect()
  console.log('connected')
  await runFile('schema.sql')
  await runFile('seed.sql')
  await runFile('realtime.sql', { ignoreErrors: true })
  const { rows } = await client.query('select count(*)::int as n from users')
  console.log(`users in DB: ${rows[0].n}`)
} finally {
  await client.end()
}
