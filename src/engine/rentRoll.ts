/**
 * §2 Unit-by-unit rent roll.
 *
 * Two hard rules, enforced here rather than left to the UI:
 *  1. Current occupied rents are NEVER silently replaced by market rents.
 *     Current and stabilized income are always computed as separate figures.
 *  2. Income from a non-conforming (non-legal) unit is excluded from the
 *     conservative case unless the investor explicitly opts in (§21/§37).
 */

import type { LegalProfile, ScenarioTuning, Unit } from './types'
import { mean, median, safeDiv, sum } from './money'

export interface UnitIncome {
  unitId: string
  unitNumber: string
  legalUnit: boolean
  occupied: boolean
  /** Rent actually being collected today. */
  currentRent: number
  /** Achievable market rent for this unit. */
  marketRent: number
  /** Rent applied in the scenario being computed. */
  scenarioRent: number
  currentAncillary: number
  marketAncillary: number
  scenarioAncillary: number
  /** True when this unit's income was zeroed because it is non-conforming. */
  excludedAsNonConforming: boolean
  belowMarketGap: number
  belowMarketPercent: number | null
}

export interface RentRollSummary {
  unitCount: number
  legalUnitCount: number
  nonConformingUnitCount: number
  occupiedCount: number
  vacantCount: number
  totalBedrooms: number
  totalSqFt: number

  currentMonthlyResidentialRent: number
  currentAnnualResidentialRent: number
  marketMonthlyResidentialRent: number
  marketAnnualResidentialRent: number

  currentMonthlyAncillary: number
  currentAnnualAncillary: number
  marketMonthlyAncillary: number
  marketAnnualAncillary: number

  /** Gross Scheduled Income = residential rent + ancillary income. */
  currentMonthlyGSI: number
  currentAnnualGSI: number
  stabilizedMonthlyGSI: number
  stabilizedAnnualGSI: number

  monthlyRentUpside: number
  annualRentUpside: number

  averageRentPerUnit: number | null
  medianRentPerUnit: number | null
  rentPerBedroom: number | null
  rentPerSqFt: number | null

  belowMarketUnits: UnitIncome[]
  units: UnitIncome[]
}

function currentAncillary(u: Unit): number {
  return (u.parkingIncome || 0) + (u.storageIncome || 0) + (u.laundryIncome || 0) + (u.otherIncome || 0)
}

function marketAncillary(u: Unit): number {
  // Market ancillary defaults to current when no separate potential is entered.
  const p = u.parkingIncomeMarket || u.parkingIncome || 0
  const s = u.storageIncomeMarket || u.storageIncome || 0
  const l = u.laundryIncomeMarket || u.laundryIncome || 0
  const o = u.otherIncomeMarket || u.otherIncome || 0
  return p + s + l + o
}

/** Rent roll totals, independent of any scenario. */
export function summarizeRentRoll(units: Unit[]): RentRollSummary {
  const rows: UnitIncome[] = units.map((u) => {
    const gap = Math.max(0, (u.marketRent || 0) - (u.currentRent || 0))
    return {
      unitId: u.id,
      unitNumber: u.unitNumber,
      legalUnit: u.legalUnit,
      occupied: u.occupied,
      currentRent: u.occupied ? u.currentRent || 0 : 0,
      marketRent: u.marketRent || 0,
      scenarioRent: 0,
      currentAncillary: currentAncillary(u),
      marketAncillary: marketAncillary(u),
      scenarioAncillary: 0,
      excludedAsNonConforming: false,
      belowMarketGap: u.occupied ? gap : 0,
      belowMarketPercent: u.occupied && u.currentRent > 0 ? safeDiv(gap, u.currentRent) : null,
    }
  })

  const currentMonthlyResidentialRent = sum(rows.map((r) => r.currentRent))
  const marketMonthlyResidentialRent = sum(rows.map((r) => r.marketRent))
  const currentMonthlyAncillary = sum(rows.map((r) => r.currentAncillary))
  const marketMonthlyAncillary = sum(rows.map((r) => r.marketAncillary))

  const occupiedRents = rows.filter((r) => r.occupied).map((r) => r.currentRent)
  const totalBedrooms = sum(units.map((u) => u.bedrooms || 0))
  const totalSqFt = sum(units.map((u) => u.sqFt || 0))

  const currentMonthlyGSI = currentMonthlyResidentialRent + currentMonthlyAncillary
  const stabilizedMonthlyGSI = marketMonthlyResidentialRent + marketMonthlyAncillary

  return {
    unitCount: units.length,
    legalUnitCount: units.filter((u) => u.legalUnit).length,
    nonConformingUnitCount: units.filter((u) => !u.legalUnit).length,
    occupiedCount: units.filter((u) => u.occupied).length,
    vacantCount: units.filter((u) => !u.occupied).length,
    totalBedrooms,
    totalSqFt,

    currentMonthlyResidentialRent,
    currentAnnualResidentialRent: currentMonthlyResidentialRent * 12,
    marketMonthlyResidentialRent,
    marketAnnualResidentialRent: marketMonthlyResidentialRent * 12,

    currentMonthlyAncillary,
    currentAnnualAncillary: currentMonthlyAncillary * 12,
    marketMonthlyAncillary,
    marketAnnualAncillary: marketMonthlyAncillary * 12,

    currentMonthlyGSI,
    currentAnnualGSI: currentMonthlyGSI * 12,
    stabilizedMonthlyGSI,
    stabilizedAnnualGSI: stabilizedMonthlyGSI * 12,

    monthlyRentUpside: stabilizedMonthlyGSI - currentMonthlyGSI,
    annualRentUpside: (stabilizedMonthlyGSI - currentMonthlyGSI) * 12,

    averageRentPerUnit: mean(occupiedRents),
    medianRentPerUnit: median(occupiedRents),
    rentPerBedroom: totalBedrooms > 0 ? safeDiv(currentMonthlyResidentialRent, totalBedrooms) : null,
    rentPerSqFt: totalSqFt > 0 ? safeDiv(currentMonthlyResidentialRent, totalSqFt) : null,

    belowMarketUnits: rows.filter((r) => r.belowMarketGap > 0),
    units: rows,
  }
}

