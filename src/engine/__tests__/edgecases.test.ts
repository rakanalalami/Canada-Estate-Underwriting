import { describe, expect, it } from 'vitest'
import { createDeal, defaultInvestorProfile, buildUnit } from '@/data/defaults'
import { underwrite } from '../underwrite'
import { simulate, type SimProperty, type SimulatorSettings } from '../simulator'
import { computeRefinance } from '../refinance'
import { computeNoi } from '../noi'
import { buildDefaultExpenseSet } from '@/data/defaults'
import { buildPortfolio } from '../portfolio'
import { summarizeRentComps, summarizeSaleComps } from '../comps'
import { project } from '../projection'

const profile = defaultInvestorProfile()

describe('a brand-new empty deal', () => {
  it('underwrites without throwing and reports nulls rather than NaN', () => {
    const deal = createDeal({ units: [] })
    const r = underwrite(deal, { profile })

    expect(r.price).toBe(0)
    expect(r.rentRoll.unitCount).toBe(0)
    expect(r.scenarios.STABILIZED.noi.totalPotentialGrossIncome).toBe(0)
    expect(r.scenarios.STABILIZED.capRateOnOffer).toBeNull()
    expect(r.scenarios.STABILIZED.noi.noiPerUnit).toBeNull()
    expect(r.acquisition.landTransferTax).toBe(0)

    // Nothing anywhere should be NaN or Infinity.
    const walk = (v: unknown, path = ''): string[] => {
      if (typeof v === 'number') return Number.isFinite(v) ? [] : [`${path} = ${v}`]
      if (Array.isArray(v)) return v.flatMap((x, i) => walk(x, `${path}[${i}]`))
      if (v && typeof v === 'object') {
        return Object.entries(v as Record<string, unknown>).flatMap(([k, x]) => walk(x, `${path}.${k}`))
      }
      return []
    }
    expect(walk(r, 'result')).toEqual([])
  })

  it('produces a deal with default units that also underwrites cleanly', () => {
    const deal = createDeal()
    const r = underwrite(deal, { profile })
    expect(deal.units.length).toBe(3)
    expect(r.scenarios.STABILIZED.noi.noi).toBeLessThanOrEqual(0)
    expect(r.offers.length).toBeGreaterThan(0)
    expect(r.sensitivity).toHaveLength(3)
  })
})

