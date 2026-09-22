import { describe, expect, it } from 'vitest'
import { createSampleDeal, SAMPLE_EXPECTATIONS } from '@/data/sampleDeal'
import { defaultInvestorProfile } from '@/data/defaults'
import { underwrite } from '../underwrite'
import { buildUnit } from '@/data/defaults'

const profile = defaultInvestorProfile()

describe('§38 worked example, end to end', () => {
  const deal = createSampleDeal()
  const r = underwrite(deal, { profile })
  const stabilized = r.scenarios.STABILIZED

  it('builds the rent roll from units, not a single building total', () => {
    expect(r.rentRoll.unitCount).toBe(3)
    expect(r.rentRoll.currentMonthlyResidentialRent).toBe(6_750)
    expect(r.rentRoll.currentAnnualResidentialRent).toBe(SAMPLE_EXPECTATIONS.grossAnnualRent)
  })

  it('computes the NOI waterfall exactly', () => {
    const noi = stabilized.noi
    expect(noi.totalPotentialGrossIncome).toBeCloseTo(81_000, 6)
    expect(noi.vacancyLoss).toBeCloseTo(SAMPLE_EXPECTATIONS.vacancyLoss, 6)
    expect(noi.effectiveGrossIncome).toBeCloseTo(SAMPLE_EXPECTATIONS.effectiveGrossIncome, 6)
    expect(noi.operatingExpenses).toBeCloseTo(22_415.6, 4)
    expect(noi.noi).toBeCloseTo(SAMPLE_EXPECTATIONS.noi, 4)
  })

  it('excludes mortgage payments from NOI', () => {
    // NOI must be identical whether the deal is financed or all cash.
    const financed = underwrite(
      { ...deal, financing: { ...deal.financing, structure: 'MORTGAGED', downPaymentPercent: 0.25 } },
      { profile },
    )
    expect(financed.scenarios.STABILIZED.noi.noi).toBeCloseTo(stabilized.noi.noi, 8)
    expect(financed.scenarios.STABILIZED.debt.mortgageAmount).toBeGreaterThan(0)
    expect(stabilized.debt.mortgageAmount).toBe(0)
  })

  it('reports NOI per unit and per square foot', () => {
    expect(stabilized.noi.noiPerUnit).toBeCloseTo(SAMPLE_EXPECTATIONS.noi / 3, 4)
    expect(stabilized.noi.noiPerSqFt).toBeCloseTo(SAMPLE_EXPECTATIONS.noi / 2_250, 6)
  })

  it('computes cap rates on both asking and offer price', () => {
    expect(stabilized.capRateOnAsking).toBeCloseTo(SAMPLE_EXPECTATIONS.noi / 650_000, 8)
    expect(stabilized.capRateOnOffer).toBeCloseTo(SAMPLE_EXPECTATIONS.noi / 650_000, 8)
  })

  it('computes Ontario acquisition costs including LTT', () => {
    expect(r.acquisition.landTransferTax).toBeCloseTo(SAMPLE_EXPECTATIONS.landTransferTax, 4)
    expect(r.acquisition.totalClosingCosts).toBeCloseTo(SAMPLE_EXPECTATIONS.totalClosingCosts, 4)
    expect(r.acquisition.capitalInProperty).toBeCloseTo(SAMPLE_EXPECTATIONS.capitalInProperty, 4)
    expect(r.acquisition.totalCashRequired).toBeCloseTo(SAMPLE_EXPECTATIONS.capitalInProperty, 4)
  })

  it('refinances at 65% LTV on a C$650,000 appraisal', () => {
    expect(r.refinance.mortgageAmount).toBeCloseTo(SAMPLE_EXPECTATIONS.refinanceMortgage, 4)
    expect(r.refinance.monthlyPayment).toBeCloseTo(2397.2, 0)
    expect(r.refinance.annualDebtService).toBeCloseTo(28_766, -1)
  })

  it('nets refinance proceeds against costs, never reporting gross as released', () => {
    expect(r.refinance.grossProceeds).toBeCloseTo(422_500, 4)
    expect(r.refinance.refinanceCosts).toBeCloseTo(3_300, 4)
    expect(r.refinance.netCashReleased).toBeCloseTo(SAMPLE_EXPECTATIONS.netCashReleased, 4)
    expect(r.refinance.netCashReleased).toBeLessThan(r.refinance.grossProceeds)
  })

  it('computes trapped capital with the §40.7 formula', () => {
    // price + closing + renovation - net refinance proceeds
    expect(r.refinance.cashRemainingInvested).toBeCloseTo(
      SAMPLE_EXPECTATIONS.cashRemainingInvested,
      4,
    )
    expect(r.refinance.capitalRecycleRatio).toBeCloseTo(419_200 / 670_000, 8)
  })

  it('computes post-refinance DSCR, cash flow and cash-on-cash', () => {
    expect(r.refinance.dscr).toBeCloseTo(SAMPLE_EXPECTATIONS.noi / 28_766, 2)
    expect(r.refinance.dscr!).toBeGreaterThan(1.3)
    expect(r.refinance.monthlyCashFlow).toBeCloseTo((56_154.4 - 28_766) / 12, 0)
    expect(r.refinance.cashOnCash).toBeCloseTo(
      (56_154.4 - 28_766) / 250_800,
      2,
    )
  })

  it('leaves the expected investor capital from the C$1M starting position', () => {
    const remaining = profile.startingCapital - r.acquisition.totalCashRequired + r.refinance.netCashReleased
    expect(remaining).toBeCloseTo(749_200, 0)
  })
})

