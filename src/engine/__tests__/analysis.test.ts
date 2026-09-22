import { describe, expect, it } from 'vitest'
import { createSampleDeal } from '@/data/sampleDeal'
import { buildUnit, defaultInvestorProfile } from '@/data/defaults'
import { underwrite } from '../underwrite'
import { buildCapexForecast } from '../capex'
import { buildDefaultComponents } from '@/data/defaults'
import { capRateBand, dscrBand, recycleBand } from '../metrics'
import { summarizeRentComps, percentile } from '../comps'
import { buildPortfolio } from '../portfolio'
import { project } from '../projection'
import { amortize } from '../finance'

const profile = defaultInvestorProfile()

describe('§5 status bands', () => {
  it('labels cap rates per the specification', () => {
    expect(capRateBand(0.045).label).toBe('Low yield')
    expect(capRateBand(0.055).label).toBe('Moderate')
    expect(capRateBand(0.062).label).toBe('Attractive depending on area')
    expect(capRateBand(0.068).label).toBe('Strong target')
    expect(capRateBand(0.085).key).toBe('HIGH')
  })

  it('warns rather than praises on a high cap rate', () => {
    const band = capRateBand(0.09)
    expect(band.tone).toBe('warn')
    expect(band.note).toMatch(/building condition, tenant risk/)
  })

  it('labels DSCR per the specification', () => {
    expect(dscrBand(0.95).key).toBe('FAIL')
    expect(dscrBand(1.1).label).toBe('Weak')
    expect(dscrBand(1.25).label).toBe('Marginal')
    expect(dscrBand(1.35).label).toBe('Acceptable target')
    expect(dscrBand(1.5).label).toBe('Strong debt coverage')
  })

  it('flags very high capital recycling as a risk, not a win', () => {
    expect(recycleBand(0.3).label).toMatch(/Low/)
    expect(recycleBand(0.75).tone).toBe('warn')
  })
})

describe('§14 rent comparables', () => {
  const comps = [1800, 1900, 2000, 2100, 2600].map((rent, i) => ({
    id: `c${i}`,
    address: `${i} Street`,
    distanceKm: 0.5,
    neighbourhood: 'Overbrook',
    unitType: '2 bed',
    bedrooms: 2,
    bathrooms: 1,
    sqFt: 750,
    monthlyRent: rent,
    parkingIncluded: false,
    utilitiesIncluded: [],
    furnished: false,
    condition: 'Good',
    listingDate: '',
    sourceUrl: '',
    include: true,
  }))

  it('never suggests the highest comparable', () => {
    const s = summarizeRentComps(comps)
    expect(s.maxRent).toBe(2600)
    expect(s.optimisticRent!).toBeLessThan(2600)
    expect(s.conservativeRent!).toBeLessThan(s.baseRent!)
    expect(s.baseRent!).toBeLessThan(s.optimisticRent!)
  })

  it('computes percentiles correctly', () => {
    expect(percentile([1, 2, 3, 4, 5], 0.5)).toBe(3)
    expect(percentile([1, 2, 3, 4], 0.25)).toBeCloseTo(1.75, 10)
    expect(percentile([], 0.5)).toBeNull()
  })

  it('excludes comparables the user has unticked', () => {
    const s = summarizeRentComps(comps.map((c, i) => (i === 4 ? { ...c, include: false } : c)))
    expect(s.count).toBe(4)
    expect(s.maxRent).toBe(2100)
  })
})

describe('§20 CapEx risk', () => {
  it('scores an old building with imminent work as high risk', () => {
    const components = buildDefaultComponents().map((c) =>
      c.key === 'ROOF'
        ? { ...c, ageYears: 26, condition: 'POOR' as const, estimatedCost: 22_000 }
        : c.key === 'FURNACE'
          ? { ...c, ageYears: 24, condition: 'FAIR' as const, estimatedCost: 7_000 }
          : c.key === 'KNOB_AND_TUBE'
            ? { ...c, condition: 'POOR' as const, estimatedCost: 20_000, includeInForecast: true }
            : c,
    )
    const f = buildCapexForecast(components, {
      unitCount: 3,
      purchasePrice: 650_000,
      yearBuilt: 1925,
      condition: 'RENOVATION_REQUIRED',
    })
    expect(f.withinOneYear).toBeGreaterThanOrEqual(42_000)
    expect(f.riskLevel).toBe('HIGH')
    expect(f.hazardCount).toBeGreaterThan(0)
    expect(f.drivers.length).toBeGreaterThan(0)
  })

  it('scores a new building as low risk', () => {
    const components = buildDefaultComponents().map((c) => ({ ...c, condition: 'GOOD' as const, ageYears: 2 }))
    const f = buildCapexForecast(components, {
      unitCount: 3,
      purchasePrice: 650_000,
      yearBuilt: 2022,
      condition: 'NEW',
    })
    expect(f.riskLevel).toBe('LOW')
    expect(f.withinOneYear).toBe(0)
  })

  it('separates an 8% cap on an old building from an 8% cap on a new one', () => {
    const old = buildCapexForecast(
      buildDefaultComponents().map((c) =>
        c.key === 'ROOF' ? { ...c, condition: 'POOR' as const, estimatedCost: 100_000 } : c,
      ),
      { unitCount: 3, purchasePrice: 650_000, yearBuilt: 1920, condition: 'MAJOR_CAPITAL_REQUIRED' },
    )
    const renovated = buildCapexForecast(
      buildDefaultComponents().map((c) => ({ ...c, condition: 'GOOD' as const, ageYears: 1 })),
      { unitCount: 3, purchasePrice: 650_000, yearBuilt: 2020, condition: 'EXCELLENT' },
    )
    expect(old.score).toBeGreaterThan(renovated.score + 40)
  })
})

