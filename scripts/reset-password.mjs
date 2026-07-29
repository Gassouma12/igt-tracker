// Reset a user's password as the admin — no recovery email needed. AiB iGT.
//
//   SUPABASE_SERVICE_ROLE_KEY=... node scripts/reset-password.mjs <email> <new-password>
//
// The service_role key is in the Supabase dashboard → Project Settings → API →
// "service_role" (secret — never commit it). Hand the new password to the user
// and tell them to sign in and change it.
import { createClient } from '@supabase/supabase-js'

const [email, password] = process.argv.slice(2)
const URL = process.env.VITE_SUPABASE_URL || 'https://sayuohpchlpmykdvwtdo.supabase.co'
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!email || !password) {
  console.error('usage: node scripts/reset-password.mjs <email> <new-password>')
  process.exit(1)
}
if (!KEY) {
  console.error('Set SUPABASE_SERVICE_ROLE_KEY (dashboard → Settings → API → service_role).')
  process.exit(1)
}
if (password.length < 6) {
  console.error('Password must be at least 6 characters.')
  process.exit(1)
}

const admin = createClient(URL, KEY, { auth: { persistSession: false } })
const { data, error } = await admin.auth.admin.listUsers({ perPage: 1000 })
if (error) { console.error(error.message); process.exit(1) }
const user = data.users.find((u) => u.email?.toLowerCase() === email.toLowerCase())
if (!user) { console.error(`No account found for ${email}.`); process.exit(1) }

const { error: upErr } = await admin.auth.admin.updateUserById(user.id, { password })
if (upErr) { console.error(upErr.message); process.exit(1) }
console.log(`✓ Password reset for ${email}. Tell them to sign in and change it.`)
