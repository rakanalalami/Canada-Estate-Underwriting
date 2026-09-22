/**
 * §4 Net Operating Income.
 *
 *   Gross Scheduled Rent
 * + Other / ancillary income
 * = Total Potential Gross Income
 * - Vacancy
 * - Bad debt
 * = Effective Gross Income
 * - Operating expenses
 * = NET OPERATING INCOME
 *
 * Mortgage payments, income taxes and capital appreciation are NEVER part of
 * NOI. Nothing in this module has access to the financing model.
 */

import type { ExpenseSet } from './types'
import { resolveExpenses, type ExpenseContext, type ResolvedExpenses } from './expenses'
import { safeDiv } from './money'
import { trace, type TraceStep } from './trace'
import { fmtCAD, fmtPct } from './money'

export interface NoiInput {
  /** Annual residential rent for the scenario. */
  annualResidentialRent: number
  /** Annual ancillary/other income for the scenario. */
  annualOtherIncome: number
  expenses: ExpenseSet
  /** Scenario vacancy overrides the expense set's base vacancy when provided. */
  vacancyPercentOverride?: number | null
  /** Multiplier applied to controllable operating expenses (scenario tuning). */
  expenseFactor?: number
  purchasePrice: number
  unitCount: number
  buildingSqFt: number
}

export interface NoiResult {
  grossScheduledRent: number
  otherIncome: number
  totalPotentialGrossIncome: number
  vacancyPercent: number
  vacancyLoss: number
  badDebtPercent: number
  badDebtLoss: number
  effectiveGrossIncome: number
  collectedResidentialRent: number
  expenses: ResolvedExpenses
  operatingExpenses: number
  noi: number
  noiExcludingCapexReserve: number
  monthlyNoi: number
  noiPerUnit: number | null
  noiPerSqFt: number | null
  expenseRatio: number | null
  steps: TraceStep[]
}

export function computeNoi(input: NoiInput): NoiResult {
  const grossScheduledRent = input.annualResidentialRent
  const otherIncome = input.annualOtherIncome
  const totalPotentialGrossIncome = grossScheduledRent + otherIncome

  const d = input.expenses.deductions
  const vacancyPercent =
    input.vacancyPercentOverride !== undefined && input.vacancyPercentOverride !== null
      ? input.vacancyPercentOverride
      : d.vacancyPercent

  const vacancyLoss =
    d.vacancyAmountOverride !== null && input.vacancyPercentOverride === undefined
      ? d.vacancyAmountOverride
      : totalPotentialGrossIncome * vacancyPercent

  const badDebtPercent = d.badDebtPercent
  const badDebtLoss =
    d.badDebtAmountOverride !== null
      ? d.badDebtAmountOverride
      : totalPotentialGrossIncome * badDebtPercent

  const effectiveGrossIncome = totalPotentialGrossIncome - vacancyLoss - badDebtLoss
  const lossRate = safeDiv(vacancyLoss + badDebtLoss, totalPotentialGrossIncome) ?? 0
  const collectedResidentialRent = grossScheduledRent * (1 - lossRate)

  const ctx: ExpenseContext = {
    grossScheduledIncome: totalPotentialGrossIncome,
    effectiveGrossIncome,
    collectedResidentialRent,
    purchasePrice: input.purchasePrice,
    unitCount: input.unitCount,
    buildingSqFt: input.buildingSqFt,
  }

  const factor = input.expenseFactor ?? 1
  const resolved = resolveExpenses(input.expenses, ctx)
  const scaled: ResolvedExpenses =
    factor === 1
      ? resolved
      : {
          ...resolved,
          lines: resolved.lines.map((l) => ({
            ...l,
            annual: l.annual * factor,
            monthly: (l.annual * factor) / 12,
          })),
          totalAnnual: resolved.totalAnnual * factor,
          totalMonthly: (resolved.totalAnnual * factor) / 12,
          totalAnnualExCapex: resolved.totalAnnualExCapex * factor,
          capexReserveAnnual: resolved.capexReserveAnnual * factor,
          expenseRatio: safeDiv(resolved.totalAnnual * factor, effectiveGrossIncome),
        }

  const operatingExpenses = scaled.totalAnnual
  const noi = effectiveGrossIncome - operatingExpenses
  const noiExcludingCapexReserve = effectiveGrossIncome - scaled.totalAnnualExCapex

  const t = trace()
  t.input('Gross scheduled rent', grossScheduledRent, 'Sum of scenario unit rents x 12')
  t.add('Other / ancillary income', otherIncome, 'Parking + storage + laundry + other x 12')
  t.subtotal('Total potential gross income', totalPotentialGrossIncome)
  t.deduct(
    'Vacancy',
    vacancyLoss,
    `${fmtCAD(totalPotentialGrossIncome)} x ${fmtPct(vacancyPercent)}`,
  )
  t.deduct('Bad debt', badDebtLoss, `${fmtCAD(totalPotentialGrossIncome)} x ${fmtPct(badDebtPercent)}`)
  t.subtotal('Effective gross income', effectiveGrossIncome)
  t.deduct(
    'Operating expenses',
    operatingExpenses,
    input.expenses.includeCapexReserveInNOI
      ? 'Includes CapEx reserve'
      : 'Excludes CapEx reserve (below the line)',
  )
  t.total('NET OPERATING INCOME', noi)
  t.note('Excluded from NOI by definition', 'Mortgage payments · income taxes · capital appreciation')

  return {
    grossScheduledRent,
    otherIncome,
    totalPotentialGrossIncome,
    vacancyPercent,
    vacancyLoss,
    badDebtPercent,
    badDebtLoss,
    effectiveGrossIncome,
    collectedResidentialRent,
    expenses: scaled,
    operatingExpenses,
    noi,
    noiExcludingCapexReserve,
    monthlyNoi: noi / 12,
    noiPerUnit: input.unitCount > 0 ? safeDiv(noi, input.unitCount) : null,
    noiPerSqFt: input.buildingSqFt > 0 ? safeDiv(noi, input.buildingSqFt) : null,
    expenseRatio: scaled.expenseRatio,
    steps: t.build(),
  }
}