describe('§37 underwriting philosophy is enforced structurally', () => {
  const deal = createSampleDeal()

  it('never replaces an occupied below-market rent with market rent', () => {
    const belowMarket = {
      ...deal,
      units: [
        buildUnit(0, { currentRent: 1400, marketRent: 2250, occupied: true }),
        buildUnit(1, { currentRent: 1500, marketRent: 2250, occupied: true }),
        buildUnit(2, { currentRent: 2250, marketRent: 2250, occupied: true }),
      ],
    }
    const r = underwrite(belowMarket, { profile })
    // Current and stabilized are both driven by contract rent for occupied units.
    expect(r.scenarios.CONSERVATIVE.income.monthlyResidentialRent).toBe(1400 + 1500 + 2250)
    expect(r.scenarios.STABILIZED.income.monthlyResidentialRent).toBe(1400 + 1500 + 2250)
    // Only the explicitly optimistic scenario marks tenants to market.
    expect(r.scenarios.OPTIMISTIC.income.monthlyResidentialRent).toBeGreaterThan(1400 + 1500 + 2250)
    expect(r.warnings.some((w) => w.includes('below market'))).toBe(true)
  })

  it('prices vacant units without assuming the top comparable', () => {
    const withVacancy = {
      ...deal,
      units: [
        buildUnit(0, { currentRent: 2250, marketRent: 2250, occupied: true }),
        buildUnit(1, { currentRent: 0, marketRent: 2400, occupied: false }),
        buildUnit(2, { currentRent: 2250, marketRent: 2250, occupied: true }),
      ],
      rentComps: [
        { id: 'c1', address: 'A', distanceKm: 0.3, neighbourhood: 'Overbrook', unitType: '2 bed', bedrooms: 2, bathrooms: 1, sqFt: 750, monthlyRent: 1900, parkingIncluded: false, utilitiesIncluded: [], furnished: false, condition: 'Good', listingDate: '', sourceUrl: '', include: true },
        { id: 'c2', address: 'B', distanceKm: 0.5, neighbourhood: 'Overbrook', unitType: '2 bed', bedrooms: 2, bathrooms: 1, sqFt: 780, monthlyRent: 2100, parkingIncluded: true, utilitiesIncluded: [], furnished: false, condition: 'Good', listingDate: '', sourceUrl: '', include: true },
        { id: 'c3', address: 'C', distanceKm: 0.8, neighbourhood: 'Overbrook', unitType: '2 bed', bedrooms: 2, bathrooms: 1, sqFt: 800, monthlyRent: 2600, parkingIncluded: true, utilitiesIncluded: ['Heat'], furnished: false, condition: 'Renovated', listingDate: '', sourceUrl: '', include: true },
      ],
    }
    const r = underwrite(withVacancy, { profile })
    // Conservative uses the 25th percentile of comps, not the C$2,600 top comp.
    const conservativeVacantRent =
      r.scenarios.CONSERVATIVE.income.monthlyResidentialRent - 4500
    expect(conservativeVacantRent).toBeLessThan(2400)
    expect(conservativeVacantRent).toBeLessThan(2600)
    expect(r.rentComps.maxRent).toBe(2600)
    expect(r.rentComps.conservativeRent).toBeLessThan(2600)
  })

  it('excludes non-conforming unit income from the conservative case', () => {
    const withIllegal = {
      ...deal,
      info: { ...deal.info, legalUnits: 2, nonConformingUnits: 1 },
      units: [
        buildUnit(0, { currentRent: 2250, marketRent: 2250, occupied: true, legalUnit: true }),
        buildUnit(1, { currentRent: 2250, marketRent: 2250, occupied: true, legalUnit: true }),
        buildUnit(2, { currentRent: 1500, marketRent: 1500, occupied: true, legalUnit: false }),
      ],
    }
    const r = underwrite(withIllegal, { profile })
    expect(r.scenarios.CONSERVATIVE.income.monthlyResidentialRent).toBe(4500)
    expect(r.scenarios.STABILIZED.income.monthlyResidentialRent).toBe(6000)
    expect(r.legal.hasNonConformingWarning).toBe(true)
    expect(r.warnings.some((w) => w.includes('NON-CONFORMING'))).toBe(true)
  })

  it('never treats principal repayment as cash flow', () => {
    const financed = underwrite(
      { ...deal, financing: { ...deal.financing, structure: 'MORTGAGED' } },
      { profile },
    )
    const cf = financed.scenarios.STABILIZED.cashFlow
    expect(cf.annualPreTaxCashFlow).toBeCloseTo(cf.annualNoi - cf.annualDebtService, 6)
    expect(cf.equityBuildFromPrincipalYear1).toBeGreaterThan(0)
    // Principal is reported, but it is not inside the cash flow figure.
    expect(cf.annualPreTaxCashFlow).not.toBeCloseTo(
      cf.annualNoi - cf.annualDebtService + cf.equityBuildFromPrincipalYear1,
      2,
    )
  })

  it('does not assume the refinance appraisal exceeds the purchase price', () => {
    const r = underwrite(deal, { profile })
    expect(r.refinance.appraisedValue).toBeLessThanOrEqual(r.price)
  })
})

