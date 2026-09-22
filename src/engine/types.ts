/**
 * Canonical domain model for the Ottawa small-multifamily underwriting engine.
 *
 * Conventions used everywhere in this file and the engine:
 *  - All monetary values are CAD dollars (not cents) as plain numbers.
 *  - All rates are decimals (0.0475 === 4.75%), never percentages, inside the engine.
 *    The UI converts to/from percent at the input boundary only.
 *  - "monthly" values are per calendar month; "annual" values are monthly * 12 unless
 *    a line item is explicitly annual (e.g. property tax, insurance).
 */

export type ISODate = string // 'YYYY-MM-DD'

/* ------------------------------------------------------------------ *
 * Data provenance (§33 Sources / audit trail)
 * ------------------------------------------------------------------ */

/** Where a number came from. Never silently overwrite USER_INPUT. */
export type DataOrigin =
  | 'LISTING_DATA'
  | 'USER_INPUT'
  | 'MODEL_ASSUMPTION'
  | 'LIVE_MARKET_DATA'

export interface SourceRecord {
  id: string
  /** Dotted path of the field this documents, e.g. 'info.askingPrice'. */
  field: string
  label: string
  origin: DataOrigin
  source: string
  url: string
  retrievedAt: ISODate
  /** true = typed by a human, false = fetched by an integration. */
  manual: boolean
  note: string
}

/* ------------------------------------------------------------------ *
 * §1 Property information
 * ------------------------------------------------------------------ */

export type PropertyType =
  | 'DUPLEX'
  | 'TRIPLEX'
  | 'FOURPLEX'
  | 'MULTIFAMILY_5_PLUS'
  | 'HOUSE_WITH_SDU'
  | 'OTHER'

export type PropertyCondition =
  | 'NEW'
  | 'EXCELLENT'
  | 'GOOD'
  | 'AVERAGE'
  | 'RENOVATION_REQUIRED'
  | 'MAJOR_CAPITAL_REQUIRED'

export type OccupancyStatus =
  | 'FULLY_OCCUPIED'
  | 'PARTIALLY_OCCUPIED'
  | 'VACANT'
  | 'OWNER_OCCUPIED'
  | 'MIXED'

export type UtilityParty = 'TENANT' | 'LANDLORD' | 'SPLIT' | 'NA'

export interface PropertyInfo {
  address: string
  city: string
  province: string
  postalCode: string
  neighbourhood: string
  mlsNumber: string
  listingUrl: string
  askingPrice: number
  offerPrice: number
  propertyType: PropertyType
  yearBuilt: number | null
  yearRenovated: number | null
  legalUnits: number
  nonConformingUnits: number
  totalBedrooms: number
  totalBathrooms: number
  parkingSpaces: number
  lotSizeSqFt: number
  buildingSizeSqFt: number
  zoning: string
  occupancyStatus: OccupancyStatus
  condition: PropertyCondition
  separateHydroMeters: boolean
  separateGasMeters: boolean
  separateWaterMeters: boolean
  /** Free-form lists, e.g. ['Hydro', 'Heat']. */
  tenantPaidUtilities: string[]
  landlordPaidUtilities: string[]
}

/** §1 component notes + §20 age tracking live together. */
export interface ComponentNote {
  key: BuildingComponentKey
  note: string
  /** Age in years of the component, where meaningful. null = unknown. */
  ageYears: number | null
  /** Remaining useful life override in years. null = derive from age. */
  remainingLifeYears: number | null
  /** Estimated replacement / remediation cost in CAD. */
  estimatedCost: number
  condition: ComponentCondition
  /** Whether this is included in the CapEx forecast. */
  includeInForecast: boolean
}

export type ComponentCondition = 'GOOD' | 'FAIR' | 'POOR' | 'UNKNOWN' | 'NA'

export type BuildingComponentKey =
  | 'ROOF'
  | 'WINDOWS'
  | 'ELECTRICAL'
  | 'PLUMBING'
  | 'FOUNDATION'
  | 'SEWER'
  | 'HVAC'
  | 'BOILER'
  | 'FURNACE'
  | 'HOT_WATER'
  | 'INSULATION'
  | 'EXTERIOR'
  | 'PARKING'
  | 'ENVIRONMENTAL'
  | 'ASBESTOS'
  | 'KNOB_AND_TUBE'
  | 'GALVANIZED_PLUMBING'
  | 'OTHER_DEFERRED'

