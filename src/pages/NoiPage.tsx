import type { Deal, ScenarioKey } from '@/engine/types'
import type { UnderwriteResult } from '@/engine/underwrite'
import { useDealEdit } from '@/lib/dealEdit'
import {
  Badge,
  Callout,
  Collapsible,
  Kpi,
  Panel,
  PercentInput,
  Select,
  TableWrap,
  Toggle,
  TraceTable,
  cx,
} from '@/components/ui/primitives'
import { Note, SectionGrid } from '@/components/shared'
import { fmtCAD, fmtNumber, fmtPct } from '@/engine/money'
import { CAP_RATE_HIGH_WARNING, capRateBand } from '@/engine/metrics'
import { SCENARIO_DESCRIPTIONS, SCENARIO_LABELS } from '@/engine/underwrite'

const SCENARIOS: ScenarioKey[] = ['CONSERVATIVE', 'STABILIZED', 'OPTIMISTIC']

export default function NoiPage({ deal, r }: { deal: Deal; r: UnderwriteResult }) {
  const edit = useDealEdit(deal.id)
  const s = r.scenarios.STABILIZED
  const capB = capRateBand(s.capRateOnOffer)

  return (
    <div className="space-y-5">
      <SectionGrid cols={4}>
        <Kpi label="Current NOI" value={fmtCAD(r.scenarios.CONSERVATIVE.noi.noi)} sub="Conservative scenario" trace={r.scenarios.CONSERVATIVE.noi.steps} />
        <Kpi label="Stabilized NOI" value={fmtCAD(s.noi.noi)} sub="Base scenario" trace={s.noi.steps} emphasis />
        <Kpi label="NOI per unit" value={fmtCAD(s.noi.noiPerUnit)} sub={`${deal.units.length} units`} />
        <Kpi label="NOI per square foot" value={s.noi.noiPerSqFt ? fmtCAD(s.noi.noiPerSqFt, 2) : '—'} sub={`${fmtNumber(deal.info.buildingSizeSqFt)} sq ft`} />
      </SectionGrid>

      <Panel title="NOI waterfall" subtitle="The same arithmetic runs in every scenario, export and matrix in this app." dense>
        <div className="grid gap-0 lg:grid-cols-3 lg:divide-x lg:divide-line">
          {SCENARIOS.map((key) => (
            <div key={key} className="p-4">
              <div className="mb-2 flex items-center justify-between">
                <h4 className="text-sm font-semibold">{SCENARIO_LABELS[key]}</h4>
                {key === 'OPTIMISTIC' && <Badge tone="warn">Never the default</Badge>}
              </div>
              <p className="mb-3 text-2xs leading-relaxed text-subtle">{SCENARIO_DESCRIPTIONS[key]}</p>
              <TraceTable steps={r.scenarios[key].noi.steps} />
            </div>
          ))}
        </div>
        <div className="border-t border-line px-4 py-3">
          <Callout tone="info" compact>
            Mortgage payments, income taxes and capital appreciation are excluded from NOI by
            definition. The NOI module in this codebase has no access to the financing model at all —
            it is structurally impossible for debt service to leak into these figures.
          </Callout>
        </div>
      </Panel>

      <Panel
        title="Cap rate"
        subtitle="Reported on both the asking price and your proposed offer, for each scenario."
        dense
      >
        <TableWrap>
          <thead className="border-b border-line bg-raised">
            <tr>
              <th className="th">Scenario</th>
              <th className="th text-right">NOI</th>
              <th className="th text-right">Cap on asking ({fmtCAD(r.askingPrice)})</th>
              <th className="th text-right">Cap on offer ({fmtCAD(r.price)})</th>
              <th className="th text-right">Cap excl. CapEx reserve</th>
              <th className="th">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line/60">
            {SCENARIOS.map((key) => {
              const sc = r.scenarios[key]
              const band = capRateBand(sc.capRateOnOffer)
              return (
                <tr key={key} className={cx('row-hover', key === 'STABILIZED' && 'bg-accent/5')}>
                  <td className="td font-medium">{SCENARIO_LABELS[key]}</td>
                  <td className="td-num">{fmtCAD(sc.noi.noi)}</td>
                  <td className="td-num">{fmtPct(sc.capRateOnAsking)}</td>
                  <td className="td-num font-semibold">{fmtPct(sc.capRateOnOffer)}</td>
                  <td className="td-num text-muted">{fmtPct(sc.capRateExCapexReserve)}</td>
                  <td className="td">
                    <Badge tone={band.tone}>{band.label}</Badge>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </TableWrap>

        <div className="space-y-3 border-t border-line px-4 py-3">
          <div className="grid gap-2 sm:grid-cols-5">
            <CapBand range="Below 5%" label="Low yield" tone="neg" active={(s.capRateOnOffer ?? 0) < 0.05} />
            <CapBand range="5 – 6%" label="Moderate" tone="warn" active={(s.capRateOnOffer ?? 0) >= 0.05 && (s.capRateOnOffer ?? 0) < 0.06} />
            <CapBand range="6 – 6.5%" label="Attractive, area-dependent" tone="info" active={(s.capRateOnOffer ?? 0) >= 0.06 && (s.capRateOnOffer ?? 0) < 0.065} />
            <CapBand range="6.5 – 7%" label="Strong target" tone="pos" active={(s.capRateOnOffer ?? 0) >= 0.065 && (s.capRateOnOffer ?? 0) < 0.07} />
            <CapBand range="7%+" label="High — investigate" tone="warn" active={(s.capRateOnOffer ?? 0) >= 0.07} />
          </div>
          {(s.capRateOnOffer ?? 0) >= 0.07 && (
            <Callout tone="warn" title="High cap rate">
              {CAP_RATE_HIGH_WARNING} A high yield is a question to answer, not a conclusion — check
              the CapEx forecast, the legal unit count and the landlord-paid utilities before
              treating it as a win.
            </Callout>
          )}
          {capB.note && (s.capRateOnOffer ?? 0) < 0.07 && <Note>{capB.note}</Note>}
        </div>
      </Panel>

      <Collapsible
        title="Scenario tuning"
        subtitle="How each scenario differs. The conservative case can never be made to mark tenants to market."
        defaultOpen={false}
      >
        <div className="grid gap-5 lg:grid-cols-3">
          {SCENARIOS.map((key) => {
            const tuningKey = key === 'CONSERVATIVE' ? 'conservative' : key === 'STABILIZED' ? 'stabilized' : 'optimistic'
            const t = deal.scenarios[tuningKey]
            return (
              <div key={key} className="space-y-3 rounded-md border border-line p-3">
                <h4 className="text-sm font-semibold">{SCENARIO_LABELS[key]}</h4>
                <PercentInput
                  label="Rent factor"
                  value={t.rentFactor - 1}
                  onChange={(v) => edit.scenarios({ [tuningKey]: { ...t, rentFactor: 1 + v } } as never)}
                  hint="Applied on top of the scenario's rent basis."
                />
                <PercentInput
                  label="Vacancy"
                  value={t.vacancyPercent}
                  onChange={(v) => edit.scenarios({ [tuningKey]: { ...t, vacancyPercent: v } } as never)}
                />
                <PercentInput
                  label="Expense factor"
                  value={t.expenseFactor - 1}
                  onChange={(v) => edit.scenarios({ [tuningKey]: { ...t, expenseFactor: 1 + v } } as never)}
                />
                <Select
                  label="Vacant units priced at"
                  value={t.vacantUnitRentBasis}
                  onChange={(v) => edit.scenarios({ [tuningKey]: { ...t, vacantUnitRentBasis: v } } as never)}
                  options={[
                    { value: 'CONSERVATIVE', label: 'Conservative comp rent (25th percentile)' },
                    { value: 'MARKET', label: 'Market rent as entered' },
                    { value: 'CURRENT', label: 'Current rent (usually zero)' },
                  ]}
                />
                <Toggle
                  checked={key === 'CONSERVATIVE' ? false : t.markOccupiedToMarket}
                  disabled={key === 'CONSERVATIVE'}
                  onChange={(v) => edit.scenarios({ [tuningKey]: { ...t, markOccupiedToMarket: v } } as never)}
                  label="Mark occupied units to market"
                  hint={
                    key === 'CONSERVATIVE'
                      ? 'Locked off. The conservative case never assumes a sitting tenant can be moved to market rent.'
                      : 'Ontario rent control caps increases for sitting tenants at the annual guideline.'
                  }
                />
                {r.scenarios[key].warnings.map((w, i) => (
                  <Callout key={i} tone="warn" compact>
                    {w}
                  </Callout>
                ))}
              </div>
            )
          })}
        </div>
      </Collapsible>

      <Panel title="Operating expense detail — stabilized" dense>
        <TableWrap>
          <thead className="border-b border-line bg-raised">
            <tr>
              <th className="th">Line</th>
              <th className="th">Basis</th>
              <th className="th text-right">Annual</th>
              <th className="th text-right">Monthly</th>
              <th className="th text-right">Per unit</th>
              <th className="th text-right">% of EGI</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line/60">
            {s.noi.expenses.lines
              .filter((l) => l.annual > 0)
              .sort((a, b) => b.annual - a.annual)
              .map((l) => (
                <tr key={l.key} className="row-hover">
                  <td className="td">
                    {l.label}
                    {l.isActual && <Badge tone="pos">actual</Badge>}
                    {l.estimatedFallback && <Badge tone="warn">est.</Badge>}
                  </td>
                  <td className="td text-xs text-muted">
                    {l.mode === 'PERCENT' && l.basis
                      ? `${fmtPct(l.percent ?? 0)} of ${l.basis.replace(/_/g, ' ').toLowerCase()}`
                      : 'Fixed amount'}
                  </td>
                  <td className="td-num">{fmtCAD(l.annual)}</td>
                  <td className="td-num text-muted">{fmtCAD(l.monthly)}</td>
                  <td className="td-num text-muted">{fmtCAD(deal.units.length ? l.annual / deal.units.length : null)}</td>
                  <td className="td-num text-muted">
                    {fmtPct(s.noi.effectiveGrossIncome > 0 ? l.annual / s.noi.effectiveGrossIncome : null, 1)}
                  </td>
                </tr>
              ))}
          </tbody>
          <tfoot className="border-t-2 border-line bg-raised font-semibold">
            <tr>
              <td className="td" colSpan={2}>Total</td>
              <td className="td-num">{fmtCAD(s.noi.operatingExpenses)}</td>
              <td className="td-num">{fmtCAD(s.noi.operatingExpenses / 12)}</td>
              <td className="td-num">{fmtCAD(s.noi.expenses.perUnitAnnual)}</td>
              <td className="td-num">{fmtPct(s.noi.expenseRatio, 1)}</td>
            </tr>
          </tfoot>
        </TableWrap>
      </Panel>
    </div>
  )
}

function CapBand({
  range,
  label,
  tone,
  active,
}: {
  range: string
  label: string
  tone: 'pos' | 'warn' | 'neg' | 'info'
  active: boolean
}) {
  return (
    <div
      className={cx(
        'rounded-md border p-2.5 transition-colors',
        active
          ? tone === 'pos'
            ? 'border-pos bg-pos/10'
            : tone === 'warn'
              ? 'border-warn bg-warn/10'
              : tone === 'neg'
                ? 'border-neg bg-neg/10'
                : 'border-info bg-info/10'
          : 'border-line',
      )}
    >
      <div className={cx('num text-xs font-semibold', active && 'text-ink')}>{range}</div>
      <div className="mt-0.5 text-2xs leading-tight text-muted">{label}</div>
    </div>
  )
}
