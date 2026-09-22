/**
 * §40.21 First-acquisition mode, §40.22 reverse deal finder and §40.23
 * portfolio goal seek.
 *
 * These run the underwriting backwards: instead of "here is a property, what
 * does it return?", they answer "here is the return I need, what must the
 * property look like?". That is the fastest possible listing screen.
 */

import { computePayment, loanFromPayment } from './finance'
import { safeDiv } from './money'

/* ------------------- §40.21 Property #1 special mode ----------------- */

export interface FirstAcquisitionInput {
  startingCapital: number
  maximumCashPurchase: number
  reserveRequirement: number
  targetCapRate: number
  targetRefinanceLtv: number
  targetMonthlyCashFlow: number
  closingCostPercent: number
  renovationBudget: number
  refinanceRate: number
  refinanceAmortizationYears: number
  refinanceCosts: number
  vacancyPercent: number
  operatingExpenseRatio: number
  minDscr: number
}

export interface FirstAcquisitionResult {
  deployableCapital: number
  maxAllInCost: number
  maxPurchasePrice: number
  estimatedClosingCosts: number
  renovationBudget: number
  minimumRequiredNoi: number
  minimumRequiredAnnualGrossRent: number
  minimumRequiredMonthlyGrossRent: number
  maximumOperatingExpenses: number
  minimumAppraisalRequired: number
  expectedMortgage: number
  expectedAnnualDebtService: number
  expectedMonthlyPayment: number
  expectedRefinanceProceeds: number
  cashRemainingInProperty: number
  cashAfterRefinance: number
  budgetForPropertyTwo: number
  impliedDscr: number | null
  impliedCashOnCash: number | null
  bindingConstraint: 'CAP_RATE' | 'CASH_FLOW' | 'DSCR'
  notes: string[]
}