describe('degenerate inputs are handled, not crashed on', () => {
  it('handles a zero-rate refinance', () => {
    const r = computeRefinance({
      plan: {
        monthsUntilRefinance: 6,
        appraisalLow: 600_000,
        appraisalBase: 650_000,
        appraisalHigh: 700_000,
        appraisalCase: 'BASE',
        valuationMethod: 'COMPARABLE_SALES',
        valuationCapRate: 0.065,
        ltv: 0.65,
        annualRate: 0,
        amortizationYears: 25,
        termYears: 5,
        paymentFrequency: 'MONTHLY',
        compounding: 'SEMI_ANNUAL',
        refinanceFees: 0,
        legalFees: 0,
        appraisalFee: 0,
        otherLenderCosts: 0,
        existingDebtPayoff: 0,
      },
      capitalInProperty: 670_000,
      stabilizedNoi: 56_154,
    })
    // At 0% the payment is simply principal / periods.
    expect(r.monthlyPayment).toBeCloseTo(422_500 / 300, 4)
    expect(Number.isFinite(r.dscr!)).toBe(true)
  })

  it('handles a zero-LTV refinance as no refinance at all', () => {
    const r = computeRefinance({
      plan: {
        monthsUntilRefinance: 6, appraisalLow: 0, appraisalBase: 650_000, appraisalHigh: 0,
        appraisalCase: 'BASE', valuationMethod: 'COMPARABLE_SALES', valuationCapRate: 0.065,
        ltv: 0, annualRate: 0.0475, amortizationYears: 25, termYears: 5,
        paymentFrequency: 'MONTHLY', compounding: 'SEMI_ANNUAL', refinanceFees: 0,
        legalFees: 0, appraisalFee: 0, otherLenderCosts: 0, existingDebtPayoff: 0,
      },
      capitalInProperty: 670_000,
      stabilizedNoi: 56_154,
    })
    expect(r.mortgageAmount).toBe(0)
    expect(r.netCashReleased).toBe(0)
    expect(r.annualDebtService).toBe(0)
    expect(r.dscr).toBeNull()
    expect(r.cashRemainingInvested).toBe(670_000)
  })

  it('reports a negative NOI rather than hiding it', () => {
    const noi = computeNoi({
      annualResidentialRent: 12_000,
      annualOtherIncome: 0,
      expenses: buildDefaultExpenseSet(3),
      purchasePrice: 650_000,
      unitCount: 3,
      buildingSqFt: 2_250,
    })
    expect(noi.noi).toBeLessThan(0)
    expect(Number.isFinite(noi.noi)).toBe(true)
  })

  it('handles an empty portfolio', () => {
    const p = buildPortfolio([], 0)
    expect(p.propertyCount).toBe(0)
    expect(p.totalValue).toBe(0)
    expect(p.portfolioLtv).toBeNull()
    expect(p.portfolioCapRate).toBeNull()
    expect(p.warnings).toEqual([])
  })

  it('handles empty comparable sets', () => {
    expect(summarizeRentComps([]).count).toBe(0)
    expect(summarizeRentComps([]).baseRent).toBeNull()
    expect(summarizeSaleComps([]).averagePricePerUnit).toBeNull()
  })

  it('handles a zero-length projection', () => {
    const p = project({
      startingGrossIncome: 81_000,
      startingOperatingExpenses: 22_415,
      vacancyPercent: 0.03,
      badDebtPercent: 0,
      assumptions: {
        annualRentGrowth: 0.025, annualExpenseInflation: 0.03, annualAppreciation: 0.02,
        projectionVacancy: 0.03, exitCapRate: 0.065, sellingCostsPercent: 0.05, holdYears: 0,
      },
      startingValue: 650_000,
      initialCashInvested: 670_000,
      debt: { amortization: null, annualDebtService: 0 },
      years: 0,
    })
    expect(p.years).toEqual([])
    expect(Number.isFinite(p.totalCashFlow)).toBe(true)
  })

  it('simulates an empty property list without dividing by zero', () => {
    const settings: SimulatorSettings = {
      profile,
      appraisalCase: 'BASE',
      rentFactor: 1,
      rateOverride: null,
      refinanceDelayOverride: null,
      ltvOverride: null,
      capexEvents: [],
    }
    const r = simulate([], settings)
    expect(r.acquiredCount).toBe(0)
    expect(r.finalCash).toBe(profile.startingCapital)
    expect(r.portfolioCapRate).toBeNull()
    expect(r.portfolioDscr).toBeNull()
    expect(r.monthlyCashFlow).toBe(0)
  })

  it('never lets a blocked acquisition consume cash', () => {
    const base: SimProperty = {
      id: 'p', name: 'Too expensive', linkedDealId: null,
      purchasePrice: 5_000_000, closingCosts: 100_000, renovationCosts: 0, units: 10,
      stabilizedGrossAnnualRent: 400_000, currentGrossAnnualRent: 380_000,
      vacancyPercent: 0.03, operatingExpenseRatio: 0.3, operatingExpensesAnnual: 0,
      monthsToStabilization: 4, monthsUntilRefinance: 6,
      appraisalLow: 0, appraisalBase: 0, appraisalHigh: 0,
      refinanceLtv: 0.65, refinanceRate: 0.0475, refinanceAmortizationYears: 25,
      refinanceTermYears: 5, refinanceCosts: 3_300, paymentFrequency: 'MONTHLY',
      compounding: 'SEMI_ANNUAL', neighbourhood: '', propertyType: '',
      gapMonthsAfterRefinance: 1, enabled: true,
    }
    const r = simulate([base], {
      profile, appraisalCase: 'BASE', rentFactor: 1, rateOverride: null,
      refinanceDelayOverride: null, ltvOverride: null, capexEvents: [],
    })
    expect(r.properties[0].acquired).toBe(false)
    expect(r.finalCash).toBe(profile.startingCapital)
    expect(r.portfolioDebt).toBe(0)
  })
})

describe('non-conforming override behaves as advertised', () => {
  it('includes the income only when explicitly opted in', () => {
    const units = [
      buildUnit(0, { currentRent: 2000, marketRent: 2000, legalUnit: true }),
      buildUnit(1, { currentRent: 1200, marketRent: 1200, legalUnit: false }),
    ]
    const base = createDeal({ units, info: { ...createDeal().info, askingPrice: 500_000, legalUnits: 1, nonConformingUnits: 1 } })

    const excluded = underwrite(base, { profile })
    expect(excluded.scenarios.CONSERVATIVE.income.monthlyResidentialRent).toBe(2000)

    const included = underwrite(
      { ...base, legal: { ...base.legal, includeNonConformingIncomeInConservative: true } },
      { profile },
    )
    expect(included.scenarios.CONSERVATIVE.income.monthlyResidentialRent).toBe(3200)
    expect(included.legal.messages.some((m) => m.includes('explicitly chosen'))).toBe(true)
  })
})
