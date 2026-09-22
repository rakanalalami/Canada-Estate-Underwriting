import { useMemo } from 'react'
import type { Deal } from '@/engine/types'
import { underwrite, type UnderwriteResult } from '@/engine/underwrite'
import { useStore } from '@/store/useStore'

/** Memoized underwriting for a deal. Recomputes only when inputs change. */
export function useUnderwriting(deal: Deal | null): UnderwriteResult | null {
  const profile = useStore((s) => s.profile)
  return useMemo(() => {
    if (!deal) return null
    try {
      return underwrite(deal, { profile })
    } catch (err) {
      console.error('Underwriting failed', err)
      return null
    }
  }, [deal, profile])
}
