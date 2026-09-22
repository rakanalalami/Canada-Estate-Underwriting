import type { Deal } from '@/engine/types'
import type { UnderwriteResult } from '@/engine/underwrite'
import { useStore } from '@/store/useStore'
import {
  Badge,
  Callout,
  Kpi,
  Panel,
  TableWrap,
  cx,
  toneText,
} from '@/components/ui/primitives'
import { Note, SectionGrid } from '@/components/shared'
import { fmtCAD, fmtMultiple, fmtPct } from '@/engine/money'
import { breakEvenBand, cashFlowBand, cashOnCashBand, dscrBand } from '@/engine/metrics'
import { computeCashFlow } from '@/engine/cashflow'

export default function CashFlowPage({ deal, r }: { deal: Deal; r: UnderwriteResult }) {
  const profile = useStore((s) => s.profile)
  const isCashRefi = deal.financing.structure === 'CASH_THEN_REFINANCE'
  const s = r.scenarios.STABILIZED

  // Pre-refinance (as bought) and post-refinance (as held) are both real
  // positions for this strategy, so both are reported.
  const preRefi = s.cashFlow
  const postRefi = computeCashFlow({
    noi: s.noi,
    annualDebtService: r.refinance.annualDebtService,
    principalYear1: r.refinance.principalYear1,
    interestYear1: r.refinance.interestYear1,
    cashRemainingInvested: r.refinance.cashRemainingInvested,
  })

  const headline = isCashRefi ? postRefi : preRefi

  return (
    <div className="space-y-5">
      <SectionGrid cols={4}>
        <Kpi
          label="Monthly cash flow"
          value={fmtCAD(headline.monthlyCashFlow)}
          tone={cashFlowBand(headline.monthlyCashFlow).tone}
          band={cashFlowBand(headline.monthlyCashFlow).label}
          sub={isCashRefi ? 'After refinance' : 'Current structure'}
          emphasis
        />
        <Kpi label="Annual pre-tax cash flow" value={fmtCAD(headline.annualPreTaxCashFlow)} />
        <Kpi
          label="DSCR"
          value={fmtMultiple(headline.dscr)}
          tone={dscrBand(headline.dscr).tone}
          band={dscrBand(headline.dscr).label}
          sub={`Your floor: ${profile.minDscr.toFixed(2)}x`}
        />
        <Kpi
          label="Break-even occupancy"
          value={fmtPct(headline.breakEvenOccupancy)}
          tone={breakEvenBand(headline.breakEvenOccupancy).tone}
          band={breakEvenBand(headline.breakEvenOccupancy).label}
        />
      </SectionGrid>

      <div className="grid gap-5 lg:grid-cols-2">
        <Panel title="Monthly" subtitle="What lands in the bank account each month.">
          <FlowRow label="Gross scheduled rent" value={headline.monthlyGrossRent} />
          <FlowRow label="Vacancy and bad debt" value={-(s.noi.vacancyLoss + s.noi.badDebtLoss) / 12} tone="neg" />
          <FlowRow label="Effective gross income" value={headline.monthlyEffectiveIncome} strong />
          <FlowRow label="Operating expenses" value={-headline.monthlyOperatingExpenses} tone="neg" />
          <FlowRow label="Net operating income" value={headline.monthlyNoi} strong />
          <FlowRow label="Mortgage debt service" value={-headline.monthlyDebtService} tone="neg" />
          <FlowRow label="PRE-TAX CASH FLOW" value={headline.monthlyCashFlow} strong emphasis />
        </Panel>

        <Panel title="Annual" subtitle="The same waterfall over twelve months.">
          <FlowRow label="Gross income" value={headline.annualGrossIncome} />
          <FlowRow label="Vacancy and bad debt" value={-(s.noi.vacancyLoss + s.noi.badDebtLoss)} tone="neg" />
          <FlowRow label="Effective income" value={headline.annualEffectiveIncome} strong />
          <FlowRow label="Operating expenses" value={-headline.annualOperatingExpenses} tone="neg" />
          <FlowRow label="Net operating income" value={headline.annualNoi} strong />
          <FlowRow label="Debt service" value={-headline.annualDebtService} tone="neg" />
          <FlowRow label="PRE-TAX CASH FLOW" value={headline.annualPreTaxCashFlow} strong emphasis />
        </Panel>
      </div>

      <Panel title="Equity build from principal repayment" subtitle="Reported separately, because it is not spendable cash.">
        <div className="grid gap-4 lg:grid-cols-3">
          <div>
            <div className="label">Principal repaid in year 1</div>
            <div className="num mt-1 text-xl font-semibold text-info">
              {fmtCAD(headline.equityBuildFromPrincipalYear1)}
            </div>
            <Note>{fmtCAD(headline.equityBuildFromPrincipalYear1 / 12)}/month of equity build</Note>
          </div>
          <div>
            <div className="label">Interest paid in year 1</div>
            <div className="num mt-1 text-xl font-semibold">{fmtCAD(headline.interestPaidYear1)}</div>
            <Note>The genuine cost of the debt</Note>
          </div>
          <div>
            <div className="label">Cash flow plus equity build</div>
            <div className="num mt-1 text-xl font-semibold">
              {fmtCAD(headline.annualPreTaxCashFlow + headline.equityBuildFromPrincipalYear1)}
            </div>
            <Note>Shown for completeness only — do not spend it</Note>
          </div>
        </div>
        <div className="mt-4">
          <Callout tone="info" compact>
            <strong className="text-ink">Principal repayment is never counted as cash flow anywhere in this tool.</strong>{' '}
            It builds equity you can only access by selling or refinancing again, and refinancing to
            access it re-creates the debt you just paid down.
          </Callout>
        </div>
      </Panel>

      {isCashRefi && (
        <Panel title="Before and after the refinance" subtitle="The cash purchase and the refinanced position are both real — this is the transition.">
          <TableWrap>
            <thead className="border-b border-line bg-raised">
              <tr>
                <th className="th">Metric</th>
                <th className="th text-right">Unlevered (as bought)</th>
                <th className="th text-right">After refinance</th>
                <th className="th text-right">Change</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line/60">
              <CompareRow label="Monthly cash flow" a={preRefi.monthlyCashFlow} b={postRefi.monthlyCashFlow} />
              <CompareRow label="Annual cash flow" a={preRefi.annualPreTaxCashFlow} b={postRefi.annualPreTaxCashFlow} />
              <CompareRow label="Annual debt service" a={preRefi.annualDebtService} b={postRefi.annualDebtService} invert />
              <CompareRow label="Cash invested" a={preRefi.cashRemainingInvested} b={postRefi.cashRemainingInvested} invert />
              <tr className="row-hover">
                <td className="td">Cash-on-cash return</td>
                <td className="td-num">{fmtPct(preRefi.cashOnCash)}</td>
                <td className="td-num font-semibold">{fmtPct(postRefi.cashOnCash)}</td>
                <td className="td-num text-pos">
                  {preRefi.cashOnCash !== null && postRefi.cashOnCash !== null
                    ? `+${fmtPct(postRefi.cashOnCash - preRefi.cashOnCash)}`
                    : '—'}
                </td>
              </tr>
              <tr className="row-hover">
                <td className="td">DSCR</td>
                <td className="td-num text-muted">No debt</td>
                <td className="td-num font-semibold">{fmtMultiple(postRefi.dscr)}</td>
                <td className="td" />
              </tr>
              <tr className="row-hover">
                <td className="td">Break-even occupancy</td>
                <td className="td-num">{fmtPct(preRefi.breakEvenOccupancy)}</td>
                <td className="td-num font-semibold">{fmtPct(postRefi.breakEvenOccupancy)}</td>
                <td className="td-num text-warn">
                  {preRefi.breakEvenOccupancy !== null && postRefi.breakEvenOccupancy !== null
                    ? `+${fmtPct(postRefi.breakEvenOccupancy - preRefi.breakEvenOccupancy)}`
                    : '—'}
                </td>
              </tr>
            </tbody>
          </TableWrap>
          <div className="mt-3">
            <Note>
              The refinance raises cash-on-cash sharply because the denominator collapses — that is the
              point of the strategy, not a sign the property improved. Monthly income falls and
              break-even occupancy rises at the same time. Both are true simultaneously.
            </Note>
          </div>
        </Panel>
      )}

      {/* §10 cash-on-cash */}
      <Panel title="Cash-on-cash return" subtitle="Annual pre-tax cash flow divided by the cash actually still invested.">
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-md border border-line p-4">
            <div className="label">Before refinance</div>
            <div className={cx('num mt-1 text-2xl font-semibold', toneText[cashOnCashBand(preRefi.cashOnCash).tone])}>
              {fmtPct(preRefi.cashOnCash)}
            </div>
            <div className="mt-2 space-y-1 text-xs text-muted">
              <div className="flex justify-between"><span>Annual cash flow</span><span className="num">{fmtCAD(preRefi.annualPreTaxCashFlow)}</span></div>
              <div className="flex justify-between"><span>Cash invested</span><span className="num">{fmtCAD(preRefi.cashRemainingInvested)}</span></div>
            </div>
          </div>
          <div className="rounded-md border border-line p-4">
            <div className="label">After refinance</div>
            <div className={cx('num mt-1 text-2xl font-semibold', toneText[cashOnCashBand(postRefi.cashOnCash).tone])}>
              {fmtPct(postRefi.cashOnCash)}
            </div>
            <div className="mt-2 space-y-1 text-xs text-muted">
              <div className="flex justify-between"><span>Annual cash flow</span><span className="num">{fmtCAD(postRefi.annualPreTaxCashFlow)}</span></div>
              <div className="flex justify-between"><span>Cash remaining invested</span><span className="num">{fmtCAD(postRefi.cashRemainingInvested)}</span></div>
            </div>
          </div>
        </div>
      </Panel>

      {/* §11 DSCR bands */}
      <Panel title="Debt service coverage" subtitle="NOI divided by annual debt service.">
        <div className="grid gap-2 sm:grid-cols-5">
          <DscrBand range="Below 1.00x" label="Cannot cover debt from NOI" tone="neg" active={(headline.dscr ?? 99) < 1} />
          <DscrBand range="1.00 – 1.20x" label="Weak" tone="neg" active={(headline.dscr ?? 0) >= 1 && (headline.dscr ?? 0) < 1.2} />
          <DscrBand range="1.20 – 1.30x" label="Marginal" tone="warn" active={(headline.dscr ?? 0) >= 1.2 && (headline.dscr ?? 0) < 1.3} />
          <DscrBand range="1.30 – 1.40x" label="Acceptable target" tone="pos" active={(headline.dscr ?? 0) >= 1.3 && (headline.dscr ?? 0) < 1.4} />
          <DscrBand range="1.40x +" label="Strong" tone="pos" active={(headline.dscr ?? 0) >= 1.4} />
        </div>
        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          <div>
            <div className="label">Current DSCR</div>
            <div className={cx('num mt-1 text-xl font-semibold', toneText[dscrBand(headline.dscr).tone])}>
              {fmtMultiple(headline.dscr)}
            </div>
          </div>
          <div>
            <div className="label">Your minimum</div>
            <div className="num mt-1 text-xl font-semibold">{profile.minDscr.toFixed(2)}x</div>
          </div>
          <div>
            <div className="label">Headroom</div>
            <div className={cx('num mt-1 text-xl font-semibold', (headline.dscr ?? 0) >= profile.minDscr ? 'text-pos' : 'text-neg')}>
              {headline.dscr !== null ? `${((headline.dscr - profile.minDscr) >= 0 ? '+' : '')}${(headline.dscr - profile.minDscr).toFixed(2)}x` : '—'}
            </div>
            <Note>
              NOI could fall {headline.dscr !== null && headline.dscr > profile.minDscr
                ? fmtPct(1 - profile.minDscr / headline.dscr)
                : '0%'}{' '}
              before breaching your floor
            </Note>
          </div>
        </div>
      </Panel>

      {/* §17 total return */}
      <Panel
        title="Total return, year 1"
        subtitle="Cash and non-cash wealth creation, labelled separately."
        actions={<Badge tone="info">{fmtPct(r.totalReturnYear1.totalLeveragedReturn)} total</Badge>}
        dense
      >
        <TableWrap>
          <thead className="border-b border-line bg-raised">
            <tr>
              <th className="th">Component</th>
              <th className="th">Nature</th>
              <th className="th text-right">Amount</th>
              <th className="th text-right">On cash invested</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line/60">
            {r.totalReturnYear1.components.map((c) => (
              <tr key={c.key} className="row-hover">
                <td className="td">{c.label}</td>
                <td className="td">
                  <Badge tone={c.nature === 'CASH' ? 'pos' : 'muted'}>
                    {c.nature === 'CASH' ? 'Spendable cash' : 'Non-cash'}
                  </Badge>
                </td>
                <td className="td-num">{fmtCAD(c.amount)}</td>
                <td className="td-num text-muted">
                  {fmtPct(r.totalReturnYear1.cashBase > 0 ? c.amount / r.totalReturnYear1.cashBase : null)}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot className="border-t-2 border-line bg-raised font-semibold">
            <tr>
              <td className="td" colSpan={2}>Total equity gain</td>
              <td className="td-num">{fmtCAD(r.totalReturnYear1.totalEquityGain)}</td>
              <td className="td-num">{fmtPct(r.totalReturnYear1.totalLeveragedReturn)}</td>
            </tr>
          </tfoot>
        </TableWrap>
        <div className="space-y-2 border-t border-line px-4 py-3">
          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <div className="label">Cash return</div>
              <div className="num mt-0.5 text-base font-semibold text-pos">{fmtCAD(r.totalReturnYear1.cashComponent)}</div>
            </div>
            <div>
              <div className="label">Non-cash return</div>
              <div className="num mt-0.5 text-base font-semibold text-muted">{fmtCAD(r.totalReturnYear1.nonCashComponent)}</div>
            </div>
            <div>
              <div className="label">Return on equity</div>
              <div className="num mt-0.5 text-base font-semibold">{fmtPct(r.totalReturnYear1.returnOnEquity)}</div>
            </div>
          </div>
          <Note>
            {r.totalReturnYear1.totalEquityGain > 0 &&
              `${fmtPct(r.totalReturnYear1.cashComponent / r.totalReturnYear1.totalEquityGain)} of this year's total return is actual cash. `}
            Appreciation is an assumption you entered on the Projection page, not a fact. If most of
            the return above is non-cash, the deal is asking you to be right about the future rather
            than paying you today.
          </Note>
        </div>
      </Panel>
    </div>
  )
}

function FlowRow({
  label,
  value,
  tone,
  strong,
  emphasis,
}: {
  label: string
  value: number
  tone?: 'neg' | 'pos'
  strong?: boolean
  emphasis?: boolean
}) {
  return (
    <div
      className={cx(
        'flex items-baseline justify-between gap-3 border-b border-line/60 py-2 last:border-0',
        strong && 'font-semibold',
        emphasis && 'border-t-2 border-t-line pt-2.5 text-base',
      )}
    >
      <span className={cx(strong ? 'text-ink' : 'text-muted', emphasis ? 'text-xs uppercase tracking-wider' : 'text-xs')}>
        {label}
      </span>
      <span className={cx('num', emphasis ? 'text-lg' : 'text-sm', tone && toneText[tone], emphasis && value < 0 && 'text-neg', emphasis && value >= 0 && 'text-pos')}>
        {fmtCAD(value)}
      </span>
    </div>
  )
}

function CompareRow({ label, a, b, invert }: { label: string; a: number; b: number; invert?: boolean }) {
  const delta = b - a
  const good = invert ? delta < 0 : delta > 0
  return (
    <tr className="row-hover">
      <td className="td">{label}</td>
      <td className="td-num">{fmtCAD(a)}</td>
      <td className="td-num font-semibold">{fmtCAD(b)}</td>
      <td className={cx('td-num', Math.abs(delta) < 1 ? 'text-muted' : good ? 'text-pos' : 'text-neg')}>
        {delta > 0 ? '+' : ''}
        {fmtCAD(delta)}
      </td>
    </tr>
  )
}

function DscrBand({ range, label, tone, active }: { range: string; label: string; tone: 'pos' | 'warn' | 'neg'; active: boolean }) {
  return (
    <div
      className={cx(
        'rounded-md border p-2.5',
        active
          ? tone === 'pos'
            ? 'border-pos bg-pos/10'
            : tone === 'warn'
              ? 'border-warn bg-warn/10'
              : 'border-neg bg-neg/10'
          : 'border-line',
      )}
    >
      <div className="num text-xs font-semibold">{range}</div>
      <div className="mt-0.5 text-2xs leading-tight text-muted">{label}</div>
    </div>
  )
}
