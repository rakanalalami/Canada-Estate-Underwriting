import type { DealStatus } from '@/engine/types'
import type { Tone } from '@/engine/metrics'

export const DEAL_STATUS_META: { key: DealStatus; label: string; tone: Tone }[] = [
  { key: 'WATCHING', label: 'Watching', tone: 'muted' },
  { key: 'INTERESTED', label: 'Interested', tone: 'info' },
  { key: 'DUE_DILIGENCE', label: 'Due diligence', tone: 'warn' },
  { key: 'OFFER_SUBMITTED', label: 'Offer submitted', tone: 'warn' },
  { key: 'UNDER_CONTRACT', label: 'Under contract', tone: 'pos' },
  { key: 'PURCHASED', label: 'Purchased', tone: 'pos' },
  { key: 'REJECTED', label: 'Rejected', tone: 'neg' },
  { key: 'ARCHIVED', label: 'Archived', tone: 'muted' },
]

export function statusMeta(status: DealStatus) {
  return DEAL_STATUS_META.find((s) => s.key === status) ?? DEAL_STATUS_META[0]
}
