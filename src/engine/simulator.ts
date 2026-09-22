/**
 * §25 + §40 Capital Recycling Simulator.
 *
 * BUY CASH → STABILIZE → REFINANCE → EXTRACT CAPITAL → BUY NEXT → REPEAT.
 *
 * The §40.25 core rules are structural, not cosmetic:
 *  - Cash is tracked as a single running balance, so it cannot be double-counted.
 *  - Appreciation never touches the cash balance; only a sale or a refinance does.
 *  - Refinance proceeds are always net of existing debt and refinance costs.
 *  - The refinance appraisal never defaults above the purchase price.
 *  - An acquisition that would breach the liquidity reserve is blocked and
 *    reported, not quietly funded.
 *  - Principal repayment is never treated as spendable income.
 */

import type { InvestorProfile, PaymentFrequency, CompoundingConvention } from './types'
import { amortize, computePayment, balanceAfterYears } from './finance'
import { capitalRecycleRatio, cashOnCash, dscr as dscrOf } from './metrics'
import { safeDiv, sum } from './money'

/* ------------------------------------------------------------------ *
 * Inputs
 * ------------------------------------------------------------------ */

export interface SimProperty {
  id: string
  name: string
  /** Optional link back to a fully underwritten deal. */
  linkedDealId: string | null
  purchasePrice: number
  closingCosts: number
  renovationCosts: number
  units: number
  /** Annual figures for the stabilized property. */
  stabilizedGrossAnnualRent: number
  currentGrossAnnualRent: number
  vacancyPercent: number
  /** Operating expenses as a share of effective gross income. */
  operatingExpenseRatio: number
  /** Explicit annual operating expenses; overrides the ratio when > 0. */
  operatingExpensesAnnual: number
  monthsToStabilization: number
  monthsUntilRefinance: number
  /** Appraisal scenarios. Base defaults to the purchase price, never above it. */
  appraisalLow: number
  appraisalBase: number
  appraisalHigh: number
  refinanceLtv: number
  refinanceRate: number
  refinanceAmortizationYears: number
  refinanceTermYears: number
  refinanceCosts: number
  paymentFrequency: PaymentFrequency
  compounding: CompoundingConvention
  neighbourhood: string
  propertyType: string
  /** Months to wait after this refinance before the next acquisition. */
  gapMonthsAfterRefinance: number
  enabled: boolean
}

export interface CapexEvent {
  id: string
  label: string
  amount: number
  month: number
  /** Which property it hits, or '' for portfolio-level. */
  propertyId: string
  enabled: boolean
}

export interface SimulatorSettings {
  profile: InvestorProfile
  appraisalCase: 'LOW' | 'BASE' | 'HIGH'
  /** Global rent multiplier for §40.16 rent stress. */
  rentFactor: number
  /** Global refinance-rate override for §40.15 interest-rate risk. */
  rateOverride: number | null
  /** Global refinance-delay override for §40.13. */
  refinanceDelayOverride: number | null
  /** Global LTV override for the §40.9 ladder. */
  ltvOverride: number | null
  capexEvents: CapexEvent[]
}

/* ------------------------------------------------------------------ *
 * Outputs
 * ------------------------------------------------------------------ */

export type SimEventType =
  | 'START'
  | 'ACQUIRE'
  | 'STABILIZE'
  | 'REFINANCE'
  | 'CAPEX'
  | 'BLOCKED'
  | 'RESERVE_BREACH'

export interface SimEvent {
  month: number
  type: SimEventType
  propertyId: string | null
  propertyName: string
  label: string
  detail: string
  cashDelta: number
  cashBalance: number
  portfolioValue: number
  portfolioDebt: number
  portfolioEquity: number
  monthlyCashFlow: number
  units: number
}

export interface WaterfallLine {
  label: string
  amount: number
  kind: 'opening' | 'out' | 'in' | 'subtotal' | 'total' | 'note'
}

export interface SimPropertyResult {
  index: number
  id: string
  name: string
  acquired: boolean
  blockedReason: string | null

  acquisitionMonth: number
  stabilizationMonth: number
  refinanceMonth: number

  purchasePrice: number
  closingCosts: number
  renovationCosts: number
  totalAcquisitionCash: number
  units: number

  currentGrossAnnualRent: number
  stabilizedGrossAnnualRent: number
  effectiveGrossIncome: number
  operatingExpenses: number
  annualNoi: number
  monthlyNoi: number
  capRateOnPrice: number | null

