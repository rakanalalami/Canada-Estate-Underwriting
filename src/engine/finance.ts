/**
 * Mortgage and time-value maths, Canadian conventions first.
 *
 * The single most important detail here: a Canadian fixed-rate mortgage
 * compounds SEMI-ANNUALLY, NOT IN ADVANCE (Interest Act, s.6 style quoting).
 * The periodic rate is therefore
 *
 *     i = (1 + r/2)^(2/p) - 1
 *
 * where r is the nominal annual rate and p is payments per year — not r/12.
 * At 4.75% that is 0.391960% per month rather than 0.395833%, a difference of
 * roughly C$9/month on a C$422,500 mortgage. The convention is switchable so a
 * US-style or variable/monthly-compounded product can also be modelled, and the
 * choice is always displayed rather than buried.
 */

import type { CompoundingConvention, MortgageTerms, PaymentFrequency } from './types'

export function paymentsPerYear(freq: PaymentFrequency): number {
  switch (freq) {
    case 'MONTHLY':
      return 12
    case 'SEMI_MONTHLY':
      return 24
    case 'BI_WEEKLY':
    case 'ACCELERATED_BI_WEEKLY':
      return 26
    case 'WEEKLY':
    case 'ACCELERATED_WEEKLY':
      return 52
  }
}

export function isAccelerated(freq: PaymentFrequency): boolean {
  return freq === 'ACCELERATED_BI_WEEKLY' || freq === 'ACCELERATED_WEEKLY'
}

export function frequencyLabel(freq: PaymentFrequency): string {
  switch (freq) {
    case 'MONTHLY':
      return 'Monthly'
    case 'SEMI_MONTHLY':
      return 'Semi-monthly'
    case 'BI_WEEKLY':
      return 'Bi-weekly'
    case 'ACCELERATED_BI_WEEKLY':
      return 'Accelerated bi-weekly'
    case 'WEEKLY':
      return 'Weekly'
    case 'ACCELERATED_WEEKLY':
      return 'Accelerated weekly'
  }
}

/**
 * Effective rate for one payment period.
 * SEMI_ANNUAL: i = (1 + r/2)^(2/p) - 1   (Canadian convention)
 * MONTHLY:     i = (1 + r/12)^(12/p) - 1 (US / variable-rate convention)
 */
export function periodicRate(
  annualRate: number,
  compounding: CompoundingConvention,
  perYear: number,
): number {
  if (annualRate === 0) return 0
  const compoundsPerYear = compounding === 'SEMI_ANNUAL' ? 2 : 12
  return Math.pow(1 + annualRate / compoundsPerYear, compoundsPerYear / perYear) - 1
}

/** Standard annuity payment. Returns principal/n when the rate is zero. */
export function annuityPayment(principal: number, ratePerPeriod: number, periods: number): number {
  if (principal <= 0 || periods <= 0) return 0
  if (ratePerPeriod === 0) return principal / periods
  const f = Math.pow(1 + ratePerPeriod, -periods)
  return (principal * ratePerPeriod) / (1 - f)
}

export interface PaymentBreakdown {
  /** The contractual payment made every payment period. */
  periodicPayment: number
  /** Equivalent monthly outlay (payment * payments per year / 12). */
  monthlyEquivalent: number
  annualDebtService: number
  ratePerPeriod: number
  perYear: number
  /** Nominal amortization in periods, before acceleration. */
  nominalPeriods: number
  /** Actual periods to full payout, accounting for accelerated payments. */
  actualPeriods: number
  actualAmortizationYears: number
  accelerated: boolean
}

/**
 * Contractual payment for a set of terms. For accelerated frequencies the
 * payment is the monthly payment divided by 2 (bi-weekly) or 4 (weekly), which
 * is what makes the mortgage amortize faster than its nominal schedule.
 */
