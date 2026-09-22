import { useState } from 'react'
import type { Deal } from '@/engine/types'
import type { UnderwriteResult } from '@/engine/underwrite'
import { useStore } from '@/store/useStore'
import { Callout, Panel, Segmented, TableWrap, cx } from '@/components/ui/primitives'
import { MatrixLegend, Note } from '@/components/shared'
import { fmtCAD, fmtCADCompact, fmtMultiple, fmtPct } from '@/engine/money'
import type { SensitivityMatrix } from '@/engine/sensitivity'

type Measure = 'CASH_FLOW' | 'DSCR' | 'COC'

export default function SensitivityPage({ deal, r }: { deal: Deal; r: UnderwriteResult }) {
  const profile = useStore((s) => s.profile)
  const [measure, setMeasure] = useState<Measure>('CASH_FLOW')
  const isCashRefi = deal.financing.structure === 'CASH_THEN_REFINANCE'

  return (
    <div className="space-y-5">
      <Callout tone="info" title="What is being stressed">
        {isCashRefi
          ? 'These matrices run against the post-refinance capital structure — the position you actually end up holding. Each cell re-runs the whole underwriting at that combination rather than scaling a single result, so land transfer tax brackets, percentage expenses and mortgage sizing all respond correctly.'
          : 'Each cell re-runs the whole underwriting at that combination rather than scaling a single result, so land transfer tax brackets, percentage expenses and mortgage sizing all respond correctly.'}
      </Callout>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <Segmented
          value={measure}
          onChange={setMeasure}
          options={[
            { value: 'CASH_FLOW', label: 'Monthly cash flow' },
            { value: 'DSCR', label: 'DSCR' },
            { value: 'COC', label: 'Cash-on-cash' },
          ]}
        />
        <MatrixLegend minDscr={profile.minDscr} />
      </div>

      {r.sensitivity.map((m) => (
        <MatrixPanel key={m.id} matrix={m} measure={measure} minDscr={profile.minDscr} />
      ))}

      <Panel title="Where this breaks" subtitle="The combinations that matter most, pulled out of the grids above.">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Breakpoint
            label="Cash-flow negative"
            cells={countCells(r.sensitivity, (c) => c.flags.negativeCashFlow)}
            total={totalCells(r.sensitivity)}
            tone="neg"
          />
          <Breakpoint
            label={`DSCR below ${profile.minDscr.toFixed(2)}x`}
            cells={countCells(r.sensitivity, (c) => c.flags.belowDscrTarget)}
            total={totalCells(r.sensitivity)}
            tone="warn"
          />
          <Breakpoint
            label="C$1,000+/month"
            cells={countCells(r.sensitivity, (c) => c.flags.aboveThousand)}
            total={totalCells(r.sensitivity)}
            tone="pos"
          />
          <Breakpoint
            label="C$2,000+/month"
            cells={countCells(r.sensitivity, (c) => c.flags.aboveTwoThousand)}
            total={totalCells(r.sensitivity)}
            tone="pos"
          />
        </div>
        <div className="mt-4">
          <Note>
            Read the rate row that matches your renewal risk, not today's rate. A five-year term means
            you reprice this debt once inside the holding period — the question is whether the deal
            still works at the rate you might face then, not the rate you can get now.
          </Note>
        </div>
      </Panel>
    </div>
  )
}

function MatrixPanel({
  matrix,
  measure,
  minDscr,
}: {
  matrix: SensitivityMatrix
  measure: Measure
  minDscr: number
}) {
  const fmtHeader = (v: number, kind: SensitivityMatrix['rowFormat']) => {
    if (kind === 'percent') return fmtPct(v, 2)
    if (kind === 'currency') return fmtCADCompact(v)
    return v === 0 ? 'Base' : `${v > 0 ? '+' : ''}${(v * 100).toFixed(0)}%`
  }

  const value = (cell: SensitivityMatrix['cells'][number][number]) => {
    if (measure === 'DSCR') return fmtMultiple(cell.dscr)
    if (measure === 'COC') return fmtPct(cell.cashOnCash)
    return fmtCAD(cell.monthlyCashFlow)
  }

  const tone = (cell: SensitivityMatrix['cells'][number][number]) => {
    if (measure === 'DSCR') {
      if (cell.dscr === null) return ''
      if (cell.dscr < 1) return 'bg-neg/20 text-neg'
      if (cell.dscr < minDscr) return 'bg-warn/15 text-warn'
      if (cell.dscr >= minDscr + 0.1) return 'bg-pos/15 text-pos'
      return ''
    }
    if (measure === 'COC') {
      if (cell.cashOnCash === null) return ''
      if (cell.cashOnCash < 0) return 'bg-neg/20 text-neg'
      if (cell.cashOnCash < 0.04) return 'bg-warn/15 text-warn'
      if (cell.cashOnCash >= 0.08) return 'bg-pos/15 text-pos'
      return ''
    }
    if (cell.flags.negativeCashFlow) return 'bg-neg/20 text-neg'
    if (cell.flags.belowDscrTarget) return 'bg-warn/15 text-warn'
    if (cell.flags.aboveTwoThousand) return 'bg-pos/20 text-pos'
    if (cell.flags.aboveThousand) return 'bg-pos/10 text-pos'
    return ''
  }

  return (
    <Panel title={matrix.title} subtitle={`${matrix.rowLabel} down, ${matrix.colLabel} across`} dense>
      <TableWrap>
        <thead className="border-b border-line bg-raised">
          <tr>
            <th className="th sticky left-0 bg-raised">
              {matrix.rowLabel} \ {matrix.colLabel}
            </th>
            {matrix.colValues.map((c) => (
              <th key={c} className="th text-right">
                {fmtHeader(c, matrix.colFormat)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-line/60">
          {matrix.cells.map((row, i) => (
            <tr key={i}>
              <td className="td-num sticky left-0 bg-surface font-medium">
                {fmtHeader(matrix.rowValues[i], matrix.rowFormat)}
              </td>
              {row.map((cell, j) => (
                <td
                  key={j}
                  className={cx('td-num', tone(cell))}
                  title={`Cash flow ${fmtCAD(cell.monthlyCashFlow)}/mo · DSCR ${fmtMultiple(cell.dscr)} · Cash-on-cash ${fmtPct(cell.cashOnCash)} · NOI ${fmtCAD(cell.noi)}`}
                >
                  {value(cell)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </TableWrap>
    </Panel>
  )
}

function countCells(matrices: SensitivityMatrix[], pred: (c: SensitivityMatrix['cells'][number][number]) => boolean): number {
  return matrices.reduce((s, m) => s + m.cells.flat().filter(pred).length, 0)
}

function totalCells(matrices: SensitivityMatrix[]): number {
  return matrices.reduce((s, m) => s + m.cells.flat().length, 0)
}

function Breakpoint({
  label,
  cells,
  total,
  tone,
}: {
  label: string
  cells: number
  total: number
  tone: 'pos' | 'warn' | 'neg'
}) {
  const share = total > 0 ? cells / total : 0
  return (
    <div className="rounded-md border border-line p-3">
      <div className="label">{label}</div>
      <div
        className={cx(
          'num mt-1 text-xl font-semibold',
          tone === 'pos' && 'text-pos',
          tone === 'warn' && 'text-warn',
          tone === 'neg' && 'text-neg',
        )}
      >
        {cells} / {total}
      </div>
      <div className="mt-0.5 text-2xs text-muted">{fmtPct(share, 0)} of tested combinations</div>
    </div>
  )
}