/* ------------------------------------------------------------------ *
 * §2 Unit-by-unit rent roll
 * ------------------------------------------------------------------ */

export interface Unit {
  id: string
  unitNumber: string
  legalUnit: boolean
  bedrooms: number
  bathrooms: number
  sqFt: number
  occupied: boolean
  currentRent: number
  marketRent: number
  leaseStart: ISODate | ''
  leaseEnd: ISODate | ''
  monthToMonth: boolean
  tenantPaysHydro: boolean
  tenantPaysHeat: boolean
  tenantPaysWater: boolean
  parkingIncome: number
  storageIncome: number
  laundryIncome: number
  otherIncome: number
  /** Potential ancillary income once stabilized (>= current by convention). */
  parkingIncomeMarket: number
  storageIncomeMarket: number
  laundryIncomeMarket: number
  otherIncomeMarket: number
  lastRentIncrease: ISODate | ''
  nextLegalIncreaseDate: ISODate | ''
  /** Ontario rent-increase guideline used for the "next legal increase" estimate. */
  notes: string
}

/* ------------------------------------------------------------------ *
 * §3 Operating expenses
 * ------------------------------------------------------------------ */

export type ExpenseMode = 'AMOUNT' | 'PERCENT'

export type PercentBasis =
  | 'GROSS_SCHEDULED_INCOME'
  | 'EFFECTIVE_GROSS_INCOME'
  | 'COLLECTED_RESIDENTIAL_RENT'
  | 'PURCHASE_PRICE'

export interface ExpenseLine {
  key: ExpenseKey
  label: string
  /** Annual dollar amount when mode === 'AMOUNT'. */
  amount: number
  /** Decimal rate when mode === 'PERCENT' (0.08 === 8%). */
  percent: number
  basis: PercentBasis
  mode: ExpenseMode
  enabled: boolean
  /** ACTUAL = vendor-supplied/verified. ESTIMATED = model assumption. */
  actualAmount: number | null
  note: string
}

export type ExpenseKey =
  | 'PROPERTY_TAX'
  | 'INSURANCE'
  | 'WATER_SEWER'
  | 'NATURAL_GAS'
  | 'ELECTRICITY'
  | 'WASTE'
  | 'MANAGEMENT'
  | 'REPAIRS_MAINTENANCE'
  | 'CAPEX_RESERVE'
  | 'SNOW_REMOVAL'
  | 'LANDSCAPING'
  | 'CLEANING'
  | 'PEST_CONTROL'
  | 'FIRE_INSPECTION'
  | 'LICENSING'
  | 'SECURITY'
  | 'INTERNET'
  | 'LAUNDRY_EXPENSE'
  | 'ACCOUNTING'
  | 'LEGAL'
  | 'ADMIN'
  | 'CONDO_FEES'
  | 'SUPERINTENDENT'
  | 'ELEVATOR'
  | 'PARKING_EXPENSE'
  | 'OTHER'

/** Vacancy and bad debt sit ABOVE the expense line (§4 NOI waterfall). */
export interface IncomeDeductions {
  vacancyPercent: number
  badDebtPercent: number
  /** Optional hard-dollar override; null = use percentages. */
  vacancyAmountOverride: number | null
  badDebtAmountOverride: number | null
}

export type ExpenseSourceMode = 'ACTUAL' | 'ESTIMATED'

export interface ExpenseSet {
  mode: ExpenseSourceMode
  lines: ExpenseLine[]
  deductions: IncomeDeductions
  /**
   * CapEx reserve is a below-the-line reserve for some underwriters and an
   * operating expense for others. Default: included (conservative). Both cap
   * rates are always reported so the choice is never hidden.
   */
  includeCapexReserveInNOI: boolean
}

/* ------------------------------------------------------------------ *
 * §6 Purchase costs
 * ------------------------------------------------------------------ */

export interface PurchaseCosts {
  /** Ontario LTT is computed, not entered. Override only if you have a quote. */
  landTransferTaxOverride: number | null
  /** Ottawa has NO municipal land transfer tax. Kept for future cities only. */
  municipalLandTransferTax: number
  legalFees: number
  inspection: number
  appraisal: number
  titleInsurance: number
  lenderFees: number
  mortgageBrokerFees: number
  environmentalReport: number
  buildingInspection: number
  engineeringInspection: number
  hst: number
  hstApplicable: boolean
  otherAcquisitionCosts: number
  /** §6 stabilization budget, treated as capital, not expense. */
  immediateRenovationBudget: number
  initialReserveFund: number
}

