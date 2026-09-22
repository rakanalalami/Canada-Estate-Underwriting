/**
 * §16 appreciation, §17 total return, §18 5- and 10-year projection.
 *
 * Appreciation is kept strictly separate from operating performance. The
 * projection reports the operating result (NOI, debt service, cash flow) and
 * the balance-sheet result (value, debt, equity) side by side so a weak
 * cash-flow deal can never be dressed up by an appreciation assumption.
 */

import type { ProjectionAssumptions } from './types'
import type { AmortizationResult } from './finance'
import { balanceAfterYears, equityMultiple, irr, yearSplit } from './finance'
import { safeDiv } from './money'

export interface ProjectionDebt {
  amortization: AmortizationResult | null
  annualDebtService: number
}

export interface ProjectionInput {
  /** Year-1 total potential gross income (rent + ancillary). */
  startingGrossIncome: number
  /** Year-1 operating expenses, excluding debt service. */
  startingOperatingExpenses: number
  vacancyPercent: number
  badDebtPercent: number
  assumptions: ProjectionAssumptions
  /** Value at t0 — normally the purchase price, not an appraisal. */
  startingValue: number
  initialCashInvested: number
  debt: ProjectionDebt
  /** Optional mid-hold refinance (the core strategy). */
  refinance?: {
    atYear: number
    netCashReleased: number
    debt: ProjectionDebt
  }
  years: number
}

export interface ProjectionYear {
  year: number
  grossIncome: number
  vacancyLoss: number
  badDebtLoss: number
  effectiveGrossIncome: number
  operatingExpenses: number
  noi: number
  debtService: number
  cashFlow: number
  cumulativeCashFlow: number
  mortgageBalance: number
  principalRepaid: number
  cumulativePrincipalRepaid: number
  propertyValue: number
  equity: number
  capitalEvent: number
  capitalEventLabel: string
  dscr: number | null
  cashOnCash: number | null
  returnOnEquity: number | null
}

export interface SaleScenario {
  method: 'APPRECIATION' | 'EXIT_CAP'
  label: string
  futureValue: number
  sellingCosts: number
  mortgageRepayment: number
  netSaleProceeds: number
  totalCashFlowCollected: number
  capitalReleasedBeforeSale: number
  totalProfit: number
  irr: number | null
  equityMultiple: number | null
  cashflows: number[]
}

export interface ProjectionResult {
  years: ProjectionYear[]
  valueAt: { year: number; value: number }[]
  saleAtAppreciation: SaleScenario
  saleAtExitCap: SaleScenario | null
  totalCashFlow: number
  totalPrincipalRepaid: number
  totalAppreciation: number
  initialCashInvested: number
}

function debtForYear(input: ProjectionInput, year: number): { debt: ProjectionDebt; scheduleYear: number } {
  if (input.refinance && year > input.refinance.atYear) {
    return { debt: input.refinance.debt, scheduleYear: year - input.refinance.atYear }
  }
  return { debt: input.debt, scheduleYear: year }
}

