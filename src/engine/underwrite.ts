/**
 * Top-level underwriting orchestrator.
 *
 * One deal in, every §1–§23 and §28 output out. Every derived figure here is
 * produced by the pure modules beside this file, so the same maths drives the
 * dashboard, the sensitivity matrices, the exports and the portfolio roll-up —
 * there is exactly one implementation of each formula in this codebase.
 */

import type { Deal, InvestorProfile, ScenarioKey, ScenarioTuning } from './types'
import { summarizeRentRoll, scenarioIncome, type RentRollSummary, type ScenarioIncome } from './rentRoll'
import { computeNoi, type NoiResult } from './noi'
import { amortize } from './finance'
import { computeAcquisitionCosts, type AcquisitionCosts } from './purchase'
import { computeDebt, type DebtResult } from './financing'
import { computeCashFlow, computeTotalReturn, type CashFlowResult, type TotalReturnResult } from './cashflow'
import {
  computeAppraisalMatrix,
  computeLtvLadder,
  computeRefinance,
  refinanceDelayStress,
  type AppraisalMatrixCell,
  type LtvLadder,
  type RefinanceDelayRow,
  type RefinanceResult,
} from './refinance'
import { computeBreakEven, type BreakEvenResult } from './breakeven'
import { buildOfferLadder, buildTargetPrices, type OfferMetrics, type OfferRow, type TargetPriceRow } from './offer'
import { buildSensitivitySet, pricesAround, type SensitivityMatrix, type SensitivityMetrics } from './sensitivity'
import { appreciationForecast, project, type ProjectionInput, type ProjectionResult } from './projection'
import { buildCapexForecast, type CapexForecast } from './capex'
import { assessLegalRisk, type LegalRiskResult } from './legal'
import { buildScorecard, conditionScore, type ScorecardResult } from './scorecard'
import { evaluateDealBreakers, type DealBreakerEvaluation } from './dealBreakers'
import {
  compareSubjectToComps,
  summarizeRentComps,
  summarizeSaleComps,
  suggestedRentForBedrooms,
  type RentCompSummary,
  type SaleCompSummary,
  type SubjectVsComps,
} from './comps'
import {
  capRate,
  cashOnCash,
  DEFAULT_CASHFLOW_TARGETS,
  DEFAULT_DSCR_TARGETS,
  DEFAULT_OFFER_DISCOUNTS,
  DEFAULT_RATE_SCENARIOS,
  DEFAULT_REFI_LTVS,
  DEFAULT_RENT_SCENARIOS,
  DEFAULT_TARGET_CAP_RATES,
} from './metrics'
import { safeDiv, sum } from './money'

export const SCENARIO_LABELS: Record<ScenarioKey, string> = {
  CONSERVATIVE: 'Conservative / Current',
  STABILIZED: 'Stabilized / Base',
  OPTIMISTIC: 'Optimistic',
}

export const SCENARIO_DESCRIPTIONS: Record<ScenarioKey, string> = {
  CONSERVATIVE:
    'Actual in-place rents, actual expenses, higher vacancy, no assumed rent reset, non-conforming income excluded.',
  STABILIZED:
    'Vacant units let at reasonable market rents, realistic operating assumptions. Occupied units keep their contract rent.',
  OPTIMISTIC:
    'Higher achievable rents, lower vacancy, operational improvements delivered. Never the default view.',
}

export interface ScenarioResult {
  key: ScenarioKey
  label: string
  description: string
  income: ScenarioIncome
  noi: NoiResult
  capRateOnAsking: number | null
  capRateOnOffer: number | null
  capRateExCapexReserve: number | null
  debt: DebtResult
  cashFlow: CashFlowResult
  breakEven: BreakEvenResult
  cashRemainingInvested: number
  warnings: string[]
}

export interface UnderwriteOptions {
  profile: InvestorProfile
  /** Override the price used for the whole underwriting (offer analysis). */
  priceOverride?: number
  /** Override the acquisition mortgage rate (sensitivity). */
  rateOverride?: number
  /** Global rent multiplier (sensitivity / stress). */
  rentFactorOverride?: number
}

