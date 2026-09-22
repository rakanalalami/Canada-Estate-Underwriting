import type { Deal } from '@/engine/types'
import type { UnderwriteResult } from '@/engine/underwrite'
import { useDealEdit } from '@/lib/dealEdit'
import {
  Badge,
  Callout,
  Kpi,
  NumberInput,
  Panel,
  PercentInput,
  Progress,
  Segmented,
  TableWrap,
  Toggle,
  cx,
  toneText,
} from '@/components/ui/primitives'
import { Note, PassBadge, SectionGrid } from '@/components/shared'
import { fmtCAD, fmtPct } from '@/engine/money'

export default function RiskPage({ deal, r }: { deal: Deal; r: UnderwriteResult }) {
  const edit = useDealEdit(deal.id)

  return (
    <div className="space-y-5">
      {/* §28 Deal breakers first */}
      <Panel
        title="Red flags"
        subtitle={
          r.dealBreakers.hits.length === 0
            ? 'Nothing is currently firing against your configured rules.'
            : `${r.dealBreakers.redCount} red, ${r.dealBreakers.amberCount} caution.`
        }
      >
        {r.dealBreakers.hits.length === 0 ? (
          <Callout tone="pos" compact>
            No configured red flags are firing. That is not the same as the deal being sound — it
            means none of these specific tests failed.
          </Callout>
        ) : (
          <div className="grid gap-2 md:grid-cols-2">
            {r.dealBreakers.hits.map((h) => (
              <Callout key={h.key} tone={h.severity === 'RED' ? 'neg' : 'warn'} title={h.message}>
                {h.detail}
              </Callout>
            ))}
          </div>
        )}
      </Panel>

      {/* §23 Requirements */}
      <Panel title="Investor requirements" subtitle={r.scorecard.summary} dense>
        <TableWrap>
          <thead className="border-b border-line bg-raised">
            <tr>
              <th className="th">Requirement</th>
              <th className="th text-right">Your target</th>
              <th className="th text-right">This deal</th>
              <th className="th text-center">Result</th>
              <th className="th">Note</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line/60">
            {r.scorecard.requirements.map((req) => (
              <tr key={req.key} className="row-hover">
                <td className="td font-medium">{req.label}</td>
                <td className="td-num text-muted">{req.requirement}</td>
                <td className="td-num font-semibold">{req.actual}</td>
                <td className="td text-center"><PassBadge result={req.result} /></td>
                <td className="td text-2xs text-muted">{req.note}</td>
              </tr>
            ))}
          </tbody>
        </TableWrap>
      </Panel>

      {/* §23 Scorecard */}
      <Panel
        title="Scorecard"
        subtitle="Twelve independent dimensions. Deliberately not combined into a single number."
      >
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {r.scorecard.dimensions.map((d) => (
            <div key={d.key} className="rounded-md border border-line p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="text-xs font-semibold">{d.label}</div>
                  {d.headline && <div className="mt-0.5 num text-2xs text-muted">{d.headline}</div>}
                </div>
                <Badge tone={d.tone}>{d.grade}</Badge>
              </div>
              <div className="mt-2">
                <Progress value={d.score / 100} tone={d.tone} height="h-1.5" />
              </div>
              <p className="mt-2 text-2xs leading-relaxed text-subtle">{d.detail}</p>
              {d.subjective && (
                <div className="mt-1.5">
                  <span className="text-2xs italic text-subtle">Your judgement, not a calculation</span>
                </div>
              )}
            </div>
          ))}
        </div>
        <div className="mt-4">
          <Callout tone="info" compact>
            There is no overall score here on purpose. A property with a strong cap rate and a HIGH
            CapEx risk is a different proposition from one with a moderate cap rate and a new roof —
            averaging them into one number destroys exactly the information you need.
          </Callout>
        </div>
      </Panel>

      {/* §20 CapEx */}
      <SectionGrid cols={4}>
        <Kpi label="Within 1 year" value={fmtCAD(r.capex.withinOneYear)} tone={r.capex.withinOneYear > 0 ? 'warn' : 'pos'} />
        <Kpi label="Within 3 years" value={fmtCAD(r.capex.withinThreeYears)} />
        <Kpi label="Within 5 years" value={fmtCAD(r.capex.withinFiveYears)} />
        <Kpi
          label="Within 10 years"
          value={fmtCAD(r.capex.totalTenYear)}
          sub={`${fmtPct(r.capex.capexToPriceRatio, 1)} of price · ${fmtCAD(r.capex.perUnitTenYear)}/unit`}
          tone={r.capex.riskLevel === 'LOW' ? 'pos' : r.capex.riskLevel === 'MODERATE' ? 'warn' : 'neg'}
          band={`${r.capex.riskLevel} risk`}
          emphasis
        />
      </SectionGrid>

      <Panel title="Capital expenditure forecast" subtitle="Driven by the component ages and conditions on the Property page." dense>
        <div className="p-4">
          <div className="mb-2 flex items-center justify-between">
            <span className="label">CapEx risk score</span>
            <span className={cx('num text-sm font-semibold', toneText[r.capex.riskLevel === 'LOW' ? 'pos' : r.capex.riskLevel === 'MODERATE' ? 'warn' : 'neg'])}>
              {Math.round(r.capex.score)} / 100 — {r.capex.riskLevel}
            </span>
          </div>
          <Progress
            value={r.capex.score / 100}
            tone={r.capex.riskLevel === 'LOW' ? 'pos' : r.capex.riskLevel === 'MODERATE' ? 'warn' : 'neg'}
          />
          {r.capex.drivers.length > 0 && (
            <ul className="mt-3 space-y-1">
              {r.capex.drivers.map((d, i) => (
                <li key={i} className="text-2xs text-muted">• {d}</li>
              ))}
            </ul>
          )}
        </div>

        <TableWrap>
          <thead className="border-b border-t border-line bg-raised">
            <tr>
              <th className="th">Component</th>
              <th className="th w-20 text-right">Age</th>
              <th className="th w-24 text-right">Typical life</th>
              <th className="th w-24 text-right">Remaining</th>
              <th className="th w-24">Condition</th>
              <th className="th w-28 text-right">Estimated cost</th>
              <th className="th w-28">Basis</th>
              <th className="th w-24 text-center">Due within</th>
              <th className="th">Note</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line/60">
            {r.capex.items
              .filter((i) => i.included || i.estimatedCost > 0)
              .sort((a, b) => (a.horizon ?? 99) - (b.horizon ?? 99))
              .map((i) => (
                <tr key={i.key} className={cx('row-hover', i.horizon === 1 && 'bg-warn/5')}>
                  <td className="td">
                    {i.label}
                    {i.hazard && <Badge tone="warn">hazard</Badge>}
                  </td>
                  <td className="td-num text-muted">{i.ageYears ?? '—'}</td>
                  <td className="td-num text-muted">{i.usefulLifeYears ?? '—'}</td>
                  <td className={cx('td-num', i.remainingLifeYears !== null && i.remainingLifeYears <= 3 && 'text-warn font-medium')}>
                    {i.remainingLifeYears ?? '—'}
                  </td>
                  <td className="td">
                    <Badge tone={i.condition === 'GOOD' ? 'pos' : i.condition === 'FAIR' ? 'warn' : i.condition === 'POOR' ? 'neg' : 'muted'}>
                      {i.condition}
                    </Badge>
                  </td>
                  <td className="td-num">
                    {fmtCAD(i.estimatedCost)}
                    {i.usesDefaultCost && <div className="text-2xs text-subtle">editable default</div>}
                  </td>
                  <td className="td">
                    {i.basis === 'CONDITION' && <Badge tone="info">Condition</Badge>}
                    {i.basis === 'AGE' && <Badge tone="info">Age</Badge>}
                    {i.basis === 'UNKNOWN' && <Badge tone="warn">Assumed</Badge>}
                    {i.basis === null && <span className="text-2xs text-subtle">—</span>}
                  </td>
                  <td className="td text-center">
                    {i.horizon ? <Badge tone={i.horizon <= 1 ? 'neg' : i.horizon <= 3 ? 'warn' : 'muted'}>{i.horizon} yr</Badge> : <span className="text-2xs text-subtle">—</span>}
                  </td>
                  <td className="td text-2xs text-muted">{i.note}</td>
                </tr>
              ))}
          </tbody>
        </TableWrap>

        <div className="border-t border-line px-4 py-3">
          {r.capex.assumedUnknownTotal > 0 && (
            <div className="mb-3">
              <Callout tone="warn" title="Part of this forecast is a placeholder, not evidence">
                {fmtCAD(r.capex.assumedUnknownTotal)} of the ten-year total covers components with
                neither an age nor a condition recorded, which the model assumes will need replacing
                within ten years. Only {fmtCAD(r.capex.evidencedTenYear)} is backed by something you
                actually recorded. Fill in the ages and conditions on the Property page — or attach an
                inspection report — and this number becomes real.
              </Callout>
            </div>
          )}
          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <div className="label">Implied annual reserve</div>
              <div className="num mt-0.5 text-base font-semibold">{fmtCAD(r.capex.impliedAnnualReserve)}</div>
              <Note>Ten-year forecast ÷ 10</Note>
            </div>
            <div>
              <div className="label">Reserve modelled in NOI</div>
              <div className="num mt-0.5 text-base font-semibold">
                {fmtCAD(r.scenarios.STABILIZED.noi.expenses.capexReserveAnnual)}
              </div>
              <Note>{fmtPct(deal.expenses.lines.find((l) => l.key === 'CAPEX_RESERVE')?.percent ?? 0)} of gross rent</Note>
            </div>
            <div>
              <div className="label">Shortfall</div>
              <div
                className={cx(
                  'num mt-0.5 text-base font-semibold',
                  r.capex.impliedAnnualReserve > r.scenarios.STABILIZED.noi.expenses.capexReserveAnnual ? 'text-warn' : 'text-pos',
                )}
              >
                {fmtCAD(Math.max(0, r.capex.impliedAnnualReserve - r.scenarios.STABILIZED.noi.expenses.capexReserveAnnual))}
              </div>
              <Note>Per year, if the forecast is right</Note>
            </div>
          </div>
          {r.capex.impliedAnnualReserve > r.scenarios.STABILIZED.noi.expenses.capexReserveAnnual * 1.2 && (
            <div className="mt-3">
              <Callout tone="warn" compact>
                The identified capital work needs a bigger annual reserve than the percentage rule is
                providing. Raising the CapEx reserve on the Expenses page will lower NOI and the cap
                rate — which is the honest outcome, not a problem with the model.
              </Callout>
            </div>
          )}
        </div>
      </Panel>

      {/* §21 Legal risk */}
      <Panel title="Legal and zoning risk" subtitle="Edit the underlying compliance items on the Property page.">
        <div className="grid gap-4 lg:grid-cols-3">
          <div>
            <div className="label">Risk level</div>
            <div className={cx('num mt-1 text-xl font-semibold', toneText[r.legal.riskLevel === 'LOW' ? 'pos' : r.legal.riskLevel === 'MODERATE' ? 'warn' : 'neg'])}>
              {r.legal.riskLevel}
            </div>
            <div className="mt-2">
              <Progress value={r.legal.score / 100} tone={r.legal.riskLevel === 'LOW' ? 'pos' : r.legal.riskLevel === 'MODERATE' ? 'warn' : 'neg'} height="h-1.5" />
            </div>
          </div>
          <div>
            <div className="label">Units</div>
            <div className="num mt-1 text-xl font-semibold">
              {r.legal.actualUnits} actual / {r.legal.legalUnits} legal
            </div>
            {r.legal.excessUnits > 0 && <Note>{r.legal.excessUnits} unit(s) beyond the legal count</Note>}
          </div>
          <div>
            <div className="label">Income at risk</div>
            <div className={cx('num mt-1 text-xl font-semibold', r.legal.nonConformingMonthlyIncome > 0 && 'text-neg')}>
              {fmtCAD(r.legal.nonConformingMonthlyIncome)}/mo
            </div>
            <Note>{fmtCAD(r.legal.nonConformingAnnualIncome)} per year</Note>
          </div>
        </div>

        <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {r.legal.items.map((i) => (
            <div key={i.key} className="flex items-center justify-between rounded-md border border-line px-3 py-2">
              <span className="text-xs">{i.label}</span>
              <Badge tone={i.severity === 'OK' ? 'pos' : i.severity === 'AMBER' ? 'warn' : i.severity === 'RED' ? 'neg' : 'muted'}>
                {i.state === 'CONFIRMED' ? 'Confirmed' : i.state === 'UNVERIFIED' ? 'Unverified' : i.state === 'NON_COMPLIANT' ? 'Non-compliant' : 'N/A'}
              </Badge>
            </div>
          ))}
        </div>
      </Panel>

      {/* §28 configuration */}
      <Panel title="Configure your red flags" subtitle="Thresholds are yours to set. Disabled rules never fire." dense>
        <TableWrap>
          <thead className="border-b border-line bg-raised">
            <tr>
              <th className="th w-14 text-center">On</th>
              <th className="th">Rule</th>
              <th className="th w-32 text-center">Severity</th>
              <th className="th w-40 text-right">Threshold</th>
              <th className="th w-24 text-center">Firing</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line/60">
            {deal.dealBreakers.map((rule) => {
              const firing = r.dealBreakers.hits.some((h) => h.key === rule.key)
              return (
                <tr key={rule.key} className={cx('row-hover', !rule.enabled && 'opacity-45')}>
                  <td className="td text-center">
                    <input
                      type="checkbox"
                      checked={rule.enabled}
                      onChange={(e) => edit.dealBreaker(rule.key, { enabled: e.target.checked })}
                      className="h-3.5 w-3.5 rounded border-line text-accent"
                    />
                  </td>
                  <td className="td">{rule.label}</td>
                  <td className="td text-center">
                    <Segmented
                      value={rule.severity}
                      onChange={(v) => edit.dealBreaker(rule.key, { severity: v })}
                      size="sm"
                      options={[
                        { value: 'RED', label: 'Red' },
                        { value: 'AMBER', label: 'Caution' },
                      ]}
                    />
                  </td>
                  <td className="td">
                    <ThresholdInput rule={rule} onChange={(v) => edit.dealBreaker(rule.key, { threshold: v })} />
                  </td>
                  <td className="td text-center">
                    {firing ? <Badge tone={rule.severity === 'RED' ? 'neg' : 'warn'}>Yes</Badge> : <span className="text-2xs text-subtle">—</span>}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </TableWrap>
      </Panel>

      <Panel title="Non-conforming income treatment">
        <Toggle
          checked={deal.legal.includeNonConformingIncomeInConservative}
          onChange={(v) => edit.legal({ includeNonConformingIncomeInConservative: v })}
          label="Include non-conforming unit income in the conservative case"
          hint="Off by default. This is the single most common way a small multifamily underwriting overstates income."
        />
      </Panel>
    </div>
  )
}

const PERCENT_RULES = new Set([
  'CAP_RATE_MIN',
  'LEGACY_LOW_RENTS',
  'LANDLORD_UTILITIES',
  'HIGH_PROPERTY_TAX',
  'EXCESSIVE_RENOVATION',
])
const PLAIN_RULES = new Set(['DSCR_MIN', 'ROOF_IMMINENT'])

function ThresholdInput({
  rule,
  onChange,
}: {
  rule: Deal['dealBreakers'][number]
  onChange: (v: number) => void
}) {
  if (PERCENT_RULES.has(rule.key)) {
    return <PercentInput value={rule.threshold} onChange={onChange} className="w-32" />
  }
  if (PLAIN_RULES.has(rule.key)) {
    return (
      <NumberInput
        value={rule.threshold}
        onChange={onChange}
        decimals={rule.key === 'DSCR_MIN' ? 2 : 0}
        suffix={rule.key === 'ROOF_IMMINENT' ? 'yrs' : 'x'}
        className="w-32"
      />
    )
  }
  return <span className="block text-right text-2xs text-subtle">Boolean rule</span>
}