export interface ScenarioIncomeOptions {
  units: Unit[]
  tuning: ScenarioTuning
  legal: LegalProfile
  /** Excludes non-conforming unit income (true for the conservative case). */
  excludeNonConforming: boolean
  /** Optional comp-derived conservative rent per unit id. */
  conservativeRentByUnit?: Record<string, number>
}

export interface ScenarioIncome {
  units: UnitIncome[]
  monthlyResidentialRent: number
  monthlyAncillary: number
  monthlyGSI: number
  annualGSI: number
  excludedUnitCount: number
  excludedMonthlyIncome: number
}

/**
 * Income for one scenario. The scenario's rent basis decides how VACANT units
 * are priced; occupied units keep their contract rent unless the scenario
 * explicitly marks them to market (never the case for CONSERVATIVE).
 */
export function scenarioIncome(opts: ScenarioIncomeOptions): ScenarioIncome {
  const { units, tuning, legal, excludeNonConforming, conservativeRentByUnit } = opts
  const allowNonConforming =
    !excludeNonConforming || legal.includeNonConformingIncomeInConservative

  let excludedUnitCount = 0
  let excludedMonthlyIncome = 0

  const rows: UnitIncome[] = units.map((u) => {
    const cur = u.occupied ? u.currentRent || 0 : 0
    const mkt = u.marketRent || 0
    const consRent = conservativeRentByUnit?.[u.id] ?? mkt

    let base: number
    if (u.occupied) {
      base = tuning.markOccupiedToMarket ? Math.max(cur, mkt) : cur
    } else {
      switch (tuning.vacantUnitRentBasis) {
        case 'MARKET':
          base = mkt
          break
        case 'CONSERVATIVE':
          base = consRent
          break
        case 'CURRENT':
          base = u.currentRent || 0
          break
      }
    }

    const ancBase = tuning.markOccupiedToMarket || !u.occupied ? marketAncillary(u) : currentAncillary(u)

    const excluded = !u.legalUnit && !allowNonConforming
    const scenarioRent = excluded ? 0 : base * tuning.rentFactor
    const scenarioAncillary = excluded ? 0 : ancBase * tuning.rentFactor

    if (excluded) {
      excludedUnitCount += 1
      excludedMonthlyIncome += base * tuning.rentFactor + ancBase * tuning.rentFactor
    }

    const gap = Math.max(0, mkt - cur)
    return {
      unitId: u.id,
      unitNumber: u.unitNumber,
      legalUnit: u.legalUnit,
      occupied: u.occupied,
      currentRent: cur,
      marketRent: mkt,
      scenarioRent,
      currentAncillary: currentAncillary(u),
      marketAncillary: marketAncillary(u),
      scenarioAncillary,
      excludedAsNonConforming: excluded,
      belowMarketGap: u.occupied ? gap : 0,
      belowMarketPercent: u.occupied && cur > 0 ? safeDiv(gap, cur) : null,
    }
  })

  const monthlyResidentialRent = sum(rows.map((r) => r.scenarioRent))
  const monthlyAncillary = sum(rows.map((r) => r.scenarioAncillary))
  const monthlyGSI = monthlyResidentialRent + monthlyAncillary

  return {
    units: rows,
    monthlyResidentialRent,
    monthlyAncillary,
    monthlyGSI,
    annualGSI: monthlyGSI * 12,
    excludedUnitCount,
    excludedMonthlyIncome,
  }
}
