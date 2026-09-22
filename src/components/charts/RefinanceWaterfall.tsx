import type { RefinanceResult } from '@/engine/refinance'
import { fmtCAD } from '@/engine/money'
import { cx } from '@/components/ui/primitives'

/**
 * A literal waterfall: capital in, proceeds out, what stays trapped. Drawn with
 * divs rather than a chart library so the bars stay legible at any width and
 * print cleanly.
 */
export function RefinanceWaterfall({ refi }: { refi: RefinanceResult }) {
  const scale = Math.max(refi.capitalInProperty, refi.grossProceeds, 1)
  const pct = (v: number) => `${Math.max(0, Math.min(100, (v / scale) * 100))}%`

  const rows = [
    { label: 'Capital in property', value: refi.capitalInProperty, cls: 'bg-accent', note: 'Price + closing + renovation' },
    { label: 'Gross refinance proceeds', value: refi.grossProceeds, cls: 'bg-info', note: `${(refi.ltv * 100).toFixed(0)}% of ${fmtCAD(refi.appraisedValue)}` },
    { label: 'Less refinance costs', value: refi.refinanceCosts, cls: 'bg-neg', note: 'Fees, legal, appraisal, lender' },
    { label: 'Less existing debt', value: refi.existingDebtPayoff, cls: 'bg-neg', note: 'Zero on a cash purchase' },
    { label: 'Net cash released', value: refi.netCashReleased, cls: 'bg-pos', note: 'Available for the next acquisition', strong: true },
    { label: 'Cash remaining invested', value: Math.max(0, refi.cashRemainingInvested), cls: 'bg-warn', note: 'Trapped in this property', strong: true },
  ]

  return (
    <div className="space-y-2.5">
      {rows.map((r) => (
        <div key={r.label}>
          <div className="mb-1 flex items-baseline justify-between gap-3">
            <span className={cx('text-xs', r.strong ? 'font-semibold text-ink' : 'text-muted')}>{r.label}</span>
            <span className={cx('num text-sm', r.strong && 'font-semibold')}>{fmtCAD(r.value)}</span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-line/70">
            <div className={cx('h-full rounded-full transition-all', r.cls)} style={{ width: pct(r.value) }} />
          </div>
          <div className="mt-0.5 text-2xs text-subtle">{r.note}</div>
        </div>
      ))}
    </div>
  )
}
