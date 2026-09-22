import { Suspense, lazy } from 'react'
import type { ComponentProps } from 'react'
import type { ProjectionChart as ProjectionChartType } from './ProjectionChart'
import type { LtvTradeoffChart as LtvTradeoffChartType } from './LtvTradeoffChart'

/**
 * Recharts is ~330 kB of the bundle and only three views need it, so it is
 * split out and loaded on demand rather than on first paint.
 */

const ProjectionChartImpl = lazy(() =>
  import('./ProjectionChart').then((m) => ({ default: m.ProjectionChart })),
)
const LtvTradeoffChartImpl = lazy(() =>
  import('./LtvTradeoffChart').then((m) => ({ default: m.LtvTradeoffChart })),
)

function ChartSkeleton({ height = 200 }: { height?: number }) {
  return (
    <div
      className="flex animate-pulse items-center justify-center rounded-md border border-dashed border-line"
      style={{ height }}
    >
      <span className="text-2xs text-subtle">Loading chart…</span>
    </div>
  )
}

export function ProjectionChart(props: ComponentProps<typeof ProjectionChartType>) {
  return (
    <Suspense fallback={<ChartSkeleton height={430} />}>
      <ProjectionChartImpl {...props} />
    </Suspense>
  )
}

export function LtvTradeoffChart(props: ComponentProps<typeof LtvTradeoffChartType>) {
  return (
    <Suspense fallback={<ChartSkeleton height={220} />}>
      <LtvTradeoffChartImpl {...props} />
    </Suspense>
  )
}