export function planFirstAcquisition(i: FirstAcquisitionInput): FirstAcquisitionResult {
  const deployableCapital = Math.max(0, i.startingCapital - i.reserveRequirement)
  const maxAllInCost = Math.min(deployableCapital, i.maximumCashPurchase)

  // All-in = price + price*closingRate + renovation  =>  solve for price.
  const maxPurchasePrice = Math.max(
    0,
    (maxAllInCost - i.renovationBudget) / (1 + i.closingCostPercent),
  )
  const estimatedClosingCosts = maxPurchasePrice * i.closingCostPercent

  // Refinance sizing — the appraisal is assumed equal to the purchase price
  // unless the investor proves otherwise (§27, §40.25).
  const expectedMortgage = maxPurchasePrice * i.targetRefinanceLtv
  const payment =
    expectedMortgage > 0
      ? computePayment({
          principal: expectedMortgage,
          annualRate: i.refinanceRate,
          amortizationYears: i.refinanceAmortizationYears,
          termYears: 5,
          paymentFrequency: 'MONTHLY',
          compounding: 'SEMI_ANNUAL',
          fees: 0,
        })
      : null
  const expectedAnnualDebtService = payment?.annualDebtService ?? 0

  const noiFromCap = maxPurchasePrice * i.targetCapRate
  const noiFromCashFlow = i.targetMonthlyCashFlow * 12 + expectedAnnualDebtService
  const noiFromDscr = expectedAnnualDebtService * i.minDscr

  const minimumRequiredNoi = Math.max(noiFromCap, noiFromCashFlow, noiFromDscr)
  const bindingConstraint: FirstAcquisitionResult['bindingConstraint'] =
    minimumRequiredNoi === noiFromCashFlow
      ? 'CASH_FLOW'
      : minimumRequiredNoi === noiFromDscr
        ? 'DSCR'
        : 'CAP_RATE'

  const egiRequired = minimumRequiredNoi / Math.max(0.01, 1 - i.operatingExpenseRatio)
  const gsiRequired = egiRequired / Math.max(0.01, 1 - i.vacancyPercent)

  const expectedRefinanceProceeds = Math.max(0, expectedMortgage - i.refinanceCosts)
  const capitalInProperty = maxPurchasePrice + estimatedClosingCosts + i.renovationBudget
  const cashRemainingInProperty = capitalInProperty - expectedRefinanceProceeds
  const cashAfterRefinance = i.startingCapital - capitalInProperty + expectedRefinanceProceeds
  const budgetForPropertyTwo = Math.max(0, cashAfterRefinance - i.reserveRequirement)

  const notes: string[] = []
  notes.push(
    `The refinance appraisal is assumed equal to the purchase price. Nothing here assumes that letting the units raises the appraised value.`,
  )
  if (bindingConstraint === 'CASH_FLOW') {
    notes.push(
      `Your C$${Math.round(i.targetMonthlyCashFlow).toLocaleString('en-CA')}/month cash-flow target — not the ${(i.targetCapRate * 100).toFixed(2)}% cap rate — is what sets the minimum NOI here.`,
    )
  } else if (bindingConstraint === 'DSCR') {
    notes.push(`The ${i.minDscr.toFixed(2)}x DSCR floor is the binding constraint at this LTV and rate.`)
  } else {
    notes.push(`The ${(i.targetCapRate * 100).toFixed(2)}% cap rate target is the binding constraint.`)
  }
  if (maxPurchasePrice <= 0) {
    notes.push('Deployable capital does not cover a purchase after the reserve and renovation budget.')
  }

  const annualCashFlow = minimumRequiredNoi - expectedAnnualDebtService

  return {
    deployableCapital,
    maxAllInCost,
    maxPurchasePrice,
    estimatedClosingCosts,
    renovationBudget: i.renovationBudget,
    minimumRequiredNoi,
    minimumRequiredAnnualGrossRent: gsiRequired,
    minimumRequiredMonthlyGrossRent: gsiRequired / 12,
    maximumOperatingExpenses: egiRequired - minimumRequiredNoi,
    minimumAppraisalRequired: i.targetRefinanceLtv > 0 ? expectedMortgage / i.targetRefinanceLtv : 0,
    expectedMortgage,
    expectedAnnualDebtService,
    expectedMonthlyPayment: payment?.monthlyEquivalent ?? 0,
    expectedRefinanceProceeds,
    cashRemainingInProperty,
    cashAfterRefinance,
    budgetForPropertyTwo,
    impliedDscr: expectedAnnualDebtService > 0 ? safeDiv(minimumRequiredNoi, expectedAnnualDebtService) : null,
    impliedCashOnCash: cashRemainingInProperty > 0 ? safeDiv(annualCashFlow, cashRemainingInProperty) : null,
    bindingConstraint,
    notes,
  }
}

/* --------------------- §40.22 Reverse deal finder ------------------- */

export interface ReverseDealInput {
  purchaseBudget: number
  targetCapRate: number
  targetMonthlyCashFlowAfterRefinance: number
  refinanceLtv: number
  mortgageRate: number
  amortizationYears: number
  vacancyPercent: number
  operatingExpenseRatio: number
  /** Property tax as an acceptable share of operating expenses. */
  maxPropertyTaxShareOfOpex: number
  minDscr: number
}

export interface ReverseDealResult {
  minimumNoi: number
  minimumAnnualGrossRent: number
  minimumMonthlyGrossRent: number
  maximumOperatingExpenses: number
  maximumAnnualPropertyTax: number
  maximumPurchasePrice: number
  requiredDscr: number | null
  mortgageAmount: number
  annualDebtService: number
  monthlyPayment: number
  impliedMonthlyCashFlow: number
  bindingConstraint: 'CAP_RATE' | 'CASH_FLOW' | 'DSCR'
  perUnitGuide: { units: number; monthlyRentPerUnit: number }[]
  notes: string[]
}

