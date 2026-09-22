import type { SimEvent } from '@/engine/simulator'
import { fmtCAD } from '@/engine/money'
import { cx } from '@/components/ui/primitives'

const EVENT_STYLE: Record<
  SimEvent['type'],
  { dot: string; label: string; ring: string }
> = {
  START: { dot: 'bg-accent', label: 'Start', ring: 'ring-accent/25' },
  ACQUIRE: { dot: 'bg-info', label: 'Acquire', ring: 'ring-info/25' },
  STABILIZE: { dot: 'bg-pos', label: 'Stabilize', ring: 'ring-pos/25' },
  REFINANCE: { dot: 'bg-warn', label: 'Refinance', ring: 'ring-warn/25' },
  CAPEX: { dot: 'bg-neg', label: 'CapEx', ring: 'ring-neg/25' },
  BLOCKED: { dot: 'bg-neg', label: 'Blocked', ring: 'ring-neg/25' },
  RESERVE_BREACH: { dot: 'bg-neg', label: 'Reserve breach', ring: 'ring-neg/25' },
}

/**
 * The §40.17 timeline: a vertical chronology of every capital event with the
 * running balances at each step, so the movement of the starting capital
 * through the portfolio is readable at a glance.
 */
export function CapitalTimeline({ events }: { events: SimEvent[] }) {
  if (events.length === 0) return null

  return (
    <ol className="relative space-y-0">
      <span className="absolute left-[7px] top-2 bottom-2 w-px bg-line" aria-hidden />
      {events.map((e, i) => {
        const style = EVENT_STYLE[e.type]
        return (
          <li key={i} className="relative flex gap-4 pb-5 last:pb-0">
            <span
              className={cx('relative z-10 mt-1.5 h-[15px] w-[15px] shrink-0 rounded-full ring-4', style.dot, style.ring)}
              aria-hidden
            />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <div>
                  <span className="mono text-2xs text-subtle">Month {e.month}</span>
                  <span className="ml-2 text-sm font-semibold">{e.label}</span>
                </div>
                {e.cashDelta !== 0 && (
                  <span className={cx('num text-sm font-semibold', e.cashDelta > 0 ? 'text-pos' : 'text-neg')}>
                    {e.cashDelta > 0 ? '+' : ''}
                    {fmtCAD(e.cashDelta)}
                  </span>
                )}
              </div>
              <p className="mt-0.5 text-xs leading-relaxed text-muted">{e.detail}</p>
              <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 sm:grid-cols-5">
                <Stat label="Cash" value={fmtCAD(e.cashBalance)} />
                <Stat label="Value" value={fmtCAD(e.portfolioValue)} />
                <Stat label="Debt" value={fmtCAD(e.portfolioDebt)} />
                <Stat label="Equity" value={fmtCAD(e.portfolioEquity)} />
                <Stat label="Cash flow" value={`${fmtCAD(e.monthlyCashFlow)}/mo`} />
              </div>
            </div>
          </li>
        )
      })}
    </ol>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-2xs uppercase tracking-wider text-subtle">{label}</div>
      <div className="num text-xs font-medium">{value}</div>
    </div>
  )
}
