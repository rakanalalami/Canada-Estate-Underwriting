import { useState } from 'react'
import type { Deal } from '@/engine/types'
import type { UnderwriteResult } from '@/engine/underwrite'
import { useDealEdit } from '@/lib/dealEdit'
import {
  Badge,
  Callout,
  Kpi,
  Panel,
  PercentInput,
  Segmented,
  TableWrap,
  cx,
} from '@/components/ui/primitives'
import { Note, SectionGrid } from '@/components/shared'
import { fmtCAD, fmtMultiple, fmtPct } from '@/engine/money'
import { ProjectionChart } from '@/components/charts/lazy'
import type { SaleScenario } from '@/engine/projection'

export default function ProjectionPage({ deal, r }: { deal: Deal; r: UnderwriteResult }) {
  const edit = useDealEdit(deal.id)
  const [horizon, setHorizon] = useState<'5' | '10'>('5')
  const p = horizon === '5' ? r.projection : r.projectionTenYear
  const last = p.years[p.years.length - 1]

  return (
    <div className="space-y-5">
      <Panel title="Assumptions" subtitle="Every projection line is driven by these. All editable, none hidden.">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <PercentInput label="Annual rent growth" value={deal.projection.annualRentGrowth} onChange={(v) => edit.projection({ annualRentGrowth: v })} />
          <PercentInput label="Annual expense inflation" value={deal.projection.annualExpenseInflation} onChange={(v) => edit.projection({ annualExpenseInflation: v })} hint="Usually outpaces rent growth under rent control." />
          <PercentInput label="Annual appreciation" value={deal.projection.annualAppreciation} onChange={(v) => edit.projection({ annualAppreciation: v })} hint="An assumption, never a fact." />
          <PercentInput label="Projection vacancy" value={deal.projection.projectionVacancy} onChange={(v) => edit.projection({ projectionVacancy: v })} />
          <PercentInput label="Exit cap rate" value={deal.projection.exitCapRate} onChange={(v) => edit.projection({ exitCapRate: v })} hint="Used for the income-based sale scenario." />
          <PercentInput label="Selling costs" value={deal.projection.sellingCostsPercent} onChange={(v) => edit.projection({ sellingCostsPercent: v })} hint="Agent commission, legal, adjustments." />
        </div>
      </Panel>

      {/* §16 appreciation ladder, kept visibly separate */}
      <Panel
        title="Value forecast"
        subtitle="Appreciation only. This section says nothing about whether the property pays for itself."
        dense
      >
        <TableWrap>
          <thead className="border-b border-line bg-raised">
            <tr>
              <th className="th">Annual appreciation</th>
              <th className="th text-right">1 year</th>
              <th className="th text-right">3 years</th>
              <th className="th text-right">5 years</th>
              <th className="th text-right">10 years</th>
              <th className="th text-right">10-year gain</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line/60">
            {r.appreciation.map((row) => (
              <tr
                key={row.rate}
                className={cx('row-hover', Math.abs(row.rate - deal.projection.annualAppreciation) < 1e-9 && 'bg-accent/5 font-medium')}
              >
                <td className="td">
                  {fmtPct(row.rate, 0)}
                  {Math.abs(row.rate - deal.projection.annualAppreciation) < 1e-9 && <Badge tone="info">selected</Badge>}
                </td>
                {row.values.map((v) => (
                  <td key={v.year} className="td-num">
                    {fmtCAD(v.value)}
                  </td>
                ))}
                <td className="td-num text-muted">{fmtCAD(row.values[3].value - r.price)}</td>
              </tr>
            ))}
          </tbody>
        </TableWrap>
        <div className="border-t border-line px-4 py-3">
          <Callout tone="warn" compact>
            Appreciation is kept out of NOI, cap rate, cash flow and DSCR everywhere in this tool.
            A property that only works at 4% appreciation is a bet on the market, not an income
            investment — the Total return panel on the Cash flow page shows exactly how much of the
            return is real cash.
          </Callout>
        </div>
      </Panel>

      <Panel
        title={`${horizon}-year projection`}
        subtitle="Operating performance and balance sheet, reported side by side but never mixed."
        actions={
          <Segmented
            value={horizon}
            onChange={setHorizon}
            options={[
              { value: '5', label: '5 years' },
              { value: '10', label: '10 years' },
            ]}
          />
        }
      >
        <ProjectionChart years={p.years} />
      </Panel>

      <Panel title="Year by year" dense>
        <TableWrap>
          <thead className="border-b border-line bg-raised">
            <tr>
              <th className="th">Year</th>
              <th className="th text-right">Gross income</th>
              <th className="th text-right">Vacancy</th>
              <th className="th text-right">Expenses</th>
              <th className="th text-right">NOI</th>
              <th className="th text-right">Debt service</th>
              <th className="th text-right">Cash flow</th>
              <th className="th text-right">DSCR</th>
              <th className="th text-right">Principal repaid</th>
              <th className="th text-right">Mortgage balance</th>
              <th className="th text-right">Property value</th>
              <th className="th text-right">Equity</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line/60">
            {p.years.map((y) => (
              <tr key={y.year} className="row-hover">
                <td className="td font-medium">
                  {y.year}
                  {y.capitalEvent > 0 && <Badge tone="info">refi</Badge>}
                </td>
                <td className="td-num">{fmtCAD(y.grossIncome)}</td>
                <td className="td-num text-muted">({fmtCAD(y.vacancyLoss)})</td>
                <td className="td-num text-muted">({fmtCAD(y.operatingExpenses)})</td>
                <td className="td-num font-medium">{fmtCAD(y.noi)}</td>
                <td className="td-num text-muted">({fmtCAD(y.debtService)})</td>
                <td className={cx('td-num font-medium', y.cashFlow < 0 && 'text-neg')}>{fmtCAD(y.cashFlow)}</td>
                <td className="td-num">{fmtMultiple(y.dscr)}</td>
                <td className="td-num text-info">{fmtCAD(y.principalRepaid)}</td>
                <td className="td-num">{fmtCAD(y.mortgageBalance)}</td>
                <td className="td-num text-muted">{fmtCAD(y.propertyValue)}</td>
                <td className="td-num font-medium">{fmtCAD(y.equity)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot className="border-t-2 border-line bg-raised font-semibold">
            <tr>
              <td className="td">Total</td>
              <td className="td" colSpan={5} />
              <td className="td-num">{fmtCAD(p.totalCashFlow)}</td>
              <td className="td" />
              <td className="td-num text-info">{fmtCAD(p.totalPrincipalRepaid)}</td>
              <td className="td" colSpan={2} />
              <td className="td-num">{fmtCAD(last?.equity ?? 0)}</td>
            </tr>
          </tfoot>
        </TableWrap>
        {p.years.some((y) => y.capitalEvent > 0) && (
          <div className="border-t border-line px-4 py-3">
            <Note>
              The refinance in year {p.years.find((y) => y.capitalEvent > 0)!.year} releases{' '}
              {fmtCAD(p.years.find((y) => y.capitalEvent > 0)!.capitalEvent)}. That is a capital event,
              not cash flow — it appears in the IRR calculation below but never in the cash-flow
              column.
            </Note>
          </div>
        )}
      </Panel>

      <div className="grid gap-5 lg:grid-cols-2">
        <SaleScenarioPanel
          title="Sale at the assumed appreciation"
          scenario={p.saleAtAppreciation}
          initialCash={p.initialCashInvested}
          years={p.years.length}
        />
        {p.saleAtExitCap ? (
          <SaleScenarioPanel
            title="Sale at the exit cap rate"
            scenario={p.saleAtExitCap}
            initialCash={p.initialCashInvested}
            years={p.years.length}
          />
        ) : (
          <Panel title="Sale at the exit cap rate">
            <Note>Set an exit cap rate above to model an income-based sale value.</Note>
          </Panel>
        )}
      </div>

      <Panel title="Where the return comes from">
        <SectionGrid cols={3}>
          <Kpi label="Cumulative cash flow" value={fmtCAD(p.totalCashFlow)} sub="Spendable cash over the hold" tone="pos" />
          <Kpi label="Principal repaid" value={fmtCAD(p.totalPrincipalRepaid)} sub="Equity build — not spendable" tone="info" />
          <Kpi label="Appreciation" value={fmtCAD(p.totalAppreciation)} sub={`At ${fmtPct(deal.projection.annualAppreciation, 1)} per year — an assumption`} tone="muted" />
        </SectionGrid>
        <div className="mt-4">
          <Note>
            Of the {fmtCAD(p.totalCashFlow + p.totalPrincipalRepaid + p.totalAppreciation)} of total
            wealth created over {p.years.length} years,{' '}
            <strong className="text-ink">
              {fmtPct(
                (p.totalCashFlow) /
                  Math.max(1, p.totalCashFlow + p.totalPrincipalRepaid + p.totalAppreciation),
              )}{' '}
              is actual cash
            </strong>
            . The rest only becomes spendable if you sell or refinance again.
          </Note>
        </div>
      </Panel>
    </div>
  )
}

function SaleScenarioPanel({
  title,
  scenario,
  initialCash,
  years,
}: {
  title: string
  scenario: SaleScenario
  initialCash: number
  years: number
}) {
  return (
    <Panel title={title} subtitle={scenario.label}>
      <div className="space-y-1">
        <Row label="Future property value" value={fmtCAD(scenario.futureValue)} />
        <Row label="Selling costs" value={`(${fmtCAD(scenario.sellingCosts)})`} tone="neg" />
        <Row label="Mortgage repayment" value={`(${fmtCAD(scenario.mortgageRepayment)})`} tone="neg" />
        <Row label="Net sale proceeds" value={fmtCAD(scenario.netSaleProceeds)} strong />
        <Row label="Cash flow collected over the hold" value={fmtCAD(scenario.totalCashFlowCollected)} />
        {scenario.capitalReleasedBeforeSale > 0 && (
          <Row label="Capital released at refinance" value={fmtCAD(scenario.capitalReleasedBeforeSale)} />
        )}
        <Row label="Initial cash invested" value={`(${fmtCAD(initialCash)})`} tone="neg" />
        <Row label="Total profit" value={fmtCAD(scenario.totalProfit)} strong />
      </div>
      <div className="mt-4 grid grid-cols-2 gap-3">
        <div className="rounded-md border border-line bg-raised p-3">
          <div className="label">IRR</div>
          <div className="num mt-1 text-xl font-semibold">{fmtPct(scenario.irr)}</div>
          <Note>Over {years} years, including the sale</Note>
        </div>
        <div className="rounded-md border border-line bg-raised p-3">
          <div className="label">Equity multiple</div>
          <div className="num mt-1 text-xl font-semibold">{fmtMultiple(scenario.equityMultiple)}</div>
          <Note>Total returned ÷ total invested</Note>
        </div>
      </div>
    </Panel>
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
  tone?: 'neg' | 'pos'
  strong?: boolean
}) {
  return (
    <div className={cx('flex items-baseline justify-between gap-3 border-b border-line/50 py-1.5 last:border-0', strong && 'font-semibold')}>
      <span className="text-xs text-muted">{label}</span>
      <span className={cx('num text-sm', tone === 'neg' && 'text-neg', tone === 'pos' && 'text-pos')}>{value}</span>
    </div>
  )
}