/* ------------------------------------------------------------------ *
 * §7 Financing
 * ------------------------------------------------------------------ */

export type AcquisitionStructure = 'ALL_CASH' | 'MORTGAGED' | 'CASH_THEN_REFINANCE'

export type PaymentFrequency =
  | 'MONTHLY'
  | 'SEMI_MONTHLY'
  | 'BI_WEEKLY'
  | 'ACCELERATED_BI_WEEKLY'
  | 'WEEKLY'
  | 'ACCELERATED_WEEKLY'

/**
 * Canadian fixed-rate mortgages compound semi-annually, not in advance.
 * This materially changes the payment vs. US monthly compounding, so it is
 * explicit and switchable rather than hard-coded.
 */
export type CompoundingConvention = 'SEMI_ANNUAL' | 'MONTHLY'

export interface MortgageTerms {
  principal: number
  annualRate: number
  amortizationYears: number
  termYears: number
  paymentFrequency: PaymentFrequency
  compounding: CompoundingConvention
  /** One-time financing costs rolled into cash required, not into principal. */
  fees: number
}

export interface FinancingPlan {
  structure: AcquisitionStructure
  downPaymentPercent: number
  /** null = derive from downPaymentPercent. */
  downPaymentAmountOverride: number | null
  annualRate: number
  amortizationYears: number
  termYears: number
  paymentFrequency: PaymentFrequency
  compounding: CompoundingConvention
  mortgageFees: number
}

/* ------------------------------------------------------------------ *
 * §8 / §27 Refinance
 * ------------------------------------------------------------------ */

export type AppraisalCase = 'LOW' | 'BASE' | 'HIGH'

export type ValuationMethod = 'COMPARABLE_SALES' | 'INCOME_CAP_RATE' | 'MANUAL'

export interface RefinancePlan {
  monthsUntilRefinance: number
  /** Explicit appraisal scenarios — never assume value > purchase price. */
  appraisalLow: number
  appraisalBase: number
  appraisalHigh: number
  appraisalCase: AppraisalCase
  /**
   * For 2–4 unit residential, lenders lean on comparable residential sales.
   * Income capitalisation is opt-in, never the silent default.
   */
  valuationMethod: ValuationMethod
  /** Only used when valuationMethod === 'INCOME_CAP_RATE'. */
  valuationCapRate: number
  ltv: number
  annualRate: number
  amortizationYears: number
  termYears: number
  paymentFrequency: PaymentFrequency
  compounding: CompoundingConvention
  refinanceFees: number
  legalFees: number
  appraisalFee: number
  otherLenderCosts: number
  /** Debt to be discharged at refinance (0 for a cash purchase). */
  existingDebtPayoff: number
}

/* ------------------------------------------------------------------ *
 * §14/§15 Comparables
 * ------------------------------------------------------------------ */

export interface RentComp {
  id: string
  address: string
  distanceKm: number
  neighbourhood: string
  unitType: string
  bedrooms: number
  bathrooms: number
  sqFt: number
  monthlyRent: number
  parkingIncluded: boolean
  utilitiesIncluded: string[]
  furnished: boolean
  condition: string
  listingDate: ISODate | ''
  sourceUrl: string
  include: boolean
}

export interface SaleComp {
  id: string
  address: string
  price: number
  units: number
  buildingSqFt: number
  lotSqFt: number
  yearBuilt: number | null
  grossAnnualRent: number
  noi: number
  saleDate: ISODate | ''
  distanceKm: number
  source: string
  include: boolean
}

/* ------------------------------------------------------------------ *
 * §16–§18 Projection
 * ------------------------------------------------------------------ */

export interface ProjectionAssumptions {
  annualRentGrowth: number
  annualExpenseInflation: number
  annualAppreciation: number
  projectionVacancy: number
  exitCapRate: number
  sellingCostsPercent: number
  holdYears: number
}

/* ------------------------------------------------------------------ *
 * §21 Legal / unit risk
 * ------------------------------------------------------------------ */

export type ComplianceState = 'CONFIRMED' | 'UNVERIFIED' | 'NON_COMPLIANT' | 'NA'

export interface LegalProfile {
  zoningConfirmed: ComplianceState
  fireCompliance: ComplianceState
  buildingPermits: ComplianceState
  occupancyPermits: ComplianceState
  separateEntrances: ComplianceState
  egress: ComplianceState
  electricalCompliance: ComplianceState
  /**
   * §21/§37: non-conforming unit income is excluded from the conservative
   * scenario unless the investor explicitly overrides.
   */
  includeNonConformingIncomeInConservative: boolean
  notes: string
}

