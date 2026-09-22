import type { Deal } from '@/engine/types'
import type { UnderwriteResult } from '@/engine/underwrite'
import {
  Badge,
  Callout,
  Kpi,
  Panel,
  Progress,
  TableWrap,
  cx,
  toneText,
} from '@/components/ui/primitives'
import { MatrixLegend, Note, PassBadge, SectionGrid, cellTone } from '@/components/shared'
import { fmtCAD, fmtCADCompact, fmtMultiple, fmtNumber, fmtPct } from '@/engine/money'
import {
  breakEvenBand,
  capRateBand,
  cashFlowBand,
  cashOnCashBand,
  dscrBand,
  ltvBand,
  recycleBand,
} from '@/engine/metrics'
import { useStore } from '@/store/useStore'
import { ProjectionChart } from '@/components/charts/lazy'

export default function DashboardPage({ deal, r }: { deal: Deal; r: UnderwriteResult }) {
  const profile = useStore((s) => s.profile)
  const isCashRefi = deal.financing.structure === 'CASH_THEN_REFINANCE'
  const current = r.scenarios.CONSERVATIVE
  const stabilized = r.scenarios.STABILIZED
  const optimistic = r.scenarios.OPTIMISTIC

  // The headline operating figures follow the structure actually chosen.
  const debtMonthly = isCashRefi ? r.refinance.monthlyPayment : stabilized.debt.monthlyPayment
  const mortgage = isCashRefi ? r.refinance.mortgageAmount : stabilized.debt.mortgageAmount
  const monthlyCashFlow = isCashRefi
    ? r.refinance.monthlyCashFlow
    : stabilized.cashFlow.monthlyCashFlow
  const dscr = isCashRefi ? r.refinance.dscr : stabilized.cashFlow.dscr
  const coc = isCashRefi ? r.refinance.cashOnCash : stabilized.cashFlow.cashOnCash
  const cashInDeal = isCashRefi ? r.refinance.cashRemainingInvested : stabilized.cashRemainingInvested
  const equity = isCashRefi ? r.refinance.equityRemaining : r.price - mortgage
  const breakEven = stabilized.breakEven.breakEvenOccupancy

  const capB = capRateBand(stabilized.capRateOnOffer)

  return (
    <div className="space-y-5">
      {/* Red flags first — §28 says show them prominently. */}
      {r.dealBreakers.hits.length > 0 && (
        <Panel
          title={
            <span className="flex items-center gap-2">
              Deal breakers
              {r.dealBreakers.redCount > 0 && <Badge tone="neg">{r.dealBreakers.redCount} red</Badge>}
              {r.dealBreakers.amberCount > 0 && (
                <Badge tone="warn">{r.dealBreakers.amberCount} caution</Badge>
              )}
            </span>
          }
          subtitle="Your configured red flags, checked against this underwriting."
          actions={
            <a className="btn btn-xs" href="#/risk">
              Configure
            </a>
          }
        >
          <div className="grid gap-2 md:grid-cols-2">
            {r.dealBreakers.hits.map((h) => (
              <Callout key={h.key} tone={h.severity === 'RED' ? 'neg' : 'warn'} title={h.message} compact>
                {h.detail}
              </Callout>
            ))}
          </div>
        </Panel>
      )}

      {/* §29 headline block */}
      <SectionGrid cols={4}>
        <Kpi label="Purchase price" value={fmtCAD(r.price)} sub={r.price !== r.askingPrice ? `Asking ${fmtCAD(r.askingPrice)}` : 'At asking'} emphasis />
        <Kpi
          label="Total cash required"
          value={fmtCAD(r.acquisition.totalCashRequired - mortgage)}
          sub={isCashRefi ? 'Full cash on closing, before refinance' : `${fmtCAD(r.acquisition.totalCashRequired)} less mortgage`}
          trace={r.acquisition.steps}
          emphasis
        />
        <Kpi label="Units" value={fmtNumber(deal.units.length)} sub={`${r.legal.legalUnits} legal · ${deal.info.totalBedrooms || '—'} beds`} tone={r.legal.hasNonConformingWarning ? 'neg' : undefined} band={r.legal.hasNonConformingWarning ? 'Non-conforming' : undefined} />
        <Kpi label="Gross rent" value={`${fmtCAD(stabilized.noi.totalPotentialGrossIncome / 12)}/mo`} sub={`${fmtCAD(stabilized.noi.totalPotentialGrossIncome)}/yr stabilized`} />
      </SectionGrid>

      <SectionGrid cols={4}>
        <Kpi
          label="Net operating income"
          value={fmtCAD(stabilized.noi.noi)}
          sub={`${fmtCAD(stabilized.noi.noiPerUnit)}/unit · current ${fmtCAD(current.noi.noi)}`}
          trace={stabilized.noi.steps}
          emphasis
        />
        <Kpi
          label="Cap rate"
          value={fmtPct(stabilized.capRateOnOffer)}
          tone={capB.tone}
          band={capB.label}
          sub={`Current ${fmtPct(current.capRateOnOffer)}`}
          emphasis
        />
        <Kpi label="Mortgage" value={fmtCAD(mortgage)} sub={isCashRefi ? `After refinance at ${fmtPct(deal.refinance.ltv, 0)} LTV` : `${fmtPct(stabilized.debt.downPaymentPercent, 0)} down`} />
        <Kpi label="Monthly payment" value={fmtCAD(debtMonthly)} sub={`${fmtCAD(debtMonthly * 12)}/yr debt service`} />
      </SectionGrid>

      <SectionGrid cols={4}>
        <Kpi
          label="Monthly cash flow"
          value={fmtCAD(monthlyCashFlow)}
          tone={cashFlowBand(monthlyCashFlow).tone}
          band={cashFlowBand(monthlyCashFlow).label}
          sub={`${fmtCAD(monthlyCashFlow * 12)}/yr pre-tax`}
          emphasis
        />
        <Kpi
          label="Cash-on-cash"
          value={fmtPct(coc)}
          tone={cashOnCashBand(coc).tone}
          sub={`On ${fmtCAD(cashInDeal)} still invested`}
        />
        <Kpi
          label="DSCR"
          value={fmtMultiple(dscr)}
          tone={dscrBand(dscr).tone}
          band={dscrBand(dscr).label}
          sub={`Target ${profile.minDscr.toFixed(2)}x`}
          emphasis
        />
        <Kpi
          label="Break-even occupancy"
          value={fmtPct(breakEven)}
          tone={breakEvenBand(breakEven).tone}
          band={breakEvenBand(breakEven).label}
          sub="Unlevered — see Refinance for the levered figure"
        />
      </SectionGrid>

      <SectionGrid cols={4}>
        <Kpi
          label="Refinance proceeds"
          value={fmtCAD(r.refinance.netCashReleased)}
          sub={`Net of ${fmtCAD(r.refinance.refinanceCosts)} in costs`}
          trace={r.refinance.steps}
        />
        <Kpi
          label="Cash remaining in deal"
          value={fmtCAD(r.refinance.cashRemainingInvested)}
          sub={`${fmtPct(r.refinance.percentCapitalRecycled)} of capital recycled`}
          tone={recycleBand(r.refinance.capitalRecycleRatio).tone}
          band={recycleBand(r.refinance.capitalRecycleRatio).label}
        />
        <Kpi label="Equity" value={fmtCAD(equity)} sub={`${fmtPct(r.refinance.postRefinanceLtv)} LTV after refinance`} tone={ltvBand(r.refinance.postRefinanceLtv, profile.maxRefinanceLtv).tone} />
        <Kpi
          label="Capital freed for next deal"
          value={fmtCAD(Math.max(0, profile.startingCapital - (r.acquisition.totalCashRequired - r.refinance.netCashReleased) - profile.minimumCashReserve))}
          sub={`From ${fmtCAD(profile.startingCapital)} starting capital, holding ${fmtCAD(profile.minimumCashReserve)} reserve`}
        />
      </SectionGrid>

      {r.warnings.length > 0 && (
        <Panel title="What the model wants you to notice" subtitle="Generated from this deal's own inputs.">
          <div className="grid gap-2 md:grid-cols-2">
            {r.warnings.map((w, i) => (
              <Callout key={i} tone="warn" compact>
                {w}
              </Callout>
            ))}
          </div>
        </Panel>
      )}

      {/* §22 three scenarios */}
      <Panel
        title="Current vs stabilized vs optimistic"
        subtitle="Three scenarios, always. Optimistic is never the default view."
        actions={<a className="btn btn-xs" href="#/noi">Detail</a>}
        dense
      >
        <TableWrap>
          <thead className="border-b border-line bg-raised">
            <tr>
              <th className="th">Metric</th>
              <th className="th text-right">Conservative / current</th>
              <th className="th text-right">Stabilized / base</th>
              <th className="th text-right">Optimistic</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line/60">
            <ScenarioRow label="Gross scheduled income" values={[current.noi.totalPotentialGrossIncome, stabilized.noi.totalPotentialGrossIncome, optimistic.noi.totalPotentialGrossIncome]} />
            <ScenarioRow label="Vacancy allowance" values={[current.noi.vacancyPercent, stabilized.noi.vacancyPercent, optimistic.noi.vacancyPercent]} format="percent" />
            <ScenarioRow label="Effective gross income" values={[current.noi.effectiveGrossIncome, stabilized.noi.effectiveGrossIncome, optimistic.noi.effectiveGrossIncome]} />
            <ScenarioRow label="Operating expenses" values={[current.noi.operatingExpenses, stabilized.noi.operatingExpenses, optimistic.noi.operatingExpenses]} />
            <ScenarioRow label="Net operating income" values={[current.noi.noi, stabilized.noi.noi, optimistic.noi.noi]} strong />
            <ScenarioRow label="Cap rate on offer price" values={[current.capRateOnOffer, stabilized.capRateOnOffer, optimistic.capRateOnOffer]} format="percent" strong />
            <ScenarioRow label="Monthly cash flow after refinance" values={scenarioCashFlows(r)} strong />
          </tbody>
        </TableWrap>
        <div className="border-t border-line px-4 py-3">
          <Note>
            Conservative excludes non-conforming income and uses in-place rents with a higher vacancy.
            Stabilized lets vacant units at market but leaves sitting tenants on their contract rent.
            Optimistic is the only scenario that marks occupied units to market — it exists to size the
            upside, not to justify a price.
          </Note>
        </div>
      </Panel>

      <div className="grid gap-5 lg:grid-cols-2">
        {/* Refinance */}
        <Panel
          title="Refinance scenario"
          subtitle={`${fmtPct(deal.refinance.ltv, 0)} LTV on a ${fmtCAD(r.refinance.appraisedValue)} appraisal, ${deal.refinance.monthsUntilRefinance} months after closing`}
          actions={<a className="btn btn-xs" href="#/refinance">Detail</a>}
        >
          <div className="space-y-1">
            <Line label="Capital in property" value={fmtCAD(r.refinance.capitalInProperty)} />
            <Line label="Gross refinance proceeds" value={fmtCAD(r.refinance.grossProceeds)} />
            <Line label="Refinance costs" value={`(${fmtCAD(r.refinance.refinanceCosts)})`} tone="neg" />
            <Line label="Net cash released" value={fmtCAD(r.refinance.netCashReleased)} strong />
            <Line label="Cash remaining invested" value={fmtCAD(r.refinance.cashRemainingInvested)} strong />
            <Line label="Post-refinance DSCR" value={fmtMultiple(r.refinance.dscr)} tone={dscrBand(r.refinance.dscr).tone} />
            <Line label="Post-refinance cash flow" value={`${fmtCAD(r.refinance.monthlyCashFlow)}/mo`} tone={r.refinance.monthlyCashFlow < 0 ? 'neg' : 'pos'} />
          </div>
          <div className="mt-3">
            <Note>{r.refinance.valuationNote}</Note>
          </div>
        </Panel>

        {/* Offer analysis */}
        <Panel
          title="What should I pay?"
          subtitle="Price required to hit each target, fully re-underwritten at every level."
          actions={<a className="btn btn-xs" href="#/offer">Detail</a>}
          dense
        >
          <TableWrap>
            <thead className="border-b border-line bg-raised">
              <tr>
                <th className="th">Target</th>
                <th className="th text-right">Price</th>
                <th className="th text-right">vs asking</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line/60">
              {r.targetPrices.slice(0, 7).map((t) => (
                <tr key={t.key} className="row-hover">
                  <td className="td">{t.label}</td>
                  <td className="td-num">{t.price ? fmtCAD(t.price) : '—'}</td>
                  <td className="td-num">
                    {t.notBinding ? (
                      <span className="text-2xs text-pos">Not binding</span>
                    ) : t.discountFromAsking !== null ? (
                      <span className={t.discountFromAsking > 0 ? 'text-warn' : 'text-pos'}>
                        {t.discountFromAsking > 0 ? '−' : '+'}
                        {fmtPct(Math.abs(t.discountFromAsking), 1)}
                      </span>
                    ) : (
                      '—'
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </TableWrap>
        </Panel>
      </div>

      {/* §18 projection */}
      <Panel
        title="5-year projection"
        subtitle="Operating performance and balance sheet, kept separate."
        actions={<a className="btn btn-xs" href="#/projection">Detail</a>}
      >
        <ProjectionChart years={r.projection.years} />
      </Panel>

      <div className="grid gap-5 lg:grid-cols-2">
        {/* §19 sensitivity preview */}
        <Panel
          title="Sensitivity — rate vs rent"
          subtitle="Monthly cash flow at each combination."
          actions={<a className="btn btn-xs" href="#/sensitivity">All matrices</a>}
          dense
        >
          <TableWrap>
            <thead className="border-b border-line bg-raised">
              <tr>
                <th className="th">Rate \ Rent</th>
                {r.sensitivity[0].colValues.map((c) => (
                  <th key={c} className="th text-right">
                    {c === 0 ? 'Base' : `${c > 0 ? '+' : ''}${(c * 100).toFixed(0)}%`}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-line/60">
              {r.sensitivity[0].cells.map((row, i) => (
                <tr key={i}>
                  <td className="td-num font-medium">{fmtPct(r.sensitivity[0].rowValues[i], 2)}</td>
                  {row.map((cell, j) => (
                    <td key={j} className={cx('td-num', cellTone(cell.flags))}>
                      {fmtCADCompact(cell.monthlyCashFlow)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </TableWrap>
          <div className="border-t border-line px-4 py-3">
            <MatrixLegend minDscr={profile.minDscr} />
          </div>
        </Panel>

        {/* §23 requirements */}
        <Panel
          title="Your requirements"
          subtitle={r.scorecard.summary}
          actions={<a className="btn btn-xs" href="#/risk">Scorecard</a>}
          dense
        >
          <TableWrap>
            <thead className="border-b border-line bg-raised">
              <tr>
                <th className="th">Requirement</th>
                <th className="th text-right">Target</th>
                <th className="th text-right">Actual</th>
                <th className="th text-right">Result</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line/60">
              {r.scorecard.requirements.map((req) => (
                <tr key={req.key} className="row-hover">
                  <td className="td">{req.label}</td>
                  <td className="td-num text-muted">{req.requirement}</td>
                  <td className="td-num">{req.actual}</td>
                  <td className="td text-right">
                    <PassBadge result={req.result} />
                  </td>
                </tr>
              ))}
            </tbody>
          </TableWrap>
        </Panel>
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <Panel title="CapEx risk" subtitle={`${r.capex.riskLevel} · ${fmtCAD(r.capex.totalTenYear)} identified over 10 years`} actions={<a className="btn btn-xs" href="#/risk">Detail</a>}>
          <div className="mb-3">
            <Progress
              value={r.capex.score / 100}
              tone={r.capex.riskLevel === 'LOW' ? 'pos' : r.capex.riskLevel === 'MODERATE' ? 'warn' : 'neg'}
            />
          </div>
          <div className="space-y-1">
            <Line label="Within 1 year" value={fmtCAD(r.capex.withinOneYear)} tone={r.capex.withinOneYear > 0 ? 'warn' : undefined} />
            <Line label="Within 3 years" value={fmtCAD(r.capex.withinThreeYears)} />
            <Line label="Within 5 years" value={fmtCAD(r.capex.withinFiveYears)} />
            <Line label="Implied annual reserve" value={fmtCAD(r.capex.impliedAnnualReserve)} />
            <Line label="Modelled CapEx reserve" value={fmtCAD(stabilized.noi.expenses.capexReserveAnnual)} tone={stabilized.noi.expenses.capexReserveAnnual < r.capex.impliedAnnualReserve ? 'warn' : 'pos'} />
          </div>
        </Panel>

        <Panel title="Rent roll" subtitle={`${r.rentRoll.occupiedCount} occupied · ${r.rentRoll.vacantCount} vacant`} actions={<a className="btn btn-xs" href="#/rent-roll">Detail</a>}>
          <div className="space-y-1">
            <Line label="Current monthly rent" value={fmtCAD(r.rentRoll.currentMonthlyResidentialRent)} />
            <Line label="Market monthly rent" value={fmtCAD(r.rentRoll.marketMonthlyResidentialRent)} />
            <Line label="Monthly upside" value={fmtCAD(r.rentRoll.monthlyRentUpside)} tone={r.rentRoll.monthlyRentUpside > 0 ? 'info' : undefined} />
            <Line label="Below-market units" value={fmtNumber(r.rentRoll.belowMarketUnits.length)} tone={r.rentRoll.belowMarketUnits.length ? 'warn' : 'pos'} />
            <Line label="Average rent per unit" value={fmtCAD(r.rentRoll.averageRentPerUnit)} />
          </div>
        </Panel>

        <Panel title="Comparables" subtitle={`${r.rentComps.count} rent · ${r.saleComps.count} sales`} actions={<a className="btn btn-xs" href="#/comparables">Detail</a>}>
          {r.rentComps.count === 0 && r.saleComps.count === 0 ? (
            <Note>
              No comparables entered. Without them, the market rents and the stabilized scenario rest
              entirely on your own estimates.
            </Note>
          ) : (
            <div className="space-y-1">
              <Line label="Median comparable rent" value={fmtCAD(r.rentComps.medianRent)} />
              <Line label="Suggested conservative" value={fmtCAD(r.rentComps.conservativeRent)} />
              <Line label="Suggested optimistic" value={fmtCAD(r.rentComps.optimisticRent)} />
              <Line label="Subject price per unit" value={fmtCAD(r.subjectVsComps.subjectPricePerUnit)} />
              <Line label="Comp average per unit" value={fmtCAD(r.saleComps.averagePricePerUnit)} />
            </div>
          )}
        </Panel>
      </div>
    </div>
  )
}

function scenarioCashFlows(r: UnderwriteResult): number[] {
  return (['CONSERVATIVE', 'STABILIZED', 'OPTIMISTIC'] as const).map((k) => {
    const noi = r.scenarios[k].noi.noi
    return (noi - r.refinance.annualDebtService) / 12
  })
}

function ScenarioRow({
  label,
  values,
  format = 'currency',
  strong,
}: {
  label: string
  values: (number | null)[]
  format?: 'currency' | 'percent'
  strong?: boolean
}) {
  return (
    <tr className={cx('row-hover', strong && 'font-semibold')}>
      <td className="td">{label}</td>
      {values.map((v, i) => (
        <td key={i} className="td-num">
          {format === 'percent' ? fmtPct(v) : fmtCAD(v)}
        </td>
      ))}
    </tr>
  )
}

function Line({
  label,
  value,
  tone,
  strong,
}: {
  label: string
  value: string
  tone?: 'pos' | 'warn' | 'neg' | 'info' | 'muted'
  strong?: boolean
}) {
  return (
    <div className={cx('flex items-baseline justify-between gap-3 border-b border-line/50 py-1.5 last:border-0', strong && 'font-semibold')}>
      <span className="text-xs text-muted">{label}</span>
      <span className={cx('num text-sm', tone && toneText[tone])}>{value}</span>
    </div>
  )
}
