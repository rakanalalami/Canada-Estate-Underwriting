/**
 * §5 cap rate, §10 cash-on-cash, §11 DSCR, §12 break-even, plus the shared
 * status-band vocabulary used by the UI. Bands are advisory labels, never a
 * verdict: a high cap rate in particular is flagged for investigation, not
 * rewarded (§5).
 */

import { safeDiv } from './money'

export type Tone = 'pos' | 'warn' | 'neg' | 'info' | 'muted'

export interface Band {
  key: string
  label: string
  tone: Tone
  note?: string
}

/* ----------------------------- Cap rate ----------------------------- */

export function capRate(noi: number, price: number): number | null {
  if (price <= 0) return null
  return safeDiv(noi, price)
}

export const CAP_RATE_HIGH_WARNING =
  'High cap rates can reflect building condition, tenant risk, location risk, deferred maintenance or unusual operating costs.'

export function capRateBand(rate: number | null): Band {
  if (rate === null || !Number.isFinite(rate)) return { key: 'NA', label: 'No data', tone: 'muted' }
  if (rate < 0) return { key: 'NEGATIVE', label: 'Negative NOI', tone: 'neg', note: 'Operating expenses exceed effective gross income.' }
  if (rate < 0.05) return { key: 'LOW', label: 'Low yield', tone: 'neg' }
  if (rate < 0.06) return { key: 'MODERATE', label: 'Moderate', tone: 'warn' }
  if (rate < 0.065) return { key: 'ATTRACTIVE', label: 'Attractive depending on area', tone: 'info' }
  if (rate < 0.07) return { key: 'STRONG', label: 'Strong target', tone: 'pos' }
  return { key: 'HIGH', label: 'High yield — investigate why', tone: 'warn', note: CAP_RATE_HIGH_WARNING }
}

/* ------------------------------- DSCR ------------------------------- */

export function dscr(noi: number, annualDebtService: number): number | null {
  if (annualDebtService <= 0) return null
  return safeDiv(noi, annualDebtService)
}

export function dscrBand(v: number | null): Band {
  if (v === null || !Number.isFinite(v))
    return { key: 'NO_DEBT', label: 'No debt service', tone: 'muted', note: 'Unlevered — DSCR is not meaningful.' }
  if (v < 1.0)
    return { key: 'FAIL', label: 'Cannot cover debt from NOI', tone: 'neg' }
  if (v < 1.2) return { key: 'WEAK', label: 'Weak', tone: 'neg' }
  if (v < 1.3) return { key: 'MARGINAL', label: 'Marginal', tone: 'warn' }
  if (v < 1.4) return { key: 'ACCEPTABLE', label: 'Acceptable target', tone: 'pos' }
  return { key: 'STRONG', label: 'Strong debt coverage', tone: 'pos' }
}

/* -------------------------- Cash-on-cash ---------------------------- */

/**
 * Annual pre-tax cash flow / cash actually remaining invested.
 * After a refinance the denominator is the trapped cash, not the original
 * outlay — that is the whole point of the recycling strategy (§10).
 */
export function cashOnCash(annualPreTaxCashFlow: number, cashRemainingInvested: number): number | null {
  if (cashRemainingInvested <= 0) return null
  return safeDiv(annualPreTaxCashFlow, cashRemainingInvested)
}

export function cashOnCashBand(v: number | null): Band {
  if (v === null) return { key: 'NA', label: 'No cash invested', tone: 'muted', note: 'All capital has been recycled out — return on remaining equity is undefined.' }
  if (v < 0) return { key: 'NEG', label: 'Negative', tone: 'neg' }
  if (v < 0.04) return { key: 'LOW', label: 'Low', tone: 'warn' }
  if (v < 0.07) return { key: 'MODERATE', label: 'Moderate', tone: 'info' }
  if (v < 0.12) return { key: 'STRONG', label: 'Strong', tone: 'pos' }
  return { key: 'VERY_STRONG', label: 'Very strong — verify inputs', tone: 'pos' }
}

/* --------------------------- Cash flow ------------------------------ */

export function cashFlowBand(monthly: number): Band {
  if (monthly < 0) return { key: 'NEG', label: 'Negative cash flow', tone: 'neg' }
  if (monthly < 250) return { key: 'THIN', label: 'Thin', tone: 'warn' }
  if (monthly < 1000) return { key: 'MODEST', label: 'Modest', tone: 'info' }
  if (monthly < 2000) return { key: 'GOOD', label: 'Good', tone: 'pos' }
  return { key: 'STRONG', label: 'Strong', tone: 'pos' }
}