  appraisedValue: number
  refinanceLtv: number
  mortgageAmount: number
  refinanceCosts: number
  netCashReleased: number
  cashRemainingInvested: number
  equityAfterRefinance: number

  monthlyDebtService: number
  annualDebtService: number
  postRefinanceMonthlyCashFlow: number
  postRefinanceAnnualCashFlow: number
  dscr: number | null
  cashOnCash: number | null
  capitalRecycleRatio: number | null

  liquidityAfterRefinance: number
  mortgageRate: number
  renewalYear: number | null

  waterfall: WaterfallLine[]
}

export interface TargetProgress {
  target: number
  achieved: boolean
  current: number
  shortfall: number
  percent: number
  /** Month the target was first reached, or null. */
  achievedAtMonth: number | null
  /** Properties owned when the target was reached. */
  propertiesAtAchievement: number | null
}

export interface ReserveAnalysis {
  configuredMinimum: number
  suggestedMinimum: number
  sixMonthsDebtService: number
  sixMonthsOperatingExpenses: number
  nearTermCapex: number
  actualReserve: number
  surplusOrDeficit: number
  belowThreshold: boolean
  note: string
}

export interface NextPropertyCapacity {
  cashBalance: number
  requiredReserve: number
  availableCapital: number
  maxCashPurchase: number
  maxCashPurchaseAfterCosts: number
  withFiftyPercentDown: number
  withThirtyFivePercentDown: number
  withTwentyFivePercentDown: number
  assumedClosingCostRate: number
}

export interface DebtCascadeRow {
  propertyId: string
  propertyName: string
  originalMortgage: number
  currentBalance: number
  rate: number
  renewalYear: number | null
  monthlyPayment: number
  annualDebtService: number
  ltv: number | null
  dscr: number | null
}

export interface SimulationResult {
  properties: SimPropertyResult[]
  events: SimEvent[]
  startingCapital: number
  finalCash: number
  portfolioValue: number
  portfolioDebt: number
  portfolioEquity: number
  totalUnits: number
  monthlyGrossRent: number
  monthlyNoi: number
  monthlyDebtService: number
  monthlyCashFlow: number
  annualCashFlow: number
  portfolioCapRate: number | null
  portfolioDscr: number | null
  portfolioLtv: number | null
  totalCapitalDeployed: number
  totalCapitalRecycled: number
  totalCashTrapped: number
  overallRecycleRatio: number | null
  targets: TargetProgress[]
  reserve: ReserveAnalysis
  nextCapacity: NextPropertyCapacity
  debtCascade: DebtCascadeRow[]
  acquiredCount: number
  blockedCount: number
  horizonMonths: number
  warnings: string[]
}

/* ------------------------------------------------------------------ *
 * Core simulation
 * ------------------------------------------------------------------ */

function noiOf(p: SimProperty, rentFactor: number): {
  gsi: number
  egi: number
  opex: number
  noi: number
} {
  const gsi = p.stabilizedGrossAnnualRent * rentFactor
  const egi = gsi * (1 - p.vacancyPercent)
  const opex = p.operatingExpensesAnnual > 0 ? p.operatingExpensesAnnual : egi * p.operatingExpenseRatio
  return { gsi, egi, opex, noi: egi - opex }
}

function appraisalOf(p: SimProperty, which: 'LOW' | 'BASE' | 'HIGH'): number {
  const base = p.appraisalBase > 0 ? p.appraisalBase : p.purchasePrice
  if (which === 'LOW') return p.appraisalLow > 0 ? p.appraisalLow : base * 0.95
  if (which === 'HIGH') return p.appraisalHigh > 0 ? p.appraisalHigh : base
  return base
}