export interface UnderwriteResult {
  deal: Deal
  price: number
  askingPrice: number
  rentRoll: RentRollSummary
  rentComps: RentCompSummary
  saleComps: SaleCompSummary
  subjectVsComps: SubjectVsComps
  scenarios: Record<ScenarioKey, ScenarioResult>
  acquisition: AcquisitionCosts
  refinance: RefinanceResult
  refinanceOnConservativeNoi: RefinanceResult
  ltvLadder: LtvLadder
  appraisalMatrix: AppraisalMatrixCell[]
  refinanceDelay: RefinanceDelayRow[]
  projection: ProjectionResult
  projectionTenYear: ProjectionResult
  appreciation: ReturnType<typeof appreciationForecast>
  totalReturnYear1: TotalReturnResult
  sensitivity: SensitivityMatrix[]
  capex: CapexForecast
  legal: LegalRiskResult
  scorecard: ScorecardResult
  dealBreakers: DealBreakerEvaluation
  offers: OfferRow[]
  targetPrices: TargetPriceRow[]
  warnings: string[]
}

function tuningFor(deal: Deal, key: ScenarioKey): ScenarioTuning {
  switch (key) {
    case 'CONSERVATIVE':
      return deal.scenarios.conservative
    case 'STABILIZED':
      return deal.scenarios.stabilized
    case 'OPTIMISTIC':
      return deal.scenarios.optimistic
  }
}

/** Comp-derived conservative rent per unit, matched on bedroom count. */
function conservativeRentMap(deal: Deal, comps: RentCompSummary): Record<string, number> {
  const map: Record<string, number> = {}
  for (const u of deal.units) {
    const s = suggestedRentForBedrooms(comps, u.bedrooms)
    map[u.id] = s.conservative ?? u.marketRent ?? 0
  }
  return map
}

