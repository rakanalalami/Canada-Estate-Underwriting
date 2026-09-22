import type { AppraisalCase, Deal, ValuationMethod } from '@/engine/types'
import type { UnderwriteResult } from '@/engine/underwrite'
import { useDealEdit } from '@/lib/dealEdit'
import { useStore } from '@/store/useStore'
import {
  Badge,
  Callout,
  Kpi,
  MoneyInput,
  NumberInput,
  Panel,
  PercentInput,
  Segmented,
  Select,
  TableWrap,
  TraceTable,
  cx,
} from '@/components/ui/primitives'
import { Note, SectionGrid } from '@/components/shared'
import { fmtCAD, fmtMultiple, fmtPct } from '@/engine/money'
import { dscrBand, recycleBand } from '@/engine/metrics'
import { RefinanceWaterfall } from '@/components/charts/RefinanceWaterfall'
import { LtvTradeoffChart } from '@/components/charts/lazy'

const APPRAISAL_CASES: { value: AppraisalCase; label: string }[] = [
  { value: 'LOW', label: 'Low' },
  { value: 'BASE', label: 'Base' },
  { value: 'HIGH', label: 'High' },
]

const VALUATION_METHODS: { value: ValuationMethod; label: string }[] = [
  { value: 'COMPARABLE_SALES', label: 'Comparable residential sales' },
  { value: 'INCOME_CAP_RATE', label: 'Income capitalisation (NOI ÷ cap rate)' },
  { value: 'MANUAL', label: 'Manual appraised value' },
]

