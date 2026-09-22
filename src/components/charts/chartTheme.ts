/**
 * Chart styling that follows the CSS theme tokens, so charts recolour with
 * light/dark mode instead of being hard-coded.
 */

function cssVar(name: string, fallback: string): string {
  if (typeof window === 'undefined') return fallback
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim()
  return v ? `rgb(${v})` : fallback
}

export const CHART_COLORS = {
  get accent() {
    return cssVar('--c-accent', '#14407c')
  },
  get pos() {
    return cssVar('--c-pos', '#0d764a')
  },
  get warn() {
    return cssVar('--c-warn', '#a86806')
  },
  get neg() {
    return cssVar('--c-neg', '#b22727')
  },
  get info() {
    return cssVar('--c-info', '#1e5a9c')
  },
  get subtle() {
    return cssVar('--c-subtle', '#8692a4')
  },
  get ink() {
    return cssVar('--c-ink', '#0b1220')
  },
}

export const chartAxis = {
  tick: { fontSize: 11, fill: 'rgb(var(--c-muted))' },
  axisLine: { stroke: 'rgb(var(--c-line))' },
  tickLine: false,
} as const

export const chartTooltip = {
  contentStyle: {
    background: 'rgb(var(--c-surface))',
    border: '1px solid rgb(var(--c-line))',
    borderRadius: 8,
    fontSize: 12,
    boxShadow: '0 12px 32px -8px rgb(11 18 32 / 0.25)',
  },
  labelStyle: { color: 'rgb(var(--c-ink))', fontWeight: 600, marginBottom: 4 },
  itemStyle: { color: 'rgb(var(--c-muted))' },
} as const
