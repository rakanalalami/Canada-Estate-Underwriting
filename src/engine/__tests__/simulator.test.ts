import { describe, expect, it } from 'vitest'
import { defaultInvestorProfile } from '@/data/defaults'
import { simulate, type SimProperty, type SimulatorSettings } from '../simulator'
import {
  buildAutoProperties,
  evaluateEndState,
  interestRateStress,
  rentStress,
  runExitScenario,
} from '../simulatorExtras'
import { planFirstAcquisition, portfolioGoalSeek, reverseDealFinder } from '../reverse'

function property(overrides: Partial<SimProperty> = {}): SimProperty {
  return {
    id: 'p1',
    name: 'Property 1',
    linkedDealId: null,
    purchasePrice: 650_000,
    closingCosts: 20_000,
    renovationCosts: 0,
    units: 3,
    stabilizedGrossAnnualRent: 81_000,
    currentGrossAnnualRent: 81_000,
    vacancyPercent: 0.03,
    operatingExpenseRatio: 0.285,
    operatingExpensesAnnual: 22_415.6,
    monthsToStabilization: 4,
    monthsUntilRefinance: 6,
    appraisalLow: 620_000,
    appraisalBase: 650_000,
    appraisalHigh: 700_000,
    refinanceLtv: 0.65,
    refinanceRate: 0.0475,
    refinanceAmortizationYears: 25,
    refinanceTermYears: 5,
    refinanceCosts: 3_300,
    paymentFrequency: 'MONTHLY',
    compounding: 'SEMI_ANNUAL',
    neighbourhood: 'Overbrook',
    propertyType: 'Triplex',
    gapMonthsAfterRefinance: 1,
    enabled: true,
    ...overrides,
  }
}

function settings(overrides: Partial<SimulatorSettings> = {}): SimulatorSettings {
  return {
    profile: defaultInvestorProfile(),
    appraisalCase: 'BASE',
    rentFactor: 1,
    rateOverride: null,
    refinanceDelayOverride: null,
    ltvOverride: null,
    capexEvents: [],
    ...overrides,
  }
}