export function computePayment(terms: MortgageTerms): PaymentBreakdown {
  const perYear = paymentsPerYear(terms.paymentFrequency)
  const accelerated = isAccelerated(terms.paymentFrequency)
  const nominalPeriods = Math.round(terms.amortizationYears * perYear)

  let periodicPayment: number
  let ratePerPeriod: number

  if (accelerated) {
    // Accelerated payments are derived from the MONTHLY payment.
    const monthlyRate = periodicRate(terms.annualRate, terms.compounding, 12)
    const monthlyPayment = annuityPayment(
      terms.principal,
      monthlyRate,
      Math.round(terms.amortizationYears * 12),
    )
    const divisor = terms.paymentFrequency === 'ACCELERATED_BI_WEEKLY' ? 2 : 4
    periodicPayment = monthlyPayment / divisor
    ratePerPeriod = periodicRate(terms.annualRate, terms.compounding, perYear)
  } else {
    ratePerPeriod = periodicRate(terms.annualRate, terms.compounding, perYear)
    periodicPayment = annuityPayment(terms.principal, ratePerPeriod, nominalPeriods)
  }

  const actualPeriods = periodsToPayout(terms.principal, ratePerPeriod, periodicPayment, nominalPeriods)

  return {
    periodicPayment,
    monthlyEquivalent: (periodicPayment * perYear) / 12,
    annualDebtService: periodicPayment * perYear,
    ratePerPeriod,
    perYear,
    nominalPeriods,
    actualPeriods,
    actualAmortizationYears: actualPeriods / perYear,
    accelerated,
  }
}

/** Number of periods required to fully repay, capped for safety. */
function periodsToPayout(
  principal: number,
  ratePerPeriod: number,
  payment: number,
  nominalPeriods: number,
): number {
  if (principal <= 0 || payment <= 0) return 0
  if (ratePerPeriod === 0) return Math.ceil(principal / payment)
  // Payment must at least cover interest, otherwise the loan never amortizes.
  if (payment <= principal * ratePerPeriod) return Number.POSITIVE_INFINITY
  const n = -Math.log(1 - (principal * ratePerPeriod) / payment) / Math.log(1 + ratePerPeriod)
  const ceilN = Math.ceil(n - 1e-9)
  return Math.min(ceilN, Math.max(nominalPeriods, ceilN))
}

export interface AmortPeriod {
  period: number
  payment: number
  interest: number
  principal: number
  balance: number
}

export interface AmortYear {
  year: number
  payments: number
  interest: number
  principal: number
  endingBalance: number
  debtService: number
}

export interface AmortizationResult {
  breakdown: PaymentBreakdown
  periods: AmortPeriod[]
  years: AmortYear[]
  totalInterest: number
  /** true when the payment cannot cover the interest accrual. */
  negativeAmortization: boolean
}

/** Full amortization schedule. Periods are capped at 100 years of payments. */
export function amortize(terms: MortgageTerms, maxYears = 40): AmortizationResult {
  const breakdown = computePayment(terms)
  const periods: AmortPeriod[] = []
  const perYear = breakdown.perYear
  const cap = Math.round(maxYears * perYear)

  let balance = terms.principal
  let totalInterest = 0
  let negativeAmortization = false

  if (terms.principal > 0 && breakdown.periodicPayment <= terms.principal * breakdown.ratePerPeriod) {
    negativeAmortization = true
  }

  for (let p = 1; p <= cap && balance > 0.005; p++) {
    const interest = balance * breakdown.ratePerPeriod
    let principalPortion = breakdown.periodicPayment - interest
    let payment = breakdown.periodicPayment
    if (principalPortion > balance) {
      // Final payment tops out at the remaining balance.
      principalPortion = balance
      payment = balance + interest
    }
    if (negativeAmortization) principalPortion = Math.min(principalPortion, 0)
    balance = Math.max(0, balance - principalPortion)
    totalInterest += interest
    periods.push({ period: p, payment, interest, principal: principalPortion, balance })
    if (negativeAmortization && p > perYear * maxYears) break
  }

  const years: AmortYear[] = []
  const yearCount = Math.ceil(periods.length / perYear)
  for (let y = 1; y <= yearCount; y++) {
    const slice = periods.slice((y - 1) * perYear, y * perYear)
    if (slice.length === 0) break
    years.push({
      year: y,
      payments: slice.length,
      interest: slice.reduce((a, b) => a + b.interest, 0),
      principal: slice.reduce((a, b) => a + b.principal, 0),
      endingBalance: slice[slice.length - 1].balance,
      debtService: slice.reduce((a, b) => a + b.payment, 0),
    })
  }

  return { breakdown, periods, years, totalInterest, negativeAmortization }
}

