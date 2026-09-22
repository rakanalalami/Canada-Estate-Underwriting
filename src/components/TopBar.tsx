import { useState } from 'react'
import { useActiveDeal, useStore } from '@/store/useStore'
import { useUnderwriting } from '@/lib/useUnderwriting'
import { fmtCAD, fmtMultiple, fmtPct } from '@/engine/money'
import { capRateBand, dscrBand } from '@/engine/metrics'
import { Badge, cx, toneText } from '@/components/ui/primitives'
import { ExportMenu } from '@/components/ExportMenu'

export function TopBar({ onToggleNav, route }: { onToggleNav: () => void; route: string }) {
  const theme = useStore((s) => s.theme)
  const setTheme = useStore((s) => s.setTheme)
  const deal = useActiveDeal()
  const r = useUnderwriting(deal)
  const [exportOpen, setExportOpen] = useState(false)

  const stabilized = r?.scenarios.STABILIZED
  const cap = stabilized?.capRateOnOffer ?? null
  const capB = capRateBand(cap)
  const refiDscr = r?.refinance.dscr ?? null
  const dscrB = dscrBand(refiDscr)
  const monthlyCf =
    deal?.financing.structure === 'CASH_THEN_REFINANCE'
      ? (r?.refinance.monthlyCashFlow ?? 0)
      : (stabilized?.cashFlow.monthlyCashFlow ?? 0)

  return (
    <header className="no-print fixed inset-x-0 top-0 z-40 flex h-14 items-center gap-3 border-b border-line bg-surface/95 px-4 backdrop-blur sm:px-6">
      <button
        onClick={onToggleNav}
        aria-label="Toggle navigation"
        className="btn-ghost -ml-1 h-8 w-8 p-0 lg:hidden"
      >
        <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
          <path d="M3 5.5h14M3 10h14M3 14.5h14" strokeLinecap="round" />
        </svg>
      </button>

      <a href="#/dashboard" className="flex items-center gap-2.5">
        <svg viewBox="0 0 32 32" className="h-7 w-7 shrink-0">
          <rect width="32" height="32" rx="7" className="fill-accent" />
          <path d="M7 22V13l9-5 9 5v9" stroke="white" strokeWidth="2" fill="none" strokeLinejoin="round" />
          <path d="M11 22v-5h4v5M19 22v-7h3" stroke="white" strokeWidth="2" fill="none" />
        </svg>
        <span className="hidden leading-tight sm:block">
          <span className="block text-sm font-semibold tracking-tight">Ottawa Underwriting</span>
          <span className="block text-2xs text-subtle">Small multifamily · CAD</span>
        </span>
      </a>

      {/* Live headline metrics travel with you across every page. */}
      {r && deal && r.hasMeaningfulData && (
        <div className="ml-4 hidden items-center gap-5 border-l border-line pl-5 xl:flex">
          <Metric label="Price" value={fmtCAD(r.price)} />
          <Metric label="NOI" value={fmtCAD(stabilized!.noi.noi)} />
          <Metric label="Cap" value={fmtPct(cap)} tone={capB.tone} />
          <Metric label="Cash flow" value={`${fmtCAD(monthlyCf)}/mo`} tone={monthlyCf < 0 ? 'neg' : 'pos'} />
          <Metric label="DSCR" value={fmtMultiple(refiDscr)} tone={dscrB.tone} />
        </div>
      )}

      {/* An empty deal has no headline figures worth showing. */}
      {r && deal && !r.hasMeaningfulData && (
        <div className="ml-4 hidden items-center border-l border-line pl-5 xl:flex">
          <a href="#/property" className="text-xs text-muted transition-colors hover:text-accent">
            No price or rent entered yet — open the property form
          </a>
        </div>
      )}

      <div className="ml-auto flex items-center gap-2">
        {r && deal && r.dealBreakers.redCount > 0 && (
          <a href="#/risk" className="hidden sm:block">
            <Badge tone="neg">
              {r.dealBreakers.redCount} red flag{r.dealBreakers.redCount === 1 ? '' : 's'}
            </Badge>
          </a>
        )}

        {deal && (
          <div className="relative">
            <button className="btn btn-xs" onClick={() => setExportOpen((o) => !o)}>
              Export
            </button>
            {exportOpen && (
              <ExportMenu deal={deal} result={r} route={route} onClose={() => setExportOpen(false)} />
            )}
          </div>
        )}

        <button
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          aria-label="Toggle colour theme"
          className="btn-ghost h-8 w-8 p-0"
        >
          {theme === 'dark' ? (
            <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.6">
              <circle cx="10" cy="10" r="3.5" />
              <path d="M10 2v2M10 16v2M2 10h2M16 10h2M4.5 4.5l1.4 1.4M14.1 14.1l1.4 1.4M15.5 4.5l-1.4 1.4M5.9 14.1l-1.4 1.4" strokeLinecap="round" />
            </svg>
          ) : (
            <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.6">
              <path d="M16 12.3A7 7 0 017.7 4a7 7 0 108.3 8.3z" strokeLinejoin="round" />
            </svg>
          )}
        </button>
      </div>
    </header>
  )
}

function Metric({ label, value, tone }: { label: string; value: string; tone?: 'pos' | 'warn' | 'neg' | 'info' | 'muted' }) {
  return (
    <div className="leading-tight">
      <div className="text-2xs uppercase tracking-wider text-subtle">{label}</div>
      <div className={cx('num text-sm font-semibold', tone ? toneText[tone] : 'text-ink')}>{value}</div>
    </div>
  )
}
