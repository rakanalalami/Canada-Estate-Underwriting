/**
 * §9 Cash flow and §17 total return.
 *
 * Principal repayment is NEVER reported as cash flow. It appears only as
 * "equity build from principal repayment", and total return explicitly labels
 * which components are spendable cash and which are non-cash wealth creation.
 */

import type { NoiResult } from './noi'
import { breakEvenOccupancy, cashOnCash, dscr } from './metrics'
import { safeDiv } from './money'

export interface CashFlowResult {
  monthlyGrossRent: number
  monthlyEffectiveIncome: number
  monthlyOperatingExpenses: number
  monthlyNoi: number
  monthlyDebtService: number
  monthlyCashFlow: number

  annualGrossIncome: number
  annualEffectiveIncome: number
  annualOperatingExpenses: number
  annualNoi: number
  annualDebtService: number
  annualPreTaxCashFlow: number

  /** Shown separately — not cash flow. */
  equityBuildFromPrincipalYear1: number
  interestPaidYear1: number

  dscr: number | null
  breakEvenOccupancy: number | null
  cashOnCash: number | null
  cashRemainingInvested: number
}

export interface CashFlowInput {
  noi: NoiResult
  annualDebtService: number
  principalYear1: number
  interestYear1: number
  cashRemainingInvested: number
}

export function computeCashFlow(input: CashFlowInput): CashFlowResult {
  const { noi, annualDebtService } = input
  const annualPreTaxCashFlow = noi.noi - annualDebtService

  return {
    monthlyGrossRent: noi.totalPotentialGrossIncome / 12,
    monthlyEffectiveIncome: noi.effectiveGrossIncome / 12,
    monthlyOperatingExpenses: noi.operatingExpenses / 12,
    monthlyNoi: noi.noi / 12,
    monthlyDebtService: annualDebtService / 12,
    monthlyCashFlow: annualPreTaxCashFlow / 12,

    annualGrossIncome: noi.totalPotentialGrossIncome,
    annualEffectiveIncome: noi.effectiveGrossIncome,
    annualOperatingExpenses: noi.operatingExpenses,
    annualNoi: noi.noi,
    annualDebtService,
    annualPreTaxCashFlow,

    equityBuildFromPrincipalYear1: input.principalYear1,
    interestPaidYear1: input.interestYear1,

    dscr: dscr(noi.noi, annualDebtService),
    breakEvenOccupancy: breakEvenOccupancy(
      noi.operatingExpenses,
      annualDebtService,
      noi.totalPotentialGrossIncome,
    ),
    cashOnCash: cashOnCash(annualPreTaxCashFlow, input.cashRemainingInvested),
    cashRemainingInvested: input.cashRemainingInvested,
  }
}

/* --------------------------- §17 Total return ----------------------- */

export interface TotalReturnComponent {
  key: 'CASH_FLOW' | 'PRINCIPAL' | 'APPRECIATION'
  label: string
  amount: number
  /** Spendable cash this year, or wealth that is only realised on sale/refi. */
  nature: 'CASH' | 'NON_CASH'
}

export interface TotalReturnResult {
  components: TotalReturnComponent[]
  cashComponent: number
  nonCashComponent: number
  totalEquityGain: number
  cashOnCashReturn: number | null
  returnOnEquity: number | null
  totalLeveragedReturn: number | null
  equityBase: number
  cashBase: number
}

export function computeTotalReturn(args: {
  annualPreTaxCashFlow: number
  principalRepaid: number
  appreciation: number
  cashRemainingInvested: number
  equity: number
}): TotalReturnResult {
  const components: TotalReturnComponent[] = [
    { key: 'CASH_FLOW', label: 'Pre-tax cash flow', amount: args.annualPreTaxCashFlow, nature: 'CASH' },
    { key: 'PRINCIPAL', label: 'Principal repayment (equity build)', amount: args.principalRepaid, nature: 'NON_CASH' },
    { key: 'APPRECIATION', label: 'Appreciation (assumption, not guaranteed)', amount: args.appreciation, nature: 'NON_CASH' },
  ]
  const cashComponent = args.annualPreTaxCashFlow
  const nonCashComponent = args.principalRepaid + args.appreciation
  const totalEquityGain = cashComponent + nonCashComponent

  return {
    components,
    cashComponent,
    nonCashComponent,
    totalEquityGain,
    cashOnCashReturn: args.cashRemainingInvested > 0 ? safeDiv(cashComponent, args.cashRemainingInvested) : null,
    returnOnEquity: args.equity > 0 ? safeDiv(totalEquityGain, args.equity) : null,
    totalLeveragedReturn:
      args.cashRemainingInvested > 0 ? safeDiv(totalEquityGain, args.cashRemainingInvested) : null,
    equityBase: args.equity,
    cashBase: args.cashRemainingInvested,
  }
}
