import { useStore } from '@/store/useStore'
import { applyStrategy, STRATEGY_PRESETS } from '@/data/defaults'
import { planFirstAcquisition } from '@/engine/reverse'
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
import { Note, SectionGrid } from '@/components/shared'
import { fmtCAD, fmtPct } from '@/engine/money'
import { NEIGHBOURHOOD_EVALUATION_FACTORS, OTTAWA_NEIGHBOURHOODS } from '@/data/ottawa'

export default function SettingsPage() {
  const profile = useStore((s) => s.profile)
  const setProfile = useStore((s) => s.setProfile)
  const resetAll = useStore((s) => s.resetAll)
  const deals = useStore((s) => s.deals)

  const deployable = Math.max(0, profile.startingCapital - profile.minimumCashReserve)
  const possibleAcquisitions =
    profile.maxCapitalPerAcquisition > 0 ? Math.floor(deployable / profile.maxCapitalPerAcquisition) : 0

  const firstDeal = planFirstAcquisition({
    startingCapital: profile.startingCapital,
    maximumCashPurchase: profile.maxCapitalPerAcquisition,
    reserveRequirement: profile.minimumCashReserve,
    targetCapRate: profile.minCapRate,
    targetRefinanceLtv: profile.maxRefinanceLtv,
    targetMonthlyCashFlow: profile.targetMonthlyCashFlow / Math.max(1, profile.maxProperties),
    closingCostPercent: 0.03,
    renovationBudget: 0,
    refinanceRate: 0.0475,
    refinanceAmortizationYears: 25,
    refinanceCosts: 3300,
    vacancyPercent: 0.03,
    operatingExpenseRatio: 0.32,
    minDscr: profile.minDscr,
  })

  return (
    <div className="space-y-5">
      <SectionGrid cols={4}>
        <Kpi label="Starting capital" value={fmtCAD(profile.startingCapital)} emphasis />
        <Kpi label="Maximum deployable capital" value={fmtCAD(deployable)} sub={`After the ${fmtCAD(profile.minimumCashReserve)} reserve`} />
        <Kpi label="Recommended reserve" value={fmtCAD(profile.minimumCashReserve)} sub="Adjusted dynamically in the simulator" />
        <Kpi
          label="Simultaneous cash purchases"
          value={String(possibleAcquisitions)}
          sub={`At ${fmtCAD(profile.maxCapitalPerAcquisition)} each, before any refinancing`}
        />
      </SectionGrid>

      <Panel
        title="Strategy"
        subtitle="Presets set leverage, coverage and reserve together. Every value stays editable afterwards."
      >
        <Segmented
          value={profile.strategy}
          onChange={(v) => setProfile(applyStrategy(profile, v))}
          options={[
            { value: 'CONSERVATIVE', label: 'Conservative' },
            { value: 'BALANCED', label: 'Balanced' },
            { value: 'AGGRESSIVE', label: 'Aggressive' },
            { value: 'CUSTOM', label: 'Custom' },
          ]}
        />

        <div className="mt-4 grid gap-3 lg:grid-cols-3">
          {STRATEGY_PRESETS.map((p) => (
            <div
              key={p.key}
              className={cx(
                'rounded-md border p-3',
                profile.strategy === p.key ? 'border-accent bg-accent/5' : 'border-line',
              )}
            >
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold">{p.name}</span>
                {p.key === 'AGGRESSIVE' && <Badge tone="warn">Higher risk</Badge>}
              </div>
              <p className="mt-1 text-2xs leading-relaxed text-muted">{p.description}</p>
              <dl className="mt-2 space-y-0.5 text-2xs">
                <Item label="Refinance LTV" value={`${(p.refinanceLtvRange[0] * 100).toFixed(0)}–${(p.refinanceLtvRange[1] * 100).toFixed(0)}%`} />
                <Item label="Minimum DSCR" value={`${p.minDscr.toFixed(2)}x`} />
                <Item label="Minimum reserve" value={fmtCAD(p.minimumCashReserve)} />
                <Item label="Appreciation assumed" value={fmtPct(p.annualAppreciation, 0)} />
                <Item label="Rent basis" value={p.rentBasis.toLowerCase()} />
              </dl>
              <p className={cx('mt-2 text-2xs leading-relaxed', p.key === 'AGGRESSIVE' ? 'text-warn' : 'text-subtle')}>
                {p.riskNote}
              </p>
            </div>
          ))}
        </div>
      </Panel>

      <Panel title="Capital" subtitle="What you have and how much of it you are willing to put to work.">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <MoneyInput label="Starting capital" value={profile.startingCapital} onChange={(v) => setProfile({ startingCapital: v })} />
          <MoneyInput label="Minimum cash reserve" value={profile.minimumCashReserve} onChange={(v) => setProfile({ minimumCashReserve: v })} hint="Never deployed into an acquisition." />
          <MoneyInput label="Maximum capital per acquisition" value={profile.maxCapitalPerAcquisition} onChange={(v) => setProfile({ maxCapitalPerAcquisition: v })} />
          <NumberInput label="Maximum properties" value={profile.maxProperties} onChange={(v) => setProfile({ maxProperties: v })} min={1} />
          <MoneyInput label="Maximum renovation budget per property" value={profile.maxRenovationBudget} onChange={(v) => setProfile({ maxRenovationBudget: v })} />
          <NumberInput label="Expected refinance timeline (months)" value={profile.expectedRefinanceMonths} onChange={(v) => setProfile({ expectedRefinanceMonths: v })} min={0} />
        </div>
      </Panel>

      <Panel title="Targets" subtitle="What the portfolio is for.">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <MoneyInput label="Target monthly cash flow" value={profile.targetMonthlyCashFlow} onChange={(v) => setProfile({ targetMonthlyCashFlow: v })} suffix="/mo" />
          <MoneyInput label="Target annual cash flow" value={profile.targetMonthlyCashFlow * 12} onChange={(v) => setProfile({ targetMonthlyCashFlow: v / 12 })} suffix="/yr" />
          <MoneyInput label="Target portfolio value" value={profile.targetPortfolioValue} onChange={(v) => setProfile({ targetPortfolioValue: v })} />
          <NumberInput label="Target units" value={profile.targetUnits} onChange={(v) => setProfile({ targetUnits: v })} min={0} />
          <MoneyInput label="Target equity" value={profile.targetEquity} onChange={(v) => setProfile({ targetEquity: v })} />
        </div>
      </Panel>

      <Panel title="Underwriting floors" subtitle="Used by every scorecard, deal-breaker check and simulator run.">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <PercentInput label="Minimum cap rate" value={profile.minCapRate} onChange={(v) => setProfile({ minCapRate: v })} />
          <NumberInput label="Minimum DSCR" value={profile.minDscr} onChange={(v) => setProfile({ minDscr: v })} decimals={2} suffix="x" />
          <PercentInput label="Maximum refinance LTV" value={profile.maxRefinanceLtv} onChange={(v) => setProfile({ maxRefinanceLtv: v })} />
          <PercentInput label="Maximum portfolio LTV" value={profile.maxPortfolioLtv} onChange={(v) => setProfile({ maxPortfolioLtv: v })} />
          <PercentInput label="Minimum cash-on-cash" value={profile.minCashOnCash} onChange={(v) => setProfile({ minCashOnCash: v })} />
        </div>
      </Panel>

      <Panel title="What this profile implies for property #1" subtitle="Reverse-engineered from the numbers above.">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Kpi label="Maximum purchase price" value={fmtCAD(firstDeal.maxPurchasePrice)} />
          <Kpi label="Minimum NOI required" value={fmtCAD(firstDeal.minimumRequiredNoi)} />
          <Kpi label="Minimum monthly gross rent" value={fmtCAD(firstDeal.minimumRequiredMonthlyGrossRent)} />
          <Kpi label="Budget for property #2" value={fmtCAD(firstDeal.budgetForPropertyTwo)} sub="After refinancing property #1" />
        </div>
        <div className="mt-3">
          <a className="btn btn-xs" href="#/first-deal">Open the first-acquisition planner</a>
        </div>
      </Panel>

      <Panel title="Ottawa search area" subtitle="The neighbourhoods this profile is aimed at. Prestige is not the ranking.">
        <TableWrap>
          <thead className="border-b border-line bg-raised">
            <tr>
              <th className="th">Neighbourhood</th>
              <th className="th">Ward</th>
              <th className="th">Why it is on the list</th>
              <th className="th">Housing stock</th>
              <th className="th">Watch-outs</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line/60">
            {OTTAWA_NEIGHBOURHOODS.map((n) => (
              <tr key={n.name} className="row-hover align-top">
                <td className="td font-medium">
                  {n.name}
                  {!n.focus && <Badge tone="muted">diversification</Badge>}
                </td>
                <td className="td text-2xs text-muted">{n.ward}</td>
                <td className="td max-w-xs text-2xs leading-relaxed text-muted">{n.note}</td>
                <td className="td max-w-xs text-2xs leading-relaxed text-muted">{n.housingStock}</td>
                <td className="td max-w-xs text-2xs leading-relaxed text-warn">{n.watchOuts}</td>
              </tr>
            ))}
          </tbody>
        </TableWrap>
        <div className="border-t border-line px-4 py-3">
          <div className="label mb-2">What the analysis weighs</div>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
            {NEIGHBOURHOOD_EVALUATION_FACTORS.map((f) => (
              <div key={f.key} className="rounded-md border border-line p-2.5">
                <div className="text-2xs font-semibold">{f.label}</div>
                <div className="mt-0.5 text-2xs leading-relaxed text-subtle">{f.detail}</div>
              </div>
            ))}
          </div>
        </div>
      </Panel>

      <Panel title="Data" subtitle="Everything lives in this browser.">
        <Callout tone="info" compact>
          {deals.length} {deals.length === 1 ? 'deal is' : 'deals are'} stored in this browser's local
          storage. Nothing is uploaded anywhere. Clearing site data, using a different browser or a
          private window means starting fresh — export anything you want to keep.
        </Callout>
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            className="btn-danger btn-xs"
            onClick={() => {
              if (
                confirm(
                  'Delete every deal, the simulator setup and your investor profile?\n\nThis cannot be undone. Export anything you want to keep first.',
                )
              ) {
                resetAll()
                location.hash = '#/dashboard'
              }
            }}
          >
            Reset everything
          </button>
        </div>
        <div className="mt-3">
          <Note>
            This is an underwriting tool, not financial, tax, legal or mortgage advice. Verify every
            assumption — rents against leases, taxes against the bill, insurance against a bindable
            quote, and unit legality against the City of Ottawa — before you waive a condition.
          </Note>
        </div>
      </Panel>
    </div>
  )
}

function Item({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-2">
      <dt className="text-subtle">{label}</dt>
      <dd className="num font-medium">{value}</dd>
    </div>
  )
}
