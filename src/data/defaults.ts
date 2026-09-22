/**
 * Editable defaults. Nothing here is hard-coded into the maths — every value
 * is a starting point the investor can change per deal (§37, §39).
 */

import type {
  ComponentNote,
  Deal,
  DealBreakerRule,
  ExpenseKey,
  ExpenseLine,
  ExpenseSet,
  FinancingPlan,
  InvestorProfile,
  LegalProfile,
  MarketRatings,
  ProjectionAssumptions,
  PropertyInfo,
  PurchaseCosts,
  RefinancePlan,
  ScenarioSettings,
  StrategyProfile,
  Unit,
} from '@/engine/types'
import { COMPONENT_SPECS } from '@/engine/capex'
import { DEFAULT_DEAL_BREAKERS } from '@/engine/dealBreakers'

export function uid(prefix = 'id'): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36).slice(-4)}`
}

/* --------------------------- Expenses -------------------------------- */

interface ExpenseSeed {
  key: ExpenseKey
  label: string
  mode: 'AMOUNT' | 'PERCENT'
  percent?: number
  basis?: ExpenseLine['basis']
  amount?: number
  /** Multiplied by unit count at deal creation. */
  perUnitAmount?: number
  enabled: boolean
  note: string
}

export const EXPENSE_SEEDS: ExpenseSeed[] = [
  {
    key: 'PROPERTY_TAX',
    label: 'Property tax',
    mode: 'PERCENT',
    percent: 0.01,
    basis: 'PURCHASE_PRICE',
    enabled: true,
    note: 'Placeholder at 1.0% of price. Ottawa\'s residential rate is applied to the MPAC assessed value, which usually lags the market — replace this with the actual figure from the listing or the tax bill.',
  },
  {
    key: 'INSURANCE',
    label: 'Insurance',
    mode: 'AMOUNT',
    perUnitAmount: 1000,
    enabled: true,
    note: 'Estimate of C$1,000 per unit per year. Get a bindable quote — older wiring or plumbing changes this materially, and some buildings are declined outright.',
  },
  { key: 'WATER_SEWER', label: 'Water / sewer', mode: 'AMOUNT', perUnitAmount: 480, enabled: true, note: 'Landlord-paid unless separately metered.' },
  { key: 'NATURAL_GAS', label: 'Natural gas', mode: 'AMOUNT', amount: 0, enabled: true, note: 'Only where the landlord pays heat. Set to zero when tenants are separately metered.' },
  { key: 'ELECTRICITY', label: 'Electricity / common hydro', mode: 'AMOUNT', amount: 600, enabled: true, note: 'Common areas, exterior lighting and shared laundry.' },
  { key: 'WASTE', label: 'Waste removal', mode: 'AMOUNT', amount: 0, enabled: true, note: 'City collection covers most small residential buildings in Ottawa; six-plus units often need private collection.' },
  {
    key: 'MANAGEMENT',
    label: 'Property management',
    mode: 'PERCENT',
    percent: 0.08,
    basis: 'COLLECTED_RESIDENTIAL_RENT',
    enabled: true,
    note: '8% of collected rent. Charge this even when self-managing — your time is not free, and a buyer will price it in.',
  },
  {
    key: 'REPAIRS_MAINTENANCE',
    label: 'Repairs and maintenance',
    mode: 'PERCENT',
    percent: 0.05,
    basis: 'GROSS_SCHEDULED_INCOME',
    enabled: true,
    note: '5% of gross rent for routine maintenance. Older buildings run higher.',
  },
  {
    key: 'CAPEX_RESERVE',
    label: 'Capital expenditure reserve',
    mode: 'PERCENT',
    percent: 0.03,
    basis: 'GROSS_SCHEDULED_INCOME',
    enabled: true,
    note: '3% of gross rent set aside for roof, furnace, windows and similar. Cross-check against the CapEx forecast — the forecast usually demands more on older stock.',
  },
  { key: 'SNOW_REMOVAL', label: 'Snow removal', mode: 'AMOUNT', amount: 1200, enabled: true, note: 'Ottawa winters make this non-optional. Walkway clearing is a landlord obligation.' },
  { key: 'LANDSCAPING', label: 'Landscaping', mode: 'AMOUNT', amount: 600, enabled: true, note: '' },
  { key: 'CLEANING', label: 'Cleaning', mode: 'AMOUNT', amount: 0, enabled: true, note: 'Common areas in buildings with interior corridors.' },
  { key: 'PEST_CONTROL', label: 'Pest control', mode: 'AMOUNT', amount: 0, enabled: true, note: '' },
  { key: 'FIRE_INSPECTION', label: 'Fire inspection', mode: 'AMOUNT', amount: 0, enabled: true, note: 'Annual alarm and extinguisher servicing.' },
  { key: 'LICENSING', label: 'Licensing', mode: 'AMOUNT', amount: 0, enabled: true, note: 'Ottawa rental licensing applies to certain small properties — confirm whether this building is captured.' },
  { key: 'SECURITY', label: 'Security', mode: 'AMOUNT', amount: 0, enabled: false, note: '' },
  { key: 'INTERNET', label: 'Internet', mode: 'AMOUNT', amount: 0, enabled: false, note: 'Only where included in rent.' },
  { key: 'LAUNDRY_EXPENSE', label: 'Laundry expenses', mode: 'AMOUNT', amount: 0, enabled: false, note: 'Lease or servicing costs for shared machines.' },
  { key: 'ACCOUNTING', label: 'Accounting', mode: 'AMOUNT', amount: 600, enabled: true, note: '' },
  { key: 'LEGAL', label: 'Legal', mode: 'AMOUNT', amount: 400, enabled: true, note: 'LTB applications and tenancy matters.' },
  { key: 'ADMIN', label: 'Administrative', mode: 'AMOUNT', amount: 300, enabled: true, note: '' },
  { key: 'CONDO_FEES', label: 'Condo fees', mode: 'AMOUNT', amount: 0, enabled: false, note: 'Only where applicable.' },
  { key: 'SUPERINTENDENT', label: 'Superintendent / caretaker', mode: 'AMOUNT', amount: 0, enabled: false, note: '' },
  { key: 'ELEVATOR', label: 'Elevator', mode: 'AMOUNT', amount: 0, enabled: false, note: '' },
  { key: 'PARKING_EXPENSE', label: 'Parking expenses', mode: 'AMOUNT', amount: 0, enabled: false, note: 'Sealing, line painting, snow clearing of the lot.' },
  { key: 'OTHER', label: 'Other expenses', mode: 'AMOUNT', amount: 0, enabled: true, note: '' },
]

export function buildDefaultExpenseLines(unitCount: number): ExpenseLine[] {
  return EXPENSE_SEEDS.map((s) => ({
    key: s.key,
    label: s.label,
    amount: s.perUnitAmount !== undefined ? s.perUnitAmount * Math.max(1, unitCount) : (s.amount ?? 0),
    percent: s.percent ?? 0,
    basis: s.basis ?? 'GROSS_SCHEDULED_INCOME',
    mode: s.mode,
    enabled: s.enabled,
    actualAmount: null,
    note: s.note,
  }))
}

export function buildDefaultExpenseSet(unitCount: number): ExpenseSet {
  return {
    mode: 'ESTIMATED',
    lines: buildDefaultExpenseLines(unitCount),
    deductions: {
      vacancyPercent: 0.03,
      badDebtPercent: 0.01,
      vacancyAmountOverride: null,
      badDebtAmountOverride: null,
    },
    includeCapexReserveInNOI: true,
  }
}

/* --------------------------- Components ------------------------------ */

export function buildDefaultComponents(): ComponentNote[] {
  return COMPONENT_SPECS.map((s) => ({
    key: s.key,
    note: '',
    ageYears: null,
    remainingLifeYears: null,
    estimatedCost: 0,
    condition: 'UNKNOWN',
    includeInForecast: !s.hazard,
  }))
}

/* ------------------------------ Units -------------------------------- */

export function buildUnit(index: number, overrides: Partial<Unit> = {}): Unit {
  return {
    id: uid('unit'),
    unitNumber: String(index + 1),
    legalUnit: true,
    bedrooms: 2,
    bathrooms: 1,
    sqFt: 0,
    occupied: true,
    currentRent: 0,
    marketRent: 0,
    leaseStart: '',
    leaseEnd: '',
    monthToMonth: false,
    tenantPaysHydro: true,
    tenantPaysHeat: false,
    tenantPaysWater: false,
    parkingIncome: 0,
    storageIncome: 0,
    laundryIncome: 0,
    otherIncome: 0,
    parkingIncomeMarket: 0,
    storageIncomeMarket: 0,
    laundryIncomeMarket: 0,
    otherIncomeMarket: 0,
    lastRentIncrease: '',
    nextLegalIncreaseDate: '',
    notes: '',
    ...overrides,
  }
}

/* ---------------------------- Sub-models ----------------------------- */

export function defaultPropertyInfo(): PropertyInfo {
  return {
    address: '',
    city: 'Ottawa',
    province: 'ON',
    postalCode: '',
    neighbourhood: '',
    mlsNumber: '',
    listingUrl: '',
    askingPrice: 0,
    offerPrice: 0,
    propertyType: 'TRIPLEX',
    yearBuilt: null,
    yearRenovated: null,
    legalUnits: 3,
    nonConformingUnits: 0,
    totalBedrooms: 0,
    totalBathrooms: 0,
    parkingSpaces: 0,
    lotSizeSqFt: 0,
    buildingSizeSqFt: 0,
    zoning: '',
    occupancyStatus: 'FULLY_OCCUPIED',
    condition: 'AVERAGE',
    separateHydroMeters: true,
    separateGasMeters: false,
    separateWaterMeters: false,
    tenantPaidUtilities: ['Hydro'],
    landlordPaidUtilities: ['Heat', 'Water'],
  }
}

export function defaultPurchaseCosts(): PurchaseCosts {
  return {
    landTransferTaxOverride: null,
    municipalLandTransferTax: 0,
    legalFees: 2500,
    inspection: 800,
    appraisal: 700,
    titleInsurance: 600,
    lenderFees: 0,
    mortgageBrokerFees: 0,
    environmentalReport: 0,
    buildingInspection: 0,
    engineeringInspection: 0,
    hst: 0,
    hstApplicable: false,
    otherAcquisitionCosts: 1000,
    immediateRenovationBudget: 0,
    initialReserveFund: 0,
  }
}

export function defaultFinancing(): FinancingPlan {
  return {
    structure: 'CASH_THEN_REFINANCE',
    downPaymentPercent: 0.25,
    downPaymentAmountOverride: null,
    annualRate: 0.0475,
    amortizationYears: 25,
    termYears: 5,
    paymentFrequency: 'MONTHLY',
    compounding: 'SEMI_ANNUAL',
    mortgageFees: 0,
  }
}

export function defaultRefinance(price: number): RefinancePlan {
  return {
    monthsUntilRefinance: 6,
    appraisalLow: price * 0.95,
    appraisalBase: price,
    appraisalHigh: price * 1.06,
    appraisalCase: 'BASE',
    valuationMethod: 'COMPARABLE_SALES',
    valuationCapRate: 0.065,
    ltv: 0.65,
    annualRate: 0.0475,
    amortizationYears: 25,
    termYears: 5,
    paymentFrequency: 'MONTHLY',
    compounding: 'SEMI_ANNUAL',
    refinanceFees: 1500,
    legalFees: 1200,
    appraisalFee: 600,
    otherLenderCosts: 0,
    existingDebtPayoff: 0,
  }
}

export function defaultProjection(): ProjectionAssumptions {
  return {
    annualRentGrowth: 0.025,
    annualExpenseInflation: 0.03,
    annualAppreciation: 0.02,
    projectionVacancy: 0.03,
    exitCapRate: 0.065,
    sellingCostsPercent: 0.05,
    holdYears: 5,
  }
}

export function defaultLegal(): LegalProfile {
  return {
    zoningConfirmed: 'UNVERIFIED',
    fireCompliance: 'UNVERIFIED',
    buildingPermits: 'UNVERIFIED',
    occupancyPermits: 'UNVERIFIED',
    separateEntrances: 'UNVERIFIED',
    egress: 'UNVERIFIED',
    electricalCompliance: 'UNVERIFIED',
    includeNonConformingIncomeInConservative: false,
    notes: '',
  }
}

export function defaultRatings(): MarketRatings {
  return {
    rentalDemand: 3,
    locationQuality: 3,
    appreciationPotential: 3,
    neighbourhoodTrajectory: 3,
    liquidityResaleDemand: 3,
    notes: '',
  }
}

export function defaultScenarios(): ScenarioSettings {
  return {
    conservative: {
      rentFactor: 1,
      vacancyPercent: 0.05,
      expenseFactor: 1.05,
      vacantUnitRentBasis: 'CONSERVATIVE',
      markOccupiedToMarket: false,
    },
    stabilized: {
      rentFactor: 1,
      vacancyPercent: 0.03,
      expenseFactor: 1,
      vacantUnitRentBasis: 'MARKET',
      markOccupiedToMarket: false,
    },
    optimistic: {
      rentFactor: 1.03,
      vacancyPercent: 0.02,
      expenseFactor: 0.95,
      vacantUnitRentBasis: 'MARKET',
      markOccupiedToMarket: true,
    },
  }
}

export function defaultDealBreakers(): DealBreakerRule[] {
  return DEFAULT_DEAL_BREAKERS.map((r) => ({ ...r }))
}

/* --------------------------- Deal factory ---------------------------- */

export function createDeal(overrides: Partial<Deal> = {}): Deal {
  const now = new Date().toISOString()
  const unitCount = 3
  const info = { ...defaultPropertyInfo(), ...(overrides.info ?? {}) }
  const units = overrides.units ?? Array.from({ length: unitCount }, (_, i) => buildUnit(i))

  return {
    id: uid('deal'),
    name: 'Untitled Ottawa property',
    status: 'WATCHING',
    archived: false,
    createdAt: now,
    updatedAt: now,
    info,
    components: buildDefaultComponents(),
    units,
    expenses: buildDefaultExpenseSet(units.length),
    purchaseCosts: defaultPurchaseCosts(),
    financing: defaultFinancing(),
    refinance: defaultRefinance(info.askingPrice || 650_000),
    projection: defaultProjection(),
    legal: defaultLegal(),
    ratings: defaultRatings(),
    scenarios: defaultScenarios(),
    rentComps: [],
    saleComps: [],
    dealBreakers: defaultDealBreakers(),
    sources: [],
    notes: '',
    inPortfolio: false,
    ...overrides,
  }
}

/* -------------------------- Investor profile ------------------------- */

export function defaultInvestorProfile(): InvestorProfile {
  return {
    startingCapital: 1_000_000,
    minimumCashReserve: 100_000,
    maxCapitalPerAcquisition: 700_000,
    maxProperties: 10,
    maxPortfolioLtv: 0.65,
    targetMonthlyCashFlow: 6_000,
    targetPortfolioValue: 3_000_000,
    targetUnits: 12,
    targetEquity: 1_300_000,
    minCapRate: 0.065,
    minDscr: 1.3,
    maxRefinanceLtv: 0.65,
    minCashOnCash: 0.06,
    maxRenovationBudget: 50_000,
    expectedRefinanceMonths: 6,
    strategy: 'BALANCED',
  }
}

export interface StrategyPreset {
  key: StrategyProfile
  name: string
  description: string
  refinanceLtvRange: [number, number]
  refinanceLtv: number
  minDscr: number
  minimumCashReserve: number
  annualAppreciation: number
  rentBasis: 'CONSERVATIVE' | 'BASE' | 'OPTIMISTIC'
  riskNote: string
}

export const STRATEGY_PRESETS: StrategyPreset[] = [
  {
    key: 'CONSERVATIVE',
    name: 'Conservative',
    description: 'Lower leverage, thicker coverage, no appreciation assumed.',
    refinanceLtvRange: [0.5, 0.55],
    refinanceLtv: 0.55,
    minDscr: 1.4,
    minimumCashReserve: 150_000,
    annualAppreciation: 0,
    rentBasis: 'CONSERVATIVE',
    riskNote: 'Least capital recycled per refinance, so the portfolio grows more slowly — but every property carries real cash-flow cushion.',
  },
  {
    key: 'BALANCED',
    name: 'Balanced',
    description: 'The default: 60–65% LTV, 1.30x DSCR, C$100k reserve, base-case rents.',
    refinanceLtvRange: [0.6, 0.65],
    refinanceLtv: 0.65,
    minDscr: 1.3,
    minimumCashReserve: 100_000,
    annualAppreciation: 0.02,
    rentBasis: 'BASE',
    riskNote: 'Recycles enough capital to keep acquiring while holding coverage most lenders will accept.',
  },
  {
    key: 'AGGRESSIVE',
    name: 'Aggressive',
    description: 'Higher leverage, thinner coverage, lower reserve.',
    refinanceLtvRange: [0.7, 0.75],
    refinanceLtv: 0.75,
    minDscr: 1.2,
    minimumCashReserve: 50_000,
    annualAppreciation: 0.03,
    rentBasis: 'OPTIMISTIC',
    riskNote: 'INCREASED RISK: more capital out per property, materially less monthly cash flow, and far less room if rates rise at renewal or a unit sits empty.',
  },
]

export function applyStrategy(profile: InvestorProfile, key: StrategyProfile): InvestorProfile {
  const preset = STRATEGY_PRESETS.find((p) => p.key === key)
  if (!preset) return { ...profile, strategy: key }
  return {
    ...profile,
    strategy: key,
    maxRefinanceLtv: preset.refinanceLtv,
    minDscr: preset.minDscr,
    minimumCashReserve: preset.minimumCashReserve,
  }
}

/* ----------------------- §36 Search filter presets ------------------- */

export interface FilterPreset {
  key: string
  name: string
  description: string
  minCapRate: number
  minMonthlyCashFlow: number
  minDscr: number
  maxYearBuiltAge: number | null
  requireSeparateUtilities: boolean
  requireAllLegalUnits: boolean
  maxCapexRisk: 'LOW' | 'MODERATE' | 'HIGH'
}

export const FILTER_PRESETS: FilterPreset[] = [
  {
    key: 'HIGH_CASH_FLOW',
    name: 'High cash flow',
    description: 'Maximum current income. Accepts older stock and more capital risk.',
    minCapRate: 0.07,
    minMonthlyCashFlow: 1500,
    minDscr: 1.3,
    maxYearBuiltAge: null,
    requireSeparateUtilities: false,
    requireAllLegalUnits: true,
    maxCapexRisk: 'HIGH',
  },
  {
    key: 'BALANCED',
    name: 'Balanced',
    description: 'The investor default: 6.5% cap, 1.30x DSCR, legal units, moderate capital risk.',
    minCapRate: 0.065,
    minMonthlyCashFlow: 1200,
    minDscr: 1.3,
    maxYearBuiltAge: 80,
    requireSeparateUtilities: false,
    requireAllLegalUnits: true,
    maxCapexRisk: 'MODERATE',
  },
  {
    key: 'APPRECIATION_INCOME',
    name: 'Appreciation + income',
    description: 'Improving areas with acceptable yield. Income must still stand on its own.',
    minCapRate: 0.06,
    minMonthlyCashFlow: 800,
    minDscr: 1.3,
    maxYearBuiltAge: 70,
    requireSeparateUtilities: false,
    requireAllLegalUnits: true,
    maxCapexRisk: 'MODERATE',
  },
  {
    key: 'LOW_MAINTENANCE',
    name: 'Low maintenance',
    description: 'Newer stock, separate utilities, minimal near-term capital.',
    minCapRate: 0.06,
    minMonthlyCashFlow: 1000,
    minDscr: 1.35,
    maxYearBuiltAge: 35,
    requireSeparateUtilities: true,
    requireAllLegalUnits: true,
    maxCapexRisk: 'LOW',
  },
]
