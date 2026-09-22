/**
 * §40.6 automatic projection, §40.12–40.16 stress runs, §40.19 exit /
 * deleveraging and §40.20 end-state mode.
 *
 * Every stress run re-executes the same `simulate()` with one setting changed,
 * so a stressed sequence obeys exactly the same capital rules as the base case.
 */

import { computePayment } from './finance'
import { safeDiv, sum } from './money'
import {
  simulate,
  type SimProperty,
  type SimulationResult,
  type SimulatorSettings,
} from './simulator'

/* ---------------------- §40.6 Auto projection ----------------------- */

export interface AutoProjectionAssumptions {
  averagePurchasePrice: number
  averageCapRate: number
  averageUnits: number
  averageClosingCostPercent: number
  averageRenovationBudget: number
  /** Appraisal at refinance as a multiple of purchase price. 1.0 = no uplift. */
  averageAppraisalFactor: number
  averageRefinanceLtv: number
  averageMortgageRate: number
  averageAmortizationYears: number
  averageRefinanceCosts: number
  averageMonthsToRefinance: number
  averageMonthsBetweenAcquisitions: number
  averageVacancy: number
  averageOperatingExpenseRatio: number
  maxProperties: number
}

export function buildAutoProperties(a: AutoProjectionAssumptions): SimProperty[] {
  const out: SimProperty[] = []
  for (let i = 0; i < a.maxProperties; i++) {
    const price = a.averagePurchasePrice
    // Back out the gross rent that delivers the target cap rate at this price.
    const noi = price * a.averageCapRate
    const egi = noi / Math.max(0.01, 1 - a.averageOperatingExpenseRatio)
    const gsi = egi / Math.max(0.01, 1 - a.averageVacancy)
    out.push({
      id: `auto-${i + 1}`,
      name: `Projected property ${i + 1}`,
      linkedDealId: null,
      purchasePrice: price,
      closingCosts: price * a.averageClosingCostPercent,
      renovationCosts: a.averageRenovationBudget,
      units: a.averageUnits,
      stabilizedGrossAnnualRent: gsi,
      currentGrossAnnualRent: gsi * 0.95,
      vacancyPercent: a.averageVacancy,
      operatingExpenseRatio: a.averageOperatingExpenseRatio,
      operatingExpensesAnnual: 0,
      monthsToStabilization: Math.max(1, Math.round(a.averageMonthsToRefinance * 0.6)),
      monthsUntilRefinance: a.averageMonthsToRefinance,
      appraisalLow: price * Math.min(1, a.averageAppraisalFactor) * 0.95,
      appraisalBase: price * a.averageAppraisalFactor,
      appraisalHigh: price * a.averageAppraisalFactor * 1.06,
      refinanceLtv: a.averageRefinanceLtv,
      refinanceRate: a.averageMortgageRate,
      refinanceAmortizationYears: a.averageAmortizationYears,
      refinanceTermYears: 5,
      refinanceCosts: a.averageRefinanceCosts,
      paymentFrequency: 'MONTHLY',
      compounding: 'SEMI_ANNUAL',
      neighbourhood: 'Projected',
      propertyType: 'Projected',
      gapMonthsAfterRefinance: Math.max(0, a.averageMonthsBetweenAcquisitions),
      enabled: true,
    })
  }
  return out
}

export interface Milestone {
  month: number
  label: string
  detail: string
  cashBalance: number
  monthlyCashFlow: number
  portfolioValue: number
  portfolioDebt: number
}

export function milestonesFrom(result: SimulationResult): Milestone[] {
  return result.events
    .filter((e) => e.type === 'ACQUIRE' || e.type === 'REFINANCE' || e.type === 'BLOCKED')
    .map((e) => ({
      month: e.month,
      label: e.label,
      detail: e.detail,
      cashBalance: e.cashBalance,
      monthlyCashFlow: e.monthlyCashFlow,
      portfolioValue: e.portfolioValue,
      portfolioDebt: e.portfolioDebt,
    }))
}

/* ------------------------- Stress harness --------------------------- */

export interface StressRow<T> {
  variant: T
  label: string
  acquiredCount: number
  totalUnits: number
  monthlyCashFlow: number
  portfolioDscr: number | null
  portfolioDebt: number
  portfolioValue: number
  portfolioLtv: number | null
  finalCash: number
  totalCapitalRecycled: number
  reserveBreached: boolean
}

