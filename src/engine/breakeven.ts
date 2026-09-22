/**
 * §12 Break-even analysis: what the property can support, and what it is worth
 * at each target yield. This is the section that answers "what should I pay?".
 */

import type { CompoundingConvention, PaymentFrequency } from './types'
import { loanFromPayment, maxLoanAtDscr, paymentsPerYear } from './finance'
import { breakEvenOccupancy, priceAtCapRate } from './metrics'

export interface MaxLoanRow {
  dscr: number
  maxAnnualDebtService: number
  maxMonthlyPayment: number
  maxLoan: number
  impliedPriceAtLtv: number | null
}

export interface MaxPriceRow {
  capRate: number
  maxPrice: number | null
  vsAskingPrice: number | null
  vsOfferPrice: number | null
}

export interface BreakEvenResult {
  breakEvenOccupancy: number | null
  /** Debt service NOI can carry at exactly 1.00x. */
  maxAnnualDebtServiceAtParity: number
  maxMonthlyPaymentAtParity: number
  maxLoanAtParity: number
  maxLoans: MaxLoanRow[]
  maxPrices: MaxPriceRow[]
  /** Rent level at which cash flow hits zero, as a share of modelled rent. */
  breakEvenRentFactor: number | null
}

export function computeBreakEven(args: {
  noi: number
  operatingExpenses: number
  totalPotentialGrossIncome: number
  annualDebtService: number
  annualRate: number
  amortizationYears: number
  compounding: CompoundingConvention
  paymentFrequency: PaymentFrequency
  dscrTargets: number[]
  capTargets: number[]
  askingPrice: number
  offerPrice: number
  refinanceLtv: number
}): BreakEvenResult {
  const perYear = paymentsPerYear(args.paymentFrequency)
  const maxLoanAtParityValue = maxLoanAtDscr(
    args.noi,
    1,
    args.annualRate,
    args.amortizationYears,
    args.compounding,
    args.paymentFrequency,
  )

  const maxLoans: MaxLoanRow[] = args.dscrTargets.map((d) => {
    const maxAnnualDebtService = d > 0 ? args.noi / d : 0
    const maxPayment = maxAnnualDebtService / perYear
    const maxLoan = loanFromPayment(
      maxPayment,
      args.annualRate,
      args.amortizationYears,
      args.compounding,
      args.paymentFrequency,
    )
    return {
      dscr: d,
      maxAnnualDebtService,
      maxMonthlyPayment: maxAnnualDebtService / 12,
      maxLoan,
      impliedPriceAtLtv: args.refinanceLtv > 0 ? maxLoan / args.refinanceLtv : null,
    }
  })

  const maxPrices: MaxPriceRow[] = args.capTargets.map((c) => {
    const maxPrice = priceAtCapRate(args.noi, c)
    return {
      capRate: c,
      maxPrice,
      vsAskingPrice: maxPrice !== null && args.askingPrice > 0 ? maxPrice - args.askingPrice : null,
      vsOfferPrice: maxPrice !== null && args.offerPrice > 0 ? maxPrice - args.offerPrice : null,
    }
  })

  // Rent factor at which NOI exactly equals debt service.
  // NOI(f) = EGI*f - opex  (expenses held flat), so f* = (debtService + opex) / EGI.
  const egi = args.noi + args.operatingExpenses
  const breakEvenRentFactor = egi > 0 ? (args.annualDebtService + args.operatingExpenses) / egi : null

  return {
    breakEvenOccupancy: breakEvenOccupancy(
      args.operatingExpenses,
      args.annualDebtService,
      args.totalPotentialGrossIncome,
    ),
    maxAnnualDebtServiceAtParity: args.noi,
    maxMonthlyPaymentAtParity: args.noi / 12,
    maxLoanAtParity: maxLoanAtParityValue,
    maxLoans,
    maxPrices,
    breakEvenRentFactor,
  }
}
