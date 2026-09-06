// Lightweight client-side attempt limiter for sensitive actions (sign in / sign
// up). This is defense-in-depth + UX only — the authoritative rate limiting is
// enforced by Supabase Auth server-side. It slows repeated attempts from a single
// browser and gives clear feedback instead of hammering the endpoint.

interface Bucket { count: number; first: number; blockedUntil: number }
const buckets = new Map<string, Bucket>()

export interface RateResult { ok: boolean; retryInMs: number }

/**
 * Allow up to `max` attempts per `windowMs`; once exceeded, block for `blockMs`.
 * Returns { ok } and, when blocked, how long to wait.
 */
export function rateLimit(
  key: string,
  { max = 5, windowMs = 60_000, blockMs = 60_000 }: { max?: number; windowMs?: number; blockMs?: number } = {},
): RateResult {
  const now = Date.now()
  const b = buckets.get(key)
  if (!b) { buckets.set(key, { count: 1, first: now, blockedUntil: 0 }); return { ok: true, retryInMs: 0 } }
  if (b.blockedUntil > now) return { ok: false, retryInMs: b.blockedUntil - now }
  if (now - b.first > windowMs) { b.count = 1; b.first = now; b.blockedUntil = 0; return { ok: true, retryInMs: 0 } }
  b.count++
  if (b.count > max) { b.blockedUntil = now + blockMs; return { ok: false, retryInMs: blockMs } }
  return { ok: true, retryInMs: 0 }
}

/** Reset a bucket after a successful attempt. */
export function rateLimitReset(key: string): void { buckets.delete(key) }

/** Human-friendly "try again in N seconds" for a blocked result. */
export function retryHint(ms: number): string {
  const s = Math.ceil(ms / 1000)
  return `Too many attempts. Please wait ${s} second${s === 1 ? '' : 's'} and try again.`
}
