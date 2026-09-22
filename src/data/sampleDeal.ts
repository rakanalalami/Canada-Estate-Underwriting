/**
 * §38 Example target deal, used as the first-run demo and as the fixture the
 * engine test suite asserts against. Changing these numbers changes the tests.
 */

import type { Deal, ExpenseLine } from '@/engine/types'
import {
  buildDefaultExpenseLines,
  buildDefaultComponents,
  buildUnit,
  createDeal,
  defaultFinancing,
  defaultProjection,
  defaultPurchaseCosts,
  defaultRatings,
  defaultRefinance,
  defaultScenarios,
  defaultDealBreakers,
  uid,
} from './defaults'

const PRICE = 650_000

function sampleExpenseLines(): ExpenseLine[] {
  const lines = buildDefaultExpenseLines(3)
  const set = (key: string, patch: Partial<ExpenseLine>) => {
    const i = lines.findIndex((l) => l.key === key)
    if (i >= 0) lines[i] = { ...lines[i], ...patch }
  }

  // §38 gives explicit figures for tax, insurance and "other operating", and
  // percentage assumptions for management, maintenance and the CapEx reserve.
  set('PROPERTY_TAX', { mode: 'AMOUNT', amount: 4650, actualAmount: 4650, note: 'From the listing — 2025 tax bill.' })
  set('INSURANCE', { mode: 'AMOUNT', amount: 3000, actualAmount: 3000, note: 'Broker quote for a three-unit building.' })
  set('OTHER', { mode: 'AMOUNT', amount: 2000, label: 'Other operating costs', note: 'Snow, landscaping, admin and sundries consolidated per the example.' })

  // Everything else that would double-count the consolidated "other" line.
  for (const key of [
    'WATER_SEWER', 'NATURAL_GAS', 'ELECTRICITY', 'WASTE', 'SNOW_REMOVAL',
    'LANDSCAPING', 'CLEANING', 'PEST_CONTROL', 'FIRE_INSPECTION', 'LICENSING',
    'ACCOUNTING', 'LEGAL', 'ADMIN',
  ]) {
    set(key, { enabled: false, amount: 0 })
  }

  set('MANAGEMENT', { mode: 'PERCENT', percent: 0.08, basis: 'COLLECTED_RESIDENTIAL_RENT', enabled: true })
  set('REPAIRS_MAINTENANCE', { mode: 'PERCENT', percent: 0.05, basis: 'GROSS_SCHEDULED_INCOME', enabled: true })
  set('CAPEX_RESERVE', { mode: 'PERCENT', percent: 0.03, basis: 'GROSS_SCHEDULED_INCOME', enabled: true })

  return lines
}

export function createSampleDeal(): Deal {
  const units = [0, 1, 2].map((i) =>
    buildUnit(i, {
      unitNumber: String(i + 1),
      bedrooms: 2,
      bathrooms: 1,
      sqFt: 750,
      occupied: true,
      currentRent: 2250,
      marketRent: 2250,
      legalUnit: true,
      monthToMonth: i === 2,
      tenantPaysHydro: true,
      tenantPaysHeat: false,
      tenantPaysWater: false,
    }),
  )

  return createDeal({
    id: uid('deal'),
    name: '§38 Example — Ottawa triplex',
    status: 'DUE_DILIGENCE',
    info: {
      address: '123 Example Avenue',
      city: 'Ottawa',
      province: 'ON',
      postalCode: 'K1K 0A1',
      neighbourhood: 'Overbrook',
      mlsNumber: 'X0000000',
      listingUrl: '',
      askingPrice: PRICE,
      offerPrice: PRICE,
      propertyType: 'TRIPLEX',
      yearBuilt: 1962,
      yearRenovated: null,
      legalUnits: 3,
      nonConformingUnits: 0,
      totalBedrooms: 6,
      totalBathrooms: 3,
      parkingSpaces: 3,
      lotSizeSqFt: 4500,
      buildingSizeSqFt: 2250,
      zoning: 'R4',
      occupancyStatus: 'FULLY_OCCUPIED',
      condition: 'AVERAGE',
      separateHydroMeters: true,
      separateGasMeters: false,
      separateWaterMeters: false,
      tenantPaidUtilities: ['Hydro'],
      landlordPaidUtilities: ['Heat', 'Water'],
    },
    units,
    components: buildDefaultComponents(),
    expenses: {
      mode: 'ESTIMATED',
      lines: sampleExpenseLines(),
      deductions: {
        vacancyPercent: 0.03,
        badDebtPercent: 0,
        vacancyAmountOverride: null,
        badDebtAmountOverride: null,
      },
      includeCapexReserveInNOI: true,
    },
    purchaseCosts: {
      ...defaultPurchaseCosts(),
      // Tuned so total closing costs land on the §38 figure of C$20,000:
      // LTT C$9,475 + legal C$2,500 + inspection C$800 + appraisal C$700
      // + title C$600 + other C$5,925 = C$20,000.
      otherAcquisitionCosts: 5925,
      immediateRenovationBudget: 0,
      initialReserveFund: 0,
    },
    financing: { ...defaultFinancing(), structure: 'CASH_THEN_REFINANCE' },
    refinance: {
      ...defaultRefinance(PRICE),
      monthsUntilRefinance: 6,
      appraisalLow: 620_000,
      appraisalBase: 650_000,
      appraisalHigh: 700_000,
      appraisalCase: 'BASE',
      ltv: 0.65,
      annualRate: 0.0475,
      amortizationYears: 25,
    },
    projection: defaultProjection(),
    ratings: { ...defaultRatings(), rentalDemand: 4, locationQuality: 3, appreciationPotential: 3 },
    scenarios: defaultScenarios(),
    dealBreakers: defaultDealBreakers(),
    notes:
      'Worked example from the specification. Every figure here is editable — it exists so the maths can be checked end to end against known inputs.',
  })
}

export const SAMPLE_EXPECTATIONS = {
  grossAnnualRent: 81_000,
  vacancyLoss: 2_430,
  effectiveGrossIncome: 78_570,
  noi: 56_154.4,
  landTransferTax: 9_475,
  totalClosingCosts: 20_000,
  capitalInProperty: 670_000,
  refinanceMortgage: 422_500,
  netCashReleased: 419_200,
  cashRemainingInvested: 250_800,
}