/** Outstanding balance after a whole number of years. */
export function balanceAfterYears(result: AmortizationResult, years: number): number {
  if (years <= 0) return result.periods.length ? result.periods[0].balance + result.periods[0].principal : 0
  const idx = Math.round(years * result.breakdown.perYear) - 1
  if (idx < 0) return 0
  if (idx >= result.periods.length) return 0
  return result.periods[idx].balance
}

/** Interest + principal paid across a given year (1-based). */
export function yearSplit(result: AmortizationResult, year: number): { interest: number; principal: number } {
  const y = result.years.find((v) => v.year === year)
  return y ? { interest: y.interest, principal: y.principal } : { interest: 0, principal: 0 }
}

/* ------------------------------------------------------------------ *
 * Time value of money
 * ------------------------------------------------------------------ */

export function npv(rate: number, cashflows: number[]): number {
  return cashflows.reduce((acc, cf, t) => acc + cf / Math.pow(1 + rate, t), 0)
}

/**
 * IRR by bisection with sign-change detection. Bisection is slower than
 * Newton-Raphson but cannot diverge, which matters for the lumpy cash-flow
 * profiles a refinance produces (large negative, several small positives,
 * a large positive at sale).
 * Returns null when no root exists in a sensible range.
 */
export function irr(cashflows: number[], lo = -0.9999, hi = 10): number | null {
  if (cashflows.length < 2) return null
  const hasPositive = cashflows.some((c) => c > 0)
  const hasNegative = cashflows.some((c) => c < 0)
  if (!hasPositive || !hasNegative) return null

  let fLo = npv(lo, cashflows)
  let fHi = npv(hi, cashflows)

  if (fLo * fHi > 0) {
    // Expand the upper bound once before giving up.
    hi = 100
    fHi = npv(hi, cashflows)
    if (fLo * fHi > 0) return null
  }

  let mid = 0
  for (let i = 0; i < 300; i++) {
    mid = (lo + hi) / 2
    const fMid = npv(mid, cashflows)
    if (Math.abs(fMid) < 1e-9 || (hi - lo) / 2 < 1e-10) return mid
    if (fLo * fMid < 0) {
      hi = mid
      fHi = fMid
    } else {
      lo = mid
      fLo = fMid
    }
  }
  return mid
}

/** Total distributions divided by total contributions. */
export function equityMultiple(cashflows: number[]): number | null {
  const invested = cashflows.filter((c) => c < 0).reduce((a, b) => a + Math.abs(b), 0)
  const returned = cashflows.filter((c) => c > 0).reduce((a, b) => a + b, 0)
  if (invested === 0) return null
  return returned / invested
}

/** Loan amount a given payment can support at these terms. */
export function loanFromPayment(
  payment: number,
  annualRate: number,
  amortizationYears: number,
  compounding: CompoundingConvention,
  freq: PaymentFrequency,
): number {
  const perYear = paymentsPerYear(freq)
  const i = periodicRate(annualRate, compounding, perYear)
  const n = Math.round(amortizationYears * perYear)
  if (payment <= 0 || n <= 0) return 0
  if (i === 0) return payment * n
  return (payment * (1 - Math.pow(1 + i, -n))) / i
}

/** Loan amount supported by NOI at a target DSCR. */
export function maxLoanAtDscr(
  noi: number,
  targetDscr: number,
  annualRate: number,
  amortizationYears: number,
  compounding: CompoundingConvention,
  freq: PaymentFrequency,
): number {
  if (noi <= 0 || targetDscr <= 0) return 0
  const maxAnnualDebtService = noi / targetDscr
  const perYear = paymentsPerYear(freq)
  const perPayment = maxAnnualDebtService / perYear
  return loanFromPayment(perPayment, annualRate, amortizationYears, compounding, freq)
}

/** Convenience constructor so callers do not repeat the terms plumbing. */
export function terms(
  principal: number,
  annualRate: number,
  amortizationYears: number,
  opts: Partial<Omit<MortgageTerms, 'principal' | 'annualRate' | 'amortizationYears'>> = {},
): MortgageTerms {
  return {
    principal,
    annualRate,
    amortizationYears,
    termYears: opts.termYears ?? 5,
    paymentFrequency: opts.paymentFrequency ?? 'MONTHLY',
    compounding: opts.compounding ?? 'SEMI_ANNUAL',
    fees: opts.fees ?? 0,
  }
}
