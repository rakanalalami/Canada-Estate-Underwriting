/**
 * §19 Sensitivity analysis.
 *
 * Matrices are built by re-running the underwriting at each combination rather
 * than by scaling a single result, so land transfer tax brackets, percentage
 * expenses and mortgage sizing all respond correctly.
 */

export interface SensitivityMetrics {
  noi: number
  capRate: number | null
  monthlyCashFlow: number
  annualCashFlow: number
  dscr: number | null
  cashOnCash: number | null
  annualDebtService: number
  mortgageAmount: number
  cashRemainingInvested: number
}

export type SensitivityEvaluator = (opts: {
  rate: number
  rentFactor: number
  price: number
}) => SensitivityMetrics

export interface SensitivityFlags {
  negativeCashFlow: boolean
  belowDscrTarget: boolean
  aboveThousand: boolean
  aboveTwoThousand: boolean
}

export interface SensitivityCell extends SensitivityMetrics {
  rowValue: number
  colValue: number
  flags: SensitivityFlags
}

export interface SensitivityMatrix {
  id: string
  title: string
  rowLabel: string
  colLabel: string
  rowFormat: 'percent' | 'currency' | 'rentDelta'
  colFormat: 'percent' | 'currency' | 'rentDelta'
  rowValues: number[]
  colValues: number[]
  cells: SensitivityCell[][]
  minDscr: number
}

function flagsFor(m: SensitivityMetrics, minDscr: number): SensitivityFlags {
  return {
    negativeCashFlow: m.monthlyCashFlow < 0,
    belowDscrTarget: m.dscr !== null && m.dscr < minDscr,
    aboveThousand: m.monthlyCashFlow >= 1000,
    aboveTwoThousand: m.monthlyCashFlow >= 2000,
  }
}

function build(
  id: string,
  title: string,
  rowLabel: string,
  colLabel: string,
  rowFormat: SensitivityMatrix['rowFormat'],
  colFormat: SensitivityMatrix['colFormat'],
  rowValues: number[],
  colValues: number[],
  evaluate: (row: number, col: number) => SensitivityMetrics,
  minDscr: number,
): SensitivityMatrix {
  const cells = rowValues.map((r) =>
    colValues.map((c) => {
      const m = evaluate(r, c)
      return { ...m, rowValue: r, colValue: c, flags: flagsFor(m, minDscr) }
    }),
  )
  return { id, title, rowLabel, colLabel, rowFormat, colFormat, rowValues, colValues, cells, minDscr }
}

export interface SensitivityInput {
  evaluate: SensitivityEvaluator
  rates: number[]
  rentDeltas: number[]
  prices: number[]
  basePrice: number
  baseRate: number
  minDscr: number
}

export function buildSensitivitySet(input: SensitivityInput): SensitivityMatrix[] {
  const { evaluate, rates, rentDeltas, prices, basePrice, baseRate, minDscr } = input

  return [
    build(
      'rate-vs-rent',
      'Mortgage rate vs rent',
      'Mortgage rate',
      'Rent change',
      'percent',
      'rentDelta',
      rates,
      rentDeltas,
      (rate, delta) => evaluate({ rate, rentFactor: 1 + delta, price: basePrice }),
      minDscr,
    ),
    build(
      'price-vs-rent',
      'Purchase price vs rent',
      'Purchase price',
      'Rent change',
      'currency',
      'rentDelta',
      prices,
      rentDeltas,
      (price, delta) => evaluate({ rate: baseRate, rentFactor: 1 + delta, price }),
      minDscr,
    ),
    build(
      'price-vs-rate',
      'Purchase price vs interest rate',
      'Purchase price',
      'Mortgage rate',
      'currency',
      'percent',
      prices,
      rates,
      (price, rate) => evaluate({ rate, rentFactor: 1, price }),
      minDscr,
    ),
  ]
}

/** Price ladder centred on the offer price, for the price-based matrices. */
export function pricesAround(base: number, deltas: number[] = [-0.1, -0.05, 0, 0.05, 0.1]): number[] {
  return deltas.map((d) => Math.round((base * (1 + d)) / 1000) * 1000)
}