export function buildScenario(
  deal: Deal,
  key: ScenarioKey,
  price: number,
  opts: {
    rateOverride?: number
    rentFactorOverride?: number
    conservativeRentByUnit?: Record<string, number>
  } = {},
): ScenarioResult {
  const baseTuning = tuningFor(deal, key)
  const tuning: ScenarioTuning = {
    ...baseTuning,
    rentFactor: baseTuning.rentFactor * (opts.rentFactorOverride ?? 1),
    // The conservative case never marks sitting tenants to market, whatever
    // the stored tuning says.
    markOccupiedToMarket: key === 'CONSERVATIVE' ? false : baseTuning.markOccupiedToMarket,
  }

  const income = scenarioIncome({
    units: deal.units,
    tuning,
    legal: deal.legal,
    excludeNonConforming: key === 'CONSERVATIVE',
    conservativeRentByUnit: opts.conservativeRentByUnit,
  })

  const noi = computeNoi({
    annualResidentialRent: income.monthlyResidentialRent * 12,
    annualOtherIncome: income.monthlyAncillary * 12,
    expenses: deal.expenses,
    vacancyPercentOverride: tuning.vacancyPercent,
    expenseFactor: tuning.expenseFactor,
    purchasePrice: price,
    unitCount: deal.units.length,
    buildingSqFt: deal.info.buildingSizeSqFt,
  })

  const financing = {
    ...deal.financing,
    annualRate: opts.rateOverride ?? deal.financing.annualRate,
  }
  const debt = computeDebt(price, financing)

  const acq = computeAcquisitionCosts(price, deal.purchaseCosts, {
    unitCount: deal.units.length,
    propertyType: deal.info.propertyType,
    city: deal.info.city,
  })

  const cashRemainingInvested = Math.max(0, acq.capitalInProperty - debt.mortgageAmount)

  const cashFlow = computeCashFlow({
    noi,
    annualDebtService: debt.annualDebtService,
    principalYear1: debt.principalYear1,
    interestYear1: debt.interestYear1,
    cashRemainingInvested,
  })

  const breakEven = computeBreakEven({
    noi: noi.noi,
    operatingExpenses: noi.operatingExpenses,
    totalPotentialGrossIncome: noi.totalPotentialGrossIncome,
    annualDebtService: debt.annualDebtService,
    annualRate: financing.annualRate,
    amortizationYears: financing.amortizationYears,
    compounding: financing.compounding,
    paymentFrequency: financing.paymentFrequency,
    dscrTargets: DEFAULT_DSCR_TARGETS,
    capTargets: DEFAULT_TARGET_CAP_RATES,
    askingPrice: deal.info.askingPrice,
    offerPrice: deal.info.offerPrice || price,
    refinanceLtv: deal.refinance.ltv,
  })

  const warnings: string[] = []
  if (income.excludedUnitCount > 0) {
    warnings.push(
      `${income.excludedUnitCount} non-conforming unit(s) excluded — C$${Math.round(income.excludedMonthlyIncome).toLocaleString('en-CA')}/month of income is not counted in this scenario.`,
    )
  }
  if (key !== 'CONSERVATIVE' && tuning.markOccupiedToMarket) {
    warnings.push(
      'This scenario marks occupied units to market. Ontario rent control means sitting tenants cannot simply be moved to market rent.',
    )
  }
  if (noi.expenses.estimatedFallbackCount > 0) {
    warnings.push(
      `${noi.expenses.estimatedFallbackCount} expense line(s) have no verified actual and fall back to a model assumption.`,
    )
  }

  return {
    key,
    label: SCENARIO_LABELS[key],
    description: SCENARIO_DESCRIPTIONS[key],
    income,
    noi,
    capRateOnAsking: capRate(noi.noi, deal.info.askingPrice),
    capRateOnOffer: capRate(noi.noi, price),
    capRateExCapexReserve: capRate(noi.noiExcludingCapexReserve, price),
    debt,
    cashFlow,
    breakEven,
    cashRemainingInvested,
    warnings,
  }
}

