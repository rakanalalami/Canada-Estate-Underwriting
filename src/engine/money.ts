/** CAD formatting + tolerant numeric input parsing (§30). */

const CAD = new Intl.NumberFormat('en-CA', {
  style: 'currency',
  currency: 'CAD',
  currencyDisplay: 'symbol',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
})

const CAD_CENTS = new Intl.NumberFormat('en-CA', {
  style: 'currency',
  currency: 'CAD',
  currencyDisplay: 'symbol',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

const NUM = new Intl.NumberFormat('en-CA', {
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
})

/** C$650,000 — the whole app uses CAD, so the C prefix is always shown. */
export function fmtCAD(value: number | null | undefined, decimals = 0): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—'
  const f = decimals > 0 ? CAD_CENTS : CAD
  // Intl renders CAD as "$" in en-CA; prefix with C to be unambiguous.
  return 'C' + f.format(value)
}

/** Compact form for chart axes and dense tables: C$650k / C$1.2M. */
export function fmtCADCompact(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—'
  const abs = Math.abs(value)
  const sign = value < 0 ? '-' : ''
  if (abs >= 1_000_000) return `${sign}C$${(abs / 1_000_000).toFixed(abs >= 10_000_000 ? 1 : 2)}M`
  if (abs >= 1_000) return `${sign}C$${Math.round(abs / 1_000)}k`
  return `${sign}C$${Math.round(abs)}`
}

export function fmtNumber(value: number | null | undefined, decimals = 0): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—'
  return new Intl.NumberFormat('en-CA', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value)
}

export { NUM }

/** 0.0643 -> "6.43%" */
export function fmtPct(rate: number | null | undefined, decimals = 2): string {
  if (rate === null || rate === undefined || !Number.isFinite(rate)) return '—'
  return `${(rate * 100).toFixed(decimals)}%`
}

/** 1.34 -> "1.34x" */
export function fmtMultiple(x: number | null | undefined, decimals = 2): string {
  if (x === null || x === undefined || !Number.isFinite(x)) return '—'
  return `${x.toFixed(decimals)}x`
}

/**
 * Accepts the ways a human actually types money:
 *   650000 · 650,000 · $650,000 · C$650,000 · 650 000 · 650k · 1.2m · (1,200) · -1200
 * Returns null when nothing numeric is present, so callers can distinguish
 * "empty" from "zero".
 */
export function parseNumeric(raw: string | number | null | undefined): number | null {
  if (typeof raw === 'number') return Number.isFinite(raw) ? raw : null
  if (raw === null || raw === undefined) return null

  let s = String(raw).trim()
  if (s === '') return null

  let negative = false
  // Accounting-style negatives
  if (/^\(.*\)$/.test(s)) {
    negative = true
    s = s.slice(1, -1)
  }

  s = s
    .replace(/^C\$/i, '')
    .replace(/[$\s, '_]/g, '')
    .replace(/%$/, '')

  if (s.startsWith('-')) {
    negative = !negative
    s = s.slice(1)
  }
  if (s.startsWith('+')) s = s.slice(1)

  let multiplier = 1
  const suffix = s.slice(-1).toLowerCase()
  if (suffix === 'k') {
    multiplier = 1_000
    s = s.slice(0, -1)
  } else if (suffix === 'm') {
    multiplier = 1_000_000
    s = s.slice(0, -1)
  } else if (suffix === 'b') {
    multiplier = 1_000_000_000
    s = s.slice(0, -1)
  }

  if (s === '' || s === '.') return null
  if (!/^\d*\.?\d*$/.test(s)) return null

  const n = Number(s)
  if (!Number.isFinite(n)) return null
  return (negative ? -n : n) * multiplier
}

/** Same as parseNumeric but falls back to a default instead of null. */
export function parseNumericOr(raw: string | number | null | undefined, fallback = 0): number {
  const v = parseNumeric(raw)
  return v === null ? fallback : v
}

/** Round to cents to avoid floating-point noise in reported dollars. */
export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100
}

export function round(n: number, dp = 0): number {
  const f = Math.pow(10, dp)
  return Math.round((n + Number.EPSILON) * f) / f
}

/** Safe division: returns null rather than Infinity/NaN. */
export function safeDiv(numerator: number, denominator: number): number | null {
  if (!Number.isFinite(numerator) || !Number.isFinite(denominator) || denominator === 0) return null
  const r = numerator / denominator
  return Number.isFinite(r) ? r : null
}

export function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n))
}

export function sum(values: number[]): number {
  return values.reduce((a, b) => a + (Number.isFinite(b) ? b : 0), 0)
}

export function mean(values: number[]): number | null {
  const v = values.filter((n) => Number.isFinite(n))
  if (v.length === 0) return null
  return sum(v) / v.length
}

export function median(values: number[]): number | null {
  const v = values.filter((n) => Number.isFinite(n)).sort((a, b) => a - b)
  if (v.length === 0) return null
  const mid = Math.floor(v.length / 2)
  return v.length % 2 === 0 ? (v[mid - 1] + v[mid]) / 2 : v[mid]
}