describe('§13 offer analysis', () => {
  const deal = createSampleDeal()
  const r = underwrite(deal, { profile })

  it('ladders the asking price down to −10%', () => {
    const labels = r.offers.map((o) => o.label)
    expect(labels).toContain('Asking price')
    expect(labels).toContain('−10.0%')
    const asking = r.offers.find((o) => o.isAsking)!
    const ten = r.offers.find((o) => o.label === '−10.0%')!
    expect(ten.price).toBeCloseTo(585_000, 4)
    expect(ten.capRate!).toBeGreaterThan(asking.capRate!)
    // Land transfer tax must fall with the price, not be scaled.
    expect(ten.landTransferTax).toBeLessThan(asking.landTransferTax)
  })

  it('solves the price required for each target cap rate', () => {
    const six = r.targetPrices.find((t) => t.key === 'cap-0.06')!
    expect(six.achievable).toBe(true)
    expect(six.price!).toBeCloseTo(56_154.4 / 0.06, -2)
  })

  it('solves the price required for each monthly cash-flow target', () => {
    const cf = r.targetPrices.find((t) => t.key === 'cf-2000')!
    expect(cf.achievable).toBe(true)
    expect(cf.metrics!.monthlyCashFlow).toBeCloseTo(2000, 0)
  })
})

describe('§12 break-even and §5 cap-rate bands', () => {
  const deal = createSampleDeal()
  const r = underwrite(deal, { profile })

  it('computes maximum purchase price at each target cap rate', () => {
    const rows = r.scenarios.STABILIZED.breakEven.maxPrices
    const sixFive = rows.find((x) => x.capRate === 0.065)!
    expect(sixFive.maxPrice!).toBeCloseTo(56_154.4 / 0.065, 2)
  })

  it('computes maximum loan at each DSCR target', () => {
    const rows = r.scenarios.STABILIZED.breakEven.maxLoans
    const at130 = rows.find((x) => x.dscr === 1.3)!
    expect(at130.maxAnnualDebtService).toBeCloseTo(56_154.4 / 1.3, 4)
    expect(at130.maxLoan).toBeGreaterThan(0)
  })

  it('computes break-even occupancy for an unlevered cash purchase', () => {
    const be = r.scenarios.STABILIZED.breakEven.breakEvenOccupancy!
    expect(be).toBeCloseTo(22_415.6 / 81_000, 6)
    expect(be).toBeLessThan(1)
  })
})

describe('§19 sensitivity matrices', () => {
  const deal = createSampleDeal()
  const r = underwrite(deal, { profile })

  it('builds all three required matrices', () => {
    expect(r.sensitivity.map((m) => m.id)).toEqual([
      'rate-vs-rent',
      'price-vs-rent',
      'price-vs-rate',
    ])
  })

  it('shows cash flow falling as rates rise', () => {
    const m = r.sensitivity[0]
    const baseRentCol = m.colValues.indexOf(0)
    const lowRate = m.cells[0][baseRentCol]
    const highRate = m.cells[m.cells.length - 1][baseRentCol]
    expect(highRate.monthlyCashFlow).toBeLessThan(lowRate.monthlyCashFlow)
    expect(highRate.dscr!).toBeLessThan(lowRate.dscr!)
  })

  it('shows cash flow falling as rents fall', () => {
    const m = r.sensitivity[0]
    const row = m.cells[0]
    expect(row[0].monthlyCashFlow).toBeLessThan(row[row.length - 1].monthlyCashFlow)
  })
})
