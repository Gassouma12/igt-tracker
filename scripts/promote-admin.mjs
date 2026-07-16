// Promote a signed-up user to approved admin (the bootstrap step).
// Usage:
//   SUPABASE_DB_URL="<session pooler URI>" node scripts/promote-admin.mjs you@aiesec.be
import pg from 'pg'

const email = process.argv[2]?.trim().toLowerCase()
const DB = process.env.SUPABASE_DB_URL
if (!email || !DB) { console.error('Usage: SUPABASE_DB_URL=... node scripts/promote-admin.mjs <email>'); process.exit(1) }

const c = new pg.Client({ connectionString: DB, ssl: { rejectUnauthorized: false }, connectionTimeoutMillis: 8000 })
await c.connect()
try {
  const { rows: auth } = await c.query(`select id::text from auth.users where lower(email) = $1`, [email])
  if (!auth.length) {
    console.error(`No auth account for ${email} — sign up in the app first, then re-run this.`)
    process.exit(1)
  }
  const { rowCount } = await c.query(
    `update users set role='admin', status='approved', active=true where id=$1`, [auth[0].id])
  if (!rowCount) {
    console.error('Auth account exists but the profile row is missing — sign up through the app form (it creates the profile), then re-run.')
    process.exit(1)
  }
  console.log(`${email} is now an approved admin. Reload the app.`)
} finally { await c.end() }
