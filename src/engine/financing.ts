/** §7 Acquisition financing. */

import type { FinancingPlan, MortgageTerms } from './types'
import { amortize, balanceAfterYears, computePayment, yearSplit, type AmortizationResult } from './finance'

export interface DebtResult {
  structure: FinancingPlan['structure']
  downPayment: number
  downPaymentPercent: number
  mortgageAmount: number
  terms: MortgageTerms
  periodicPayment: number
  monthlyPayment: number
  annualDebtService: number
  principalYear1: number
  interestYear1: number
  balances: { years: number; balance: number }[]
  amortization: AmortizationResult
  mortgageFees: number
}

export const BALANCE_CHECKPOINTS = [1, 2, 3, 5, 10]

export function computeDebt(price: number, plan: FinancingPlan): DebtResult {
  const isCash = plan.structure === 'ALL_CASH' || plan.structure === 'CASH_THEN_REFINANCE'

  const downPayment = isCash
    ? price
    : plan.downPaymentAmountOverride !== null && Number.isFinite(plan.downPaymentAmountOverride)
      ? plan.downPaymentAmountOverride
      : price * plan.downPaymentPercent

  const mortgageAmount = Math.max(0, price - downPayment)

  const terms: MortgageTerms = {
    principal: mortgageAmount,
    annualRate: plan.annualRate,
    amortizationYears: plan.amortizationYears,
    termYears: plan.termYears,
    paymentFrequency: plan.paymentFrequency,
    compounding: plan.compounding,
    fees: plan.mortgageFees,
  }

  const amortization = amortize(terms)
  const breakdown = computePayment(terms)
  const y1 = yearSplit(amortization, 1)

  return {
    structure: plan.structure,
    downPayment,
    downPaymentPercent: price > 0 ? downPayment / price : 0,
    mortgageAmount,
    terms,
    periodicPayment: breakdown.periodicPayment,
    monthlyPayment: breakdown.monthlyEquivalent,
    annualDebtService: mortgageAmount > 0 ? breakdown.annualDebtService : 0,
    principalYear1: y1.principal,
    interestYear1: y1.interest,
    balances: BALANCE_CHECKPOINTS.map((years) => ({ years, balance: balanceAfterYears(amortization, years) })),
    amortization,
    mortgageFees: plan.mortgageFees || 0,
  }
}
