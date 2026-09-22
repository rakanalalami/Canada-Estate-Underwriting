import type { Deal, ExpenseLine, PercentBasis } from '@/engine/types'
import type { UnderwriteResult } from '@/engine/underwrite'
import { useDealEdit } from '@/lib/dealEdit'
import {
  Badge,
  Callout,
  Kpi,
  MoneyInput,
  Panel,
  PercentInput,
  Segmented,
  Select,
  TableWrap,
  Toggle,
  cx,
} from '@/components/ui/primitives'
import { Note, SectionGrid } from '@/components/shared'
import { fmtCAD, fmtPct } from '@/engine/money'
import { PERCENT_BASIS_LABEL } from '@/engine/expenses'

const BASIS_OPTIONS: { value: PercentBasis; label: string }[] = [
  { value: 'GROSS_SCHEDULED_INCOME', label: 'of gross scheduled income' },
  { value: 'EFFECTIVE_GROSS_INCOME', label: 'of effective gross income' },
  { value: 'COLLECTED_RESIDENTIAL_RENT', label: 'of collected rent' },
  { value: 'PURCHASE_PRICE', label: 'of purchase price' },
]

export default function ExpensesPage({ deal, r }: { deal: Deal; r: UnderwriteResult }) {
  const edit = useDealEdit(deal.id)
  const s = r.scenarios.STABILIZED
  const resolved = s.noi.expenses

  return (
    <div className="space-y-5">
      <SectionGrid cols={4}>
        <Kpi label="Total operating expenses" value={fmtCAD(resolved.totalAnnual)} sub={`${fmtCAD(resolved.totalMonthly)}/month`} emphasis />
        <Kpi
          label="Operating expense ratio"
          value={fmtPct(resolved.expenseRatio)}
          sub="Of effective gross income"
          tone={
            resolved.expenseRatio === null
              ? 'muted'
              : resolved.expenseRatio < 0.25
                ? 'warn'
                : resolved.expenseRatio > 0.5
                  ? 'warn'
                  : 'pos'
          }
          band={
            resolved.expenseRatio !== null && resolved.expenseRatio < 0.25
              ? 'Suspiciously low'
              : resolved.expenseRatio !== null && resolved.expenseRatio > 0.5
                ? 'High'
                : 'Typical range'
          }
        />
        <Kpi label="Per unit" value={fmtCAD(resolved.perUnitAnnual)} sub="Annual" />
        <Kpi label="CapEx reserve" value={fmtCAD(resolved.capexReserveAnnual)} sub={deal.expenses.includeCapexReserveInNOI ? 'Included in NOI' : 'Excluded from NOI'} />
      </SectionGrid>

      {resolved.expenseRatio !== null && resolved.expenseRatio < 0.25 && (
        <Callout tone="warn" title="The expense ratio looks too low">
          Small Ottawa multifamily typically runs 30–45% of effective gross income. Below 25% almost
          always means a line is missing — check water, heat, snow removal and management in
          particular.
        </Callout>
      )}

      {resolved.estimatedFallbackCount > 0 && deal.expenses.mode === 'ACTUAL' && (
        <Callout tone="warn" title={`${resolved.estimatedFallbackCount} line(s) have no verified actual`}>
          You are in ACTUAL mode but these lines have no actual figure recorded, so the model
          assumption is being used instead. They are marked "est." in the table below.
        </Callout>
      )}

      <Panel
        title="Vacancy and credit loss"
        subtitle="These sit above the expense line — they reduce gross income to effective gross income (§4)."
      >
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <PercentInput
            label="Vacancy allowance"
            value={deal.expenses.deductions.vacancyPercent}
            onChange={(v) => edit.deductions({ vacancyPercent: v })}
            hint="Suggested starting assumption: 3%. Scenario tuning overrides this per scenario."
          />
          <PercentInput
            label="Bad debt allowance"
            value={deal.expenses.deductions.badDebtPercent}
            onChange={(v) => edit.deductions({ badDebtPercent: v })}
          />
          <div className="rounded-md border border-line bg-raised p-3">
            <div className="label">Vacancy loss</div>
            <div className="num mt-1 text-lg font-semibold">{fmtCAD(s.noi.vacancyLoss)}</div>
            <Note>{fmtPct(s.noi.vacancyPercent)} of {fmtCAD(s.noi.totalPotentialGrossIncome)}</Note>
          </div>
          <div className="rounded-md border border-line bg-raised p-3">
            <div className="label">Bad debt loss</div>
            <div className="num mt-1 text-lg font-semibold">{fmtCAD(s.noi.badDebtLoss)}</div>
            <Note>{fmtPct(s.noi.badDebtPercent)} of {fmtCAD(s.noi.totalPotentialGrossIncome)}</Note>
          </div>
        </div>
      </Panel>

      <Panel
        title="Operating expenses"
        subtitle="Each line can be a dollar amount or a percentage of a named basis."
        actions={
          <div className="flex items-center gap-3">
            <Segmented
              value={deal.expenses.mode}
              onChange={(v) => edit.expenses({ mode: v })}
              size="sm"
              options={[
                { value: 'ACTUAL', label: 'Actual', hint: 'Use verified figures where recorded' },
                { value: 'ESTIMATED', label: 'Estimated', hint: 'Use the model assumptions' },
              ]}
            />
          </div>
        }
        dense
      >
        <TableWrap>
          <thead className="border-b border-line bg-raised">
            <tr>
              <th className="th w-14 text-center">On</th>
              <th className="th">Expense</th>
              <th className="th w-24 text-center">Mode</th>
              <th className="th w-32 text-right">Amount / rate</th>
              <th className="th w-52">Basis</th>
              <th className="th w-32 text-right">Verified actual</th>
              <th className="th w-32 text-right">Annual</th>
              <th className="th w-28 text-right">Monthly</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line/60">
            {deal.expenses.lines.map((line) => {
              const res = resolved.lines.find((l) => l.key === line.key)!
              return (
                <tr key={line.key} className={cx('row-hover align-top', !line.enabled && 'opacity-45')}>
                  <td className="td text-center">
                    <input
                      type="checkbox"
                      checked={line.enabled}
                      onChange={(e) => edit.expenseLine(line.key, { enabled: e.target.checked })}
                      className="h-3.5 w-3.5 rounded border-line text-accent"
                    />
                  </td>
                  <td className="td">
                    <div className="font-medium">{line.label}</div>
                    {line.note && <div className="mt-0.5 max-w-md text-2xs leading-relaxed text-subtle">{line.note}</div>}
                  </td>
                  <td className="td text-center">
                    <Segmented
                      value={line.mode}
                      onChange={(v) => edit.expenseLine(line.key, { mode: v })}
                      size="sm"
                      options={[
                        { value: 'AMOUNT', label: '$' },
                        { value: 'PERCENT', label: '%' },
                      ]}
                    />
                  </td>
                  <td className="td">
                    {line.mode === 'AMOUNT' ? (
                      <MoneyInput value={line.amount || null} onChange={(v) => edit.expenseLine(line.key, { amount: v })} className="w-32" min={0} />
                    ) : (
                      <PercentInput value={line.percent} onChange={(v) => edit.expenseLine(line.key, { percent: v })} className="w-32" />
                    )}
                  </td>
                  <td className="td">
                    {line.mode === 'PERCENT' ? (
                      <Select
                        value={line.basis}
                        onChange={(v) => edit.expenseLine(line.key, { basis: v })}
                        options={BASIS_OPTIONS}
                      />
                    ) : (
                      <span className="text-2xs text-subtle">Fixed annual amount</span>
                    )}
                  </td>
                  <td className="td">
                    <MoneyInput
                      value={line.actualAmount}
                      onChange={(v) => edit.expenseLine(line.key, { actualAmount: v })}
                      className="w-32"
                      placeholder="—"
                      min={0}
                    />
                  </td>
                  <td className="td-num font-medium">
                    {fmtCAD(res.annual)}
                    {res.isActual && <Badge tone="pos">actual</Badge>}
                    {res.estimatedFallback && res.annual > 0 && <Badge tone="warn">est.</Badge>}
                  </td>
                  <td className="td-num text-muted">{fmtCAD(res.monthly)}</td>
                </tr>
              )
            })}
          </tbody>
          <tfoot className="border-t-2 border-line bg-raised font-semibold">
            <tr>
              <td className="td" colSpan={6}>
                Total operating expenses
              </td>
              <td className="td-num">{fmtCAD(resolved.totalAnnual)}</td>
              <td className="td-num">{fmtCAD(resolved.totalMonthly)}</td>
            </tr>
          </tfoot>
        </TableWrap>

        <div className="space-y-3 border-t border-line px-4 py-3">
          <Toggle
            checked={deal.expenses.includeCapexReserveInNOI}
            onChange={(v) => edit.expenses({ includeCapexReserveInNOI: v })}
            label="Include the CapEx reserve in NOI"
            hint={`On by default — the conservative treatment. With it excluded the cap rate on this deal would read ${fmtPct(s.capRateExCapexReserve)} instead of ${fmtPct(s.capRateOnOffer)}. Both figures are always reported so the choice is never hidden.`}
          />
          <Note>
            Percentage lines resolve against {PERCENT_BASIS_LABEL.GROSS_SCHEDULED_INCOME}{' '}
            ({fmtCAD(s.noi.totalPotentialGrossIncome)}), {PERCENT_BASIS_LABEL.EFFECTIVE_GROSS_INCOME}{' '}
            ({fmtCAD(s.noi.effectiveGrossIncome)}), {PERCENT_BASIS_LABEL.COLLECTED_RESIDENTIAL_RENT}{' '}
            ({fmtCAD(s.noi.collectedResidentialRent)}) or the purchase price ({fmtCAD(r.price)}).
            There is no circularity: income sets vacancy, vacancy sets effective gross income, and
            only then are percentage expenses applied.
          </Note>
        </div>
      </Panel>

      <Panel title="Suggested starting assumptions" subtitle="Used when actual figures are unavailable. All editable.">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <Assumption label="Vacancy" value="3%" note="Ottawa's rental market is tight, but a turnover month still costs a full month's rent." />
          <Assumption label="Management" value="8% of collected rent" note="Charge it even when self-managing — a buyer will." />
          <Assumption label="Routine maintenance" value="5% of gross rent" note="Higher on pre-1960 stock." />
          <Assumption label="CapEx reserve" value="3% of gross rent" note="Cross-check against the CapEx forecast, which is usually hungrier." />
          <Assumption label="Insurance" value="Quote required" note="C$1,000/unit is a placeholder only. Legacy wiring changes this materially." />
        </div>
      </Panel>
    </div>
  )
}

function Assumption({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <div className="rounded-md border border-line bg-raised p-3">
      <div className="label">{label}</div>
      <div className="mt-1 text-sm font-semibold">{value}</div>
      <p className="mt-1 text-2xs leading-relaxed text-subtle">{note}</p>
    </div>
  )
}

export type { ExpenseLine }