export function underwrite(deal: Deal, opts: UnderwriteOptions): UnderwriteResult {
  const askingPrice = deal.info.askingPrice
  const price = opts.priceOverride ?? (deal.info.offerPrice > 0 ? deal.info.offerPrice : askingPrice)

  const rentComps = summarizeRentComps(deal.rentComps)
  const saleComps = summarizeSaleComps(deal.saleComps)
  const consRents = conservativeRentMap(deal, rentComps)
  const rentRoll = summarizeRentRoll(deal.units)

  const scenarioOpts = {
    rateOverride: opts.rateOverride,
    rentFactorOverride: opts.rentFactorOverride,
    conservativeRentByUnit: consRents,
  }

  const scenarios: Record<ScenarioKey, ScenarioResult> = {
    CONSERVATIVE: buildScenario(deal, 'CONSERVATIVE', price, scenarioOpts),
    STABILIZED: buildScenario(deal, 'STABILIZED', price, scenarioOpts),
    OPTIMISTIC: buildScenario(deal, 'OPTIMISTIC', price, scenarioOpts),
  }

  const acquisition = computeAcquisitionCosts(price, deal.purchaseCosts, {
    unitCount: deal.units.length,
    propertyType: deal.info.propertyType,
    city: deal.info.city,
  })

  /* ----------------------- Refinance ------------------------------- */

  const stabilizedNoi = scenarios.STABILIZED.noi.noi
  const conservativeNoi = scenarios.CONSERVATIVE.noi.noi

  const refiInput = {
    plan: deal.refinance,
    capitalInProperty: acquisition.capitalInProperty,
    stabilizedNoi,
  }
  const refinance = computeRefinance(refiInput)
  const refinanceOnConservativeNoi = computeRefinance({ ...refiInput, stabilizedNoi: conservativeNoi })

  const ltvLadder = computeLtvLadder(refiInput, DEFAULT_REFI_LTVS, opts.profile.minDscr)
  const appraisalMatrix = computeAppraisalMatrix(refiInput, [0.55, 0.6, 0.65, 0.7])
  const refinanceDelay = refinanceDelayStress(
    refiInput,
    [3, 6, 9, 12, 18],
    scenarios.STABILIZED.noi.monthlyNoi - scenarios.STABILIZED.debt.annualDebtService / 12,
    Math.max(0, opts.profile.startingCapital - acquisition.totalCashRequired),
  )

  /* ----------------------- Projection ------------------------------ */

  const refinanceProjectionYear = Math.max(1, Math.ceil(deal.refinance.monthsUntilRefinance / 12))
  const projInput: ProjectionInput = {
    startingGrossIncome: scenarios.STABILIZED.noi.totalPotentialGrossIncome,
    startingOperatingExpenses: scenarios.STABILIZED.noi.operatingExpenses,
    vacancyPercent: deal.projection.projectionVacancy,
    badDebtPercent: deal.expenses.deductions.badDebtPercent,
    assumptions: deal.projection,
    startingValue: price,
    initialCashInvested: acquisition.capitalInProperty,
    debt: {
      amortization: scenarios.STABILIZED.debt.amortization,
      annualDebtService: scenarios.STABILIZED.debt.annualDebtService,
    },
    refinance:
      deal.financing.structure === 'CASH_THEN_REFINANCE'
        ? {
            atYear: refinanceProjectionYear,
            netCashReleased: refinance.netCashReleased,
            debt: {
              // Rebuilt so per-year principal repayment is tracked after the refi.
              amortization: amortizationOf(refinance),
              annualDebtService: refinance.annualDebtService,
            },
          }
        : undefined,
    years: 5,
  }

  const projection = project(projInput)
  const projectionTenYear = project({ ...projInput, years: 10 })

  const totalReturnYear1 = computeTotalReturn({
    annualPreTaxCashFlow: projection.years[0]?.cashFlow ?? 0,
    principalRepaid: projection.years[0]?.principalRepaid ?? 0,
    appreciation: price * deal.projection.annualAppreciation,
    cashRemainingInvested: refinance.cashRemainingInvested > 0 ? refinance.cashRemainingInvested : acquisition.capitalInProperty,
    equity: (projection.years[0]?.equity ?? price),
  })

  /* --------------------- Offer + sensitivity ----------------------- */

  /**
   * Re-underwrite at an arbitrary price. For a cash-then-refinance deal the
   * reported cash flow, DSCR and cash-on-cash are the POST-REFINANCE figures,
   * because that is the capital structure the investor actually ends up
   * holding — an unlevered cash purchase produces the same cash flow at every
   * price, which would make the offer analysis meaningless.
   *
   * The refinance appraisal is scaled with the price rather than held at the
   * original figure: §27 and §40.25 forbid assuming a value above what was
   * paid, so a lower offer implies a lower supportable appraisal.
   */
  const evaluateAtPrice = (p: number): OfferMetrics => {
    const s = buildScenario(deal, 'STABILIZED', p, scenarioOpts)
    const a = computeAcquisitionCosts(p, deal.purchaseCosts, {
      unitCount: deal.units.length,
      propertyType: deal.info.propertyType,
      city: deal.info.city,
    })

    const base = {
      price: p,
      noi: s.noi.noi,
      capRate: capRate(s.noi.noi, p),
      landTransferTax: a.landTransferTax,
      totalClosingCosts: a.totalClosingCosts,
    }

    if (deal.financing.structure === 'CASH_THEN_REFINANCE') {
      const r = computeRefinance({
        plan: scaleAppraisals(deal.refinance, price, p),
        capitalInProperty: a.capitalInProperty,
        stabilizedNoi: s.noi.noi,
      })
      return {
        ...base,
        totalCashRequired: a.totalCashRequired,
        cashRemainingInvested: r.cashRemainingInvested,
        monthlyCashFlow: r.monthlyCashFlow,
        annualCashFlow: r.annualCashFlow,
        dscr: r.dscr,
        cashOnCash: r.cashOnCash,
        mortgageAmount: r.mortgageAmount,
        monthlyPayment: r.monthlyPayment,
      }
    }

    return {
      ...base,
      totalCashRequired: a.totalCashRequired - s.debt.mortgageAmount,
      cashRemainingInvested: s.cashRemainingInvested,
      monthlyCashFlow: s.cashFlow.monthlyCashFlow,
      annualCashFlow: s.cashFlow.annualPreTaxCashFlow,
      dscr: s.cashFlow.dscr,
      cashOnCash: s.cashFlow.cashOnCash,
      mortgageAmount: s.debt.mortgageAmount,
      monthlyPayment: s.debt.monthlyPayment,
    }
  }

  const offers = buildOfferLadder(
    evaluateAtPrice,
    askingPrice,
    DEFAULT_OFFER_DISCOUNTS,
    deal.info.offerPrice > 0 && Math.abs(deal.info.offerPrice - askingPrice) > 1 ? deal.info.offerPrice : null,
  )

  const targetPrices = buildTargetPrices(
    evaluateAtPrice,
    askingPrice,
    [0.06, 0.065, 0.07],
    DEFAULT_CASHFLOW_TARGETS,
    [opts.profile.minDscr],
  )

  const evaluateSensitivity = (o: { rate: number; rentFactor: number; price: number }): SensitivityMetrics => {
    // Sensitivity runs against the post-refinance structure for a cash buyer,
    // because that is the capital stack the investor actually ends up holding.
    const s = buildScenario(deal, 'STABILIZED', o.price, {
      ...scenarioOpts,
      rateOverride: o.rate,
      rentFactorOverride: o.rentFactor,
    })
    const a = computeAcquisitionCosts(o.price, deal.purchaseCosts, {
      unitCount: deal.units.length,
      propertyType: deal.info.propertyType,
      city: deal.info.city,
    })

    if (deal.financing.structure === 'CASH_THEN_REFINANCE') {
      const r = computeRefinance({
        plan: scaleAppraisals(deal.refinance, price, o.price),
        capitalInProperty: a.capitalInProperty,
        stabilizedNoi: s.noi.noi,
        rateOverride: o.rate,
      })
      return {
        noi: s.noi.noi,
        capRate: capRate(s.noi.noi, o.price),
        monthlyCashFlow: r.monthlyCashFlow,
        annualCashFlow: r.annualCashFlow,
        dscr: r.dscr,
        cashOnCash: r.cashOnCash,
        annualDebtService: r.annualDebtService,
        mortgageAmount: r.mortgageAmount,
        cashRemainingInvested: r.cashRemainingInvested,
      }
    }

    return {
      noi: s.noi.noi,
      capRate: capRate(s.noi.noi, o.price),
      monthlyCashFlow: s.cashFlow.monthlyCashFlow,
      annualCashFlow: s.cashFlow.annualPreTaxCashFlow,
      dscr: s.cashFlow.dscr,
      cashOnCash: s.cashFlow.cashOnCash,
      annualDebtService: s.debt.annualDebtService,
      mortgageAmount: s.debt.mortgageAmount,
      cashRemainingInvested: s.cashRemainingInvested,
    }
  }

  const sensitivity = buildSensitivitySet({
    evaluate: evaluateSensitivity,
    rates: DEFAULT_RATE_SCENARIOS,
    rentDeltas: DEFAULT_RENT_SCENARIOS,
    prices: pricesAround(price),
    basePrice: price,
    baseRate:
      deal.financing.structure === 'CASH_THEN_REFINANCE' ? deal.refinance.annualRate : deal.financing.annualRate,
    minDscr: opts.profile.minDscr,
  })

  /* ------------------------- Risk + score -------------------------- */

  const capex = buildCapexForecast(deal.components, {
    unitCount: deal.units.length,
    purchasePrice: price,
    yearBuilt: deal.info.yearBuilt,
    condition: deal.info.condition,
  })

  const legal = assessLegalRisk(deal, deal.units)

  const propertyTaxAnnual = sum(
    scenarios.STABILIZED.noi.expenses.lines.filter((l) => l.key === 'PROPERTY_TAX').map((l) => l.annual),
  )
  const insuranceAnnual = sum(
    scenarios.STABILIZED.noi.expenses.lines.filter((l) => l.key === 'INSURANCE').map((l) => l.annual),
  )
  const landlordUtilitiesAnnual = sum(
    scenarios.STABILIZED.noi.expenses.lines
      .filter((l) => ['NATURAL_GAS', 'ELECTRICITY', 'WATER_SEWER'].includes(l.key))
      .map((l) => l.annual),
  )

  const belowMarketGapPercent =
    rentRoll.currentMonthlyResidentialRent > 0
      ? safeDiv(
          sum(rentRoll.belowMarketUnits.map((u) => u.belowMarketGap)),
          rentRoll.currentMonthlyResidentialRent,
        )
      : null

  const rentsVerified = deal.sources.some(
    (s) => /rent/i.test(s.field) || /rent/i.test(s.label),
  )

  const scorecard = buildScorecard({
    capRate: scenarios.CONSERVATIVE.capRateOnOffer,
    stabilizedCapRate: scenarios.STABILIZED.capRateOnOffer,
    monthlyCashFlow:
      deal.financing.structure === 'CASH_THEN_REFINANCE'
        ? refinance.monthlyCashFlow
        : scenarios.STABILIZED.cashFlow.monthlyCashFlow,
    dscr:
      deal.financing.structure === 'CASH_THEN_REFINANCE'
        ? refinance.dscr
        : scenarios.STABILIZED.cashFlow.dscr,
    expenseRatio: scenarios.STABILIZED.noi.expenseRatio,
    rentUpsideMonthly: rentRoll.monthlyRentUpside,
    currentMonthlyRent: rentRoll.currentMonthlyGSI,
    capexRiskScore: capex.score,
    capexTenYear: capex.totalTenYear,
    purchasePrice: price,
    legalRiskScore: legal.score,
    conditionScore: conditionScore(deal.info.condition, deal.info.yearBuilt, deal.info.yearRenovated),
    ratings: deal.ratings,
    refinance: {
      netCashReleased: refinance.netCashReleased,
      capitalInProperty: refinance.capitalInProperty,
      dscr: refinance.dscr,
      monthlyCashFlow: refinance.monthlyCashFlow,
    },
    profile: opts.profile,
    belowMarketUnitCount: rentRoll.belowMarketUnits.length,
    unitCount: deal.units.length,
    nonConformingUnits: legal.nonConformingUnits,
    allUnitsLegal: legal.nonConformingUnits === 0 && legal.excessUnits === 0,
  })

  const dealBreakers = evaluateDealBreakers({
    deal,
    capRate: scenarios.CONSERVATIVE.capRateOnOffer,
    stabilizedCapRate: scenarios.STABILIZED.capRateOnOffer,
    dscr:
      deal.financing.structure === 'CASH_THEN_REFINANCE'
        ? refinance.dscr
        : scenarios.STABILIZED.cashFlow.dscr,
    monthlyCashFlow:
      deal.financing.structure === 'CASH_THEN_REFINANCE'
        ? refinance.monthlyCashFlow
        : scenarios.STABILIZED.cashFlow.monthlyCashFlow,
    effectiveGrossIncome: scenarios.STABILIZED.noi.effectiveGrossIncome,
    propertyTaxAnnual,
    insuranceAnnual,
    landlordPaidUtilitiesAnnual: landlordUtilitiesAnnual,
    renovationBudget: deal.purchaseCosts.immediateRenovationBudget,
    purchasePrice: price,
    capex,
    legal,
    belowMarketGapPercent,
    rentsVerified,
    components: deal.components,
  })

  const subjectVsComps = compareSubjectToComps(
    {
      price,
      units: deal.units.length,
      sqFt: deal.info.buildingSizeSqFt,
      noi: scenarios.STABILIZED.noi.noi,
      grossAnnualRent: scenarios.STABILIZED.noi.totalPotentialGrossIncome,
    },
    saleComps,
  )

  /* --------------------------- Warnings ---------------------------- */

  const warnings: string[] = []
  warnings.push(...legal.messages)
  if (rentRoll.belowMarketUnits.length > 0) {
    warnings.push(
      `${rentRoll.belowMarketUnits.length} occupied unit(s) are below market by a combined C$${Math.round(sum(rentRoll.belowMarketUnits.map((u) => u.belowMarketGap))).toLocaleString('en-CA')}/month. Current and stabilized income are reported separately — this gap is not available on closing.`,
    )
  }
  if (deal.refinance.appraisalBase > price) {
    warnings.push(
      'The base refinance appraisal is above the purchase price. Lenders do not automatically accept a higher value after lease-up — confirm with comparable sales.',
    )
  }
  if (refinance.dscr !== null && refinance.dscr < opts.profile.minDscr) {
    warnings.push(
      `Post-refinance DSCR of ${refinance.dscr.toFixed(2)}x is below your ${opts.profile.minDscr.toFixed(2)}x minimum at ${(deal.refinance.ltv * 100).toFixed(0)}% LTV. A lower LTV keeps more cash flow and coverage.`,
    )
  }
  if (capex.riskLevel === 'HIGH') {
    const evidenced = capex.evidencedTenYear
    const assumed = capex.assumedUnknownTotal
    warnings.push(
      assumed > 0
        ? `CapEx risk is HIGH: C$${Math.round(capex.totalTenYear).toLocaleString('en-CA')} of capital over ten years, of which C$${Math.round(assumed).toLocaleString('en-CA')} is a placeholder for components with no recorded age or condition and only C$${Math.round(evidenced).toLocaleString('en-CA')} is evidenced. Record the component ages, or get an inspection, before comparing this yield with a renovated building's.`
        : `CapEx risk is HIGH: C$${Math.round(capex.totalTenYear).toLocaleString('en-CA')} of identified capital over ten years. Do not compare this yield against a renovated building's without adjusting.`,
    )
  }

  return {
    deal,
    price,
    askingPrice,
    rentRoll,
    rentComps,
    saleComps,
    subjectVsComps,
    scenarios,
    acquisition,
    refinance,
    refinanceOnConservativeNoi,
    ltvLadder,
    appraisalMatrix,
    refinanceDelay,
    projection,
    projectionTenYear,
    appreciation: appreciationForecast(price),
    totalReturnYear1,
    sensitivity,
    capex,
    legal,
    scorecard,
    dealBreakers,
    offers,
    targetPrices,
    warnings,
  }
}

/**
 * Scale the appraisal scenarios in proportion to a changed purchase price.
 * Paying less does not entitle the investor to the original appraisal: the
 * engine never assumes a refinance value above what was paid (§27, §40.25).
 */
function scaleAppraisals(plan: Deal['refinance'], fromPrice: number, toPrice: number): Deal['refinance'] {
  if (fromPrice <= 0 || toPrice <= 0 || Math.abs(fromPrice - toPrice) < 1) return plan
  const factor = toPrice / fromPrice
  return {
    ...plan,
    appraisalLow: plan.appraisalLow * factor,
    appraisalBase: plan.appraisalBase * factor,
    appraisalHigh: plan.appraisalHigh * factor,
  }
}

/**
 * Amortization schedule for a refinance mortgage, for projection purposes.
 * computeRefinance keeps only the headline figures so RefinanceResult stays
 * small; the schedule is rebuilt here when the projection needs per-year
 * principal. A 25-year monthly schedule is 300 rows — cheap enough.
 */
function amortizationOf(r: RefinanceResult) {
  return amortize(r.terms)
}

export { cashOnCash }
