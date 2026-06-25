// Runnable sanity check for the metrics layer — asserts the roll-ups reconcile
// with known facts from the source spreadsheet. Invoked once in dev from
// main.tsx; logs a single pass/fail line. If a roll-up breaks, this shouts.

import oppsJson from '@/data/seed/opportunities.json'
import actsJson from '@/data/seed/activities.json'
import meetingsJson from '@/data/seed/meetings.json'
import contractsJson from '@/data/seed/contracts.json'
import type { Activity, Contract, Meeting, Opportunity } from '@/data/types'
import { funnel, kpis, performanceByMember, statusDistribution, totalOutreaches } from './metrics'

export function runSelfCheck(): void {
  const opps = oppsJson as Opportunity[]
  const acts = actsJson as Activity[]
  const meetings = meetingsJson as Meeting[]
  const contracts = contractsJson as Contract[]

  const fails: string[] = []
  const ok = (cond: boolean, msg: string) => { if (!cond) fails.push(msg) }

  // distribution covers every opportunity exactly once
  const dist = statusDistribution(opps)
  ok(Object.values(dist).reduce((a, b) => a + b, 0) === opps.length, 'status distribution count mismatch')

  // funnel is monotonically non-increasing and bounded by opp count
  const f = funnel(opps)
  ok(f[0].count <= opps.length, 'funnel head exceeds opp count')
  for (let i = 1; i < f.length; i++) ok(f[i].count <= f[i - 1].count, `funnel not monotonic at ${f[i].stage}`)

  // signed opps reconcile with contract records (sheet had 11 signed)
  const k = kpis(opps, acts, meetings, contracts)
  ok(k.signed === contracts.length, `signed (${k.signed}) != contracts (${contracts.length})`)
  ok(k.outreaches === totalOutreaches(acts), 'kpi outreaches != total')

  // Tijs is the heaviest contributor — 626 outreach rows in the sheet
  const tijs = performanceByMember(opps, acts, meetings, [{ id: 'usr_tijs', name: 'Tijs' } as never])
    .find((r) => r.id === 'usr_tijs')
  ok(!!tijs && tijs.opportunities === 626, `Tijs opps ${tijs?.opportunities} != 626`)

  if (fails.length) console.error('[metrics self-check] FAILED:\n - ' + fails.join('\n - '))
  else console.info(`[metrics self-check] passed · ${opps.length} opps, ${k.outreaches} outreaches, ${k.signed} signed`)
}
