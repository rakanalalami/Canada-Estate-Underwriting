import { Fragment, useMemo } from 'react'
import { useStore } from '@/store/useStore'
import { underwrite } from '@/engine/underwrite'
import { statusMeta } from '@/components/statusMeta'
import { Badge, EmptyState, Panel, TableWrap, cx } from '@/components/ui/primitives'
import { Note } from '@/components/shared'
import { fmtCAD, fmtMultiple, fmtPct } from '@/engine/money'
import { capRateBand, dscrBand } from '@/engine/metrics'

export default function ComparePage() {
  const deals = useStore((s) => s.deals)
  const compareIds = useStore((s) => s.compareIds)
  const clearCompare = useStore((s) => s.clearCompare)
  const toggleCompare = useStore((s) => s.toggleCompare)
  const setActive = useStore((s) => s.setActiveDeal)
  const profile = useStore((s) => s.profile)

  const selected = useMemo(
    () =>
      compareIds
        .map((id) => deals.find((d) => d.id === id))
        .filter((d): d is NonNullable<typeof d> => Boolean(d))
        .map((d) => {
          const r = underwrite(d, { profile })
          const isCashRefi = d.financing.structure === 'CASH_THEN_REFINANCE'
          return {
            deal: d,
            r,
            cashFlow: isCashRefi ? r.refinance.monthlyCashFlow : r.scenarios.STABILIZED.cashFlow.monthlyCashFlow,
            dscr: isCashRefi ? r.refinance.dscr : r.scenarios.STABILIZED.cashFlow.dscr,
            coc: isCashRefi ? r.refinance.cashOnCash : r.scenarios.STABILIZED.cashFlow.cashOnCash,
          }
        }),
    [compareIds, deals, profile],
  )

  if (selected.length === 0) {
    return (
      <EmptyState title="No deals selected" action={<a className="btn-primary" href="#/deals">Choose deals</a>}>
        Tick deals on the All deals page to line them up side by side.
      </EmptyState>
    )
  }

  const rows: {
    label: string
    get: (x: (typeof selected)[number]) => string
    best?: (x: (typeof selected)[number]) => number
    higherIsBetter?: boolean
    group?: string
  }[] = [
    { label: 'Status', get: (x) => statusMeta(x.deal.status).label, group: 'Overview' },
    { label: 'Neighbourhood', get: (x) => x.deal.info.neighbourhood || '—' },
    { label: 'Property type', get: (x) => x.deal.info.propertyType.replace(/_/g, ' ').toLowerCase() },
    { label: 'Year built', get: (x) => String(x.deal.info.yearBuilt ?? '—') },
    { label: 'Units', get: (x) => String(x.deal.units.length), best: (x) => x.deal.units.length, higherIsBetter: true },

    { label: 'Asking price', get: (x) => fmtCAD(x.r.askingPrice), group: 'Price' },
    { label: 'Offer price', get: (x) => fmtCAD(x.r.price), best: (x) => x.r.price, higherIsBetter: false },
    { label: 'Price per unit', get: (x) => fmtCAD(x.deal.units.length ? x.r.price / x.deal.units.length : null), best: (x) => (x.deal.units.length ? x.r.price / x.deal.units.length : Infinity), higherIsBetter: false },
    { label: 'Total cash required', get: (x) => fmtCAD(x.r.acquisition.totalCashRequired), best: (x) => x.r.acquisition.totalCashRequired, higherIsBetter: false },

    { label: 'Current gross rent (monthly)', get: (x) => fmtCAD(x.r.rentRoll.currentMonthlyGSI), group: 'Income' },
    { label: 'Stabilized gross rent (monthly)', get: (x) => fmtCAD(x.r.rentRoll.stabilizedMonthlyGSI), best: (x) => x.r.rentRoll.stabilizedMonthlyGSI, higherIsBetter: true },
    { label: 'Rent upside (monthly)', get: (x) => fmtCAD(x.r.rentRoll.monthlyRentUpside) },
    { label: 'Operating expense ratio', get: (x) => fmtPct(x.r.scenarios.STABILIZED.noi.expenseRatio), best: (x) => x.r.scenarios.STABILIZED.noi.expenseRatio ?? 1, higherIsBetter: false },

    { label: 'Current NOI', get: (x) => fmtCAD(x.r.scenarios.CONSERVATIVE.noi.noi), group: 'Returns' },
    { label: 'Stabilized NOI', get: (x) => fmtCAD(x.r.scenarios.STABILIZED.noi.noi), best: (x) => x.r.scenarios.STABILIZED.noi.noi, higherIsBetter: true },
    { label: 'Cap rate (current)', get: (x) => fmtPct(x.r.scenarios.CONSERVATIVE.capRateOnOffer) },
    { label: 'Cap rate (stabilized)', get: (x) => fmtPct(x.r.scenarios.STABILIZED.capRateOnOffer), best: (x) => x.r.scenarios.STABILIZED.capRateOnOffer ?? 0, higherIsBetter: true },
    { label: 'Monthly cash flow', get: (x) => fmtCAD(x.cashFlow), best: (x) => x.cashFlow, higherIsBetter: true },
    { label: 'DSCR', get: (x) => fmtMultiple(x.dscr), best: (x) => x.dscr ?? 0, higherIsBetter: true },
    { label: 'Cash-on-cash', get: (x) => fmtPct(x.coc), best: (x) => x.coc ?? 0, higherIsBetter: true },
    { label: 'Break-even occupancy', get: (x) => fmtPct(x.r.scenarios.STABILIZED.breakEven.breakEvenOccupancy), best: (x) => x.r.scenarios.STABILIZED.breakEven.breakEvenOccupancy ?? 1, higherIsBetter: false },

    { label: 'Refinance proceeds', get: (x) => fmtCAD(x.r.refinance.netCashReleased), best: (x) => x.r.refinance.netCashReleased, higherIsBetter: true, group: 'Refinance' },
    { label: 'Cash trapped', get: (x) => fmtCAD(x.r.refinance.cashRemainingInvested), best: (x) => x.r.refinance.cashRemainingInvested, higherIsBetter: false },
    { label: 'Capital recycled', get: (x) => fmtPct(x.r.refinance.percentCapitalRecycled), best: (x) => x.r.refinance.percentCapitalRecycled ?? 0, higherIsBetter: true },
    { label: 'Post-refinance DSCR', get: (x) => fmtMultiple(x.r.refinance.dscr), best: (x) => x.r.refinance.dscr ?? 0, higherIsBetter: true },

    { label: 'CapEx risk', get: (x) => x.r.capex.riskLevel, group: 'Risk' },
    { label: 'Identified capital (10 yr)', get: (x) => fmtCAD(x.r.capex.totalTenYear), best: (x) => x.r.capex.totalTenYear, higherIsBetter: false },
    { label: 'Legal risk', get: (x) => x.r.legal.riskLevel },
    { label: 'Non-conforming units', get: (x) => String(x.r.legal.nonConformingUnits), best: (x) => x.r.legal.nonConformingUnits, higherIsBetter: false },
    { label: 'Red flags', get: (x) => String(x.r.dealBreakers.redCount), best: (x) => x.r.dealBreakers.redCount, higherIsBetter: false },
    { label: 'Requirements met', get: (x) => `${x.r.scorecard.passCount} / ${x.r.scorecard.requirements.length}`, best: (x) => x.r.scorecard.passCount, higherIsBetter: true },
  ]

  const bestIndex = (row: (typeof rows)[number]): number | null => {
    if (!row.best) return null
    const values = selected.map(row.best)
    if (values.every((v) => !Number.isFinite(v))) return null
    const target = row.higherIsBetter ? Math.max(...values) : Math.min(...values)
    const i = values.indexOf(target)
    // Only highlight when there is a genuine difference.
    return values.every((v) => v === target) ? null : i
  }

  return (
    <div className="space-y-5">
      <Panel
        title={`Comparing ${selected.length} ${selected.length === 1 ? 'deal' : 'deals'}`}
        subtitle="The stronger figure in each row is highlighted, one row at a time — there is no combined winner."
        actions={
          <div className="flex gap-2">
            <a className="btn btn-xs" href="#/deals">Change selection</a>
            <button className="btn btn-xs" onClick={clearCompare}>Clear</button>
          </div>
        }
        dense
      >
        <TableWrap>
          <thead className="border-b border-line bg-raised">
            <tr>
              <th className="th sticky left-0 z-10 bg-raised">Metric</th>
              {selected.map((x) => (
                <th key={x.deal.id} className="th text-right">
                  <a
                    className="hover:text-accent hover:underline"
                    href="#/dashboard"
                    onClick={() => setActive(x.deal.id)}
                  >
                    {x.deal.name || 'Untitled'}
                  </a>
                  <button
                    className="ml-2 text-neg"
                    onClick={() => toggleCompare(x.deal.id)}
                    title="Remove from comparison"
                  >
                    ×
                  </button>
                  <div className="mt-1 font-normal">
                    <Badge tone={capRateBand(x.r.scenarios.STABILIZED.capRateOnOffer).tone}>
                      {fmtPct(x.r.scenarios.STABILIZED.capRateOnOffer)} cap
                    </Badge>
                    <Badge tone={dscrBand(x.dscr).tone}>{fmtMultiple(x.dscr)}</Badge>
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-line/60">
            {rows.map((row) => {
              const best = bestIndex(row)
              return (
                <Fragment key={row.label}>
                  {row.group && (
                    <tr className="bg-raised">
                      <td className="td sticky left-0 bg-raised text-2xs font-semibold uppercase tracking-wider text-muted" colSpan={selected.length + 1}>
                        {row.group}
                      </td>
                    </tr>
                  )}
                  <tr className="row-hover">
                    <td className="td sticky left-0 z-10 bg-surface text-muted">{row.label}</td>
                    {selected.map((x, j) => (
                      <td
                        key={x.deal.id}
                        className={cx('td-num', best === j && 'bg-pos/10 font-semibold text-pos')}
                      >
                        {row.get(x)}
                      </td>
                    ))}
                  </tr>
                </Fragment>
              )
            })}
          </tbody>
        </TableWrap>
        <div className="border-t border-line px-4 py-3">
          <Note>
            Highlighting marks the stronger number in a single row. It does not aggregate into a
            verdict: a deal that wins on cap rate and loses on CapEx risk and legal status is not
            "ahead" — those are different kinds of problem, and only you can price them against each
            other. Your minimum thresholds are {fmtPct(profile.minCapRate, 2)} cap and{' '}
            {profile.minDscr.toFixed(2)}x DSCR.
          </Note>
        </div>
      </Panel>
    </div>
  )
}