export function simulate(
  properties: SimProperty[],
  settings: SimulatorSettings,
): SimulationResult {
  const profile = settings.profile
  const active = properties.filter((p) => p.enabled).slice(0, Math.max(1, profile.maxProperties))

  let cash = profile.startingCapital
  let month = 0
  let portfolioValue = 0
  let portfolioDebt = 0
  let monthlyCashFlow = 0
  let units = 0

  const events: SimEvent[] = []
  const results: SimPropertyResult[] = []
  const warnings: string[] = []
  const targetMarks = new Map<number, { month: number; properties: number }>()

  const pushEvent = (
    type: SimEventType,
    m: number,
    label: string,
    detail: string,
    cashDelta: number,
    prop: SimProperty | null,
  ) => {
    events.push({
      month: m,
      type,
      propertyId: prop?.id ?? null,
      propertyName: prop?.name ?? 'Portfolio',
      label,
      detail,
      cashDelta,
      cashBalance: cash,
      portfolioValue,
      portfolioDebt,
      portfolioEquity: portfolioValue - portfolioDebt,
      monthlyCashFlow,
      units,
    })
  }

  pushEvent('START', 0, 'Starting capital', `C$${Math.round(cash).toLocaleString('en-CA')} available`, 0, null)

  const capexByMonth = settings.capexEvents.filter((e) => e.enabled).sort((a, b) => a.month - b.month)
  let capexCursor = 0

  const applyCapexThrough = (throughMonth: number) => {
    while (capexCursor < capexByMonth.length && capexByMonth[capexCursor].month <= throughMonth) {
      const e = capexByMonth[capexCursor]
      cash -= e.amount
      pushEvent('CAPEX', e.month, e.label, `Unplanned capital expenditure of C$${Math.round(e.amount).toLocaleString('en-CA')}`, -e.amount, null)
      if (cash < profile.minimumCashReserve) {
        pushEvent(
          'RESERVE_BREACH',
          e.month,
          'Liquidity reserve breached',
          `Cash of C$${Math.round(cash).toLocaleString('en-CA')} is below the C$${Math.round(profile.minimumCashReserve).toLocaleString('en-CA')} minimum reserve.`,
          0,
          null,
        )
        warnings.push(
          `"${e.label}" in month ${e.month} pushes cash below the required reserve. The next acquisition should be delayed until liquidity recovers.`,
        )
      }
      capexCursor++
    }
  }

  const markTargets = (m: number, propsOwned: number) => {
    for (const t of [3000, 5000, 6000, 7000, 10000]) {
      if (monthlyCashFlow >= t && !targetMarks.has(t)) {
        targetMarks.set(t, { month: m, properties: propsOwned })
      }
    }
  }

  for (let i = 0; i < active.length; i++) {
    const p = active[i]
    const acquisitionMonth = month
    applyCapexThrough(acquisitionMonth)

    const totalAcquisitionCash = p.purchasePrice + p.closingCosts + p.renovationCosts
    const capitalInProperty = totalAcquisitionCash

    const availableForDeal = cash - profile.minimumCashReserve
    const capPerDeal = profile.maxCapitalPerAcquisition > 0 ? profile.maxCapitalPerAcquisition : Infinity

    let blockedReason: string | null = null
    if (totalAcquisitionCash > availableForDeal) {
      blockedReason = `Needs C$${Math.round(totalAcquisitionCash).toLocaleString('en-CA')} but only C$${Math.round(Math.max(0, availableForDeal)).toLocaleString('en-CA')} is deployable after holding the C$${Math.round(profile.minimumCashReserve).toLocaleString('en-CA')} reserve.`
    } else if (totalAcquisitionCash > capPerDeal) {
      blockedReason = `Needs C$${Math.round(totalAcquisitionCash).toLocaleString('en-CA')}, above your C$${Math.round(capPerDeal).toLocaleString('en-CA')} per-acquisition ceiling.`
    }

    const income = noiOf(p, settings.rentFactor)
    const monthsToRefi = settings.refinanceDelayOverride ?? p.monthsUntilRefinance
    const stabilizationMonth = acquisitionMonth + p.monthsToStabilization
    const refinanceMonth = acquisitionMonth + Math.max(p.monthsToStabilization, monthsToRefi)

    const appraisedValue = appraisalOf(p, settings.appraisalCase)
    const ltv = Math.min(
      settings.ltvOverride ?? p.refinanceLtv,
      profile.maxRefinanceLtv > 0 ? profile.maxRefinanceLtv : 1,
    )
    const rate = settings.rateOverride ?? p.refinanceRate

    const mortgageAmount = blockedReason ? 0 : appraisedValue * ltv
    const terms = {
      principal: mortgageAmount,
      annualRate: rate,
      amortizationYears: p.refinanceAmortizationYears,
      termYears: p.refinanceTermYears,
      paymentFrequency: p.paymentFrequency,
      compounding: p.compounding,
      fees: p.refinanceCosts,
    }
    const breakdown = computePayment(terms)
    const annualDebtService = mortgageAmount > 0 ? breakdown.annualDebtService : 0
    const netCashReleased = blockedReason ? 0 : Math.max(0, mortgageAmount - p.refinanceCosts)
    const cashRemainingInvested = capitalInProperty - netCashReleased
    const postRefinanceAnnualCashFlow = income.noi - annualDebtService

    const waterfall: WaterfallLine[] = [
      { label: 'Opening cash', amount: cash, kind: 'opening' },
      { label: 'Purchase price', amount: -p.purchasePrice, kind: 'out' },
      { label: 'Closing costs (LTT, legal, inspection, title)', amount: -p.closingCosts, kind: 'out' },
      { label: 'Renovation / stabilization', amount: -p.renovationCosts, kind: 'out' },
      { label: 'Cash after acquisition', amount: cash - totalAcquisitionCash, kind: 'subtotal' },
      { label: 'Gross refinance proceeds', amount: mortgageAmount, kind: 'in' },
      { label: 'Existing debt repaid', amount: 0, kind: 'out' },
      { label: 'Refinance fees, legal, appraisal, lender costs', amount: -p.refinanceCosts, kind: 'out' },
      { label: 'Net cash released', amount: netCashReleased, kind: 'subtotal' },
      { label: 'Cash after refinance', amount: cash - totalAcquisitionCash + netCashReleased, kind: 'subtotal' },
      { label: 'Required minimum liquidity reserve', amount: -profile.minimumCashReserve, kind: 'out' },
      {
        label: 'Capital available for next acquisition',
        amount: cash - totalAcquisitionCash + netCashReleased - profile.minimumCashReserve,
        kind: 'total',
      },
    ]

    if (blockedReason) {
      results.push({
        index: i + 1,
        id: p.id,
        name: p.name,
        acquired: false,
        blockedReason,
        acquisitionMonth,
        stabilizationMonth,
        refinanceMonth,
        purchasePrice: p.purchasePrice,
        closingCosts: p.closingCosts,
        renovationCosts: p.renovationCosts,
        totalAcquisitionCash,
        units: p.units,
        currentGrossAnnualRent: p.currentGrossAnnualRent * settings.rentFactor,
        stabilizedGrossAnnualRent: income.gsi,
        effectiveGrossIncome: income.egi,
        operatingExpenses: income.opex,
        annualNoi: income.noi,
        monthlyNoi: income.noi / 12,
        capRateOnPrice: safeDiv(income.noi, p.purchasePrice),
        appraisedValue,
        refinanceLtv: ltv,
        mortgageAmount: 0,
        refinanceCosts: p.refinanceCosts,
        netCashReleased: 0,
        cashRemainingInvested: 0,
        equityAfterRefinance: 0,
        monthlyDebtService: 0,
        annualDebtService: 0,
        postRefinanceMonthlyCashFlow: 0,
        postRefinanceAnnualCashFlow: 0,
        dscr: null,
        cashOnCash: null,
        capitalRecycleRatio: null,
        liquidityAfterRefinance: cash,
        mortgageRate: rate,
        renewalYear: null,
        waterfall,
      })
      pushEvent('BLOCKED', acquisitionMonth, `${p.name} — not affordable`, blockedReason, 0, p)
      warnings.push(`${p.name}: ${blockedReason}`)
      continue
    }

    /* Acquisition */
    cash -= totalAcquisitionCash
    portfolioValue += p.purchasePrice
    units += p.units
    // Unlevered, the property throws off its full NOI from stabilization.
    pushEvent(
      'ACQUIRE',
      acquisitionMonth,
      `${p.name} — cash purchase`,
      `C$${Math.round(p.purchasePrice).toLocaleString('en-CA')} price + C$${Math.round(p.closingCosts).toLocaleString('en-CA')} closing + C$${Math.round(p.renovationCosts).toLocaleString('en-CA')} renovation`,
      -totalAcquisitionCash,
      p,
    )

    applyCapexThrough(stabilizationMonth)
    monthlyCashFlow += income.noi / 12
    markTargets(stabilizationMonth, i + 1)
    pushEvent(
      'STABILIZE',
      stabilizationMonth,
      `${p.name} — stabilized`,
      `All ${p.units} unit(s) let. Unlevered NOI C$${Math.round(income.noi / 12).toLocaleString('en-CA')}/month.`,
      0,
      p,
    )

    /* Refinance */
    applyCapexThrough(refinanceMonth)
    cash += netCashReleased
    portfolioDebt += mortgageAmount
    monthlyCashFlow -= annualDebtService / 12
    markTargets(refinanceMonth, i + 1)

    pushEvent(
      'REFINANCE',
      refinanceMonth,
      `${p.name} — refinanced at ${(ltv * 100).toFixed(0)}% LTV`,
      `Appraisal C$${Math.round(appraisedValue).toLocaleString('en-CA')} · mortgage C$${Math.round(mortgageAmount).toLocaleString('en-CA')} · net released C$${Math.round(netCashReleased).toLocaleString('en-CA')} after C$${Math.round(p.refinanceCosts).toLocaleString('en-CA')} of costs`,
      netCashReleased,
      p,
    )

    if (cash < profile.minimumCashReserve) {
      pushEvent(
        'RESERVE_BREACH',
        refinanceMonth,
        'Liquidity reserve breached',
        `Cash of C$${Math.round(cash).toLocaleString('en-CA')} is below the C$${Math.round(profile.minimumCashReserve).toLocaleString('en-CA')} minimum.`,
        0,
        null,
      )
    }

    const renewalYear = new Date().getFullYear() + Math.floor(refinanceMonth / 12) + p.refinanceTermYears

    results.push({
      index: i + 1,
      id: p.id,
      name: p.name,
      acquired: true,
      blockedReason: null,
      acquisitionMonth,
      stabilizationMonth,
      refinanceMonth,
      purchasePrice: p.purchasePrice,
      closingCosts: p.closingCosts,
      renovationCosts: p.renovationCosts,
      totalAcquisitionCash,
      units: p.units,
      currentGrossAnnualRent: p.currentGrossAnnualRent * settings.rentFactor,
      stabilizedGrossAnnualRent: income.gsi,
      effectiveGrossIncome: income.egi,
      operatingExpenses: income.opex,
      annualNoi: income.noi,
      monthlyNoi: income.noi / 12,
      capRateOnPrice: safeDiv(income.noi, p.purchasePrice),
      appraisedValue,
      refinanceLtv: ltv,
      mortgageAmount,
      refinanceCosts: p.refinanceCosts,
      netCashReleased,
      cashRemainingInvested,
      equityAfterRefinance: appraisedValue - mortgageAmount,
      monthlyDebtService: annualDebtService / 12,
      annualDebtService,
      postRefinanceMonthlyCashFlow: postRefinanceAnnualCashFlow / 12,
      postRefinanceAnnualCashFlow,
      dscr: dscrOf(income.noi, annualDebtService),
      cashOnCash: cashOnCash(postRefinanceAnnualCashFlow, cashRemainingInvested),
      capitalRecycleRatio: capitalRecycleRatio(netCashReleased, capitalInProperty),
      liquidityAfterRefinance: cash,
      mortgageRate: rate,
      renewalYear,
      waterfall,
    })

    month = refinanceMonth + Math.max(0, p.gapMonthsAfterRefinance)
  }

  applyCapexThrough(month + 120)

  /* ------------------------- Roll-up ------------------------------- */

  const acquired = results.filter((r) => r.acquired)
  const annualNoi = sum(acquired.map((r) => r.annualNoi))
  const annualDebtService = sum(acquired.map((r) => r.annualDebtService))
  const monthlyGrossRent = sum(acquired.map((r) => r.stabilizedGrossAnnualRent)) / 12
  const totalCapitalDeployed = sum(acquired.map((r) => r.totalAcquisitionCash))
  const totalCapitalRecycled = sum(acquired.map((r) => r.netCashReleased))
  const totalCashTrapped = sum(acquired.map((r) => r.cashRemainingInvested))

  const targets: TargetProgress[] = [3000, 5000, 6000, 7000, 10000].map((t) => {
    const mark = targetMarks.get(t)
    return {
      target: t,
      achieved: monthlyCashFlow >= t,
      current: monthlyCashFlow,
      shortfall: Math.max(0, t - monthlyCashFlow),
      percent: t > 0 ? Math.min(1, monthlyCashFlow / t) : 0,
      achievedAtMonth: mark?.month ?? null,
      propertiesAtAchievement: mark?.properties ?? null,
    }
  })

  const sixMonthsDebtService = annualDebtService / 2
  const sixMonthsOperatingExpenses = sum(acquired.map((r) => r.operatingExpenses)) / 2
  const nearTermCapex = sum(
    settings.capexEvents.filter((e) => e.enabled && e.month >= month && e.month <= month + 12).map((e) => e.amount),
  )
  const suggestedMinimum = sixMonthsDebtService + sixMonthsOperatingExpenses + nearTermCapex

  const reserve: ReserveAnalysis = {
    configuredMinimum: profile.minimumCashReserve,
    suggestedMinimum,
    sixMonthsDebtService,
    sixMonthsOperatingExpenses,
    nearTermCapex,
    actualReserve: cash,
    surplusOrDeficit: cash - Math.max(profile.minimumCashReserve, suggestedMinimum),
    belowThreshold: cash < Math.max(profile.minimumCashReserve, suggestedMinimum),
    note:
      'Suggested reserve = 6 months portfolio debt service + 6 months operating expenses + near-term capital expenditure.',
  }

  const assumedClosingCostRate = 0.03
  const availableCapital = Math.max(0, cash - Math.max(profile.minimumCashReserve, 0))
  const nextCapacity: NextPropertyCapacity = {
    cashBalance: cash,
    requiredReserve: profile.minimumCashReserve,
    availableCapital,
    maxCashPurchase: availableCapital,
    maxCashPurchaseAfterCosts: availableCapital / (1 + assumedClosingCostRate),
    withFiftyPercentDown: availableCapital / (0.5 + assumedClosingCostRate),
    withThirtyFivePercentDown: availableCapital / (0.35 + assumedClosingCostRate),
    withTwentyFivePercentDown: availableCapital / (0.25 + assumedClosingCostRate),
    assumedClosingCostRate,
  }

  const debtCascade: DebtCascadeRow[] = acquired.map((r) => {
    const yearsHeld = Math.max(0, Math.floor((month - r.refinanceMonth) / 12))
    const sched = amortize({
      principal: r.mortgageAmount,
      annualRate: r.mortgageRate,
      amortizationYears: 25,
      termYears: 5,
      paymentFrequency: 'MONTHLY',
      compounding: 'SEMI_ANNUAL',
      fees: 0,
    })
    return {
      propertyId: r.id,
      propertyName: r.name,
      originalMortgage: r.mortgageAmount,
      currentBalance: yearsHeld > 0 ? balanceAfterYears(sched, yearsHeld) : r.mortgageAmount,
      rate: r.mortgageRate,
      renewalYear: r.renewalYear,
      monthlyPayment: r.monthlyDebtService,
      annualDebtService: r.annualDebtService,
      ltv: safeDiv(r.mortgageAmount, r.appraisedValue),
      dscr: r.dscr,
    }
  })

  const renewalCounts = new Map<number, number>()
  for (const d of debtCascade) {
    if (!d.renewalYear) continue
    renewalCounts.set(d.renewalYear, (renewalCounts.get(d.renewalYear) ?? 0) + 1)
  }
  for (const [year, count] of renewalCounts) {
    if (count >= 2) {
      warnings.push(`${count} mortgages renew in ${year} — stagger terms to avoid repricing the whole portfolio at once.`)
    }
  }

  if (reserve.belowThreshold) {
    warnings.push(
      `Cash of C$${Math.round(cash).toLocaleString('en-CA')} is below the suggested reserve of C$${Math.round(Math.max(profile.minimumCashReserve, suggestedMinimum)).toLocaleString('en-CA')}.`,
    )
  }

  const portfolioLtv = safeDiv(portfolioDebt, portfolioValue)
  if (portfolioLtv !== null && profile.maxPortfolioLtv > 0 && portfolioLtv > profile.maxPortfolioLtv) {
    warnings.push(
      `Portfolio LTV of ${(portfolioLtv * 100).toFixed(1)}% exceeds your ${(profile.maxPortfolioLtv * 100).toFixed(0)}% ceiling.`,
    )
  }

  return {
    properties: results,
    events: events.sort((a, b) => a.month - b.month),
    startingCapital: profile.startingCapital,
    finalCash: cash,
    portfolioValue,
    portfolioDebt,
    portfolioEquity: portfolioValue - portfolioDebt,
    totalUnits: units,
    monthlyGrossRent,
    monthlyNoi: annualNoi / 12,
    monthlyDebtService: annualDebtService / 12,
    monthlyCashFlow,
    annualCashFlow: monthlyCashFlow * 12,
    portfolioCapRate: safeDiv(annualNoi, portfolioValue),
    portfolioDscr: annualDebtService > 0 ? safeDiv(annualNoi, annualDebtService) : null,
    portfolioLtv,
    totalCapitalDeployed,
    totalCapitalRecycled,
    totalCashTrapped,
    overallRecycleRatio: safeDiv(totalCapitalRecycled, totalCapitalDeployed),
    targets,
    reserve,
    nextCapacity,
    debtCascade,
    acquiredCount: acquired.length,
    blockedCount: results.length - acquired.length,
    horizonMonths: month,
    warnings,
  }
}
