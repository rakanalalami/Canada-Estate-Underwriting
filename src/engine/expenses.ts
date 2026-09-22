/**
 * §3 Operating expenses.
 *
 * Every line can be entered as a hard dollar amount or as a percentage of a
 * named basis. There is no hidden circularity: income → vacancy/bad debt →
 * effective gross income → percentage expenses → NOI, in that order.
 *
 * ACTUAL mode uses vendor-supplied figures where they exist and falls back to
 * the model assumption with a visible flag where they do not. ESTIMATED mode
 * always uses the model assumption. The two are never blended silently.
 */

import type { ExpenseKey, ExpenseLine, ExpenseSet, ExpenseSourceMode, PercentBasis } from './types'
import { safeDiv, sum } from './money'

export interface ExpenseContext {
  /** Annual figures. */
  grossScheduledIncome: number
  effectiveGrossIncome: number
  collectedResidentialRent: number
  purchasePrice: number
  unitCount: number
  buildingSqFt: number
}

export interface ResolvedExpense {
  key: ExpenseKey
  label: string
  annual: number
  monthly: number
  mode: 'AMOUNT' | 'PERCENT'
  basis: PercentBasis | null
  percent: number | null
  /** true when the figure came from a verified actual rather than a model rate. */
  isActual: boolean
  /** true when ACTUAL mode was requested but no actual figure exists. */
  estimatedFallback: boolean
  note: string
}

export const PERCENT_BASIS_LABEL: Record<PercentBasis, string> = {
  GROSS_SCHEDULED_INCOME: 'gross scheduled income',
  EFFECTIVE_GROSS_INCOME: 'effective gross income',
  COLLECTED_RESIDENTIAL_RENT: 'collected residential rent',
  PURCHASE_PRICE: 'purchase price',
}

export function basisValue(basis: PercentBasis, ctx: ExpenseContext): number {
  switch (basis) {
    case 'GROSS_SCHEDULED_INCOME':
      return ctx.grossScheduledIncome
    case 'EFFECTIVE_GROSS_INCOME':
      return ctx.effectiveGrossIncome
    case 'COLLECTED_RESIDENTIAL_RENT':
      return ctx.collectedResidentialRent
    case 'PURCHASE_PRICE':
      return ctx.purchasePrice
  }
}

export function resolveExpenseLine(
  line: ExpenseLine,
  ctx: ExpenseContext,
  mode: ExpenseSourceMode,
): ResolvedExpense {
  const base: Omit<ResolvedExpense, 'annual' | 'monthly' | 'isActual' | 'estimatedFallback'> = {
    key: line.key,
    label: line.label,
    mode: line.mode,
    basis: line.mode === 'PERCENT' ? line.basis : null,
    percent: line.mode === 'PERCENT' ? line.percent : null,
    note: line.note,
  }

  if (!line.enabled) {
    return { ...base, annual: 0, monthly: 0, isActual: false, estimatedFallback: false }
  }

  if (mode === 'ACTUAL' && line.actualAmount !== null && Number.isFinite(line.actualAmount)) {
    const annual = line.actualAmount
    return { ...base, annual, monthly: annual / 12, isActual: true, estimatedFallback: false }
  }

  const estimatedFallback = mode === 'ACTUAL'
  const annual =
    line.mode === 'AMOUNT' ? line.amount || 0 : (line.percent || 0) * basisValue(line.basis, ctx)

  return { ...base, annual, monthly: annual / 12, isActual: false, estimatedFallback }
}

export interface ResolvedExpenses {
  lines: ResolvedExpense[]
  /** Operating expenses as configured (CapEx reserve included per the setting). */
  totalAnnual: number
  totalMonthly: number
  /** Always excludes the CapEx reserve, for the alternative cap-rate view. */
  totalAnnualExCapex: number
  capexReserveAnnual: number
  /** Operating expense ratio = operating expenses / effective gross income. */
  expenseRatio: number | null
  perUnitAnnual: number | null
  perSqFtAnnual: number | null
  estimatedFallbackCount: number
}

export function resolveExpenses(
  set: ExpenseSet,
  ctx: ExpenseContext,
): ResolvedExpenses {
  const lines = set.lines.map((l) => resolveExpenseLine(l, ctx, set.mode))
  const capexReserveAnnual = sum(
    lines.filter((l) => l.key === 'CAPEX_RESERVE').map((l) => l.annual),
  )
  const totalAnnualExCapex = sum(
    lines.filter((l) => l.key !== 'CAPEX_RESERVE').map((l) => l.annual),
  )
  const totalAnnual = set.includeCapexReserveInNOI
    ? totalAnnualExCapex + capexReserveAnnual
    : totalAnnualExCapex

  return {
    lines,
    totalAnnual,
    totalMonthly: totalAnnual / 12,
    totalAnnualExCapex,
    capexReserveAnnual,
    expenseRatio: safeDiv(totalAnnual, ctx.effectiveGrossIncome),
    perUnitAnnual: ctx.unitCount > 0 ? safeDiv(totalAnnual, ctx.unitCount) : null,
    perSqFtAnnual: ctx.buildingSqFt > 0 ? safeDiv(totalAnnual, ctx.buildingSqFt) : null,
    estimatedFallbackCount: lines.filter((l) => l.estimatedFallback && l.annual > 0).length,
  }
}

/** Scale only the controllable expenses for scenario tuning. */
const NON_CONTROLLABLE: ExpenseKey[] = ['PROPERTY_TAX', 'CONDO_FEES', 'LICENSING', 'FIRE_INSPECTION']

export function isControllable(key: ExpenseKey): boolean {
  return !NON_CONTROLLABLE.includes(key)
}
