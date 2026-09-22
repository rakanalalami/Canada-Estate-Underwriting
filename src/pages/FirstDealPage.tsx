import { useMemo, useState } from 'react'
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
  TableWrap,
  cx,
} from '@/components/ui/primitives'
import { SectionGrid } from '@/components/shared'
import { fmtCAD, fmtMultiple, fmtPct } from '@/engine/money'
import { planFirstAcquisition, portfolioGoalSeek, reverseDealFinder } from '@/engine/reverse'

type Tab = 'FIRST' | 'REVERSE' | 'GOAL'

export default function FirstDealPage() {
  const profile = useStore((s) => s.profile)
  const [tab, setTab] = useState<Tab>('FIRST')

  /* §40.21 inputs */
  const [maxCashPurchase, setMaxCashPurchase] = useState(profile.maxCapitalPerAcquisition)
  const [targetCap, setTargetCap] = useState(profile.minCapRate)
  const [targetLtv, setTargetLtv] = useState(profile.maxRefinanceLtv)
  const [targetCf, setTargetCf] = useState(1500)
  const [closingPct, setClosingPct] = useState(0.03)
  const [renoBudget, setRenoBudget] = useState(0)
  const [rate, setRate] = useState(0.0475)
  const [amort, setAmort] = useState(25)
  const [refiCosts, setRefiCosts] = useState(3300)
  const [vacancy, setVacancy] = useState(0.03)
  const [opexRatio, setOpexRatio] = useState(0.32)

  /* §40.22 inputs */
  const [budget, setBudget] = useState(650_000)
  const [reverseCap, setReverseCap] = useState(0.07)
  const [reverseCf, setReverseCf] = useState(1750)
  const [taxShare, setTaxShare] = useState(0.3)

  /* §40.23 inputs */
  const [goalCf, setGoalCf] = useState(profile.targetMonthlyCashFlow)

  const first = useMemo(
    () =>
      planFirstAcquisition({
        startingCapital: profile.startingCapital,
        maximumCashPurchase: maxCashPurchase,
        reserveRequirement: profile.minimumCashReserve,
        targetCapRate: targetCap,
        targetRefinanceLtv: targetLtv,
        targetMonthlyCashFlow: targetCf,
        closingCostPercent: closingPct,
        renovationBudget: renoBudget,
        refinanceRate: rate,
        refinanceAmortizationYears: amort,
        refinanceCosts: refiCosts,
        vacancyPercent: vacancy,
        operatingExpenseRatio: opexRatio,
        minDscr: profile.minDscr,
      }),
    [profile, maxCashPurchase, targetCap, targetLtv, targetCf, closingPct, renoBudget, rate, amort, refiCosts, vacancy, opexRatio],
  )

  const reverse = useMemo(
    () =>
      reverseDealFinder({
        purchaseBudget: budget,
        targetCapRate: reverseCap,
        targetMonthlyCashFlowAfterRefinance: reverseCf,
        refinanceLtv: targetLtv,
        mortgageRate: rate,
        amortizationYears: amort,
        vacancyPercent: vacancy,
        operatingExpenseRatio: opexRatio,
        maxPropertyTaxShareOfOpex: taxShare,
        minDscr: profile.minDscr,
      }),
    [budget, reverseCap, reverseCf, targetLtv, rate, amort, vacancy, opexRatio, taxShare, profile.minDscr],
  )

  const goal = useMemo(
    () =>
      portfolioGoalSeek({
        targetMonthlyCashFlow: goalCf,
        startingCapital: profile.startingCapital,
        minimumReserve: profile.minimumCashReserve,
        refinanceLtv: targetLtv,
        mortgageRate: rate,
        amortizationYears: amort,
        vacancyPercent: vacancy,
        operatingExpenseRatio: opexRatio,
        closingCostPercent: closingPct,
        minDscr: profile.minDscr,
      }),
    [goalCf, profile, targetLtv, rate, amort, vacancy, opexRatio, closingPct],
  )

  return (
    <div className="space-y-5">
      <Segmented
        value={tab}
        onChange={setTab}
        options={[
          { value: 'FIRST', label: 'First acquisition' },
          { value: 'REVERSE', label: 'Reverse deal finder' },
          { value: 'GOAL', label: 'Portfolio goal seek' },
        ]}
      />

      {/* Shared assumptions */}
      <Panel title="Shared assumptions" subtitle="Used by all three calculators on this page.">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <PercentInput label="Refinance LTV" value={targetLtv} onChange={setTargetLtv} />
          <PercentInput label="Mortgage rate" value={rate} onChange={setRate} />
          <NumberInput label="Amortization (years)" value={amort} onChange={setAmort} min={1} />
          <PercentInput label="Vacancy" value={vacancy} onChange={setVacancy} />
          <PercentInput label="Operating expense ratio" value={opexRatio} onChange={setOpexRatio} hint="Of effective gross income. 30–40% is typical for Ottawa small multifamily." />
          <PercentInput label="Closing costs" value={closingPct} onChange={setClosingPct} hint="Land transfer tax, legal, inspections, title." />
          <MoneyInput label="Refinance costs" value={refiCosts} onChange={setRefiCosts} />
          <div className="rounded-md border border-line bg-raised p-3">
            <div className="label">From your investor profile</div>
            <div className="mt-1 space-y-0.5 text-2xs text-muted">
              <div>Capital: <span className="num text-ink">{fmtCAD(profile.startingCapital)}</span></div>
              <div>Reserve: <span className="num text-ink">{fmtCAD(profile.minimumCashReserve)}</span></div>
              <div>Min DSCR: <span className="num text-ink">{profile.minDscr.toFixed(2)}x</span></div>
            </div>
          </div>
        </div>
      </Panel>

      {tab === 'FIRST' && (
        <>
          <Panel title="Property #1 requirements" subtitle="The first acquisition starts the whole recycling strategy — it matters more than any other.">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <MoneyInput label="Maximum all-in for property #1" value={maxCashPurchase} onChange={setMaxCashPurchase} />
              <PercentInput label="Target cap rate" value={targetCap} onChange={setTargetCap} />
              <MoneyInput label="Target post-refinance cash flow" value={targetCf} onChange={setTargetCf} suffix="/mo" />
              <MoneyInput label="Renovation budget" value={renoBudget} onChange={setRenoBudget} />
            </div>
          </Panel>

          <SectionGrid cols={4}>
            <Kpi label="Deployable capital" value={fmtCAD(first.deployableCapital)} sub={`After the ${fmtCAD(profile.minimumCashReserve)} reserve`} />
            <Kpi label="Maximum purchase price" value={fmtCAD(first.maxPurchasePrice)} sub={`+ ${fmtCAD(first.estimatedClosingCosts)} closing + ${fmtCAD(first.renovationBudget)} renovation`} emphasis />
            <Kpi label="Minimum required NOI" value={fmtCAD(first.minimumRequiredNoi)} sub={`${fmtPct(first.maxPurchasePrice > 0 ? first.minimumRequiredNoi / first.maxPurchasePrice : null)} cap rate`} emphasis />
            <Kpi label="Minimum gross rent" value={`${fmtCAD(first.minimumRequiredMonthlyGrossRent)}/mo`} sub={`${fmtCAD(first.minimumRequiredAnnualGrossRent)}/yr`} />
          </SectionGrid>

          <div className="grid gap-5 lg:grid-cols-2">
            <Panel title="What the property must look like">
              <Row label="Maximum purchase price" value={fmtCAD(first.maxPurchasePrice)} strong />
              <Row label="Estimated closing costs" value={fmtCAD(first.estimatedClosingCosts)} />
              <Row label="Renovation budget" value={fmtCAD(first.renovationBudget)} />
              <Row label="Maximum all-in cost" value={fmtCAD(first.maxAllInCost)} strong />
              <Row label="Minimum required NOI" value={fmtCAD(first.minimumRequiredNoi)} strong />
              <Row label="Minimum annual gross rent" value={fmtCAD(first.minimumRequiredAnnualGrossRent)} />
              <Row label="Minimum monthly gross rent" value={fmtCAD(first.minimumRequiredMonthlyGrossRent)} strong />
              <Row label="Maximum operating expenses" value={fmtCAD(first.maximumOperatingExpenses)} />
              <Row label="Minimum appraisal required" value={fmtCAD(first.minimumAppraisalRequired)} />
              <div className="mt-3">
                <Badge tone="info">
                  Binding constraint: {first.bindingConstraint === 'CASH_FLOW' ? 'cash-flow target' : first.bindingConstraint === 'DSCR' ? 'DSCR floor' : 'cap rate target'}
                </Badge>
              </div>
            </Panel>

            <Panel title="What happens after the refinance">
              <Row label="Expected mortgage" value={fmtCAD(first.expectedMortgage)} />
              <Row label="Monthly payment" value={fmtCAD(first.expectedMonthlyPayment)} />
              <Row label="Annual debt service" value={fmtCAD(first.expectedAnnualDebtService)} />
              <Row label="Implied DSCR" value={fmtMultiple(first.impliedDscr)} tone={(first.impliedDscr ?? 0) >= profile.minDscr ? 'pos' : 'neg'} />
              <Row label="Expected refinance proceeds" value={fmtCAD(first.expectedRefinanceProceeds)} strong />
              <Row label="Cash remaining in the property" value={fmtCAD(first.cashRemainingInProperty)} />
              <Row label="Implied cash-on-cash" value={fmtPct(first.impliedCashOnCash)} />
              <Row label="Cash after refinance" value={fmtCAD(first.cashAfterRefinance)} strong />
              <Row label="Budget for property #2" value={fmtCAD(first.budgetForPropertyTwo)} strong tone="pos" />
            </Panel>
          </div>

          <Panel title="Notes">
            <ul className="space-y-2">
              {first.notes.map((n, i) => (
                <li key={i} className="text-xs leading-relaxed text-muted">• {n}</li>
              ))}
            </ul>
          </Panel>
        </>
      )}

      {tab === 'REVERSE' && (
        <>
          <Panel title="Reverse deal finder" subtitle="What must a property look like to meet your goals? Screen listings against this before doing any detailed work.">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <MoneyInput label="Purchase budget" value={budget} onChange={setBudget} />
              <PercentInput label="Target cap rate" value={reverseCap} onChange={setReverseCap} />
              <MoneyInput label="Target cash flow after refinance" value={reverseCf} onChange={setReverseCf} suffix="/mo" />
              <PercentInput label="Property tax as share of operating expenses" value={taxShare} onChange={setTaxShare} />
            </div>
          </Panel>

          <SectionGrid cols={4}>
            <Kpi label="Minimum NOI required" value={fmtCAD(reverse.minimumNoi)} emphasis />
            <Kpi label="Minimum monthly gross rent" value={fmtCAD(reverse.minimumMonthlyGrossRent)} sub={`${fmtCAD(reverse.minimumAnnualGrossRent)}/yr`} emphasis />
            <Kpi label="Maximum operating expenses" value={fmtCAD(reverse.maximumOperatingExpenses)} sub="Per year, everything included" />
            <Kpi label="Maximum property tax" value={fmtCAD(reverse.maximumAnnualPropertyTax)} sub={`${fmtPct(taxShare, 0)} of the expense budget`} />
          </SectionGrid>

          <div className="grid gap-5 lg:grid-cols-2">
            <Panel title="Screening thresholds">
              <Row label="Minimum NOI" value={fmtCAD(reverse.minimumNoi)} strong />
              <Row label="Minimum annual gross rent" value={fmtCAD(reverse.minimumAnnualGrossRent)} />
              <Row label="Minimum monthly gross rent" value={fmtCAD(reverse.minimumMonthlyGrossRent)} strong />
              <Row label="Maximum operating expenses" value={fmtCAD(reverse.maximumOperatingExpenses)} />
              <Row label="Maximum annual property tax" value={fmtCAD(reverse.maximumAnnualPropertyTax)} />
              <Row label="Maximum purchase price" value={fmtCAD(reverse.maximumPurchasePrice)} strong />
              <Row label="Mortgage at this budget" value={fmtCAD(reverse.mortgageAmount)} />
              <Row label="Annual debt service" value={fmtCAD(reverse.annualDebtService)} />
              <Row label="Required DSCR" value={fmtMultiple(reverse.requiredDscr)} />
              <Row label="Implied monthly cash flow" value={fmtCAD(reverse.impliedMonthlyCashFlow)} tone="pos" strong />
              <div className="mt-3">
                <Badge tone="info">
                  Binding constraint: {reverse.bindingConstraint === 'CASH_FLOW' ? 'cash-flow target' : reverse.bindingConstraint === 'DSCR' ? 'DSCR floor' : 'cap rate target'}
                </Badge>
              </div>
            </Panel>

            <Panel title="Rent per unit by building size" subtitle="What each unit must average to hit the required gross rent." dense>
              <TableWrap>
                <thead className="border-b border-line bg-raised">
                  <tr>
                    <th className="th">Units</th>
                    <th className="th text-right">Required rent per unit</th>
                    <th className="th text-right">Required gross monthly</th>
                    <th className="th">Realistic in Ottawa?</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line/60">
                  {reverse.perUnitGuide.map((g) => (
                    <tr key={g.units} className="row-hover">
                      <td className="td">{g.units}</td>
                      <td className="td-num font-medium">{fmtCAD(g.monthlyRentPerUnit)}</td>
                      <td className="td-num text-muted">{fmtCAD(reverse.minimumMonthlyGrossRent)}</td>
                      <td className="td text-2xs text-muted">
                        {g.monthlyRentPerUnit > 2600
                          ? 'Above typical market rent — unlikely without renovation or larger units'
                          : g.monthlyRentPerUnit > 2000
                            ? 'Achievable for renovated 2–3 bed units'
                            : g.monthlyRentPerUnit > 1400
                              ? 'Comfortably within market for 1–2 bed units'
                              : 'Well below market — check the inputs'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </TableWrap>
            </Panel>
          </div>

          <Panel title="How to use this">
            <ul className="space-y-2">
              {reverse.notes.map((n, i) => (
                <li key={i} className="text-xs leading-relaxed text-muted">• {n}</li>
              ))}
            </ul>
          </Panel>
        </>
      )}

      {tab === 'GOAL' && (
        <>
          <Panel title="Portfolio goal seek" subtitle="Several routes to the same income. Deliberately not ranked.">
            <div className="max-w-xs">
              <MoneyInput label="Target monthly portfolio cash flow" value={goalCf} onChange={setGoalCf} suffix="/mo" />
            </div>
          </Panel>

          <div className="grid gap-5 lg:grid-cols-3">
            {goal.strategies.map((s) => (
              <Panel
                key={s.key}
                title={`Strategy ${s.key} — ${s.name}`}
                subtitle={`${s.properties} properties · ${s.estimatedUnits} units`}
                actions={s.capitalSufficient ? <Badge tone="pos">Capital sufficient</Badge> : <Badge tone="warn">Short {fmtCAD(s.capitalGap)}</Badge>}
              >
                <Row label="Number of properties" value={String(s.properties)} strong />
                <Row label="Average purchase price" value={fmtCAD(s.averagePurchasePrice)} />
                <Row
                  label="Required average cap rate"
                  value={fmtPct(s.requiredAverageCapRate)}
                  strong
                  tone={s.requiredAverageCapRate > 0.075 ? 'neg' : s.requiredAverageCapRate > 0.065 ? undefined : 'pos'}
                />
                <Row label="Required NOI per property" value={fmtCAD(s.requiredAverageNoi)} />
                <Row label="Required monthly gross rent" value={fmtCAD(s.requiredAverageMonthlyGrossRent)} />
                <Row label="Cash flow per property" value={fmtCAD(s.requiredAveragePerPropertyCashFlow)} />
                <Row label="Total portfolio value" value={fmtCAD(s.totalPortfolioValue)} />
                <Row label="Total debt" value={fmtCAD(s.totalDebt)} />
                <Row label="Required equity" value={fmtCAD(s.requiredEquity)} />
                <Row label="Expected monthly cash flow" value={fmtCAD(s.expectedMonthlyCashFlow)} strong tone="pos" />
                <Row label="Portfolio DSCR" value={fmtMultiple(s.portfolioDscr)} />

                <div className="mt-3 border-t border-line pt-3">
                  <div className="label mb-1.5">Trade-offs</div>
                  <ul className="space-y-1">
                    {s.tradeOffs.map((t, i) => (
                      <li key={i} className="text-2xs leading-relaxed text-muted">• {t}</li>
                    ))}
                  </ul>
                </div>
              </Panel>
            ))}
          </div>

          <Callout tone="info" title="No universal best">
            {goal.note} In Ottawa specifically: the {fmtPct(goal.strategies[0].requiredAverageCapRate, 2)} cap rate
            Strategy A demands will usually mean older stock in Vanier or Overbrook, with the capital
            risk that implies. Strategy C's {fmtPct(goal.strategies[2].requiredAverageCapRate, 2)} opens up
            newer buildings in Nepean or Orléans but needs more capital and more time.
          </Callout>
        </>
      )}
    </div>
  )
}

function Row({
  label,
  value,
  tone,
  strong,
}: {
  label: string
  value: string
  tone?: 'pos' | 'neg'
  strong?: boolean
}) {
  return (
    <div className={cx('flex items-baseline justify-between gap-3 border-b border-line/50 py-1.5 last:border-0', strong && 'font-semibold')}>
      <span className="text-xs text-muted">{label}</span>
      <span className={cx('num text-sm', tone === 'neg' && 'text-neg', tone === 'pos' && 'text-pos')}>{value}</span>
    </div>
  )
}
