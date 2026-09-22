import { useState } from 'react'
import { useSimulation } from '@/lib/useSimulation'
import { useStore } from '@/store/useStore'
import {
  Badge,
  Callout,
  Collapsible,
  Kpi,
  MoneyInput,
  NumberInput,
  Panel,
  PercentInput,
  Progress,
  Segmented,
  Select,
  TableWrap,
  Toggle,
  cx,
  toneText,
} from '@/components/ui/primitives'
import { Note, SectionGrid } from '@/components/shared'
import { fmtCAD, fmtCADCompact, fmtMultiple, fmtNumber, fmtPct } from '@/engine/money'
import { dscrBand, recycleBand } from '@/engine/metrics'
import { evaluateEndState, runExitScenario, type ExitAction } from '@/engine/simulatorExtras'
import { CapitalTimeline } from '@/components/charts/CapitalTimeline'
import type { StressRow } from '@/engine/simulatorExtras'

export default function SimulatorPage() {
  const sim = useStore((s) => s.simulator)
  const setSim = useStore((s) => s.setSimulator)
  const profile = useStore((s) => s.profile)
  const deals = useStore((s) => s.deals)
  const addSimProperty = useStore((s) => s.addSimProperty)
  const updateSimProperty = useStore((s) => s.updateSimProperty)
  const removeSimProperty = useStore((s) => s.removeSimProperty)
  const moveSimProperty = useStore((s) => s.moveSimProperty)
  const syncFromDeal = useStore((s) => s.syncSimPropertyFromDeal)
  const addCapexEvent = useStore((s) => s.addCapexEvent)
  const updateCapexEvent = useStore((s) => s.updateCapexEvent)
  const removeCapexEvent = useStore((s) => s.removeCapexEvent)

  const { result, properties, milestones, rateStress, rentStressRows, delayStress, appraisalStressRows, ltvStressRows } =
    useSimulation()

  const [sortBy, setSortBy] = useState<'ORDER' | 'CASH_FLOW' | 'CAP' | 'DSCR' | 'EQUITY' | 'TRAPPED' | 'RECYCLE'>('ORDER')
  const [exitAction, setExitAction] = useState<ExitAction>('STOP_ACQUIRING')
  const [exitPropertyId, setExitPropertyId] = useState<string>('')
  const [exitLtv, setExitLtv] = useState(0.5)
  const [payDown, setPayDown] = useState(100_000)

  const owned = result.properties.filter((p) => p.acquired)
  const sorted = [...owned].sort((a, b) => {
    switch (sortBy) {
      case 'CASH_FLOW': return b.postRefinanceMonthlyCashFlow - a.postRefinanceMonthlyCashFlow
      case 'CAP': return (b.capRateOnPrice ?? 0) - (a.capRateOnPrice ?? 0)
      case 'DSCR': return (b.dscr ?? 0) - (a.dscr ?? 0)
      case 'EQUITY': return b.equityAfterRefinance - a.equityAfterRefinance
      case 'TRAPPED': return b.cashRemainingInvested - a.cashRemainingInvested
      case 'RECYCLE': return (b.capitalRecycleRatio ?? 0) - (a.capitalRecycleRatio ?? 0)
      default: return a.index - b.index
    }
  })

  const exit = runExitScenario({
    result,
    action: exitAction,
    propertyId: exitPropertyId || null,
    payDownAmount: payDown,
    targetLtv: exitLtv,
    sellingCostPercent: 0.05,
  })

  const endState = evaluateEndState(result, sim.endState, {
    nextBudget: profile.maxCapitalPerAcquisition,
    ltv: profile.maxRefinanceLtv,
    rate: sim.rateOverride ?? 0.0475,
    amortizationYears: 25,
    minDscr: profile.minDscr,
  })

  const primaryTarget = result.targets.find((t) => t.target === profile.targetMonthlyCashFlow)
    ?? result.targets.find((t) => t.target === 6000)!

  return (
    <div className="space-y-5">
      {/* §40.24 Dashboard summary */}
      <SectionGrid cols={4}>
        <Kpi label="Starting capital" value={fmtCAD(result.startingCapital)} sub={`${result.acquiredCount} of ${properties.length} properties acquired`} />
        <Kpi label="Cash currently available" value={fmtCAD(result.finalCash)} tone={result.reserve.belowThreshold ? 'neg' : 'pos'} sub={result.reserve.belowThreshold ? 'Below the required reserve' : 'Above the required reserve'} emphasis />
        <Kpi label="Portfolio value" value={fmtCAD(result.portfolioValue)} sub={`${result.totalUnits} units`} />
        <Kpi label="Portfolio debt" value={fmtCAD(result.portfolioDebt)} sub={`${fmtPct(result.portfolioLtv)} LTV`} tone={result.portfolioLtv !== null && result.portfolioLtv > profile.maxPortfolioLtv ? 'warn' : undefined} />
      </SectionGrid>

      <SectionGrid cols={4}>
        <Kpi label="Portfolio equity" value={fmtCAD(result.portfolioEquity)} />
        <Kpi label="Monthly gross rent" value={fmtCAD(result.monthlyGrossRent)} />
        <Kpi label="Monthly NOI" value={fmtCAD(result.monthlyNoi)} sub={`${fmtCAD(result.monthlyDebtService)} debt service`} />
        <Kpi
          label="Monthly net cash flow"
          value={fmtCAD(result.monthlyCashFlow)}
          tone={result.monthlyCashFlow >= profile.targetMonthlyCashFlow ? 'pos' : result.monthlyCashFlow < 0 ? 'neg' : 'warn'}
          sub={`${fmtCAD(result.annualCashFlow)}/yr`}
          emphasis
        />
      </SectionGrid>

      <SectionGrid cols={4}>
        <Kpi label="Portfolio cap rate" value={fmtPct(result.portfolioCapRate)} />
        <Kpi label="Portfolio DSCR" value={fmtMultiple(result.portfolioDscr)} tone={dscrBand(result.portfolioDscr).tone} band={dscrBand(result.portfolioDscr).label} />
        <Kpi
          label="Capital recycled"
          value={fmtCAD(result.totalCapitalRecycled)}
          sub={`${fmtPct(result.overallRecycleRatio)} of ${fmtCAD(result.totalCapitalDeployed)} deployed`}
          tone={recycleBand(result.overallRecycleRatio).tone}
        />
        <Kpi label="Cash trapped" value={fmtCAD(result.totalCashTrapped)} sub="Across all properties" />
      </SectionGrid>

      {/* §40.5 target progress */}
      <Panel title="Progress toward your income target" subtitle="Measured on net cash flow after debt service — not gross rent, not NOI.">
        <div className="mb-4">
          <div className="mb-2 flex items-baseline justify-between">
            <span className="num text-2xl font-semibold">
              {fmtCAD(result.monthlyCashFlow)} <span className="text-base font-normal text-muted">/ {fmtCAD(profile.targetMonthlyCashFlow)} monthly target</span>
            </span>
            <span className={cx('num text-lg font-semibold', toneText[primaryTarget.achieved ? 'pos' : 'warn'])}>
              {fmtPct(Math.min(1, result.monthlyCashFlow / Math.max(1, profile.targetMonthlyCashFlow)), 0)} achieved
            </span>
          </div>
          <Progress value={result.monthlyCashFlow / Math.max(1, profile.targetMonthlyCashFlow)} tone={primaryTarget.achieved ? 'pos' : 'warn'} height="h-3" />
          <div className="mt-1.5 text-xs text-muted">
            {result.monthlyCashFlow >= profile.targetMonthlyCashFlow
              ? `Surplus of ${fmtCAD(result.monthlyCashFlow - profile.targetMonthlyCashFlow)}/month.`
              : `Shortfall of ${fmtCAD(profile.targetMonthlyCashFlow - result.monthlyCashFlow)}/month.`}
          </div>
        </div>

        <TableWrap>
          <thead className="border-b border-line bg-raised">
            <tr>
              <th className="th">Target</th>
              <th className="th text-right">Current</th>
              <th className="th text-right">Shortfall</th>
              <th className="th w-40">Progress</th>
              <th className="th text-right">First reached</th>
              <th className="th text-right">Properties then</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line/60">
            {result.targets.map((t) => (
              <tr key={t.target} className={cx('row-hover', t.achieved && 'bg-pos/5')}>
                <td className="td font-medium">{fmtCAD(t.target)}/month</td>
                <td className="td-num">{fmtCAD(t.current)}</td>
                <td className={cx('td-num', t.shortfall > 0 ? 'text-warn' : 'text-pos')}>
                  {t.shortfall > 0 ? fmtCAD(t.shortfall) : 'Reached'}
                </td>
                <td className="td">
                  <Progress value={t.percent} tone={t.achieved ? 'pos' : 'warn'} height="h-1.5" />
                </td>
                <td className="td-num text-muted">{t.achievedAtMonth !== null ? `Month ${t.achievedAtMonth}` : '—'}</td>
                <td className="td-num text-muted">{t.propertiesAtAchievement ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </TableWrap>
        <div className="mt-3">
          <Note>
            "First reached" can fall in the window between stabilization and refinance, when a
            property is unlevered and throws off its whole NOI. Once the refinance mortgage starts,
            income drops back — the Current column is the steady state and is what the target is
            judged against.
          </Note>
        </div>
      </Panel>

      {result.warnings.length > 0 && (
        <div className="grid gap-2 md:grid-cols-2">
          {result.warnings.map((w, i) => (
            <Callout key={i} tone="warn" compact>{w}</Callout>
          ))}
        </div>
      )}

      {/* §40.17 timeline */}
      <Panel title="Capital recycling timeline" subtitle="How your capital moves through the portfolio, event by event.">
        <CapitalTimeline events={result.events} />
      </Panel>

      {/* Scenario controls */}
      <Panel title="Simulation settings" subtitle="Every control here re-runs the entire sequence, not just one property.">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <div className="label mb-1.5">Appraisal case</div>
            <Segmented
              value={sim.appraisalCase}
              onChange={(v) => setSim({ appraisalCase: v })}
              options={[
                { value: 'LOW', label: 'Low' },
                { value: 'BASE', label: 'Base' },
                { value: 'HIGH', label: 'High' },
              ]}
            />
          </div>
          <PercentInput
            label="Rent stress"
            value={sim.rentFactor - 1}
            onChange={(v) => setSim({ rentFactor: 1 + v })}
            hint="Applied to every property's stabilized rent."
          />
          <PercentInput
            label="Refinance rate override"
            value={sim.rateOverride ?? 0}
            onChange={(v) => setSim({ rateOverride: v > 0 ? v : null })}
            hint="Zero uses each property's own rate."
          />
          <PercentInput
            label="Refinance LTV override"
            value={sim.ltvOverride ?? 0}
            onChange={(v) => setSim({ ltvOverride: v > 0 ? v : null })}
            hint="Zero uses each property's own LTV. Capped by your maximum."
          />
          <NumberInput
            label="Refinance delay override (months)"
            value={sim.refinanceDelayOverride}
            onChange={(v) => setSim({ refinanceDelayOverride: v > 0 ? v : null })}
            placeholder="Per property"
          />
          <div className="sm:col-span-2 lg:col-span-3">
            <Toggle
              checked={sim.useAutoProjection}
              onChange={(v) => setSim({ useAutoProjection: v })}
              label="Project future acquisitions from averages instead of entered properties"
              hint="§40.6 — useful before you have specific properties in mind. Projected timing is an estimate, not a commitment."
            />
          </div>
        </div>

        {sim.useAutoProjection && (
          <div className="mt-4 grid gap-4 border-t border-line pt-4 sm:grid-cols-2 lg:grid-cols-4">
            <MoneyInput label="Average purchase price" value={sim.auto.averagePurchasePrice} onChange={(v) => setSim({ auto: { ...sim.auto, averagePurchasePrice: v } })} />
            <PercentInput label="Average cap rate" value={sim.auto.averageCapRate} onChange={(v) => setSim({ auto: { ...sim.auto, averageCapRate: v } })} />
            <NumberInput label="Average units" value={sim.auto.averageUnits} onChange={(v) => setSim({ auto: { ...sim.auto, averageUnits: v } })} min={1} />
            <PercentInput label="Average closing costs" value={sim.auto.averageClosingCostPercent} onChange={(v) => setSim({ auto: { ...sim.auto, averageClosingCostPercent: v } })} />
            <MoneyInput label="Average renovation budget" value={sim.auto.averageRenovationBudget} onChange={(v) => setSim({ auto: { ...sim.auto, averageRenovationBudget: v } })} />
            <PercentInput label="Appraisal factor on price" value={sim.auto.averageAppraisalFactor - 1} onChange={(v) => setSim({ auto: { ...sim.auto, averageAppraisalFactor: 1 + v } })} hint="0% assumes the appraisal equals the price." />
            <PercentInput label="Average refinance LTV" value={sim.auto.averageRefinanceLtv} onChange={(v) => setSim({ auto: { ...sim.auto, averageRefinanceLtv: v } })} />
            <PercentInput label="Average mortgage rate" value={sim.auto.averageMortgageRate} onChange={(v) => setSim({ auto: { ...sim.auto, averageMortgageRate: v } })} />
            <NumberInput label="Months to refinance" value={sim.auto.averageMonthsToRefinance} onChange={(v) => setSim({ auto: { ...sim.auto, averageMonthsToRefinance: v } })} min={1} />
            <NumberInput label="Months between acquisitions" value={sim.auto.averageMonthsBetweenAcquisitions} onChange={(v) => setSim({ auto: { ...sim.auto, averageMonthsBetweenAcquisitions: v } })} min={0} />
            <PercentInput label="Average vacancy" value={sim.auto.averageVacancy} onChange={(v) => setSim({ auto: { ...sim.auto, averageVacancy: v } })} />
            <PercentInput label="Operating expense ratio" value={sim.auto.averageOperatingExpenseRatio} onChange={(v) => setSim({ auto: { ...sim.auto, averageOperatingExpenseRatio: v } })} />
            <NumberInput label="Maximum properties to project" value={sim.auto.maxProperties} onChange={(v) => setSim({ auto: { ...sim.auto, maxProperties: v } })} min={1} />
          </div>
        )}
      </Panel>

      {/* §40.2 property sequence */}
      {!sim.useAutoProjection && (
        <Panel
          title="Property sequence"
          subtitle="Property 1 through 10. Link a slot to an underwritten deal to inherit its full model."
          actions={
            <button className="btn btn-xs" onClick={() => addSimProperty()} disabled={sim.properties.length >= profile.maxProperties}>
              Add property
            </button>
          }
        >
          <div className="space-y-3">
            {sim.properties.map((p, i) => {
              const res = result.properties.find((x) => x.id === p.id)
              return (
                <Collapsible
                  key={p.id}
                  title={`${i + 1}. ${p.name}`}
                  subtitle={
                    res
                      ? res.acquired
                        ? `Month ${res.acquisitionMonth} → refinance month ${res.refinanceMonth} · ${fmtCAD(res.postRefinanceMonthlyCashFlow)}/mo · DSCR ${fmtMultiple(res.dscr)}`
                        : res.blockedReason ?? ''
                      : ''
                  }
                  badge={
                    res ? (
                      res.acquired ? <Badge tone="pos">Acquired</Badge> : <Badge tone="neg">Blocked</Badge>
                    ) : undefined
                  }
                >
                  <div className="space-y-4">
                    <div className="flex flex-wrap items-end gap-3">
                      <div className="min-w-[180px] flex-1">
                        <label className="label mb-1">Name</label>
                        <input className="field" value={p.name} onChange={(e) => updateSimProperty(p.id, { name: e.target.value })} />
                      </div>
                      <div className="min-w-[220px] flex-1">
                        <label className="label mb-1">Link to an underwritten deal</label>
                        <select
                          className="field"
                          value={p.linkedDealId ?? ''}
                          onChange={(e) => (e.target.value ? syncFromDeal(p.id, e.target.value) : updateSimProperty(p.id, { linkedDealId: null }))}
                        >
                          <option value="">Not linked — figures entered here</option>
                          {deals.map((d) => (
                            <option key={d.id} value={d.id}>{d.name}</option>
                          ))}
                        </select>
                      </div>
                      <Toggle checked={p.enabled} onChange={(v) => updateSimProperty(p.id, { enabled: v })} label="Include" />
                      <div className="flex gap-1">
                        <button className="btn btn-xs" onClick={() => moveSimProperty(p.id, -1)} disabled={i === 0} title="Move earlier">↑</button>
                        <button className="btn btn-xs" onClick={() => moveSimProperty(p.id, 1)} disabled={i === sim.properties.length - 1} title="Move later">↓</button>
                        <button className="btn-danger btn-xs" onClick={() => removeSimProperty(p.id)}>Remove</button>
                      </div>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                      <MoneyInput label="Purchase price" value={p.purchasePrice} onChange={(v) => updateSimProperty(p.id, { purchasePrice: v })} />
                      <MoneyInput label="Closing costs" value={p.closingCosts} onChange={(v) => updateSimProperty(p.id, { closingCosts: v })} />
                      <MoneyInput label="Renovation costs" value={p.renovationCosts} onChange={(v) => updateSimProperty(p.id, { renovationCosts: v })} />
                      <NumberInput label="Units" value={p.units} onChange={(v) => updateSimProperty(p.id, { units: v })} min={1} />
                      <MoneyInput label="Current gross annual rent" value={p.currentGrossAnnualRent} onChange={(v) => updateSimProperty(p.id, { currentGrossAnnualRent: v })} />
                      <MoneyInput label="Stabilized gross annual rent" value={p.stabilizedGrossAnnualRent} onChange={(v) => updateSimProperty(p.id, { stabilizedGrossAnnualRent: v })} />
                      <PercentInput label="Vacancy" value={p.vacancyPercent} onChange={(v) => updateSimProperty(p.id, { vacancyPercent: v })} />
                      <PercentInput label="Operating expense ratio" value={p.operatingExpenseRatio} onChange={(v) => updateSimProperty(p.id, { operatingExpenseRatio: v })} hint="Of effective gross income." />
                      <MoneyInput label="Operating expenses (overrides ratio)" value={p.operatingExpensesAnnual || null} onChange={(v) => updateSimProperty(p.id, { operatingExpensesAnnual: v })} placeholder="Use ratio" />
                      <NumberInput label="Months to stabilization" value={p.monthsToStabilization} onChange={(v) => updateSimProperty(p.id, { monthsToStabilization: v })} min={0} />
                      <NumberInput label="Months until refinance" value={p.monthsUntilRefinance} onChange={(v) => updateSimProperty(p.id, { monthsUntilRefinance: v })} min={0} />
                      <NumberInput label="Gap before next purchase (months)" value={p.gapMonthsAfterRefinance} onChange={(v) => updateSimProperty(p.id, { gapMonthsAfterRefinance: v })} min={0} />
                      <MoneyInput label="Low appraisal" value={p.appraisalLow} onChange={(v) => updateSimProperty(p.id, { appraisalLow: v })} />
                      <MoneyInput label="Base appraisal" value={p.appraisalBase} onChange={(v) => updateSimProperty(p.id, { appraisalBase: v })} hint="Defaults to the purchase price." />
                      <MoneyInput label="High appraisal" value={p.appraisalHigh} onChange={(v) => updateSimProperty(p.id, { appraisalHigh: v })} />
                      <PercentInput label="Refinance LTV" value={p.refinanceLtv} onChange={(v) => updateSimProperty(p.id, { refinanceLtv: v })} />
                      <PercentInput label="Refinance rate" value={p.refinanceRate} onChange={(v) => updateSimProperty(p.id, { refinanceRate: v })} />
                      <NumberInput label="Amortization (years)" value={p.refinanceAmortizationYears} onChange={(v) => updateSimProperty(p.id, { refinanceAmortizationYears: v })} min={1} />
                      <NumberInput label="Term (years)" value={p.refinanceTermYears} onChange={(v) => updateSimProperty(p.id, { refinanceTermYears: v })} min={1} />
                      <MoneyInput label="Refinance costs" value={p.refinanceCosts} onChange={(v) => updateSimProperty(p.id, { refinanceCosts: v })} />
                      <div>
                        <label className="label mb-1">Neighbourhood</label>
                        <input className="field" value={p.neighbourhood} onChange={(e) => updateSimProperty(p.id, { neighbourhood: e.target.value })} />
                      </div>
                    </div>

                    {res && (
                      <div className="rounded-md border border-line bg-raised p-3">
                        <div className="label mb-2">Cash waterfall for this property</div>
                        <TableWrap>
                          <tbody className="divide-y divide-line/50">
                            {res.waterfall.map((w, wi) => (
                              <tr key={wi} className={cx(w.kind === 'total' && 'font-semibold', w.kind === 'subtotal' && 'font-medium')}>
                                <td className="td text-xs">{w.label}</td>
                                <td className={cx('td-num text-xs', w.kind === 'out' && 'text-neg', w.kind === 'in' && 'text-pos')}>
                                  {fmtCAD(w.amount)}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </TableWrap>
                      </div>
                    )}
                  </div>
                </Collapsible>
              )
            })}
          </div>
        </Panel>
      )}

      {/* §40.2 / §40.18 property table */}
      <Panel
        title="Properties"
        subtitle="Each property's full economics through acquisition and refinance."
        actions={
          <Select
            value={sortBy}
            onChange={setSortBy}
            options={[
              { value: 'ORDER', label: 'Acquisition order' },
              { value: 'CASH_FLOW', label: 'Cash flow' },
              { value: 'CAP', label: 'Cap rate' },
              { value: 'DSCR', label: 'DSCR' },
              { value: 'EQUITY', label: 'Equity' },
              { value: 'TRAPPED', label: 'Cash trapped' },
              { value: 'RECYCLE', label: 'Capital recycle ratio' },
            ]}
          />
        }
        dense
      >
        <TableWrap>
          <thead className="border-b border-line bg-raised">
            <tr>
              <th className="th">#</th>
              <th className="th">Property</th>
              <th className="th text-right">Bought</th>
              <th className="th text-right">Price</th>
              <th className="th text-right">All-in cash</th>
              <th className="th text-right">Units</th>
              <th className="th text-right">NOI</th>
              <th className="th text-right">Cap</th>
              <th className="th text-right">Refi month</th>
              <th className="th text-right">Appraisal</th>
              <th className="th text-right">LTV</th>
              <th className="th text-right">Mortgage</th>
              <th className="th text-right">Cash released</th>
              <th className="th text-right">Cash trapped</th>
              <th className="th text-right">Recycled</th>
              <th className="th text-right">Debt service</th>
              <th className="th text-right">Cash flow</th>
              <th className="th text-right">DSCR</th>
              <th className="th text-right">CoC</th>
              <th className="th text-right">Liquidity after</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line/60">
            {sorted.map((p) => (
              <tr key={p.id} className="row-hover">
                <td className="td">{p.index}</td>
                <td className="td font-medium">{p.name}</td>
                <td className="td-num text-muted">M{p.acquisitionMonth}</td>
                <td className="td-num">{fmtCAD(p.purchasePrice)}</td>
                <td className="td-num">{fmtCAD(p.totalAcquisitionCash)}</td>
                <td className="td-num">{p.units}</td>
                <td className="td-num">{fmtCAD(p.annualNoi)}</td>
                <td className="td-num">{fmtPct(p.capRateOnPrice)}</td>
                <td className="td-num text-muted">M{p.refinanceMonth}</td>
                <td className="td-num">{fmtCAD(p.appraisedValue)}</td>
                <td className="td-num">{fmtPct(p.refinanceLtv, 0)}</td>
                <td className="td-num">{fmtCAD(p.mortgageAmount)}</td>
                <td className="td-num text-pos">{fmtCAD(p.netCashReleased)}</td>
                <td className="td-num text-warn">{fmtCAD(p.cashRemainingInvested)}</td>
                <td className="td-num">{fmtPct(p.capitalRecycleRatio)}</td>
                <td className="td-num text-muted">{fmtCAD(p.monthlyDebtService)}</td>
                <td className={cx('td-num font-semibold', p.postRefinanceMonthlyCashFlow < 0 && 'text-neg')}>
                  {fmtCAD(p.postRefinanceMonthlyCashFlow)}
                </td>
                <td className={cx('td-num', (p.dscr ?? 0) < profile.minDscr && 'text-warn')}>{fmtMultiple(p.dscr)}</td>
                <td className="td-num">{fmtPct(p.cashOnCash)}</td>
                <td className="td-num text-muted">{fmtCAD(p.liquidityAfterRefinance)}</td>
              </tr>
            ))}
            {result.properties.filter((p) => !p.acquired).map((p) => (
              <tr key={p.id} className="bg-neg/5">
                <td className="td">{p.index}</td>
                <td className="td font-medium">{p.name}<Badge tone="neg">Blocked</Badge></td>
                <td className="td text-2xs text-muted" colSpan={18}>{p.blockedReason}</td>
              </tr>
            ))}
          </tbody>
          <tfoot className="border-t-2 border-line bg-raised font-semibold">
            <tr>
              <td className="td" colSpan={5}>Portfolio total</td>
              <td className="td-num">{result.totalUnits}</td>
              <td className="td-num">{fmtCAD(result.monthlyNoi * 12)}</td>
              <td className="td-num">{fmtPct(result.portfolioCapRate)}</td>
              <td className="td" colSpan={3} />
              <td className="td-num">{fmtCAD(result.portfolioDebt)}</td>
              <td className="td-num text-pos">{fmtCAD(result.totalCapitalRecycled)}</td>
              <td className="td-num text-warn">{fmtCAD(result.totalCashTrapped)}</td>
              <td className="td-num">{fmtPct(result.overallRecycleRatio)}</td>
              <td className="td-num">{fmtCAD(result.monthlyDebtService)}</td>
              <td className="td-num">{fmtCAD(result.monthlyCashFlow)}</td>
              <td className="td-num">{fmtMultiple(result.portfolioDscr)}</td>
              <td className="td" colSpan={2} />
            </tr>
          </tfoot>
        </TableWrap>
      </Panel>

      {/* §40.4 next capacity + §40.11 liquidity */}
      <div className="grid gap-5 lg:grid-cols-2">
        <Panel title="Next property capacity" subtitle="What the current cash position can actually buy.">
          <div className="mb-4 rounded-md border border-accent/30 bg-accent/5 p-4">
            <div className="label">Maximum next cash purchase</div>
            <div className="num mt-1 text-3xl font-semibold text-accent">
              {fmtCAD(result.nextCapacity.maxCashPurchaseAfterCosts)}
            </div>
            <Note>
              After holding the {fmtCAD(result.nextCapacity.requiredReserve)} reserve and allowing{' '}
              {fmtPct(result.nextCapacity.assumedClosingCostRate, 1)} for closing costs.
            </Note>
          </div>
          <div className="space-y-1">
            <Row label="Cash balance" value={fmtCAD(result.nextCapacity.cashBalance)} />
            <Row label="Less required reserve" value={`(${fmtCAD(result.nextCapacity.requiredReserve)})`} tone="neg" />
            <Row label="Available acquisition capital" value={fmtCAD(result.nextCapacity.availableCapital)} strong />
            <Row label="Maximum cash purchase (before costs)" value={fmtCAD(result.nextCapacity.maxCashPurchase)} />
            <Row label="Maximum cash purchase (after costs)" value={fmtCAD(result.nextCapacity.maxCashPurchaseAfterCosts)} strong />
            <Row label="With 50% down" value={fmtCAD(result.nextCapacity.withFiftyPercentDown)} />
            <Row label="With 35% down" value={fmtCAD(result.nextCapacity.withThirtyFivePercentDown)} />
            <Row label="With 25% down" value={fmtCAD(result.nextCapacity.withTwentyFivePercentDown)} />
          </div>
          <div className="mt-3">
            <Note>
              The leveraged rows assume a lender will advance at those ratios on an unstabilized
              purchase, which is usually harder than it looks. The cash figure is the one this
              strategy actually runs on.
            </Note>
          </div>
        </Panel>

        <Panel
          title="Liquidity protection"
          subtitle="The simulator never assumes all available cash should be invested."
          actions={result.reserve.belowThreshold ? <Badge tone="neg">Below threshold</Badge> : <Badge tone="pos">Adequate</Badge>}
        >
          {result.reserve.belowThreshold && (
            <div className="mb-3">
              <Callout tone="neg" title="Reserve below the required minimum">
                Cash of {fmtCAD(result.reserve.actualReserve)} is short of the{' '}
                {fmtCAD(Math.max(result.reserve.configuredMinimum, result.reserve.suggestedMinimum))} threshold.
                A single furnace failure or a two-month vacancy becomes a financing problem at this level.
              </Callout>
            </div>
          )}
          <div className="space-y-1">
            <Row label="Your configured minimum" value={fmtCAD(result.reserve.configuredMinimum)} />
            <Row label="6 months portfolio debt service" value={fmtCAD(result.reserve.sixMonthsDebtService)} />
            <Row label="6 months operating expenses" value={fmtCAD(result.reserve.sixMonthsOperatingExpenses)} />
            <Row label="Near-term capital expenditure" value={fmtCAD(result.reserve.nearTermCapex)} />
            <Row label="Suggested minimum reserve" value={fmtCAD(result.reserve.suggestedMinimum)} strong />
            <Row label="Actual cash reserve" value={fmtCAD(result.reserve.actualReserve)} strong />
            <Row
              label="Surplus / deficit"
              value={fmtCAD(result.reserve.surplusOrDeficit)}
              tone={result.reserve.surplusOrDeficit < 0 ? 'neg' : 'pos'}
              strong
            />
          </div>
          <div className="mt-3">
            <Note>{result.reserve.note}</Note>
          </div>
        </Panel>
      </div>

      {/* §40.10 debt cascade */}
      <Panel title="Portfolio debt cascade" subtitle="Every mortgage individually, then consolidated." dense>
        <TableWrap>
          <thead className="border-b border-line bg-raised">
            <tr>
              <th className="th">Property</th>
              <th className="th text-right">Original mortgage</th>
              <th className="th text-right">Current balance</th>
              <th className="th text-right">Rate</th>
              <th className="th text-right">Monthly payment</th>
              <th className="th text-right">Annual debt service</th>
              <th className="th text-right">LTV</th>
              <th className="th text-right">DSCR</th>
              <th className="th text-right">Renewal</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line/60">
            {result.debtCascade.map((d) => (
              <tr key={d.propertyId} className="row-hover">
                <td className="td">{d.propertyName}</td>
                <td className="td-num">{fmtCAD(d.originalMortgage)}</td>
                <td className="td-num">{fmtCAD(d.currentBalance)}</td>
                <td className="td-num">{fmtPct(d.rate)}</td>
                <td className="td-num">{fmtCAD(d.monthlyPayment)}</td>
                <td className="td-num">{fmtCAD(d.annualDebtService)}</td>
                <td className="td-num">{fmtPct(d.ltv)}</td>
                <td className={cx('td-num', (d.dscr ?? 0) < profile.minDscr && 'text-warn')}>{fmtMultiple(d.dscr)}</td>
                <td className="td-num text-muted">{d.renewalYear ?? '—'}</td>
              </tr>
            ))}
            {result.debtCascade.length === 0 && (
              <tr><td className="td text-muted" colSpan={9}>No debt yet — nothing has been refinanced.</td></tr>
            )}
          </tbody>
          <tfoot className="border-t-2 border-line bg-raised font-semibold">
            <tr>
              <td className="td">Consolidated</td>
              <td className="td-num">{fmtCAD(result.debtCascade.reduce((s, d) => s + d.originalMortgage, 0))}</td>
              <td className="td-num">{fmtCAD(result.portfolioDebt)}</td>
              <td className="td-num">
                {fmtPct(
                  result.portfolioDebt > 0
                    ? result.debtCascade.reduce((s, d) => s + d.currentBalance * d.rate, 0) /
                        Math.max(1, result.debtCascade.reduce((s, d) => s + d.currentBalance, 0))
                    : null,
                )}
              </td>
              <td className="td-num">{fmtCAD(result.monthlyDebtService)}</td>
              <td className="td-num">{fmtCAD(result.monthlyDebtService * 12)}</td>
              <td className="td-num">{fmtPct(result.portfolioLtv)}</td>
              <td className="td-num">{fmtMultiple(result.portfolioDscr)}</td>
              <td className="td" />
            </tr>
          </tfoot>
        </TableWrap>
      </Panel>

      {/* §40.12 capex events */}
      <Panel
        title="Unexpected capital expenditure"
        subtitle="Add an event and watch it ripple through liquidity and the acquisition timeline."
        actions={<button className="btn btn-xs" onClick={() => addCapexEvent()}>Add event</button>}
        dense
      >
        {sim.capexEvents.length === 0 ? (
          <div className="p-4">
            <Note>
              No events. Try a C$20,000 roof at month 12, or a C$30,000 foundation repair right before
              your second refinance — the point is to see how a single repair delays the next purchase.
            </Note>
          </div>
        ) : (
          <TableWrap>
            <thead className="border-b border-line bg-raised">
              <tr>
                <th className="th w-14 text-center">On</th>
                <th className="th">Event</th>
                <th className="th w-32 text-right">Amount</th>
                <th className="th w-28 text-right">Month</th>
                <th className="th w-10" />
              </tr>
            </thead>
            <tbody className="divide-y divide-line/60">
              {sim.capexEvents.map((e) => (
                <tr key={e.id} className={cx('row-hover', !e.enabled && 'opacity-45')}>
                  <td className="td text-center">
                    <input type="checkbox" checked={e.enabled} onChange={(ev) => updateCapexEvent(e.id, { enabled: ev.target.checked })} className="h-3.5 w-3.5 rounded border-line text-accent" />
                  </td>
                  <td className="td"><input className="field" value={e.label} onChange={(ev) => updateCapexEvent(e.id, { label: ev.target.value })} /></td>
                  <td className="td"><MoneyInput value={e.amount} onChange={(v) => updateCapexEvent(e.id, { amount: v })} className="w-32" /></td>
                  <td className="td"><NumberInput value={e.month} onChange={(v) => updateCapexEvent(e.id, { month: v })} className="w-24" min={0} /></td>
                  <td className="td text-right"><button className="btn-ghost btn-xs text-neg" onClick={() => removeCapexEvent(e.id)}>×</button></td>
                </tr>
              ))}
            </tbody>
          </TableWrap>
        )}
        <div className="flex flex-wrap gap-2 border-t border-line px-4 py-3">
          {[
            { label: 'Roof', amount: 20_000 },
            { label: 'Boiler', amount: 15_000 },
            { label: 'Electrical', amount: 25_000 },
            { label: 'Foundation', amount: 30_000 },
            { label: 'Vacancy / turnover renovation', amount: 10_000 },
          ].map((preset) => (
            <button
              key={preset.label}
              className="btn btn-xs"
              onClick={() => addCapexEvent({ label: preset.label, amount: preset.amount, month: 12 })}
            >
              + {preset.label} {fmtCADCompact(preset.amount)}
            </button>
          ))}
        </div>
      </Panel>

      {/* Stress suite */}
      <div className="grid gap-5 lg:grid-cols-2">
        <StressPanel title="Interest rate risk" subtitle="The whole sequence re-run at each refinance rate." rows={rateStress} minDscr={profile.minDscr} />
        <StressPanel title="Rent stress" subtitle="Does the income target survive lower rents?" rows={rentStressRows} minDscr={profile.minDscr} />
        <StressPanel title="Refinance delay" subtitle="What waiting does to the sequence." rows={delayStress} minDscr={profile.minDscr} />
        <StressPanel title="Appraisal risk" subtitle="Low, base and high appraisals across every refinance." rows={appraisalStressRows} minDscr={profile.minDscr} />
      </div>

      <StressPanel
        title="Refinance LTV across the whole portfolio"
        subtitle="The cash-released vs income trade-off, applied to every property at once."
        rows={ltvStressRows}
        minDscr={profile.minDscr}
      />

      {/* §40.19 exit */}
      <Panel title="Exit and deleveraging" subtitle="What the strategy looks like after the acquisition phase ends.">
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="space-y-3">
            <Select
              label="Action"
              value={exitAction}
              onChange={setExitAction}
              options={[
                { value: 'STOP_ACQUIRING', label: 'Stop acquiring' },
                { value: 'SELL_WEAKEST', label: 'Sell the weakest performer' },
                { value: 'SELL_PROPERTY', label: 'Sell a specific property' },
                { value: 'PAY_DOWN_MORTGAGE', label: 'Pay down one mortgage' },
                { value: 'CASH_FLOW_TO_DEBT', label: 'Direct cash flow to debt reduction' },
                { value: 'REFINANCE_LOWER_LTV', label: 'Refinance the portfolio at a lower LTV' },
              ]}
            />
            {(exitAction === 'SELL_PROPERTY' || exitAction === 'PAY_DOWN_MORTGAGE') && (
              <Select
                label="Property"
                value={exitPropertyId}
                onChange={setExitPropertyId}
                options={[{ value: '', label: 'Select…' }, ...owned.map((p) => ({ value: p.id, label: p.name }))]}
              />
            )}
            {exitAction === 'PAY_DOWN_MORTGAGE' && (
              <MoneyInput label="Pay-down amount" value={payDown} onChange={setPayDown} />
            )}
            {exitAction === 'REFINANCE_LOWER_LTV' && (
              <PercentInput label="Target LTV" value={exitLtv} onChange={setExitLtv} />
            )}
          </div>

          <div className="lg:col-span-2">
            <div className="mb-2 text-sm font-semibold">{exit.label}</div>
            <p className="mb-3 text-xs text-muted">{exit.description}</p>
            <div className="grid gap-3 sm:grid-cols-3">
              <Metric label="Cash generated" value={fmtCAD(exit.cashGenerated)} tone={exit.cashGenerated >= 0 ? 'pos' : 'neg'} />
              <Metric label="Monthly cash flow after" value={fmtCAD(exit.monthlyCashFlowAfter)} sub={`${exit.monthlyCashFlowDelta >= 0 ? '+' : ''}${fmtCAD(exit.monthlyCashFlowDelta)}`} />
              <Metric label="Portfolio debt after" value={fmtCAD(exit.portfolioDebtAfter)} />
              <Metric label="Portfolio equity after" value={fmtCAD(exit.portfolioEquityAfter)} />
              <Metric label="Portfolio DSCR after" value={fmtMultiple(exit.portfolioDscrAfter)} />
              <Metric label="Liquidity after" value={fmtCAD(exit.liquidityAfter)} />
            </div>
            {exit.yearsToDebtFree !== null && (
              <div className="mt-3">
                <Metric label="Years to debt free" value={`${exit.yearsToDebtFree.toFixed(1)} years`} />
              </div>
            )}
            <div className="mt-3">
              <Callout tone="info" compact>{exit.note}</Callout>
            </div>
          </div>
        </div>
      </Panel>

      {/* §40.20 end state */}
      <Panel title="End-state target" subtitle="Define the portfolio you actually want, and see what is still missing.">
        <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-6">
          <NumberInput label="Properties" value={sim.endState.properties} onChange={(v) => setSim({ endState: { ...sim.endState, properties: v } })} min={0} />
          <NumberInput label="Units" value={sim.endState.units} onChange={(v) => setSim({ endState: { ...sim.endState, units: v } })} min={0} />
          <MoneyInput label="Portfolio value" value={sim.endState.portfolioValue} onChange={(v) => setSim({ endState: { ...sim.endState, portfolioValue: v } })} />
          <MoneyInput label="Portfolio debt" value={sim.endState.portfolioDebt} onChange={(v) => setSim({ endState: { ...sim.endState, portfolioDebt: v } })} />
          <MoneyInput label="Portfolio equity" value={sim.endState.portfolioEquity} onChange={(v) => setSim({ endState: { ...sim.endState, portfolioEquity: v } })} />
          <MoneyInput label="Monthly cash flow" value={sim.endState.monthlyCashFlow} onChange={(v) => setSim({ endState: { ...sim.endState, monthlyCashFlow: v } })} />
        </div>

        <div className="mt-4">
          <TableWrap>
            <thead className="border-b border-line bg-raised">
              <tr>
                <th className="th">Metric</th>
                <th className="th text-right">Target</th>
                <th className="th text-right">Current</th>
                <th className="th text-right">Gap</th>
                <th className="th w-40">Progress</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line/60">
              {endState.gaps.map((g) => (
                <tr key={g.metric} className="row-hover">
                  <td className="td">{g.metric}</td>
                  <td className="td-num text-muted">{g.format === 'currency' ? fmtCAD(g.target) : fmtNumber(g.target)}</td>
                  <td className="td-num font-medium">{g.format === 'currency' ? fmtCAD(g.current) : fmtNumber(g.current)}</td>
                  <td className={cx('td-num', g.gap > 0 ? 'text-warn' : 'text-pos')}>
                    {g.gap > 0 ? (g.format === 'currency' ? fmtCAD(g.gap) : fmtNumber(g.gap)) : 'Met'}
                  </td>
                  <td className="td">
                    <Progress value={Math.min(1, g.percentAchieved)} tone={g.percentAchieved >= 1 ? 'pos' : 'warn'} height="h-1.5" />
                  </td>
                </tr>
              ))}
            </tbody>
          </TableWrap>
        </div>

        <div className="mt-4">
          <Callout tone="info" title="What the next property must deliver">
            {endState.narrative}
          </Callout>
        </div>
      </Panel>

      {/* §40.6 milestones */}
      <Panel title="Milestones" subtitle="Projected timing. An estimate, not a commitment." dense>
        <TableWrap>
          <thead className="border-b border-line bg-raised">
            <tr>
              <th className="th w-24">Month</th>
              <th className="th">Event</th>
              <th className="th text-right">Cash balance</th>
              <th className="th text-right">Monthly cash flow</th>
              <th className="th text-right">Portfolio value</th>
              <th className="th text-right">Portfolio debt</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line/60">
            {milestones.map((m, i) => (
              <tr key={i} className="row-hover">
                <td className="td font-medium">Month {m.month}</td>
                <td className="td">
                  {m.label}
                  <div className="text-2xs text-subtle">{m.detail}</div>
                </td>
                <td className="td-num">{fmtCAD(m.cashBalance)}</td>
                <td className="td-num">{fmtCAD(m.monthlyCashFlow)}</td>
                <td className="td-num text-muted">{fmtCAD(m.portfolioValue)}</td>
                <td className="td-num text-muted">{fmtCAD(m.portfolioDebt)}</td>
              </tr>
            ))}
          </tbody>
        </TableWrap>
        <div className="border-t border-line px-4 py-3">
          <Note>
            Timing assumes every stabilization and refinance lands on schedule and that each property
            appraises at the case selected above. Lenders routinely want six to twelve months of
            seasoning; a low appraisal or a slow lease-up pushes every subsequent date back.
          </Note>
        </div>
      </Panel>
    </div>
  )
}

function StressPanel<T>({
  title,
  subtitle,
  rows,
  minDscr,
}: {
  title: string
  subtitle: string
  rows: StressRow<T>[]
  minDscr: number
}) {
  return (
    <Panel title={title} subtitle={subtitle} dense>
      <TableWrap>
        <thead className="border-b border-line bg-raised">
          <tr>
            <th className="th">Scenario</th>
            <th className="th text-right">Acquired</th>
            <th className="th text-right">Units</th>
            <th className="th text-right">Monthly cash flow</th>
            <th className="th text-right">DSCR</th>
            <th className="th text-right">Debt</th>
            <th className="th text-right">Cash left</th>
            <th className="th text-center">Reserve</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line/60">
          {rows.map((row, i) => (
            <tr key={i} className="row-hover">
              <td className="td font-medium">{row.label}</td>
              <td className="td-num">{row.acquiredCount}</td>
              <td className="td-num">{row.totalUnits}</td>
              <td className={cx('td-num font-medium', row.monthlyCashFlow < 0 && 'text-neg')}>{fmtCAD(row.monthlyCashFlow)}</td>
              <td className={cx('td-num', (row.portfolioDscr ?? 9) < minDscr && 'text-warn')}>{fmtMultiple(row.portfolioDscr)}</td>
              <td className="td-num text-muted">{fmtCAD(row.portfolioDebt)}</td>
              <td className="td-num">{fmtCAD(row.finalCash)}</td>
              <td className="td text-center">
                {row.reserveBreached ? <Badge tone="neg">Breached</Badge> : <Badge tone="pos">OK</Badge>}
              </td>
            </tr>
          ))}
        </tbody>
      </TableWrap>
    </Panel>
  )
}

function Row({ label, value, tone, strong }: { label: string; value: string; tone?: 'pos' | 'neg'; strong?: boolean }) {
  return (
    <div className={cx('flex items-baseline justify-between gap-3 border-b border-line/50 py-1.5 last:border-0', strong && 'font-semibold')}>
      <span className="text-xs text-muted">{label}</span>
      <span className={cx('num text-sm', tone === 'neg' && 'text-neg', tone === 'pos' && 'text-pos')}>{value}</span>
    </div>
  )
}

function Metric({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: 'pos' | 'neg' }) {
  return (
    <div className="rounded-md border border-line bg-raised p-3">
      <div className="label">{label}</div>
      <div className={cx('num mt-1 text-base font-semibold', tone === 'pos' && 'text-pos', tone === 'neg' && 'text-neg')}>{value}</div>
      {sub && <div className="mt-0.5 text-2xs text-muted">{sub}</div>}
    </div>
  )
}