/* ------------------------------------------------------------------ *
 * §22 Scenarios
 * ------------------------------------------------------------------ */

export type ScenarioKey = 'CONSERVATIVE' | 'STABILIZED' | 'OPTIMISTIC'

export interface ScenarioTuning {
  /** Multiplier applied to the scenario's rent basis (1.0 = as entered). */
  rentFactor: number
  /** Absolute vacancy rate for the scenario (overrides the base deduction). */
  vacancyPercent: number
  /** Multiplier applied to controllable operating expenses. */
  expenseFactor: number
  /**
   * How vacant units are priced:
   *  - 'MARKET'       use the unit's market rent
   *  - 'CONSERVATIVE' use the conservative comp-derived rent
   *  - 'CURRENT'      use the current (likely zero) rent
   */
  vacantUnitRentBasis: 'MARKET' | 'CONSERVATIVE' | 'CURRENT'
  /** Whether OCCUPIED units are marked to market. Never true for CONSERVATIVE. */
  markOccupiedToMarket: boolean
}

export interface ScenarioSettings {
  conservative: ScenarioTuning
  stabilized: ScenarioTuning
  optimistic: ScenarioTuning
}

/* ------------------------------------------------------------------ *
 * §23/§35 Qualitative market ratings (1–5, investor-scored)
 * ------------------------------------------------------------------ */

export interface MarketRatings {
  /** Depth of tenant demand for this unit mix in this pocket. */
  rentalDemand: number
  /** Quality of the location for a long-term rental hold. */
  locationQuality: number
  /** Evidence-based appreciation potential — never assumed. */
  appreciationPotential: number
  /** Direction of travel: infrastructure, redevelopment, amenity change. */
  neighbourhoodTrajectory: number
  /** How readily the asset resells to another investor or owner-occupier. */
  liquidityResaleDemand: number
  notes: string
}

/* ------------------------------------------------------------------ *
 * §28 Deal breakers
 * ------------------------------------------------------------------ */

export type DealBreakerSeverity = 'RED' | 'AMBER'

export interface DealBreakerRule {
  key: string
  label: string
  enabled: boolean
  severity: DealBreakerSeverity
  /** Threshold semantics depend on the rule; see dealBreakers.ts. */
  threshold: number
}

/* ------------------------------------------------------------------ *
 * §26 Investor profile
 * ------------------------------------------------------------------ */

export type StrategyProfile = 'CONSERVATIVE' | 'BALANCED' | 'AGGRESSIVE' | 'CUSTOM'

export interface InvestorProfile {
  startingCapital: number
  minimumCashReserve: number
  maxCapitalPerAcquisition: number
  maxProperties: number
  maxPortfolioLtv: number
  targetMonthlyCashFlow: number
  targetPortfolioValue: number
  targetUnits: number
  targetEquity: number
  minCapRate: number
  minDscr: number
  maxRefinanceLtv: number
  minCashOnCash: number
  maxRenovationBudget: number
  expectedRefinanceMonths: number
  strategy: StrategyProfile
}

/* ------------------------------------------------------------------ *
 * §31 Deal lifecycle
 * ------------------------------------------------------------------ */

export type DealStatus =
  | 'WATCHING'
  | 'INTERESTED'
  | 'DUE_DILIGENCE'
  | 'OFFER_SUBMITTED'
  | 'UNDER_CONTRACT'
  | 'PURCHASED'
  | 'REJECTED'
  | 'ARCHIVED'

/* ------------------------------------------------------------------ *
 * Aggregate deal record
 * ------------------------------------------------------------------ */

export interface Deal {
  id: string
  name: string
  status: DealStatus
  archived: boolean
  createdAt: string
  updatedAt: string
  info: PropertyInfo
  components: ComponentNote[]
  units: Unit[]
  expenses: ExpenseSet
  purchaseCosts: PurchaseCosts
  financing: FinancingPlan
  refinance: RefinancePlan
  projection: ProjectionAssumptions
  legal: LegalProfile
  ratings: MarketRatings
  scenarios: ScenarioSettings
  rentComps: RentComp[]
  saleComps: SaleComp[]
  dealBreakers: DealBreakerRule[]
  sources: SourceRecord[]
  notes: string
  /** §24 portfolio: is this deal counted as owned? */
  inPortfolio: boolean
}