describe('§40 capital recycling simulator', () => {
  it('runs the §38 property through buy-cash → stabilize → refinance', () => {
    const r = simulate([property()], settings())
    const p = r.properties[0]

    expect(p.acquired).toBe(true)
    expect(p.totalAcquisitionCash).toBe(670_000)
    expect(p.annualNoi).toBeCloseTo(56_154.4, 1)
    expect(p.mortgageAmount).toBeCloseTo(422_500, 4)
    expect(p.netCashReleased).toBeCloseTo(419_200, 4)
    expect(p.cashRemainingInvested).toBeCloseTo(250_800, 4)
    expect(p.capitalRecycleRatio!).toBeCloseTo(419_200 / 670_000, 8)
    expect(p.dscr!).toBeGreaterThan(1.3)
    expect(r.finalCash).toBeCloseTo(1_000_000 - 670_000 + 419_200, 4)
  })

  it('never double-counts cash across a sequence', () => {
    const props = [property({ id: 'p1' }), property({ id: 'p2', name: 'Property 2' })]
    const r = simulate(props, settings())
    const acquired = r.properties.filter((p) => p.acquired)
    const spent = acquired.reduce((s, p) => s + p.totalAcquisitionCash, 0)
    const released = acquired.reduce((s, p) => s + p.netCashReleased, 0)
    expect(r.finalCash).toBeCloseTo(1_000_000 - spent + released, 4)
  })

  it('blocks an acquisition that would breach the liquidity reserve', () => {
    // After property 1 the balance is C$749,200, leaving C$649,200 deployable
    // once the C$100,000 reserve is held back. Property 2 needs C$680,000.
    const props = [
      property({ id: 'p1' }),
      property({ id: 'p2', name: 'Property 2', purchasePrice: 660_000, closingCosts: 20_000 }),
    ]
    const r = simulate(props, settings())
    expect(r.properties[0].acquired).toBe(true)
    expect(r.properties[1].acquired).toBe(false)
    expect(r.properties[1].blockedReason).toMatch(/deployable/)
    expect(r.blockedCount).toBe(1)
    // The blocked property must not have consumed any cash.
    expect(r.finalCash).toBeCloseTo(1_000_000 - 670_000 + 419_200, 4)
  })

  it('blocks an acquisition above the per-deal capital ceiling', () => {
    const props = [property({ id: 'p1', purchasePrice: 700_000, closingCosts: 25_000 })]
    const r = simulate(props, settings())
    expect(r.properties[0].acquired).toBe(false)
    expect(r.properties[0].blockedReason).toMatch(/per-acquisition ceiling/)
  })

  it('never lets gross refinance proceeds stand in for net', () => {
    const r = simulate([property()], settings())
    const p = r.properties[0]
    expect(p.netCashReleased).toBe(p.mortgageAmount - p.refinanceCosts)
    expect(p.netCashReleased).toBeLessThan(p.mortgageAmount)
  })

  it('does not assume a refinance value above the purchase price by default', () => {
    const r = simulate([property({ appraisalBase: 0 })], settings())
    expect(r.properties[0].appraisedValue).toBe(650_000)
  })

  it('releases less capital on a low appraisal', () => {
    const base = simulate([property()], settings({ appraisalCase: 'BASE' }))
    const low = simulate([property()], settings({ appraisalCase: 'LOW' }))
    expect(low.properties[0].netCashReleased).toBeLessThan(base.properties[0].netCashReleased)
    expect(low.properties[0].cashRemainingInvested).toBeGreaterThan(
      base.properties[0].cashRemainingInvested,
    )
  })

  it('shows the cash-released vs cash-flow trade-off across LTV', () => {
    const at55 = simulate([property()], settings({ ltvOverride: 0.55 }))
    const at75 = simulate([property()], settings({ ltvOverride: 0.75 }))
    expect(at75.properties[0].netCashReleased).toBeGreaterThan(at55.properties[0].netCashReleased)
    expect(at75.monthlyCashFlow).toBeLessThan(at55.monthlyCashFlow)
  })

  it('tracks progress toward each portfolio cash-flow target', () => {
    const r = simulate([property(), property({ id: 'p2', name: 'P2' })], settings())
    const three = r.targets.find((t) => t.target === 3000)!
    expect(three.current).toBeCloseTo(r.monthlyCashFlow, 6)
    expect(three.percent).toBeGreaterThan(0)
    const ten = r.targets.find((t) => t.target === 10000)!
    expect(ten.shortfall).toBeGreaterThan(0)
  })

  it('suggests a reserve from debt service, operating expenses and near-term capex', () => {
    const r = simulate([property()], settings())
    expect(r.reserve.suggestedMinimum).toBeCloseTo(
      r.reserve.sixMonthsDebtService + r.reserve.sixMonthsOperatingExpenses + r.reserve.nearTermCapex,
      6,
    )
  })

  it('applies an unplanned capital expenditure to the cash balance', () => {
    const withCapex = simulate(
      [property()],
      settings({
        capexEvents: [{ id: 'c1', label: 'Roof', amount: 20_000, month: 3, propertyId: 'p1', enabled: true }],
      }),
    )
    const without = simulate([property()], settings())
    expect(withCapex.finalCash).toBeCloseTo(without.finalCash - 20_000, 4)
  })

  it('computes next-property capacity net of the reserve', () => {
    const r = simulate([property()], settings())
    expect(r.nextCapacity.availableCapital).toBeCloseTo(r.finalCash - 100_000, 4)
    expect(r.nextCapacity.maxCashPurchaseAfterCosts).toBeLessThan(r.nextCapacity.maxCashPurchase)
    expect(r.nextCapacity.withTwentyFivePercentDown).toBeGreaterThan(r.nextCapacity.maxCashPurchase)
  })
})

describe('§40.15 / §40.16 stress across the whole sequence', () => {
  const props = [property(), property({ id: 'p2', name: 'P2' })]

  it('shows higher rates reducing portfolio cash flow', () => {
    const rows = interestRateStress(props, settings(), [0.04, 0.05, 0.065])
    expect(rows[0].monthlyCashFlow).toBeGreaterThan(rows[2].monthlyCashFlow)
    expect(rows.map((r) => r.variant)).toEqual([0.04, 0.05, 0.065])
  })

  it('shows lower rents reducing portfolio cash flow', () => {
    const rows = rentStress(props, settings(), [-0.1, 0, 0.1])
    expect(rows[0].monthlyCashFlow).toBeLessThan(rows[1].monthlyCashFlow)
    expect(rows[2].monthlyCashFlow).toBeGreaterThan(rows[1].monthlyCashFlow)
  })
})

describe('§40.6 automatic acquisition projection', () => {
  it('back-solves gross rent from a target cap rate', () => {
    const props = buildAutoProperties({
      averagePurchasePrice: 650_000,
      averageCapRate: 0.065,
      averageUnits: 3,
      averageClosingCostPercent: 0.03,
      averageRenovationBudget: 10_000,
      averageAppraisalFactor: 1,
      averageRefinanceLtv: 0.65,
      averageMortgageRate: 0.0475,
      averageAmortizationYears: 25,
      averageRefinanceCosts: 3_300,
      averageMonthsToRefinance: 6,
      averageMonthsBetweenAcquisitions: 1,
      averageVacancy: 0.03,
      averageOperatingExpenseRatio: 0.35,
      maxProperties: 4,
    })
    const r = simulate(props, settings())
    expect(r.properties[0].capRateOnPrice!).toBeCloseTo(0.065, 6)
    expect(r.properties[0].appraisedValue).toBe(650_000)
  })
})