export function reverseDealFinder(i: ReverseDealInput): ReverseDealResult {
  const mortgageAmount = i.purchaseBudget * i.refinanceLtv
  const payment =
    mortgageAmount > 0
      ? computePayment({
          principal: mortgageAmount,
          annualRate: i.mortgageRate,
          amortizationYears: i.amortizationYears,
          termYears: 5,
          paymentFrequency: 'MONTHLY',
          compounding: 'SEMI_ANNUAL',
          fees: 0,
        })
      : null
  const annualDebtService = payment?.annualDebtService ?? 0

  const noiFromCap = i.purchaseBudget * i.targetCapRate
  const noiFromCashFlow = i.targetMonthlyCashFlowAfterRefinance * 12 + annualDebtService
  const noiFromDscr = annualDebtService * i.minDscr
  const minimumNoi = Math.max(noiFromCap, noiFromCashFlow, noiFromDscr)

  const bindingConstraint: ReverseDealResult['bindingConstraint'] =
    minimumNoi === noiFromCashFlow ? 'CASH_FLOW' : minimumNoi === noiFromDscr ? 'DSCR' : 'CAP_RATE'

  const egi = minimumNoi / Math.max(0.01, 1 - i.operatingExpenseRatio)
  const gsi = egi / Math.max(0.01, 1 - i.vacancyPercent)
  const maximumOperatingExpenses = egi - minimumNoi

  return {
    minimumNoi,
    minimumAnnualGrossRent: gsi,
    minimumMonthlyGrossRent: gsi / 12,
    maximumOperatingExpenses,
    maximumAnnualPropertyTax: maximumOperatingExpenses * i.maxPropertyTaxShareOfOpex,
    maximumPurchasePrice: i.targetCapRate > 0 ? minimumNoi / i.targetCapRate : 0,
    requiredDscr: annualDebtService > 0 ? safeDiv(minimumNoi, annualDebtService) : null,
    mortgageAmount,
    annualDebtService,
    monthlyPayment: payment?.monthlyEquivalent ?? 0,
    impliedMonthlyCashFlow: (minimumNoi - annualDebtService) / 12,
    bindingConstraint,
    perUnitGuide: [2, 3, 4, 5, 6].map((units) => ({ units, monthlyRentPerUnit: gsi / 12 / units })),
    notes: [
      `Screen listings against C$${Math.round(gsi / 12).toLocaleString('en-CA')}/month of gross rent at a C$${Math.round(i.purchaseBudget).toLocaleString('en-CA')} price. Anything materially below that cannot meet your criteria however attractive it looks.`,
      `Operating expenses must stay under C$${Math.round(maximumOperatingExpenses).toLocaleString('en-CA')}/year — that is the whole budget for tax, insurance, utilities, management, maintenance and reserves.`,
      'These are screening thresholds computed from your own targets, not a valuation of any specific property.',
    ],
  }
}

/* -------------------- §40.23 Portfolio goal seek -------------------- */

export interface GoalSeekInput {
  targetMonthlyCashFlow: number
  startingCapital: number
  minimumReserve: number
  refinanceLtv: number
  mortgageRate: number
  amortizationYears: number
  vacancyPercent: number
  operatingExpenseRatio: number
  closingCostPercent: number
  minDscr: number
}

export interface GoalSeekStrategy {
  key: 'A' | 'B' | 'C'
  name: string
  properties: number
  averagePurchasePrice: number
  requiredAverageCapRate: number
  requiredAveragePerPropertyCashFlow: number
  requiredAverageNoi: number
  requiredAverageMonthlyGrossRent: number
  totalPortfolioValue: number
  totalDebt: number
  requiredEquity: number
  expectedMonthlyCashFlow: number
  portfolioDscr: number | null
  estimatedUnits: number
  capitalSufficient: boolean
  capitalGap: number
  tradeOffs: string[]
}

export interface GoalSeekResult {
  strategies: GoalSeekStrategy[]
  note: string
}

/**
 * Three ways to reach the same income, deliberately not ranked. Fewer, higher-
 * yielding properties concentrate risk; more, lower-yielding ones spread it but
 * need more capital and more management.
 */
