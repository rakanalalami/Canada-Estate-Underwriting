import type { ReactNode } from 'react'
import type { Tone } from '@/engine/metrics'
import { Badge, Callout, cx, toneText } from '@/components/ui/primitives'
import { fmtCAD, fmtPct } from '@/engine/money'

export function WarningList({ warnings, tone = 'warn' }: { warnings: string[]; tone?: Tone }) {
  if (warnings.length === 0) return null
  return (
    <div className="space-y-2">
      {warnings.map((w, i) => (
        <Callout key={i} tone={tone} compact>
          {w}
        </Callout>
      ))}
    </div>
  )
}

/** Small label + value pair used across dense panels. */
export function Metric({
  label,
  value,
  tone,
  sub,
  align = 'left',
}: {
  label: ReactNode
  value: ReactNode
  tone?: Tone
  sub?: ReactNode
  align?: 'left' | 'right'
}) {
  return (
    <div className={align === 'right' ? 'text-right' : ''}>
      <div className="text-2xs uppercase tracking-wider text-subtle">{label}</div>
      <div className={cx('num text-base font-semibold', tone ? toneText[tone] : 'text-ink')}>{value}</div>
      {sub && <div className="mt-0.5 text-2xs text-muted">{sub}</div>}
    </div>
  )
}

export function DeltaValue({
  value,
  format = 'currency',
  invert = false,
}: {
  value: number | null
  format?: 'currency' | 'percent'
  invert?: boolean
}) {
  if (value === null || !Number.isFinite(value)) return <span className="text-subtle">—</span>
  const positive = invert ? value < 0 : value > 0
  const neutral = Math.abs(value) < 0.005
  return (
    <span className={cx('num', neutral ? 'text-muted' : positive ? 'text-pos' : 'text-neg')}>
      {value > 0 ? '+' : ''}
      {format === 'percent' ? fmtPct(value) : fmtCAD(value)}
    </span>
  )
}

/** Explains why a number is what it is, right where it is shown. */
export function Note({ children }: { children: ReactNode }) {
  return <p className="text-2xs leading-relaxed text-subtle">{children}</p>
}

export function SectionGrid({ children, cols = 4 }: { children: ReactNode; cols?: 2 | 3 | 4 | 5 | 6 }) {
  const map: Record<number, string> = {
    2: 'sm:grid-cols-2',
    3: 'sm:grid-cols-2 lg:grid-cols-3',
    4: 'sm:grid-cols-2 lg:grid-cols-4',
    5: 'sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5',
    6: 'sm:grid-cols-3 lg:grid-cols-6',
  }
  return <div className={cx('grid gap-3', map[cols])}>{children}</div>
}

export function PassBadge({ result }: { result: 'PASS' | 'INVESTIGATE' | 'FAIL' }) {
  const tone: Tone = result === 'PASS' ? 'pos' : result === 'INVESTIGATE' ? 'warn' : 'neg'
  return <Badge tone={tone}>{result}</Badge>
}

/** Heat colouring for sensitivity cells. */
export function cellTone(opts: {
  negativeCashFlow: boolean
  belowDscrTarget: boolean
  aboveTwoThousand: boolean
  aboveThousand: boolean
}): string {
  if (opts.negativeCashFlow) return 'bg-neg/15 text-neg'
  if (opts.belowDscrTarget) return 'bg-warn/15 text-warn'
  if (opts.aboveTwoThousand) return 'bg-pos/20 text-pos'
  if (opts.aboveThousand) return 'bg-pos/10 text-pos'
  return ''
}

export function MatrixLegend({ minDscr }: { minDscr: number }) {
  return (
    <div className="flex flex-wrap items-center gap-3 text-2xs text-muted">
      <LegendSwatch className="bg-neg/25" label="Cash-flow negative" />
      <LegendSwatch className="bg-warn/25" label={`DSCR below ${minDscr.toFixed(2)}x`} />
      <LegendSwatch className="bg-pos/15" label="C$1,000+/month" />
      <LegendSwatch className="bg-pos/30" label="C$2,000+/month" />
    </div>
  )
}

function LegendSwatch({ className, label }: { className: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={cx('inline-block h-3 w-3 rounded-sm border border-line', className)} />
      {label}
    </span>
  )
}
