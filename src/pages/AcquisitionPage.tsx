import type { AcquisitionStructure, CompoundingConvention, Deal, PaymentFrequency } from '@/engine/types'
import type { UnderwriteResult } from '@/engine/underwrite'
import { useDealEdit } from '@/lib/dealEdit'
import {
  Callout,
  Kpi,
  MoneyInput,
  NumberInput,
  Panel,
  PercentInput,
  Segmented,
  Select,
  TableWrap,
  Toggle,
  TraceTable,
  cx,
} from '@/components/ui/primitives'
import { Note, SectionGrid } from '@/components/shared'
import { fmtCAD, fmtPct } from '@/engine/money'
import { frequencyLabel } from '@/engine/finance'

const STRUCTURES: { value: AcquisitionStructure; label: string }[] = [
  { value: 'ALL_CASH', label: 'All cash' },
  { value: 'MORTGAGED', label: 'Mortgaged purchase' },
  { value: 'CASH_THEN_REFINANCE', label: 'Cash purchase + later refinance' },
]

const FREQUENCIES: { value: PaymentFrequency; label: string }[] = [
  'MONTHLY',
  'SEMI_MONTHLY',
  'BI_WEEKLY',
  'ACCELERATED_BI_WEEKLY',
  'WEEKLY',
  'ACCELERATED_WEEKLY',
].map((f) => ({ value: f as PaymentFrequency, label: frequencyLabel(f as PaymentFrequency) }))

const COMPOUNDING: { value: CompoundingConvention; label: string }[] = [
  { value: 'SEMI_ANNUAL', label: 'Semi-annual (Canadian standard)' },
  { value: 'MONTHLY', label: 'Monthly (US / variable style)' },
]

