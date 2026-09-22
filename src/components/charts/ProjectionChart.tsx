import {
  Area,
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
import type { ProjectionYear } from '@/engine/projection'
import { fmtCAD, fmtCADCompact } from '@/engine/money'
import { CHART_COLORS, chartAxis, chartTooltip } from './chartTheme'

export function ProjectionChart({ years }: { years: ProjectionYear[] }) {
  const data = years.map((y) => ({
    year: `Yr ${y.year}`,
    noi: Math.round(y.noi),
    cashFlow: Math.round(y.cashFlow),
    principal: Math.round(y.principalRepaid),
    value: Math.round(y.propertyValue),
    equity: Math.round(y.equity),
    debt: Math.round(y.mortgageBalance),
  }))

  return (
    <div className="space-y-4">
      <div>
        <div className="mb-1 text-2xs font-semibold uppercase tracking-wider text-muted">
          Operating result
        </div>
        <ResponsiveContainer width="100%" height={200}>
          <ComposedChart data={data} margin={{ top: 6, right: 8, bottom: 0, left: 0 }}>
            <CartesianGrid strokeDasharray="2 4" stroke="rgb(var(--c-line))" vertical={false} />
            <XAxis dataKey="year" {...chartAxis} />
            <YAxis tickFormatter={(v) => fmtCADCompact(v)} width={58} {...chartAxis} />
            <Tooltip {...chartTooltip} formatter={(v: number, n: string) => [fmtCAD(v), n]} />
            <Legend iconSize={8} wrapperStyle={{ fontSize: 11 }} />
            <Bar dataKey="noi" name="NOI" fill={CHART_COLORS.accent} radius={[2, 2, 0, 0]} />
            <Bar dataKey="cashFlow" name="Cash flow" fill={CHART_COLORS.pos} radius={[2, 2, 0, 0]} />
            <Bar dataKey="principal" name="Principal (non-cash)" fill={CHART_COLORS.subtle} radius={[2, 2, 0, 0]} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      <div>
        <div className="mb-1 text-2xs font-semibold uppercase tracking-wider text-muted">
          Balance sheet — value, debt and equity
        </div>
        <ResponsiveContainer width="100%" height={200}>
          <ComposedChart data={data} margin={{ top: 6, right: 8, bottom: 0, left: 0 }}>
            <CartesianGrid strokeDasharray="2 4" stroke="rgb(var(--c-line))" vertical={false} />
            <XAxis dataKey="year" {...chartAxis} />
            <YAxis tickFormatter={(v) => fmtCADCompact(v)} width={58} {...chartAxis} />
            <Tooltip {...chartTooltip} formatter={(v: number, n: string) => [fmtCAD(v), n]} />
            <Legend iconSize={8} wrapperStyle={{ fontSize: 11 }} />
            <Area dataKey="equity" name="Equity" stroke={CHART_COLORS.pos} fill={CHART_COLORS.pos} fillOpacity={0.15} />
            <Area dataKey="debt" name="Mortgage balance" stroke={CHART_COLORS.warn} fill={CHART_COLORS.warn} fillOpacity={0.12} />
            <Line dataKey="value" name="Property value (assumed)" stroke={CHART_COLORS.accent} strokeWidth={2} dot={false} strokeDasharray="4 3" />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