function toRow<T>(variant: T, label: string, r: SimulationResult): StressRow<T> {
  return {
    variant,
    label,
    acquiredCount: r.acquiredCount,
    totalUnits: r.totalUnits,
    monthlyCashFlow: r.monthlyCashFlow,
    portfolioDscr: r.portfolioDscr,
    portfolioDebt: r.portfolioDebt,
    portfolioValue: r.portfolioValue,
    portfolioLtv: r.portfolioLtv,
    finalCash: r.finalCash,
    totalCapitalRecycled: r.totalCapitalRecycled,
    reserveBreached: r.reserve.belowThreshold,
  }
}

/** §40.15 — run the whole sequence at each refinance rate. */
export function interestRateStress(
  properties: SimProperty[],
  settings: SimulatorSettings,
  rates: number[],
): StressRow<number>[] {
  return rates.map((rate) =>
    toRow(rate, `${(rate * 100).toFixed(2)}%`, simulate(properties, { ...settings, rateOverride: rate })),
  )
}

/** §40.16 — run the whole sequence at each rent level. */
export function rentStress(
  properties: SimProperty[],
  settings: SimulatorSettings,
  deltas: number[],
): StressRow<number>[] {
  return deltas.map((d) =>
    toRow(
      d,
      d === 0 ? 'Base' : `${d > 0 ? '+' : ''}${(d * 100).toFixed(0)}%`,
      simulate(properties, { ...settings, rentFactor: 1 + d }),
    ),
  )
}

/** §40.13 — run the whole sequence at each refinance delay. */
export function refinanceDelayStressSequence(
  properties: SimProperty[],
  settings: SimulatorSettings,
  months: number[],
): StressRow<number>[] {
  return months.map((m) =>
    toRow(m, `${m} months`, simulate(properties, { ...settings, refinanceDelayOverride: m })),
  )
}

/** §40.14 — run the whole sequence at each appraisal case. */
export function appraisalStress(
  properties: SimProperty[],
  settings: SimulatorSettings,
): StressRow<'LOW' | 'BASE' | 'HIGH'>[] {
  return (['LOW', 'BASE', 'HIGH'] as const).map((c) =>
    toRow(c, c === 'LOW' ? 'Low appraisal' : c === 'BASE' ? 'Base appraisal' : 'High appraisal', simulate(properties, { ...settings, appraisalCase: c })),
  )
}

/** §40.9 across the whole sequence. */
export function ltvStress(
  properties: SimProperty[],
  settings: SimulatorSettings,
  ltvs: number[],
): StressRow<number>[] {
  return ltvs.map((l) =>
    toRow(l, `${(l * 100).toFixed(0)}% LTV`, simulate(properties, { ...settings, ltvOverride: l })),
  )
}

/* ------------------- §40.19 Exit / deleveraging --------------------- */

export type ExitAction =
  | 'SELL_PROPERTY'
  | 'PAY_DOWN_MORTGAGE'
  | 'STOP_ACQUIRING'
  | 'CASH_FLOW_TO_DEBT'
  | 'REFINANCE_LOWER_LTV'
  | 'SELL_WEAKEST'

export interface ExitScenarioInput {
  result: SimulationResult
  action: ExitAction
  /** Property targeted by the action, where the action needs one. */
  propertyId: string | null
  /** Cash applied to a pay-down. */
  payDownAmount: number
  /** New LTV for a deleveraging refinance. */
  targetLtv: number
  sellingCostPercent: number
}

export interface ExitScenarioResult {
  action: ExitAction
  label: string
  description: string
  cashGenerated: number
  portfolioDebtAfter: number
  portfolioValueAfter: number
  portfolioEquityAfter: number
  monthlyCashFlowAfter: number
  monthlyCashFlowDelta: number
  portfolioDscrAfter: number | null
  liquidityAfter: number
  unitsAfter: number
  yearsToDebtFree: number | null
  note: string
}