export default function AcquisitionPage({ deal, r }: { deal: Deal; r: UnderwriteResult }) {
  const edit = useDealEdit(deal.id)
  const a = r.acquisition
  const debt = r.scenarios.STABILIZED.debt
  const isCash = deal.financing.structure !== 'MORTGAGED'

  return (
    <div className="space-y-5">
      <SectionGrid cols={4}>
        <Kpi label="Purchase price" value={fmtCAD(a.price)} sub={a.price !== r.askingPrice ? `Asking ${fmtCAD(r.askingPrice)}` : 'At asking'} />
        <Kpi label="Total closing costs" value={fmtCAD(a.totalClosingCosts)} sub={`${fmtPct(a.price > 0 ? a.totalClosingCosts / a.price : null, 2)} of price`} trace={a.ltt.steps} />
        <Kpi label="Renovation / stabilization" value={fmtCAD(a.renovationBudget)} />
        <Kpi
          label="Total cash required"
          value={fmtCAD(a.totalCashRequired - debt.mortgageAmount)}
          sub={isCash ? 'Entire purchase in cash' : `${fmtCAD(a.totalCashRequired)} less the ${fmtCAD(debt.mortgageAmount)} mortgage`}
          trace={a.steps}
          emphasis
        />
      </SectionGrid>

      <div className="grid gap-5 lg:grid-cols-2">
        <Panel title="Ontario land transfer tax" subtitle="Progressive brackets — computed, not estimated.">
          <TraceTable steps={a.ltt.steps} />
          <div className="mt-3 space-y-2">
            <Callout tone="pos" compact>
              <strong className="text-ink">Ottawa levies no municipal land transfer tax.</strong>{' '}
              Toronto's MLTT would roughly double the figure above; it is never applied here.
            </Callout>
            {a.ltt.topRateCappedAtTwoPercent && a.price > 2_000_000 && (
              <Callout tone="info" compact>
                The 2.5% band above C$2,000,000 applies only to land with one or two single-family
                residences. This is a {deal.units.length}-unit multi-residential property, so the top
                band stays at 2.0%.
              </Callout>
            )}
            <MoneyInput
              label="Override land transfer tax"
              value={deal.purchaseCosts.landTransferTaxOverride}
              onChange={(v) => edit.purchaseCosts({ landTransferTaxOverride: v })}
              placeholder="Computed"
              hint="Only use this if your lawyer has given you a different figure."
            />
          </div>
        </Panel>

        <Panel title="Closing costs" subtitle="Everything payable on or around closing day.">
          <div className="grid gap-3 sm:grid-cols-2">
            <MoneyInput label="Legal fees" value={deal.purchaseCosts.legalFees} onChange={(v) => edit.purchaseCosts({ legalFees: v })} />
            <MoneyInput label="Inspection" value={deal.purchaseCosts.inspection} onChange={(v) => edit.purchaseCosts({ inspection: v })} />
            <MoneyInput label="Building inspection" value={deal.purchaseCosts.buildingInspection} onChange={(v) => edit.purchaseCosts({ buildingInspection: v })} />
            <MoneyInput label="Engineering inspection" value={deal.purchaseCosts.engineeringInspection} onChange={(v) => edit.purchaseCosts({ engineeringInspection: v })} />
            <MoneyInput label="Environmental report" value={deal.purchaseCosts.environmentalReport} onChange={(v) => edit.purchaseCosts({ environmentalReport: v })} hint="Phase I where industrial history is suspected." />
            <MoneyInput label="Appraisal" value={deal.purchaseCosts.appraisal} onChange={(v) => edit.purchaseCosts({ appraisal: v })} />
            <MoneyInput label="Title insurance" value={deal.purchaseCosts.titleInsurance} onChange={(v) => edit.purchaseCosts({ titleInsurance: v })} />
            <MoneyInput label="Lender fees" value={deal.purchaseCosts.lenderFees} onChange={(v) => edit.purchaseCosts({ lenderFees: v })} />
            <MoneyInput label="Mortgage broker fees" value={deal.purchaseCosts.mortgageBrokerFees} onChange={(v) => edit.purchaseCosts({ mortgageBrokerFees: v })} />
            <MoneyInput label="Other acquisition costs" value={deal.purchaseCosts.otherAcquisitionCosts} onChange={(v) => edit.purchaseCosts({ otherAcquisitionCosts: v })} />
          </div>
          <div className="mt-4 space-y-3 border-t border-line pt-3">
            <Toggle
              checked={deal.purchaseCosts.hstApplicable}
              onChange={(v) => edit.purchaseCosts({ hstApplicable: v })}
              label="HST applies"
              hint="Resale residential is normally exempt. New or substantially renovated buildings are taxable."
            />
            {deal.purchaseCosts.hstApplicable && (
              <MoneyInput label="HST" value={deal.purchaseCosts.hst} onChange={(v) => edit.purchaseCosts({ hst: v })} />
            )}
          </div>
        </Panel>
      </div>

      <Panel title="Capital and reserves" subtitle="What is sunk into the asset versus what is held as liquidity.">
        <div className="grid gap-4 lg:grid-cols-3">
          <MoneyInput
            label="Immediate renovation budget"
            value={deal.purchaseCosts.immediateRenovationBudget}
            onChange={(v) => edit.purchaseCosts({ immediateRenovationBudget: v })}
            hint="Capital, not expense. Counts toward trapped capital and the refinance recycle ratio."
          />
          <MoneyInput
            label="Initial reserve fund"
            value={deal.purchaseCosts.initialReserveFund}
            onChange={(v) => edit.purchaseCosts({ initialReserveFund: v })}
            hint="Cash held FOR the property, not sunk INTO it. Excluded from the trapped-capital formula."
          />
          <div className="rounded-md border border-line bg-raised p-3">
            <div className="label">Capital in property</div>
            <div className="num mt-1 text-xl font-semibold">{fmtCAD(a.capitalInProperty)}</div>
            <Note>Price + closing + renovation. This is the base for the §40.7 trapped-capital formula.</Note>
          </div>
        </div>
        <div className="mt-4">
          <TraceTable steps={a.steps} />
        </div>
      </Panel>

      <Panel
        title="Acquisition structure"
        subtitle="How the purchase is funded on day one."
        actions={
          <Segmented
            value={deal.financing.structure}
            onChange={(v) => edit.financing({ structure: v })}
            options={STRUCTURES.map((s) => ({ value: s.value, label: s.label }))}
          />
        }
      >
        {deal.financing.structure === 'CASH_THEN_REFINANCE' && (
          <Callout tone="info" title="Cash purchase, then refinance">
            This is the strategy the whole tool is built around. There is no acquisition mortgage, so
            there is no day-one DSCR — the coverage that matters is the post-refinance figure on the{' '}
            <a className="underline" href="#/refinance">Refinance</a> page. Buying without a financing
            condition is also what earns the price concession in the first place.
          </Callout>
        )}
        {deal.financing.structure === 'ALL_CASH' && (
          <Callout tone="info" title="All cash, no refinance planned">
            Every dollar stays trapped in this property. Cash-on-cash will look low because the
            denominator is the full purchase price — that is arithmetic, not a problem, but it does
            mean this capital cannot buy the next building.
          </Callout>
        )}

        {deal.financing.structure === 'MORTGAGED' && (
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <PercentInput label="Down payment" value={deal.financing.downPaymentPercent} onChange={(v) => edit.financing({ downPaymentPercent: v, downPaymentAmountOverride: null })} />
            <MoneyInput
              label="Down payment amount"
              value={deal.financing.downPaymentAmountOverride ?? Math.round(a.price * deal.financing.downPaymentPercent)}
              onChange={(v) => edit.financing({ downPaymentAmountOverride: v })}
              hint="Overrides the percentage."
            />
            <div className="rounded-md border border-line bg-raised p-3">
              <div className="label">Mortgage amount</div>
              <div className="num mt-1 text-lg font-semibold">{fmtCAD(debt.mortgageAmount)}</div>
              <Note>{fmtPct(a.price > 0 ? debt.mortgageAmount / a.price : null, 1)} LTV on price</Note>
            </div>
            <MoneyInput label="Mortgage fees" value={deal.financing.mortgageFees} onChange={(v) => edit.financing({ mortgageFees: v })} />
            <PercentInput label="Interest rate" value={deal.financing.annualRate} onChange={(v) => edit.financing({ annualRate: v })} />
            <NumberInput label="Amortization (years)" value={deal.financing.amortizationYears} onChange={(v) => edit.financing({ amortizationYears: v })} min={1} />
            <NumberInput label="Term (years)" value={deal.financing.termYears} onChange={(v) => edit.financing({ termYears: v })} min={1} />
            <Select label="Payment frequency" value={deal.financing.paymentFrequency} onChange={(v) => edit.financing({ paymentFrequency: v })} options={FREQUENCIES} />
            <Select
              label="Compounding convention"
              value={deal.financing.compounding}
              onChange={(v) => edit.financing({ compounding: v })}
              options={COMPOUNDING}
              className="sm:col-span-2"
              hint="Canadian fixed-rate mortgages compound semi-annually, not in advance. That is the default and it is not the same as rate ÷ 12."
            />
          </div>
        )}

        {deal.financing.structure === 'MORTGAGED' && debt.mortgageAmount > 0 && (
          <div className="mt-5">
            <SectionGrid cols={4}>
              <Kpi label="Payment" value={fmtCAD(debt.periodicPayment)} sub={frequencyLabel(deal.financing.paymentFrequency)} />
              <Kpi label="Monthly equivalent" value={fmtCAD(debt.monthlyPayment)} />
              <Kpi label="Annual debt service" value={fmtCAD(debt.annualDebtService)} />
              <Kpi
                label="Effective periodic rate"
                value={fmtPct(debt.amortization.breakdown.ratePerPeriod, 4)}
                sub={deal.financing.compounding === 'SEMI_ANNUAL' ? '(1 + r/2)^(2/p) − 1' : '(1 + r/12)^(12/p) − 1'}
              />
            </SectionGrid>

            <div className="mt-4 grid gap-5 lg:grid-cols-2">
              <Panel title="Year 1 split" dense>
                <TableWrap>
                  <tbody className="divide-y divide-line/60">
                    <tr><td className="td">Interest paid year 1</td><td className="td-num">{fmtCAD(debt.interestYear1)}</td></tr>
                    <tr><td className="td">Principal paid year 1</td><td className="td-num text-pos">{fmtCAD(debt.principalYear1)}</td></tr>
                    <tr className="font-semibold"><td className="td">Total debt service</td><td className="td-num">{fmtCAD(debt.annualDebtService)}</td></tr>
                  </tbody>
                </TableWrap>
                <div className="px-4 py-3">
                  <Note>
                    Principal repayment is equity build, not cash flow. It is reported here and in the
                    total-return breakdown, and nowhere else.
                  </Note>
                </div>
              </Panel>

              <Panel title="Outstanding balance" dense>
                <TableWrap>
                  <thead className="border-b border-line bg-raised">
                    <tr>
                      <th className="th">After</th>
                      <th className="th text-right">Balance</th>
                      <th className="th text-right">Principal repaid</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line/60">
                    {debt.balances.map((b) => (
                      <tr key={b.years} className="row-hover">
                        <td className="td">{b.years} year{b.years === 1 ? '' : 's'}</td>
                        <td className="td-num">{fmtCAD(b.balance)}</td>
                        <td className="td-num text-pos">{fmtCAD(debt.mortgageAmount - b.balance)}</td>
                      </tr>
                    ))}
                  </tbody>
                </TableWrap>
              </Panel>
            </div>
          </div>
        )}
      </Panel>

      <Panel title="Closing cost breakdown" dense>
        <TableWrap>
          <thead className="border-b border-line bg-raised">
            <tr>
              <th className="th">Item</th>
              <th className="th text-right">Amount</th>
              <th className="th text-right">% of price</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line/60">
            {a.closingLines
              .filter((l) => l.amount > 0 || l.key === 'MLTT')
              .map((l) => (
                <tr key={l.key} className={cx('row-hover', l.key === 'MLTT' && 'text-muted')}>
                  <td className="td">
                    {l.label}
                    {l.computed && <span className="ml-1.5 text-2xs text-subtle">computed</span>}
                  </td>
                  <td className="td-num">{fmtCAD(l.amount)}</td>
                  <td className="td-num text-muted">{fmtPct(a.price > 0 ? l.amount / a.price : null, 2)}</td>
                </tr>
              ))}
          </tbody>
          <tfoot className="border-t-2 border-line bg-raised font-semibold">
            <tr>
              <td className="td">Total closing costs</td>
              <td className="td-num">{fmtCAD(a.totalClosingCosts)}</td>
              <td className="td-num">{fmtPct(a.price > 0 ? a.totalClosingCosts / a.price : null, 2)}</td>
            </tr>
          </tfoot>
        </TableWrap>
      </Panel>
    </div>
  )
}