export default function RefinancePage({ deal, r }: { deal: Deal; r: UnderwriteResult }) {
  const edit = useDealEdit(deal.id)
  const profile = useStore((s) => s.profile)
  const refi = r.refinance
  const isSmallResidential = deal.units.length <= 4

  return (
    <div className="space-y-5">
      <SectionGrid cols={4}>
        <Kpi label="Refinance mortgage" value={fmtCAD(refi.mortgageAmount)} sub={`${fmtPct(refi.ltv, 0)} of ${fmtCAD(refi.appraisedValue)}`} trace={refi.steps} emphasis />
        <Kpi label="Net cash released" value={fmtCAD(refi.netCashReleased)} sub={`After ${fmtCAD(refi.refinanceCosts)} of costs`} emphasis />
        <Kpi
          label="Cash remaining invested"
          value={fmtCAD(refi.cashRemainingInvested)}
          sub={`${fmtPct(refi.percentCapitalRecycled)} of capital recycled`}
          tone={recycleBand(refi.capitalRecycleRatio).tone}
          band={recycleBand(refi.capitalRecycleRatio).label}
        />
        <Kpi label="Equity remaining" value={fmtCAD(refi.equityRemaining)} sub={`${fmtPct(refi.postRefinanceLtv)} post-refinance LTV`} />
      </SectionGrid>

      <SectionGrid cols={4}>
        <Kpi label="Monthly payment" value={fmtCAD(refi.monthlyPayment)} sub={`${fmtCAD(refi.annualDebtService)}/yr debt service`} />
        <Kpi label="Post-refinance cash flow" value={`${fmtCAD(refi.monthlyCashFlow)}/mo`} tone={refi.monthlyCashFlow < 0 ? 'neg' : 'pos'} sub={`${fmtCAD(refi.annualCashFlow)}/yr`} />
        <Kpi label="DSCR" value={fmtMultiple(refi.dscr)} tone={dscrBand(refi.dscr).tone} band={dscrBand(refi.dscr).label} sub={`Target ${profile.minDscr.toFixed(2)}x`} />
        <Kpi label="Cash-on-cash after refinance" value={fmtPct(refi.cashOnCash)} sub={`On ${fmtCAD(refi.cashRemainingInvested)} still invested`} />
      </SectionGrid>

      {refi.dscr !== null && refi.dscr < profile.minDscr && (
        <Callout tone="neg" title={`DSCR of ${fmtMultiple(refi.dscr)} is below your ${profile.minDscr.toFixed(2)}x floor`}>
          At {fmtPct(refi.ltv, 0)} LTV this mortgage is larger than the income comfortably supports.
          The LTV ladder below shows exactly what each rung costs in monthly cash flow — extracting
          the maximum is not the same as extracting the right amount.
        </Callout>
      )}

      <div className="grid gap-5 lg:grid-cols-5">
        <Panel title="Refinance inputs" className="lg:col-span-2">
          <div className="space-y-4">
            <NumberInput
              label="Months until refinance"
              value={deal.refinance.monthsUntilRefinance}
              onChange={(v) => edit.refinance({ monthsUntilRefinance: v })}
              min={0}
              hint="Lenders generally want the property stabilized and, on a recent purchase, may still lend against the purchase price rather than a new value."
            />

            <Select
              label="Valuation method"
              value={deal.refinance.valuationMethod}
              onChange={(v) => edit.refinance({ valuationMethod: v })}
              options={VALUATION_METHODS}
            />

            {deal.refinance.valuationMethod === 'INCOME_CAP_RATE' && (
              <PercentInput
                label="Capitalisation rate for valuation"
                value={deal.refinance.valuationCapRate}
                onChange={(v) => edit.refinance({ valuationCapRate: v })}
              />
            )}

            {isSmallResidential && deal.refinance.valuationMethod === 'INCOME_CAP_RATE' && (
              <Callout tone="warn" compact>
                This is a {deal.units.length}-unit property. Lenders value 2–4 unit residential
                primarily from comparable residential sales, not from NOI. Income capitalisation here
                will often be more generous than the appraisal you actually receive.
              </Callout>
            )}

            <div className="grid gap-3 sm:grid-cols-3">
              <MoneyInput label="Low appraisal" value={deal.refinance.appraisalLow} onChange={(v) => edit.refinance({ appraisalLow: v })} />
              <MoneyInput label="Base appraisal" value={deal.refinance.appraisalBase} onChange={(v) => edit.refinance({ appraisalBase: v })} />
              <MoneyInput label="High appraisal" value={deal.refinance.appraisalHigh} onChange={(v) => edit.refinance({ appraisalHigh: v })} />
            </div>

            <div>
              <div className="label mb-1.5">Appraisal case used</div>
              <Segmented
                value={deal.refinance.appraisalCase}
                onChange={(v) => edit.refinance({ appraisalCase: v })}
                options={APPRAISAL_CASES}
              />
            </div>

            {deal.refinance.appraisalBase > r.price && (
              <Callout tone="warn" compact>
                The base appraisal is above the purchase price. Leasing a property does not
                automatically raise its appraised value — for 2–4 units the appraiser leans on
                comparable sales. Support this with the sales comparables or drop it back to price.
              </Callout>
            )}

            <div className="grid gap-3 sm:grid-cols-2">
              <PercentInput label="Refinance LTV" value={deal.refinance.ltv} onChange={(v) => edit.refinance({ ltv: v })} />
              <PercentInput label="Interest rate" value={deal.refinance.annualRate} onChange={(v) => edit.refinance({ annualRate: v })} />
              <NumberInput label="Amortization (years)" value={deal.refinance.amortizationYears} onChange={(v) => edit.refinance({ amortizationYears: v })} min={1} />
              <NumberInput label="Term (years)" value={deal.refinance.termYears} onChange={(v) => edit.refinance({ termYears: v })} min={1} />
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <MoneyInput label="Refinance fees" value={deal.refinance.refinanceFees} onChange={(v) => edit.refinance({ refinanceFees: v })} />
              <MoneyInput label="Legal fees" value={deal.refinance.legalFees} onChange={(v) => edit.refinance({ legalFees: v })} />
              <MoneyInput label="Appraisal fee" value={deal.refinance.appraisalFee} onChange={(v) => edit.refinance({ appraisalFee: v })} />
              <MoneyInput label="Other lender costs" value={deal.refinance.otherLenderCosts} onChange={(v) => edit.refinance({ otherLenderCosts: v })} />
              <MoneyInput label="Existing debt to discharge" value={deal.refinance.existingDebtPayoff} onChange={(v) => edit.refinance({ existingDebtPayoff: v })} className="sm:col-span-2" hint="Zero for a cash purchase. Always deducted before net proceeds." />
            </div>
          </div>
        </Panel>

        <div className="space-y-5 lg:col-span-3">
          <Panel title="Cash waterfall" subtitle="Gross proceeds are never reported as released cash.">
            <RefinanceWaterfall refi={refi} />
            <div className="mt-4">
              <TraceTable steps={refi.steps} />
            </div>
            <div className="mt-3">
              <Note>{refi.valuationNote}</Note>
            </div>
          </Panel>

          <Panel
            title="DSCR measured on the conservative NOI"
            subtitle="What happens if stabilization takes longer than planned."
          >
            <div className="grid gap-3 sm:grid-cols-3">
              <div>
                <div className="label">Stabilized NOI basis</div>
                <div className="num mt-1 text-lg font-semibold">{fmtMultiple(refi.dscr)}</div>
                <Note>{fmtCAD(r.scenarios.STABILIZED.noi.noi)} NOI</Note>
              </div>
              <div>
                <div className="label">Conservative NOI basis</div>
                <div className={cx('num mt-1 text-lg font-semibold', (r.refinanceOnConservativeNoi.dscr ?? 0) < profile.minDscr && 'text-warn')}>
                  {fmtMultiple(r.refinanceOnConservativeNoi.dscr)}
                </div>
                <Note>{fmtCAD(r.scenarios.CONSERVATIVE.noi.noi)} NOI</Note>
              </div>
              <div>
                <div className="label">Cash flow on conservative NOI</div>
                <div className={cx('num mt-1 text-lg font-semibold', r.refinanceOnConservativeNoi.monthlyCashFlow < 0 && 'text-neg')}>
                  {fmtCAD(r.refinanceOnConservativeNoi.monthlyCashFlow)}/mo
                </div>
              </div>
            </div>
            <div className="mt-3">
              <Note>
                A lender underwrites the stabilized figure, but you live with whatever the building
                actually produces. If the conservative column does not clear your floor, the gap is
                execution risk you are carrying personally.
              </Note>
            </div>
          </Panel>
        </div>
      </div>

      {/* §40.9 LTV ladder */}
      <Panel
        title="Refinance LTV ladder"
        subtitle="What each additional 5% of leverage releases — and what it costs in monthly income."
        dense
      >
        <div className="p-4">
          <LtvTradeoffChart rows={r.ltvLadder.rows} />
        </div>
        <TableWrap>
          <thead className="border-b border-line bg-raised">
            <tr>
              <th className="th">LTV</th>
              <th className="th text-right">Mortgage</th>
              <th className="th text-right">Cash released</th>
              <th className="th text-right">Δ released</th>
              <th className="th text-right">Monthly payment</th>
              <th className="th text-right">Monthly cash flow</th>
              <th className="th text-right">Δ cash flow</th>
              <th className="th text-right">DSCR</th>
              <th className="th text-right">Cash-on-cash</th>
              <th className="th text-right">Cash trapped</th>
              <th className="th text-right">Equity left</th>
              <th className="th">Flags</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line/60">
            {r.ltvLadder.rows.map((row) => {
              const below = (row.dscr ?? 0) < profile.minDscr
              return (
                <tr key={row.ltv} className={cx('row-hover', row.isSelected && 'bg-accent/5 font-medium')}>
                  <td className="td-num">{fmtPct(row.ltv, 0)}</td>
                  <td className="td-num">{fmtCAD(row.mortgageAmount)}</td>
                  <td className="td-num">{fmtCAD(row.netCashReleased)}</td>
                  <td className="td-num text-pos">
                    {row.cashReleasedDeltaFromPrevious !== null ? `+${fmtCAD(row.cashReleasedDeltaFromPrevious)}` : '—'}
                  </td>
                  <td className="td-num text-muted">{fmtCAD(row.monthlyPayment)}</td>
                  <td className={cx('td-num', row.monthlyCashFlow < 0 && 'text-neg')}>{fmtCAD(row.monthlyCashFlow)}</td>
                  <td className="td-num text-neg">
                    {row.cashFlowDeltaFromPrevious !== null ? fmtCAD(row.cashFlowDeltaFromPrevious) : '—'}
                  </td>
                  <td className={cx('td-num', below && 'text-warn')}>{fmtMultiple(row.dscr)}</td>
                  <td className="td-num">{fmtPct(row.cashOnCash)}</td>
                  <td className="td-num">{fmtCAD(row.cashRemainingInvested)}</td>
                  <td className="td-num text-muted">{fmtCAD(row.equityRemaining)}</td>
                  <td className="td">
                    <div className="flex flex-wrap gap-1">
                      {row.ltv === r.ltvLadder.bestCashFlowLtv && <Badge tone="pos">Best cash flow</Badge>}
                      {row.ltv === r.ltvLadder.bestCapitalRecycledLtv && <Badge tone="info">Most capital out</Badge>}
                      {row.ltv === r.ltvLadder.bestBalancedLtv && <Badge tone="pos">Best balanced</Badge>}
                      {below && <Badge tone="warn">Below DSCR floor</Badge>}
                      {row.isSelected && <Badge tone="muted">Selected</Badge>}
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </TableWrap>
        <div className="space-y-2 border-t border-line px-4 py-3">
          <Callout tone="info" compact>
            <strong className="text-ink">Maximum extraction is not automatically the best decision.</strong>{' '}
            Moving from {fmtPct(r.ltvLadder.rows[0].ltv, 0)} to {fmtPct(r.ltvLadder.rows[r.ltvLadder.rows.length - 1].ltv, 0)} LTV
            releases {fmtCAD(r.ltvLadder.rows[r.ltvLadder.rows.length - 1].netCashReleased - r.ltvLadder.rows[0].netCashReleased)} more
            capital but costs {fmtCAD(Math.abs(r.ltvLadder.rows[r.ltvLadder.rows.length - 1].monthlyCashFlow - r.ltvLadder.rows[0].monthlyCashFlow))}/month
            of income on this property, permanently. "Best balanced" is simply the most capital released that still clears your{' '}
            {profile.minDscr.toFixed(2)}x DSCR floor — it is a constraint, not a recommendation.
          </Callout>
        </div>
      </Panel>

      {/* §40.14 Appraisal risk */}
      <Panel
        title="Appraisal risk"
        subtitle="The same sequence under a low, base and high appraisal. This is the single biggest unknown in the strategy."
        dense
      >
        <TableWrap>
          <thead className="border-b border-line bg-raised">
            <tr>
              <th className="th">Appraisal</th>
              <th className="th text-right">Value</th>
              <th className="th text-right">LTV</th>
              <th className="th text-right">Mortgage</th>
              <th className="th text-right">Cash released</th>
              <th className="th text-right">Cash trapped</th>
              <th className="th text-right">Monthly cash flow</th>
              <th className="th text-right">DSCR</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line/60">
            {r.appraisalMatrix.map((c, i) => (
              <tr
                key={i}
                className={cx(
                  'row-hover',
                  c.appraisalCase === 'LOW' && 'bg-warn/5',
                  c.appraisalCase === deal.refinance.appraisalCase && Math.abs(c.ltv - deal.refinance.ltv) < 1e-9 && 'bg-accent/10 font-medium',
                )}
              >
                <td className="td">{c.appraisalCase === 'LOW' ? 'Low' : c.appraisalCase === 'HIGH' ? 'High' : 'Base'}</td>
                <td className="td-num">{fmtCAD(c.appraisedValue)}</td>
                <td className="td-num">{fmtPct(c.ltv, 0)}</td>
                <td className="td-num">{fmtCAD(c.mortgageAmount)}</td>
                <td className="td-num">{fmtCAD(c.netCashReleased)}</td>
                <td className="td-num">{fmtCAD(c.cashRemainingInvested)}</td>
                <td className={cx('td-num', c.monthlyCashFlow < 0 && 'text-neg')}>{fmtCAD(c.monthlyCashFlow)}</td>
                <td className={cx('td-num', (c.dscr ?? 0) < profile.minDscr && 'text-warn')}>{fmtMultiple(c.dscr)}</td>
              </tr>
            ))}
          </tbody>
        </TableWrap>
        <div className="border-t border-line px-4 py-3">
          <Note>
            A low appraisal does not just reduce the cash released — it leaves more capital trapped in
            this property, which directly delays the next acquisition. Plan the sequence against the
            low row, not the high one.
          </Note>
        </div>
      </Panel>

      {/* §40.13 delay */}
      <Panel title="Refinance delay" subtitle="What waiting costs, and when the next purchase can realistically begin." dense>
        <TableWrap>
          <thead className="border-b border-line bg-raised">
            <tr>
              <th className="th">Refinance at</th>
              <th className="th text-right">Unlevered cash flow collected</th>
              <th className="th text-right">Net cash released</th>
              <th className="th text-right">Cash available at that point</th>
              <th className="th text-right">Next acquisition earliest</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line/60">
            {r.refinanceDelay.map((d) => (
              <tr key={d.months} className={cx('row-hover', d.months === deal.refinance.monthsUntilRefinance && 'bg-accent/5 font-medium')}>
                <td className="td">{d.months} months</td>
                <td className="td-num text-pos">{fmtCAD(d.cumulativeUnleveredCashFlow)}</td>
                <td className="td-num">{fmtCAD(d.netCashReleased)}</td>
                <td className="td-num">{fmtCAD(d.cashAvailableAtRefinance)}</td>
                <td className="td-num text-muted">Month {d.nextAcquisitionMonth}</td>
              </tr>
            ))}
          </tbody>
        </TableWrap>
        <div className="border-t border-line px-4 py-3">
          <Note>
            Waiting is not free, but it is not ruinous either: an unlevered stabilized property throws
            off its whole NOI while you wait. The real cost of a delay is the deferred next
            acquisition, which the Capital recycling simulator models across the full sequence.
          </Note>
        </div>
      </Panel>
    </div>
  )
}
