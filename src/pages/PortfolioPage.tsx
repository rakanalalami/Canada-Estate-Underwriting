import { useMemo, useState } from 'react'
import { useStore } from '@/store/useStore'
import { underwrite } from '@/engine/underwrite'
import { buildPortfolio, type PortfolioProperty } from '@/engine/portfolio'
import {
  Badge,
  Callout,
  Kpi,
  MoneyInput,
  Panel,
  Progress,
  TableWrap,
  cx,
} from '@/components/ui/primitives'
import { EmptyState } from '@/components/ui/primitives'
import { Note, SectionGrid } from '@/components/shared'
import { fmtCAD, fmtMultiple, fmtPct } from '@/engine/money'
import { dscrBand, ltvBand } from '@/engine/metrics'

export default function PortfolioPage() {
  const deals = useStore((s) => s.deals)
  const profile = useStore((s) => s.profile)
  const toggleInPortfolio = useStore((s) => s.toggleInPortfolio)
  const [cashReserves, setCashReserves] = useState(profile.minimumCashReserve)

  const owned = deals.filter((d) => d.inPortfolio && !d.archived)

  const properties: PortfolioProperty[] = useMemo(
    () =>
      owned.map((d) => {
        const r = underwrite(d, { profile })
        const isCashRefi = d.financing.structure === 'CASH_THEN_REFINANCE'
        const debt = isCashRefi ? r.refinance.mortgageAmount : r.scenarios.STABILIZED.debt.mortgageAmount
        const ds = isCashRefi ? r.refinance.annualDebtService : r.scenarios.STABILIZED.debt.annualDebtService
        const monthlyCf = isCashRefi
          ? r.refinance.monthlyCashFlow
          : r.scenarios.STABILIZED.cashFlow.monthlyCashFlow
        return {
          id: d.id,
          name: d.name,
          neighbourhood: d.info.neighbourhood || 'Unspecified',
          propertyType: d.info.propertyType,
          tenantType: 'Long-term residential',
          yearBuilt: d.info.yearBuilt,
          units: d.units.length,
          value: isCashRefi ? r.refinance.appraisedValue : r.price,
          originalCashInvested: r.acquisition.capitalInProperty,
          cashRemainingInvested: isCashRefi
            ? r.refinance.cashRemainingInvested
            : r.scenarios.STABILIZED.cashRemainingInvested,
          currentDebt: debt,
          annualGrossRent: r.scenarios.STABILIZED.noi.totalPotentialGrossIncome,
          annualNoi: r.scenarios.STABILIZED.noi.noi,
          annualDebtService: ds,
          monthlyCashFlow: monthlyCf,
          mortgageRate: isCashRefi ? d.refinance.annualRate : d.financing.annualRate,
          mortgageRenewalYear:
            debt > 0
              ? new Date().getFullYear() + (isCashRefi ? d.refinance.termYears : d.financing.termYears)
              : null,
        }
      }),
    [owned, profile],
  )

  const p = buildPortfolio(properties, cashReserves)

  if (owned.length === 0) {
    return (
      <div className="space-y-5">
        <EmptyState
          title="No properties marked as owned"
          action={<a className="btn-primary" href="#/deals">Open all deals</a>}
        >
          Mark a deal as part of your portfolio on the All deals page and it will roll up here — value,
          debt, NOI, cash flow, DSCR and concentration across neighbourhoods, property types, tenant
          profiles and building vintages.
        </EmptyState>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <SectionGrid cols={4}>
        <Kpi label="Total property value" value={fmtCAD(p.totalValue)} sub={`${p.propertyCount} buildings · ${p.totalUnits} units`} emphasis />
        <Kpi label="Total debt" value={fmtCAD(p.totalDebt)} sub={`${fmtPct(p.portfolioLtv)} portfolio LTV`} tone={ltvBand(p.portfolioLtv, profile.maxPortfolioLtv).tone} />
        <Kpi label="Equity" value={fmtCAD(p.totalEquity)} />
        <Kpi label="Cash reserves" value={fmtCAD(p.cashReserves)} tone={p.cashReserves < profile.minimumCashReserve ? 'neg' : 'pos'} sub={`Minimum ${fmtCAD(profile.minimumCashReserve)}`} />
      </SectionGrid>

      <SectionGrid cols={4}>
        <Kpi label="Monthly gross rent" value={fmtCAD(p.monthlyGrossRent)} sub={`${fmtCAD(p.annualGrossRent)}/yr`} />
        <Kpi label="Portfolio NOI" value={fmtCAD(p.annualNoi)} sub={`${fmtCAD(p.monthlyNoi)}/month`} />
        <Kpi label="Total mortgage payments" value={fmtCAD(p.monthlyDebtService)} sub={`${fmtCAD(p.annualDebtService)}/yr`} />
        <Kpi
          label="Monthly cash flow"
          value={fmtCAD(p.monthlyCashFlow)}
          tone={p.monthlyCashFlow >= profile.targetMonthlyCashFlow ? 'pos' : 'warn'}
          sub={`${fmtCAD(p.annualCashFlow)}/yr`}
          emphasis
        />
      </SectionGrid>

      <SectionGrid cols={4}>
        <Kpi label="Portfolio cap rate" value={fmtPct(p.portfolioCapRate)} />
        <Kpi label="Portfolio cash-on-cash" value={fmtPct(p.portfolioCashOnCash)} sub={`On ${fmtCAD(p.totalCashRemainingInvested)} still invested`} />
        <Kpi label="Portfolio DSCR" value={fmtMultiple(p.portfolioDscr)} tone={dscrBand(p.portfolioDscr).tone} band={dscrBand(p.portfolioDscr).label} />
        <Kpi label="Weighted average rate" value={fmtPct(p.weightedAverageRate)} sub="Across all mortgages" />
      </SectionGrid>

      <Panel title="Progress toward your income target">
        <div className="mb-2 flex items-baseline justify-between">
          <span className="num text-xl font-semibold">
            {fmtCAD(p.monthlyCashFlow)} <span className="text-sm font-normal text-muted">of {fmtCAD(profile.targetMonthlyCashFlow)}/month</span>
          </span>
          <span className="num text-sm font-semibold">
            {fmtPct(Math.min(1, p.monthlyCashFlow / Math.max(1, profile.targetMonthlyCashFlow)), 0)}
          </span>
        </div>
        <Progress
          value={p.monthlyCashFlow / Math.max(1, profile.targetMonthlyCashFlow)}
          tone={p.monthlyCashFlow >= profile.targetMonthlyCashFlow ? 'pos' : 'warn'}
          height="h-3"
        />
        <div className="mt-3 max-w-xs">
          <MoneyInput label="Cash reserves on hand" value={cashReserves} onChange={setCashReserves} />
        </div>
      </Panel>

      {p.warnings.length > 0 && (
        <div className="grid gap-2 md:grid-cols-2">
          {p.warnings.map((w, i) => (
            <Callout key={i} tone="warn" compact>{w}</Callout>
          ))}
        </div>
      )}

      <Panel title="Properties" dense>
        <TableWrap>
          <thead className="border-b border-line bg-raised">
            <tr>
              <th className="th">Property</th>
              <th className="th">Neighbourhood</th>
              <th className="th text-right">Units</th>
              <th className="th text-right">Value</th>
              <th className="th text-right">Debt</th>
              <th className="th text-right">Equity</th>
              <th className="th text-right">LTV</th>
              <th className="th text-right">NOI</th>
              <th className="th text-right">Cap</th>
              <th className="th text-right">Debt service</th>
              <th className="th text-right">Cash flow</th>
              <th className="th text-right">DSCR</th>
              <th className="th text-right">Cash invested</th>
              <th className="th text-right">CoC</th>
              <th className="th w-10" />
            </tr>
          </thead>
          <tbody className="divide-y divide-line/60">
            {properties
              .slice()
              .sort((a, b) => b.monthlyCashFlow - a.monthlyCashFlow)
              .map((x) => {
                const dscr = x.annualDebtService > 0 ? x.annualNoi / x.annualDebtService : null
                const coc = x.cashRemainingInvested > 0 ? (x.monthlyCashFlow * 12) / x.cashRemainingInvested : null
                return (
                  <tr key={x.id} className="row-hover">
                    <td className="td font-medium">
                      <a className="hover:text-accent hover:underline" href="#/dashboard" onClick={() => useStore.getState().setActiveDeal(x.id)}>
                        {x.name}
                      </a>
                    </td>
                    <td className="td text-muted">{x.neighbourhood}</td>
                    <td className="td-num">{x.units}</td>
                    <td className="td-num">{fmtCAD(x.value)}</td>
                    <td className="td-num">{fmtCAD(x.currentDebt)}</td>
                    <td className="td-num">{fmtCAD(x.value - x.currentDebt)}</td>
                    <td className="td-num">{fmtPct(x.value > 0 ? x.currentDebt / x.value : null)}</td>
                    <td className="td-num">{fmtCAD(x.annualNoi)}</td>
                    <td className="td-num">{fmtPct(x.value > 0 ? x.annualNoi / x.value : null)}</td>
                    <td className="td-num text-muted">{fmtCAD(x.annualDebtService / 12)}</td>
                    <td className={cx('td-num font-semibold', x.monthlyCashFlow < 0 && 'text-neg')}>{fmtCAD(x.monthlyCashFlow)}</td>
                    <td className={cx('td-num', (dscr ?? 9) < profile.minDscr && 'text-warn')}>{fmtMultiple(dscr)}</td>
                    <td className="td-num">{fmtCAD(x.cashRemainingInvested)}</td>
                    <td className="td-num">{fmtPct(coc)}</td>
                    <td className="td text-right">
                      <button className="btn-ghost btn-xs text-muted" onClick={() => toggleInPortfolio(x.id)} title="Remove from portfolio">×</button>
                    </td>
                  </tr>
                )
              })}
          </tbody>
          <tfoot className="border-t-2 border-line bg-raised font-semibold">
            <tr>
              <td className="td" colSpan={2}>Portfolio</td>
              <td className="td-num">{p.totalUnits}</td>
              <td className="td-num">{fmtCAD(p.totalValue)}</td>
              <td className="td-num">{fmtCAD(p.totalDebt)}</td>
              <td className="td-num">{fmtCAD(p.totalEquity)}</td>
              <td className="td-num">{fmtPct(p.portfolioLtv)}</td>
              <td className="td-num">{fmtCAD(p.annualNoi)}</td>
              <td className="td-num">{fmtPct(p.portfolioCapRate)}</td>
              <td className="td-num">{fmtCAD(p.monthlyDebtService)}</td>
              <td className="td-num">{fmtCAD(p.monthlyCashFlow)}</td>
              <td className="td-num">{fmtMultiple(p.portfolioDscr)}</td>
              <td className="td-num">{fmtCAD(p.totalCashRemainingInvested)}</td>
              <td className="td-num">{fmtPct(p.portfolioCashOnCash)}</td>
              <td className="td" />
            </tr>
          </tfoot>
        </TableWrap>
      </Panel>

      <Panel title="Concentration" subtitle="Where the risk is correlated. Diversification is a stated objective, so it is measured.">
        <div className="grid gap-5 sm:grid-cols-2">
          {p.concentration.map((g) => (
            <div key={g.dimension}>
              <div className="mb-2 flex items-center justify-between">
                <span className="label">{g.label}</span>
                {g.warning && <Badge tone="warn">Concentrated</Badge>}
              </div>
              <div className="space-y-2">
                {g.slices.map((s) => (
                  <div key={s.key}>
                    <div className="mb-1 flex items-baseline justify-between gap-2 text-xs">
                      <span className="truncate">{s.label}</span>
                      <span className="num shrink-0 text-muted">
                        {fmtPct(s.share, 0)} · {s.properties} {s.properties === 1 ? 'property' : 'properties'} · {s.units} units
                      </span>
                    </div>
                    <Progress value={s.share} tone={s.share > 0.5 ? 'warn' : 'info'} height="h-1.5" />
                  </div>
                ))}
              </div>
              {g.warning && (
                <div className="mt-2">
                  <Note>{g.warning}</Note>
                </div>
              )}
            </div>
          ))}
        </div>
      </Panel>

      {p.renewalClusters.length > 0 && (
        <Panel title="Debt maturity schedule" subtitle="Staggering terms avoids repricing the whole portfolio into one rate environment." dense>
          <TableWrap>
            <thead className="border-b border-line bg-raised">
              <tr>
                <th className="th">Renewal year</th>
                <th className="th text-right">Mortgages</th>
                <th className="th text-right">Debt renewing</th>
                <th className="th text-right">Share of portfolio debt</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line/60">
              {p.renewalClusters.map((c) => (
                <tr key={c.year} className={cx('row-hover', c.count >= 2 && 'bg-warn/5')}>
                  <td className="td font-medium">{c.year}</td>
                  <td className="td-num">
                    {c.count}
                    {c.count >= 2 && <Badge tone="warn">clustered</Badge>}
                  </td>
                  <td className="td-num">{fmtCAD(c.debt)}</td>
                  <td className="td-num">{fmtPct(p.totalDebt > 0 ? c.debt / p.totalDebt : null, 0)}</td>
                </tr>
              ))}
            </tbody>
          </TableWrap>
        </Panel>
      )}
    </div>
  )
}