export function runExitScenario(input: ExitScenarioInput): ExitScenarioResult {
  const r = input.result
  const owned = r.properties.filter((p) => p.acquired)
  const annualNoi = sum(owned.map((p) => p.annualNoi))
  const annualDebtService = sum(owned.map((p) => p.annualDebtService))

  const base = {
    cashGenerated: 0,
    portfolioDebtAfter: r.portfolioDebt,
    portfolioValueAfter: r.portfolioValue,
    portfolioEquityAfter: r.portfolioEquity,
    monthlyCashFlowAfter: r.monthlyCashFlow,
    monthlyCashFlowDelta: 0,
    portfolioDscrAfter: annualDebtService > 0 ? safeDiv(annualNoi, annualDebtService) : null,
    liquidityAfter: r.finalCash,
    unitsAfter: r.totalUnits,
    yearsToDebtFree: null as number | null,
  }

  const pick = () => {
    if (input.propertyId) return owned.find((p) => p.id === input.propertyId) ?? null
    return null
  }

  switch (input.action) {
    case 'SELL_PROPERTY':
    case 'SELL_WEAKEST': {
      const target =
        input.action === 'SELL_WEAKEST'
          ? [...owned].sort(
              (a, b) => (a.postRefinanceMonthlyCashFlow ?? 0) - (b.postRefinanceMonthlyCashFlow ?? 0),
            )[0]
          : pick()
      if (!target) {
        return {
          action: input.action,
          label: 'Sell a property',
          description: 'No property selected.',
          ...base,
          note: 'Select a property to model the sale.',
        }
      }
      const gross = target.appraisedValue
      const sellingCosts = gross * input.sellingCostPercent
      const proceeds = gross - sellingCosts - target.mortgageAmount
      const noiAfter = annualNoi - target.annualNoi
      const dsAfter = annualDebtService - target.annualDebtService
      return {
        action: input.action,
        label: input.action === 'SELL_WEAKEST' ? `Sell weakest performer — ${target.name}` : `Sell ${target.name}`,
        description: `Sale at C$${Math.round(gross).toLocaleString('en-CA')} less ${(input.sellingCostPercent * 100).toFixed(1)}% costs and the C$${Math.round(target.mortgageAmount).toLocaleString('en-CA')} mortgage.`,
        cashGenerated: proceeds,
        portfolioDebtAfter: r.portfolioDebt - target.mortgageAmount,
        portfolioValueAfter: r.portfolioValue - target.purchasePrice,
        portfolioEquityAfter: r.portfolioEquity - (gross - target.mortgageAmount),
        monthlyCashFlowAfter: r.monthlyCashFlow - target.postRefinanceMonthlyCashFlow,
        monthlyCashFlowDelta: -target.postRefinanceMonthlyCashFlow,
        portfolioDscrAfter: dsAfter > 0 ? safeDiv(noiAfter, dsAfter) : null,
        liquidityAfter: r.finalCash + proceeds,
        unitsAfter: r.totalUnits - target.units,
        yearsToDebtFree: null,
        note: 'Selling realises appreciation as cash but permanently removes that property\'s income. Land transfer tax and closing costs on a replacement are a real drag.',
      }
    }

    case 'PAY_DOWN_MORTGAGE': {
      const target = pick() ?? owned[0]
      if (!target) return { action: input.action, label: 'Pay down a mortgage', description: 'No property.', ...base, note: '' }
      const amount = Math.min(input.payDownAmount, target.mortgageAmount, r.finalCash)
      const newPrincipal = target.mortgageAmount - amount
      const newPayment = computePayment({
        principal: newPrincipal,
        annualRate: target.mortgageRate,
        amortizationYears: 25,
        termYears: 5,
        paymentFrequency: 'MONTHLY',
        compounding: 'SEMI_ANNUAL',
        fees: 0,
      })
      const newAnnualDs = newPrincipal > 0 ? newPayment.annualDebtService : 0
      const delta = (target.annualDebtService - newAnnualDs) / 12
      const dsAfter = annualDebtService - target.annualDebtService + newAnnualDs
      return {
        action: input.action,
        label: `Pay down ${target.name}`,
        description: `C$${Math.round(amount).toLocaleString('en-CA')} applied to a C$${Math.round(target.mortgageAmount).toLocaleString('en-CA')} mortgage.`,
        cashGenerated: -amount,
        portfolioDebtAfter: r.portfolioDebt - amount,
        portfolioValueAfter: r.portfolioValue,
        portfolioEquityAfter: r.portfolioEquity + amount,
        monthlyCashFlowAfter: r.monthlyCashFlow + delta,
        monthlyCashFlowDelta: delta,
        portfolioDscrAfter: dsAfter > 0 ? safeDiv(annualNoi, dsAfter) : null,
        liquidityAfter: r.finalCash - amount,
        unitsAfter: r.totalUnits,
        yearsToDebtFree: null,
        note: 'Paying down converts liquid cash into illiquid equity. It raises monthly income and DSCR but removes capital from the recycling engine.',
      }
    }

    case 'STOP_ACQUIRING': {
      return {
        action: input.action,
        label: 'Stop acquiring',
        description: 'Hold the current portfolio, deploy no further capital.',
        ...base,
        liquidityAfter: r.finalCash,
        note: `Holding here locks in C$${Math.round(r.monthlyCashFlow).toLocaleString('en-CA')}/month with C$${Math.round(r.finalCash).toLocaleString('en-CA')} of liquidity retained. Debt stops growing and reserves stay intact.`,
      }
    }

    case 'CASH_FLOW_TO_DEBT': {
      const annualCf = r.monthlyCashFlow * 12
      const years = annualCf > 0 ? r.portfolioDebt / annualCf : null
      return {
        action: input.action,
        label: 'Direct cash flow to debt reduction',
        description: `C$${Math.round(annualCf).toLocaleString('en-CA')}/year applied against C$${Math.round(r.portfolioDebt).toLocaleString('en-CA')} of debt.`,
        ...base,
        yearsToDebtFree: years,
        note: years
          ? `Ignoring scheduled amortization and rate changes, roughly ${years.toFixed(1)} years of cash flow would clear the portfolio debt. Scheduled principal repayment shortens this further.`
          : 'Portfolio cash flow is not positive, so debt cannot be reduced from operations.',
      }
    }

    case 'REFINANCE_LOWER_LTV': {
      const newDebt = sum(owned.map((p) => p.appraisedValue * input.targetLtv))
      const newDs = sum(
        owned.map((p) => {
          const principal = p.appraisedValue * input.targetLtv
          if (principal <= 0) return 0
          return computePayment({
            principal,
            annualRate: p.mortgageRate,
            amortizationYears: 25,
            termYears: 5,
            paymentFrequency: 'MONTHLY',
            compounding: 'SEMI_ANNUAL',
            fees: 0,
          }).annualDebtService
        }),
      )
      const cfAfter = (annualNoi - newDs) / 12
      const cashUsed = r.portfolioDebt - newDebt
      return {
        action: input.action,
        label: `Refinance the portfolio at ${(input.targetLtv * 100).toFixed(0)}% LTV`,
        description: `Debt moves from C$${Math.round(r.portfolioDebt).toLocaleString('en-CA')} to C$${Math.round(newDebt).toLocaleString('en-CA')}.`,
        cashGenerated: -cashUsed,
        portfolioDebtAfter: newDebt,
        portfolioValueAfter: r.portfolioValue,
        portfolioEquityAfter: r.portfolioValue - newDebt,
        monthlyCashFlowAfter: cfAfter,
        monthlyCashFlowDelta: cfAfter - r.monthlyCashFlow,
        portfolioDscrAfter: newDs > 0 ? safeDiv(annualNoi, newDs) : null,
        liquidityAfter: r.finalCash - cashUsed,
        unitsAfter: r.totalUnits,
        yearsToDebtFree: null,
        note: 'Deleveraging trades capital availability for income and coverage. This is the mirror image of the extraction trade-off on the LTV ladder.',
      }
    }
  }
}

