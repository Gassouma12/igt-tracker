// Uploads the app images to the Supabase `images` bucket. The anon/publishable
// key can't write to storage (RLS), so this needs the SERVICE ROLE key.
//
//   SUPABASE_SERVICE_ROLE_KEY=... node scripts/upload-images.mjs
//
// (VITE_SUPABASE_URL is read from your .env automatically if you load it; or set
//  it inline.) The service role key is secret — never commit it.
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const url = process.env.VITE_SUPABASE_URL || 'https://sayuohpchlpmykdvwtdo.supabase.co'
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!key) {
  console.error('Set SUPABASE_SERVICE_ROLE_KEY (Settings -> API -> service_role).')
  process.exit(1)
}

const supabase = createClient(url, key)
const files = ['bg.png', 'gem.png']

for (const f of files) {
  const buf = readFileSync(join(root, 'src/images', f))
  const { error } = await supabase.storage.from('images').upload(f, buf, {
    contentType: 'image/png', upsert: true,
  })
  console.log(f, error ? `FAILED: ${error.message}` : 'uploaded ✓')
}