/* -------------------------- Break-even ------------------------------ */

/**
 * The occupancy level at which the property exactly covers operating expenses
 * and debt service. Above 100% means the property cannot break even even when
 * fully occupied at the modelled rents.
 */
export function breakEvenOccupancy(
  operatingExpenses: number,
  annualDebtService: number,
  totalPotentialGrossIncome: number,
): number | null {
  if (totalPotentialGrossIncome <= 0) return null
  return (operatingExpenses + annualDebtService) / totalPotentialGrossIncome
}

export function breakEvenBand(v: number | null): Band {
  if (v === null) return { key: 'NA', label: 'No data', tone: 'muted' }
  if (v > 1) return { key: 'IMPOSSIBLE', label: 'Cannot break even at full occupancy', tone: 'neg' }
  if (v > 0.95) return { key: 'TIGHT', label: 'Very tight', tone: 'neg' }
  if (v > 0.88) return { key: 'NARROW', label: 'Narrow cushion', tone: 'warn' }
  if (v > 0.8) return { key: 'OK', label: 'Reasonable cushion', tone: 'info' }
  return { key: 'WIDE', label: 'Wide cushion', tone: 'pos' }
}

/* ----------------------- Capital recycling -------------------------- */

export function capitalRecycleRatio(netRefinanceProceeds: number, totalInitialCash: number): number | null {
  if (totalInitialCash <= 0) return null
  return safeDiv(netRefinanceProceeds, totalInitialCash)
}

export function recycleBand(v: number | null): Band {
  if (v === null) return { key: 'NA', label: 'No data', tone: 'muted' }
  if (v < 0.4) return { key: 'LOW', label: 'Low recycling efficiency', tone: 'warn' }
  if (v < 0.55) return { key: 'MODERATE', label: 'Moderate', tone: 'info' }
  if (v < 0.7) return { key: 'STRONG', label: 'Strong', tone: 'pos' }
  return { key: 'HIGH', label: 'High leverage — investigate risk', tone: 'warn', note: 'Extracting this much capital raises debt service and cuts monthly cash flow. Maximum extraction is not automatically the best outcome.' }
}

/* ----------------------------- LTV ---------------------------------- */

export function ltv(debt: number, value: number): number | null {
  if (value <= 0) return null
  return safeDiv(debt, value)
}

export function ltvBand(v: number | null, maxTarget = 0.65): Band {
  if (v === null) return { key: 'NA', label: 'No data', tone: 'muted' }
  if (v <= 0) return { key: 'UNLEVERED', label: 'Unlevered', tone: 'pos' }
  if (v <= maxTarget) return { key: 'WITHIN', label: 'Within target', tone: 'pos' }
  if (v <= maxTarget + 0.1) return { key: 'ABOVE', label: 'Above target', tone: 'warn' }
  return { key: 'HIGH', label: 'High leverage', tone: 'neg' }
}

/* ------------------- Price implied by a target ---------------------- */

/** §12: NOI / target cap rate = maximum purchase price at that yield. */
export function priceAtCapRate(noi: number, targetCap: number): number | null {
  if (targetCap <= 0) return null
  return noi / targetCap
}

export const DEFAULT_TARGET_CAP_RATES = [0.05, 0.055, 0.06, 0.065, 0.07, 0.075, 0.08]
export const DEFAULT_DSCR_TARGETS = [1.2, 1.25, 1.3, 1.4]
export const DEFAULT_REFI_LTVS = [0.5, 0.55, 0.6, 0.65, 0.7, 0.75, 0.8]
export const DEFAULT_OFFER_DISCOUNTS = [0, 0.025, 0.05, 0.075, 0.1]
export const DEFAULT_RATE_SCENARIOS = [0.04, 0.045, 0.05, 0.055, 0.06, 0.065]
export const DEFAULT_RENT_SCENARIOS = [-0.1, -0.05, 0, 0.05, 0.1]
export const DEFAULT_CASHFLOW_TARGETS = [1000, 1500, 2000, 2500]
export const DEFAULT_PORTFOLIO_TARGETS = [3000, 5000, 6000, 7000, 10000]