export function portfolioGoalSeek(i: GoalSeekInput): GoalSeekResult {
  const shapes: { key: 'A' | 'B' | 'C'; name: string; properties: number; price: number; unitsPer: number; tradeOffs: string[] }[] = [
    {
      key: 'A',
      name: 'Fewer, higher-yield properties',
      properties: 3,
      price: 650_000,
      unitsPer: 3,
      tradeOffs: [
        'Least capital and least management overhead.',
        'Requires the highest cap rate, which in Ottawa usually means older stock or a weaker pocket.',
        'Concentration risk: one bad building is a third of the portfolio.',
      ],
    },
    {
      key: 'B',
      name: 'Balanced portfolio',
      properties: 4,
      price: 620_000,
      unitsPer: 3,
      tradeOffs: [
        'Cap rate requirement sits close to the 6.5% target for good Ottawa multifamily.',
        'Four refinances means four sets of costs and four renewal dates to stagger.',
        'Reasonable diversification across neighbourhoods.',
      ],
    },
    {
      key: 'C',
      name: 'More, lower-risk properties',
      properties: 5,
      price: 580_000,
      unitsPer: 2,
      tradeOffs: [
        'Lowest required cap rate — newer buildings and stronger locations qualify.',
        'Most capital and the longest timeline to assemble.',
        'Best diversification; most operational work.',
      ],
    },
  ]

  const strategies: GoalSeekStrategy[] = shapes.map((s) => {
    const perProperty = i.targetMonthlyCashFlow / s.properties
    const mortgage = s.price * i.refinanceLtv
    const annualDs =
      mortgage > 0
        ? computePayment({
            principal: mortgage,
            annualRate: i.mortgageRate,
            amortizationYears: i.amortizationYears,
            termYears: 5,
            paymentFrequency: 'MONTHLY',
            compounding: 'SEMI_ANNUAL',
            fees: 0,
          }).annualDebtService
        : 0

    const requiredNoi = Math.max(perProperty * 12 + annualDs, annualDs * i.minDscr)
    const egi = requiredNoi / Math.max(0.01, 1 - i.operatingExpenseRatio)
    const gsi = egi / Math.max(0.01, 1 - i.vacancyPercent)

    const allIn = s.price * (1 + i.closingCostPercent)
    const netReleased = mortgage
    // Capital needed = first purchase in full, then each subsequent purchase
    // funded by the previous refinance. The binding requirement is the largest
    // simultaneous cash outlay, i.e. the trapped capital across the sequence.
    const trappedPerProperty = allIn - netReleased
    const capitalNeeded = trappedPerProperty * s.properties + i.minimumReserve + (allIn - trappedPerProperty) * 0
    const gap = capitalNeeded - i.startingCapital

    return {
      key: s.key,
      name: s.name,
      properties: s.properties,
      averagePurchasePrice: s.price,
      requiredAverageCapRate: requiredNoi / s.price,
      requiredAveragePerPropertyCashFlow: perProperty,
      requiredAverageNoi: requiredNoi,
      requiredAverageMonthlyGrossRent: gsi / 12,
      totalPortfolioValue: s.price * s.properties,
      totalDebt: mortgage * s.properties,
      requiredEquity: (s.price - mortgage) * s.properties,
      expectedMonthlyCashFlow: ((requiredNoi - annualDs) * s.properties) / 12,
      portfolioDscr: annualDs > 0 ? safeDiv(requiredNoi, annualDs) : null,
      estimatedUnits: s.properties * s.unitsPer,
      capitalSufficient: gap <= 0,
      capitalGap: Math.max(0, gap),
      tradeOffs: s.tradeOffs,
    }
  })

  return {
    strategies,
    note: 'None of these is universally best. They trade capital, cap rate, concentration and management load against each other — the right one depends on what you are most willing to give up.',
  }
}

/** Loan a target payment supports — exported for the offer/break-even views. */
export { loanFromPayment }
