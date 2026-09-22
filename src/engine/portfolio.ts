/**
 * §24 Portfolio mode — roll-up across owned properties plus concentration
 * analysis. Warns when too much of the portfolio sits in one neighbourhood,
 * one property type, one tenant profile or one vintage of building stock.
 */

import { safeDiv, sum } from './money'

export interface PortfolioProperty {
  id: string
  name: string
  neighbourhood: string
  propertyType: string
  tenantType: string
  yearBuilt: number | null
  units: number
  /** Current market value (appraisal if available, otherwise cost). */
  value: number
  originalCashInvested: number
  cashRemainingInvested: number
  currentDebt: number
  annualGrossRent: number
  annualNoi: number
  annualDebtService: number
  monthlyCashFlow: number
  mortgageRate: number
  mortgageRenewalYear: number | null
}

export interface ConcentrationSlice {
  key: string
  label: string
  value: number
  share: number
  units: number
  properties: number
}

export interface ConcentrationGroup {
  dimension: 'NEIGHBOURHOOD' | 'PROPERTY_TYPE' | 'TENANT_TYPE' | 'BUILDING_AGE'
  label: string
  slices: ConcentrationSlice[]
  topShare: number
  warning: string | null
}

export interface PortfolioResult {
  propertyCount: number
  totalUnits: number
  totalValue: number
  totalOriginalCashInvested: number
  totalCashRemainingInvested: number
  totalDebt: number
  totalEquity: number
  portfolioLtv: number | null
  annualGrossRent: number
  monthlyGrossRent: number
  annualNoi: number
  monthlyNoi: number
  annualDebtService: number
  monthlyDebtService: number
  monthlyCashFlow: number
  annualCashFlow: number
  portfolioCapRate: number | null
  portfolioCashOnCash: number | null
  portfolioDscr: number | null
  weightedAverageRate: number | null
  cashReserves: number
  concentration: ConcentrationGroup[]
  renewalClusters: { year: number; count: number; debt: number }[]
  warnings: string[]
}

function ageBucket(yearBuilt: number | null): string {
  if (!yearBuilt) return 'Unknown vintage'
  const age = new Date().getFullYear() - yearBuilt
  if (age < 15) return 'Under 15 years'
  if (age < 30) return '15–30 years'
  if (age < 50) return '30–50 years'
  if (age < 75) return '50–75 years'
  return '75+ years'
}

function groupBy(
  props: PortfolioProperty[],
  dimension: ConcentrationGroup['dimension'],
  label: string,
  keyOf: (p: PortfolioProperty) => string,
  concentrationThreshold: number,
): ConcentrationGroup {
  const total = sum(props.map((p) => p.value))
  const map = new Map<string, PortfolioProperty[]>()
  for (const p of props) {
    const k = keyOf(p) || 'Unspecified'
    map.set(k, [...(map.get(k) ?? []), p])
  }
  const slices: ConcentrationSlice[] = [...map.entries()]
    .map(([k, list]) => {
      const value = sum(list.map((p) => p.value))
      return {
        key: k,
        label: k,
        value,
        share: total > 0 ? value / total : 0,
        units: sum(list.map((p) => p.units)),
        properties: list.length,
      }
    })
    .sort((a, b) => b.value - a.value)

  const topShare = slices[0]?.share ?? 0
  const warning =
    props.length > 1 && topShare > concentrationThreshold
      ? `${(topShare * 100).toFixed(0)}% of portfolio value sits in "${slices[0].label}". Concentration raises correlated risk — a single by-law change, employer or flood event hits the whole position at once.`
      : null

  return { dimension, label, slices, topShare, warning }
}

export function buildPortfolio(
  properties: PortfolioProperty[],
  cashReserves: number,
  opts: { concentrationThreshold?: number } = {},
): PortfolioResult {
  const threshold = opts.concentrationThreshold ?? 0.5
  const totalValue = sum(properties.map((p) => p.value))
  const totalDebt = sum(properties.map((p) => p.currentDebt))
  const annualNoi = sum(properties.map((p) => p.annualNoi))
  const annualDebtService = sum(properties.map((p) => p.annualDebtService))
  const monthlyCashFlow = sum(properties.map((p) => p.monthlyCashFlow))
  const totalCashRemaining = sum(properties.map((p) => p.cashRemainingInvested))

  const weightedRate =
    totalDebt > 0
      ? sum(properties.map((p) => p.currentDebt * p.mortgageRate)) / totalDebt
      : null

  const renewalMap = new Map<number, { count: number; debt: number }>()
  for (const p of properties) {
    if (!p.mortgageRenewalYear) continue
    const cur = renewalMap.get(p.mortgageRenewalYear) ?? { count: 0, debt: 0 }
    renewalMap.set(p.mortgageRenewalYear, { count: cur.count + 1, debt: cur.debt + p.currentDebt })
  }
  const renewalClusters = [...renewalMap.entries()]
    .map(([year, v]) => ({ year, ...v }))
    .sort((a, b) => a.year - b.year)

  const concentration = [
    groupBy(properties, 'NEIGHBOURHOOD', 'Neighbourhood', (p) => p.neighbourhood, threshold),
    groupBy(properties, 'PROPERTY_TYPE', 'Property type', (p) => p.propertyType, 0.6),
    groupBy(properties, 'TENANT_TYPE', 'Tenant type', (p) => p.tenantType, 0.7),
    groupBy(properties, 'BUILDING_AGE', 'Building age', (p) => ageBucket(p.yearBuilt), 0.7),
  ]

  const warnings: string[] = concentration.map((c) => c.warning).filter((w): w is string => w !== null)

  for (const cluster of renewalClusters) {
    if (cluster.count >= 2) {
      warnings.push(
        `${cluster.count} mortgages totalling C$${Math.round(cluster.debt).toLocaleString('en-CA')} renew in ${cluster.year}. Staggering terms avoids repricing the whole portfolio into one rate environment.`,
      )
    }
  }

  return {
    propertyCount: properties.length,
    totalUnits: sum(properties.map((p) => p.units)),
    totalValue,
    totalOriginalCashInvested: sum(properties.map((p) => p.originalCashInvested)),
    totalCashRemainingInvested: totalCashRemaining,
    totalDebt,
    totalEquity: totalValue - totalDebt,
    portfolioLtv: safeDiv(totalDebt, totalValue),
    annualGrossRent: sum(properties.map((p) => p.annualGrossRent)),
    monthlyGrossRent: sum(properties.map((p) => p.annualGrossRent)) / 12,
    annualNoi,
    monthlyNoi: annualNoi / 12,
    annualDebtService,
    monthlyDebtService: annualDebtService / 12,
    monthlyCashFlow,
    annualCashFlow: monthlyCashFlow * 12,
    portfolioCapRate: safeDiv(annualNoi, totalValue),
    portfolioCashOnCash: totalCashRemaining > 0 ? safeDiv(monthlyCashFlow * 12, totalCashRemaining) : null,
    portfolioDscr: annualDebtService > 0 ? safeDiv(annualNoi, annualDebtService) : null,
    weightedAverageRate: weightedRate,
    cashReserves,
    concentration,
    renewalClusters,
    warnings,
  }
}