export function project(input: ProjectionInput): ProjectionResult {
  const a = input.assumptions
  const rows: ProjectionYear[] = []

  let cumulativeCashFlow = 0
  let cumulativePrincipal = 0

  for (let y = 1; y <= input.years; y++) {
    const growth = Math.pow(1 + a.annualRentGrowth, y - 1)
    const inflation = Math.pow(1 + a.annualExpenseInflation, y - 1)

    const grossIncome = input.startingGrossIncome * growth
    const vacancyLoss = grossIncome * input.vacancyPercent
    const badDebtLoss = grossIncome * input.badDebtPercent
    const effectiveGrossIncome = grossIncome - vacancyLoss - badDebtLoss
    const operatingExpenses = input.startingOperatingExpenses * inflation
    const noi = effectiveGrossIncome - operatingExpenses

    const { debt, scheduleYear } = debtForYear(input, y)
    const debtService = debt.annualDebtService
    const split = debt.amortization ? yearSplit(debt.amortization, scheduleYear) : { principal: 0, interest: 0 }
    const mortgageBalance = debt.amortization ? balanceAfterYears(debt.amortization, scheduleYear) : 0

    const cashFlow = noi - debtService
    cumulativeCashFlow += cashFlow
    cumulativePrincipal += split.principal

    const propertyValue = input.startingValue * Math.pow(1 + a.annualAppreciation, y)
    const equity = propertyValue - mortgageBalance

    const isRefiYear = input.refinance && y === input.refinance.atYear
    const capitalEvent = isRefiYear ? input.refinance!.netCashReleased : 0

    rows.push({
      year: y,
      grossIncome,
      vacancyLoss,
      badDebtLoss,
      effectiveGrossIncome,
      operatingExpenses,
      noi,
      debtService,
      cashFlow,
      cumulativeCashFlow,
      mortgageBalance,
      principalRepaid: split.principal,
      cumulativePrincipalRepaid: cumulativePrincipal,
      propertyValue,
      equity,
      capitalEvent,
      capitalEventLabel: isRefiYear ? 'Refinance — net cash released (capital event, not cash flow)' : '',
      dscr: debtService > 0 ? safeDiv(noi, debtService) : null,
      cashOnCash: input.initialCashInvested > 0 ? safeDiv(cashFlow, input.initialCashInvested) : null,
      returnOnEquity: equity > 0 ? safeDiv(cashFlow + split.principal, equity) : null,
    })
  }

  const last = rows[rows.length - 1]

  function buildSale(method: 'APPRECIATION' | 'EXIT_CAP', futureValue: number, label: string): SaleScenario {
    const sellingCosts = futureValue * a.sellingCostsPercent
    const mortgageRepayment = last?.mortgageBalance ?? 0
    const netSaleProceeds = futureValue - sellingCosts - mortgageRepayment
    const totalCashFlowCollected = rows.reduce((s, r) => s + r.cashFlow, 0)
    const capitalReleasedBeforeSale = rows.reduce((s, r) => s + r.capitalEvent, 0)

    const cashflows: number[] = [-input.initialCashInvested]
    for (const r of rows) cashflows.push(r.cashFlow + r.capitalEvent)
    cashflows[cashflows.length - 1] += netSaleProceeds

    const totalProfit = totalCashFlowCollected + capitalReleasedBeforeSale + netSaleProceeds - input.initialCashInvested

    return {
      method,
      label,
      futureValue,
      sellingCosts,
      mortgageRepayment,
      netSaleProceeds,
      totalCashFlowCollected,
      capitalReleasedBeforeSale,
      totalProfit,
      irr: irr(cashflows),
      equityMultiple: equityMultiple(cashflows),
      cashflows,
    }
  }

  const appreciationValue = last?.propertyValue ?? input.startingValue
  const saleAtAppreciation = buildSale(
    'APPRECIATION',
    appreciationValue,
    `Value grown at ${(a.annualAppreciation * 100).toFixed(1)}% per year — an assumption, not a guarantee`,
  )

  const saleAtExitCap =
    a.exitCapRate > 0 && last && last.noi > 0
      ? buildSale('EXIT_CAP', last.noi / a.exitCapRate, `Exit NOI capitalised at ${(a.exitCapRate * 100).toFixed(2)}%`)
      : null

  return {
    years: rows,
    valueAt: [1, 3, 5, 10].map((y) => ({
      year: y,
      value: input.startingValue * Math.pow(1 + a.annualAppreciation, y),
    })),
    saleAtAppreciation,
    saleAtExitCap,
    totalCashFlow: rows.reduce((s, r) => s + r.cashFlow, 0),
    totalPrincipalRepaid: last?.cumulativePrincipalRepaid ?? 0,
    totalAppreciation: (last?.propertyValue ?? input.startingValue) - input.startingValue,
    initialCashInvested: input.initialCashInvested,
  }
}

/** §16 appreciation ladder — 0% through 5% plus a custom rate. */
export const APPRECIATION_LADDER = [0, 0.01, 0.02, 0.03, 0.04, 0.05]

export function appreciationForecast(
  startingValue: number,
  rates: number[] = APPRECIATION_LADDER,
  horizons: number[] = [1, 3, 5, 10],
): { rate: number; values: { year: number; value: number }[] }[] {
  return rates.map((rate) => ({
    rate,
    values: horizons.map((year) => ({ year, value: startingValue * Math.pow(1 + rate, year) })),
  }))
}