describe('§18 projection', () => {
  const sched = amortize({
    principal: 422_500,
    annualRate: 0.0475,
    amortizationYears: 25,
    termYears: 5,
    paymentFrequency: 'MONTHLY',
    compounding: 'SEMI_ANNUAL',
    fees: 0,
  })

  const base = {
    startingGrossIncome: 81_000,
    startingOperatingExpenses: 22_415.6,
    vacancyPercent: 0.03,
    badDebtPercent: 0,
    assumptions: {
      annualRentGrowth: 0.025,
      annualExpenseInflation: 0.03,
      annualAppreciation: 0.02,
      projectionVacancy: 0.03,
      exitCapRate: 0.065,
      sellingCostsPercent: 0.05,
      holdYears: 5,
    },
    startingValue: 650_000,
    // A mortgaged purchase: C$670,000 of capital less the C$422,500 mortgage.
    initialCashInvested: 247_500,
    debt: { amortization: sched, annualDebtService: sched.breakdown.annualDebtService },
    years: 5,
  }

  it('projects year 1 back to the base-case NOI', () => {
    const p = project(base)
    expect(p.years[0].grossIncome).toBeCloseTo(81_000, 6)
    expect(p.years[0].noi).toBeCloseTo(56_154.4, 1)
  })

  it('grows rent and expenses at their own rates', () => {
    const p = project(base)
    expect(p.years[1].grossIncome).toBeCloseTo(81_000 * 1.025, 4)
    expect(p.years[1].operatingExpenses).toBeCloseTo(22_415.6 * 1.03, 4)
  })

  it('separates value growth from operating performance', () => {
    const p = project(base)
    expect(p.years[4].propertyValue).toBeCloseTo(650_000 * Math.pow(1.02, 5), 2)
    // Appreciation never enters cash flow.
    expect(p.years[4].cashFlow).toBeCloseTo(p.years[4].noi - p.years[4].debtService, 6)
  })

  it('computes IRR and equity multiple on the sale scenario', () => {
    const p = project(base)
    expect(p.saleAtAppreciation.irr).not.toBeNull()
    expect(p.saleAtAppreciation.equityMultiple!).toBeGreaterThan(1)
    expect(p.saleAtExitCap).not.toBeNull()
  })

  it('reports the same mortgage balance the amortization schedule gives', () => {
    const p = project(base)
    expect(p.years[4].mortgageBalance).toBeCloseTo(sched.periods[59].balance, 6)
  })

  it('treats a refinance as a capital event, not as cash flow', () => {
    const p = project({
      ...base,
      initialCashInvested: 670_000,
      debt: { amortization: null, annualDebtService: 0 },
      refinance: {
        atYear: 1,
        netCashReleased: 419_200,
        debt: { amortization: sched, annualDebtService: sched.breakdown.annualDebtService },
      },
    })
    expect(p.years[0].capitalEvent).toBe(419_200)
    expect(p.years[0].cashFlow).toBeCloseTo(p.years[0].noi, 6)
    expect(p.years[1].debtService).toBeGreaterThan(0)
  })
})

describe('§24 portfolio roll-up', () => {
  const props = [1, 2, 3].map((i) => ({
    id: `p${i}`,
    name: `Property ${i}`,
    neighbourhood: i === 3 ? 'Carlington' : 'Overbrook',
    propertyType: 'Triplex',
    tenantType: 'Long-term residential',
    yearBuilt: 1960 + i,
    units: 3,
    value: 650_000,
    originalCashInvested: 670_000,
    cashRemainingInvested: 250_800,
    currentDebt: 422_500,
    annualGrossRent: 81_000,
    annualNoi: 56_154.4,
    annualDebtService: 28_766,
    monthlyCashFlow: (56_154.4 - 28_766) / 12,
    mortgageRate: 0.0475,
    mortgageRenewalYear: 2031,
  }))

  it('aggregates value, debt, equity and cash flow', () => {
    const p = buildPortfolio(props, 150_000)
    expect(p.totalValue).toBe(1_950_000)
    expect(p.totalDebt).toBeCloseTo(1_267_500, 4)
    expect(p.totalEquity).toBeCloseTo(682_500, 4)
    expect(p.totalUnits).toBe(9)
    expect(p.portfolioLtv!).toBeCloseTo(1_267_500 / 1_950_000, 8)
    expect(p.portfolioDscr!).toBeCloseTo(56_154.4 / 28_766, 6)
  })

  it('warns on neighbourhood concentration', () => {
    const p = buildPortfolio(props, 150_000)
    const n = p.concentration.find((c) => c.dimension === 'NEIGHBOURHOOD')!
    expect(n.topShare).toBeCloseTo(2 / 3, 6)
    expect(n.warning).toMatch(/Overbrook/)
  })

  it('warns when several mortgages renew in the same year', () => {
    const p = buildPortfolio(props, 150_000)
    expect(p.warnings.some((w) => w.includes('2031'))).toBe(true)
  })
})

