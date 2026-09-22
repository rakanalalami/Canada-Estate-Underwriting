import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { LtvLadderRow } from '@/engine/refinance'
import { fmtCAD, fmtCADCompact } from '@/engine/money'
import { CHART_COLORS, chartAxis, chartTooltip } from './chartTheme'

/** The central trade-off of the strategy: cash released against monthly income. */
export function LtvTradeoffChart({ rows }: { rows: LtvLadderRow[] }) {
  const data = rows.map((r) => ({
    ltv: `${(r.ltv * 100).toFixed(0)}%`,
    released: Math.round(r.netCashReleased),
    cashFlow: Math.round(r.monthlyCashFlow),
  }))

  return (
    <ResponsiveContainer width="100%" height={220}>
      <ComposedChart data={data} margin={{ top: 6, right: 8, bottom: 0, left: 0 }}>
        <CartesianGrid strokeDasharray="2 4" stroke="rgb(var(--c-line))" vertical={false} />
        <XAxis dataKey="ltv" {...chartAxis} />
        <YAxis yAxisId="left" tickFormatter={(v) => fmtCADCompact(v)} width={58} {...chartAxis} />
        <YAxis yAxisId="right" orientation="right" tickFormatter={(v) => fmtCADCompact(v)} width={58} {...chartAxis} />
        <Tooltip {...chartTooltip} formatter={(v: number, n: string) => [fmtCAD(v), n]} />
        <Legend iconSize={8} wrapperStyle={{ fontSize: 11 }} />
        <Bar yAxisId="left" dataKey="released" name="Cash released" fill={CHART_COLORS.info} radius={[2, 2, 0, 0]} />
        <Line yAxisId="right" dataKey="cashFlow" name="Monthly cash flow" stroke={CHART_COLORS.pos} strokeWidth={2.5} dot={{ r: 3 }} />
      </ComposedChart>
    </ResponsiveContainer>
  )
}