describe('§40.19 exit and deleveraging scenarios', () => {
  const r = simulate([property(), property({ id: 'p2', name: 'P2' })], settings())

  it('models selling the weakest performer', () => {
    const e = runExitScenario({
      result: r,
      action: 'SELL_WEAKEST',
      propertyId: null,
      payDownAmount: 0,
      targetLtv: 0.5,
      sellingCostPercent: 0.05,
    })
    expect(e.cashGenerated).toBeGreaterThan(0)
    expect(e.monthlyCashFlowDelta).toBeLessThanOrEqual(0)
    expect(e.unitsAfter).toBeLessThan(r.totalUnits)
  })

  it('models deleveraging to a lower LTV', () => {
    const e = runExitScenario({
      result: r,
      action: 'REFINANCE_LOWER_LTV',
      propertyId: null,
      payDownAmount: 0,
      targetLtv: 0.5,
      sellingCostPercent: 0.05,
    })
    expect(e.portfolioDebtAfter).toBeLessThan(r.portfolioDebt)
    expect(e.monthlyCashFlowAfter).toBeGreaterThan(r.monthlyCashFlow)
  })
})

describe('§40.20 end-state mode', () => {
  it('states what the next property must produce', () => {
    const r = simulate([property()], settings())
    const end = evaluateEndState(
      r,
      { properties: 4, units: 12, portfolioValue: 3_000_000, portfolioDebt: 1_700_000, portfolioEquity: 1_300_000, monthlyCashFlow: 6_500 },
      { nextBudget: 650_000, ltv: 0.65, rate: 0.0475, amortizationYears: 25, minDscr: 1.3 },
    )
    expect(end.propertiesRemaining).toBe(3)
    expect(end.requiredMonthlyCashFlowFromNext).toBeGreaterThan(0)
    expect(end.narrative).toContain('per month'.replace('per month', '/month'))
  })
})

describe('§40.21 / §40.22 / §40.23 reverse underwriting', () => {
  it('reverse-engineers the first acquisition', () => {
    const r = planFirstAcquisition({
      startingCapital: 1_000_000,
      maximumCashPurchase: 700_000,
      reserveRequirement: 100_000,
      targetCapRate: 0.065,
      targetRefinanceLtv: 0.65,
      targetMonthlyCashFlow: 1_500,
      closingCostPercent: 0.03,
      renovationBudget: 0,
      refinanceRate: 0.0475,
      refinanceAmortizationYears: 25,
      refinanceCosts: 3_300,
      vacancyPercent: 0.03,
      operatingExpenseRatio: 0.32,
      minDscr: 1.3,
    })
    expect(r.deployableCapital).toBe(900_000)
    expect(r.maxAllInCost).toBe(700_000)
    expect(r.maxPurchasePrice).toBeCloseTo(700_000 / 1.03, 4)
    expect(r.minimumRequiredNoi).toBeGreaterThan(0)
    expect(r.minimumRequiredMonthlyGrossRent).toBeGreaterThan(r.minimumRequiredNoi / 12)
    expect(['CAP_RATE', 'CASH_FLOW', 'DSCR']).toContain(r.bindingConstraint)
  })

  it('screens listings from the target return', () => {
    const r = reverseDealFinder({
      purchaseBudget: 650_000,
      targetCapRate: 0.07,
      targetMonthlyCashFlowAfterRefinance: 1_750,
      refinanceLtv: 0.65,
      mortgageRate: 0.0475,
      amortizationYears: 25,
      vacancyPercent: 0.03,
      operatingExpenseRatio: 0.32,
      maxPropertyTaxShareOfOpex: 0.3,
      minDscr: 1.3,
    })
    expect(r.minimumNoi).toBeGreaterThanOrEqual(650_000 * 0.07)
    expect(r.mortgageAmount).toBeCloseTo(422_500, 4)
    expect(r.maximumOperatingExpenses).toBeGreaterThan(0)
    expect(r.perUnitGuide.find((g) => g.units === 3)!.monthlyRentPerUnit).toBeGreaterThan(0)
  })

  it('offers several routes to the same income without ranking them', () => {
    const r = portfolioGoalSeek({
      targetMonthlyCashFlow: 6_000,
      startingCapital: 1_000_000,
      minimumReserve: 100_000,
      refinanceLtv: 0.65,
      mortgageRate: 0.0475,
      amortizationYears: 25,
      vacancyPercent: 0.03,
      operatingExpenseRatio: 0.32,
      closingCostPercent: 0.03,
      minDscr: 1.3,
    })
    expect(r.strategies).toHaveLength(3)
    expect(r.strategies[0].properties).toBeLessThan(r.strategies[2].properties)
    // Fewer properties means each must work harder.
    expect(r.strategies[0].requiredAverageCapRate).toBeGreaterThan(
      r.strategies[2].requiredAverageCapRate,
    )
    expect(r.note).toMatch(/none of these is universally best/i)
  })
})