describe('§23 scorecard and §28 deal breakers', () => {
  it('reports separate dimensions rather than one blended score', () => {
    const r = underwrite(createSampleDeal(), { profile })
    expect(r.scorecard.dimensions).toHaveLength(12)
    expect(r.scorecard.summary).toMatch(/not a verdict/)
    expect(r.scorecard.requirements.map((x) => x.key)).toEqual([
      'CAP_RATE',
      'DSCR',
      'CASH_FLOW',
      'LEGAL_UNITS',
      'REFINANCE',
    ])
  })

  it('fires the illegal-unit deal breaker', () => {
    const deal = createSampleDeal()
    const r = underwrite(
      {
        ...deal,
        info: { ...deal.info, legalUnits: 2, nonConformingUnits: 1 },
        units: [
          buildUnit(0, { currentRent: 2250, marketRent: 2250, legalUnit: true }),
          buildUnit(1, { currentRent: 2250, marketRent: 2250, legalUnit: true }),
          buildUnit(2, { currentRent: 2250, marketRent: 2250, legalUnit: false }),
        ],
      },
      { profile },
    )
    expect(r.dealBreakers.hits.some((h) => h.key === 'ILLEGAL_UNITS')).toBe(true)
    expect(r.dealBreakers.redCount).toBeGreaterThan(0)
  })

  it('fires the low cap rate deal breaker on an overpriced deal', () => {
    const deal = createSampleDeal()
    const r = underwrite(
      { ...deal, info: { ...deal.info, askingPrice: 1_400_000, offerPrice: 1_400_000 } },
      { profile },
    )
    expect(r.dealBreakers.hits.some((h) => h.key === 'CAP_RATE_MIN')).toBe(true)
  })

  it('respects a disabled rule', () => {
    const deal = createSampleDeal()
    const disabled = {
      ...deal,
      info: { ...deal.info, askingPrice: 1_400_000, offerPrice: 1_400_000 },
      dealBreakers: deal.dealBreakers.map((d) =>
        d.key === 'CAP_RATE_MIN' ? { ...d, enabled: false } : d,
      ),
    }
    const r = underwrite(disabled, { profile })
    expect(r.dealBreakers.hits.some((h) => h.key === 'CAP_RATE_MIN')).toBe(false)
  })
})

describe('§40.9 refinance LTV ladder', () => {
  it('shows the cash-released vs cash-flow trade-off and does not call the highest LTV best', () => {
    const r = underwrite(createSampleDeal(), { profile })
    const rows = r.ltvLadder.rows
    expect(rows.map((x) => x.ltv)).toEqual([0.5, 0.55, 0.6, 0.65, 0.7, 0.75, 0.8])
    expect(rows[rows.length - 1].netCashReleased).toBeGreaterThan(rows[0].netCashReleased)
    expect(rows[rows.length - 1].monthlyCashFlow).toBeLessThan(rows[0].monthlyCashFlow)
    // "Best cash flow" is the lowest LTV; "best balanced" respects the DSCR floor.
    expect(r.ltvLadder.bestCashFlowLtv).toBe(0.5)
    expect(r.ltvLadder.bestCapitalRecycledLtv).toBe(0.8)
    expect(r.ltvLadder.bestBalancedLtv).not.toBe(null)
  })

  it('reports the cash flow given up for each extra 5% of LTV', () => {
    const r = underwrite(createSampleDeal(), { profile })
    const sixtyFive = r.ltvLadder.rows.find((x) => x.ltv === 0.65)!
    expect(sixtyFive.cashFlowDeltaFromPrevious!).toBeLessThan(0)
    expect(sixtyFive.cashReleasedDeltaFromPrevious!).toBeGreaterThan(0)
  })
})

describe('§40.14 appraisal risk', () => {
  it('runs low, base and high appraisals at each LTV', () => {
    const r = underwrite(createSampleDeal(), { profile })
    const cases = new Set(r.appraisalMatrix.map((c) => c.appraisalCase))
    expect([...cases].sort()).toEqual(['BASE', 'HIGH', 'LOW'])
    const low65 = r.appraisalMatrix.find((c) => c.appraisalCase === 'LOW' && c.ltv === 0.65)!
    const base65 = r.appraisalMatrix.find((c) => c.appraisalCase === 'BASE' && c.ltv === 0.65)!
    expect(low65.netCashReleased).toBeLessThan(base65.netCashReleased)
    expect(low65.cashRemainingInvested).toBeGreaterThan(base65.cashRemainingInvested)
  })
})