/* ---------------------- §40.20 End-state mode ----------------------- */

export interface EndStateTarget {
  properties: number
  units: number
  portfolioValue: number
  portfolioDebt: number
  portfolioEquity: number
  monthlyCashFlow: number
}

export interface EndStateGap {
  metric: string
  target: number
  current: number
  gap: number
  percentAchieved: number
  format: 'currency' | 'number'
}

export interface EndStateResult {
  gaps: EndStateGap[]
  propertiesRemaining: number
  monthlyCashFlowShortfall: number
  /** What the next property must deliver to close the gap on its own. */
  requiredMonthlyCashFlowFromNext: number
  requiredAnnualNoiFromNext: number
  requiredCapRateAtBudget: number | null
  maxAcceptablePurchasePrice: number | null
  maxMortgage: number
  assumedLtv: number
  assumedRate: number
  narrative: string
}

export function evaluateEndState(
  result: SimulationResult,
  target: EndStateTarget,
  assumptions: { nextBudget: number; ltv: number; rate: number; amortizationYears: number; minDscr: number },
): EndStateResult {
  const gaps: EndStateGap[] = [
    { metric: 'Properties', target: target.properties, current: result.acquiredCount, gap: target.properties - result.acquiredCount, percentAchieved: target.properties > 0 ? result.acquiredCount / target.properties : 1, format: 'number' },
    { metric: 'Units', target: target.units, current: result.totalUnits, gap: target.units - result.totalUnits, percentAchieved: target.units > 0 ? result.totalUnits / target.units : 1, format: 'number' },
    { metric: 'Portfolio value', target: target.portfolioValue, current: result.portfolioValue, gap: target.portfolioValue - result.portfolioValue, percentAchieved: target.portfolioValue > 0 ? result.portfolioValue / target.portfolioValue : 1, format: 'currency' },
    { metric: 'Portfolio debt', target: target.portfolioDebt, current: result.portfolioDebt, gap: target.portfolioDebt - result.portfolioDebt, percentAchieved: target.portfolioDebt > 0 ? result.portfolioDebt / target.portfolioDebt : 1, format: 'currency' },
    { metric: 'Portfolio equity', target: target.portfolioEquity, current: result.portfolioEquity, gap: target.portfolioEquity - result.portfolioEquity, percentAchieved: target.portfolioEquity > 0 ? result.portfolioEquity / target.portfolioEquity : 1, format: 'currency' },
    { metric: 'Monthly cash flow', target: target.monthlyCashFlow, current: result.monthlyCashFlow, gap: target.monthlyCashFlow - result.monthlyCashFlow, percentAchieved: target.monthlyCashFlow > 0 ? result.monthlyCashFlow / target.monthlyCashFlow : 1, format: 'currency' },
  ]

  const propertiesRemaining = Math.max(0, target.properties - result.acquiredCount)
  const shortfall = Math.max(0, target.monthlyCashFlow - result.monthlyCashFlow)
  const perProperty = propertiesRemaining > 0 ? shortfall / propertiesRemaining : shortfall

  const mortgage = assumptions.nextBudget * assumptions.ltv
  const annualDs =
    mortgage > 0
      ? computePayment({
          principal: mortgage,
          annualRate: assumptions.rate,
          amortizationYears: assumptions.amortizationYears,
          termYears: 5,
          paymentFrequency: 'MONTHLY',
          compounding: 'SEMI_ANNUAL',
          fees: 0,
        }).annualDebtService
      : 0

  const requiredAnnualNoi = perProperty * 12 + annualDs
  const requiredNoiForDscr = annualDs * assumptions.minDscr
  const bindingNoi = Math.max(requiredAnnualNoi, requiredNoiForDscr)

  return {
    gaps,
    propertiesRemaining,
    monthlyCashFlowShortfall: shortfall,
    requiredMonthlyCashFlowFromNext: perProperty,
    requiredAnnualNoiFromNext: bindingNoi,
    requiredCapRateAtBudget: assumptions.nextBudget > 0 ? bindingNoi / assumptions.nextBudget : null,
    maxAcceptablePurchasePrice: bindingNoi > 0 && assumptions.nextBudget > 0 ? assumptions.nextBudget : null,
    maxMortgage: mortgage,
    assumedLtv: assumptions.ltv,
    assumedRate: assumptions.rate,
    narrative:
      propertiesRemaining > 0
        ? `To reach C$${Math.round(target.monthlyCashFlow).toLocaleString('en-CA')}/month with ${propertiesRemaining} additional ${propertiesRemaining === 1 ? 'property' : 'properties'}, each must generate at least C$${Math.round(perProperty).toLocaleString('en-CA')}/month after debt service — an annual NOI of about C$${Math.round(bindingNoi).toLocaleString('en-CA')} at a C$${Math.round(assumptions.nextBudget).toLocaleString('en-CA')} budget and ${(assumptions.ltv * 100).toFixed(0)}% LTV, which is a ${assumptions.nextBudget > 0 ? ((bindingNoi / assumptions.nextBudget) * 100).toFixed(2) : '—'}% cap rate.`
        : shortfall > 0
          ? `The target property count is already met but cash flow is C$${Math.round(shortfall).toLocaleString('en-CA')}/month short. Closing the gap means raising NOI on what you own or deleveraging, not buying more.`
          : 'The end-state target is met by the modelled portfolio.',
  }
}
