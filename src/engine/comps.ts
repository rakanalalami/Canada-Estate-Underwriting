/**
 * §14 rent comparables and §15 sales comparables.
 *
 * Suggested rents are percentile-based: conservative = 25th percentile,
 * base = median, optimistic = 75th percentile. The maximum comparable is
 * reported for reference but is NEVER used as a suggestion (§14/§37).
 */

import type { RentComp, SaleComp } from './types'
import { mean, median, safeDiv } from './money'

export function percentile(values: number[], p: number): number | null {
  const v = values.filter(Number.isFinite).sort((a, b) => a - b)
  if (v.length === 0) return null
  if (v.length === 1) return v[0]
  const idx = (v.length - 1) * p
  const lo = Math.floor(idx)
  const hi = Math.ceil(idx)
  if (lo === hi) return v[lo]
  return v[lo] + (v[hi] - v[lo]) * (idx - lo)
}

export interface RentCompSummary {
  count: number
  averageRent: number | null
  medianRent: number | null
  minRent: number | null
  maxRent: number | null
  rentPerBedroom: number | null
  rentPerSqFt: number | null
  conservativeRent: number | null
  baseRent: number | null
  optimisticRent: number | null
  /** Grouped by bedroom count so 1-bed comps do not price a 3-bed unit. */
  byBedrooms: Record<number, RentCompSummary>
  note: string
}

function summarize(comps: RentComp[], withGroups: boolean): RentCompSummary {
  const included = comps.filter((c) => c.include && c.monthlyRent > 0)
  const rents = included.map((c) => c.monthlyRent)
  const perBed = included.filter((c) => c.bedrooms > 0).map((c) => c.monthlyRent / c.bedrooms)
  const perSqFt = included.filter((c) => c.sqFt > 0).map((c) => c.monthlyRent / c.sqFt)

  const byBedrooms: Record<number, RentCompSummary> = {}
  if (withGroups) {
    const groups = new Set(included.map((c) => c.bedrooms))
    for (const b of groups) {
      byBedrooms[b] = summarize(
        included.filter((c) => c.bedrooms === b),
        false,
      )
    }
  }

  return {
    count: included.length,
    averageRent: mean(rents),
    medianRent: median(rents),
    minRent: rents.length ? Math.min(...rents) : null,
    maxRent: rents.length ? Math.max(...rents) : null,
    rentPerBedroom: mean(perBed),
    rentPerSqFt: mean(perSqFt),
    conservativeRent: percentile(rents, 0.25),
    baseRent: percentile(rents, 0.5),
    optimisticRent: percentile(rents, 0.75),
    byBedrooms,
    note:
      included.length < 3
        ? 'Fewer than 3 comparables — treat the suggested rents as indicative only.'
        : 'Conservative = 25th percentile · Base = median · Optimistic = 75th percentile. The highest comparable is never used as a suggestion.',
  }
}

export function summarizeRentComps(comps: RentComp[]): RentCompSummary {
  return summarize(comps, true)
}

/** Suggested rent for a unit, matched on bedroom count where possible. */
export function suggestedRentForBedrooms(
  summary: RentCompSummary,
  bedrooms: number,
): { conservative: number | null; base: number | null; optimistic: number | null; matched: boolean } {
  const group = summary.byBedrooms[bedrooms]
  if (group && group.count >= 2) {
    return {
      conservative: group.conservativeRent,
      base: group.baseRent,
      optimistic: group.optimisticRent,
      matched: true,
    }
  }
  return {
    conservative: summary.conservativeRent,
    base: summary.baseRent,
    optimistic: summary.optimisticRent,
    matched: false,
  }
}

/* --------------------------- Sales comps ---------------------------- */

export interface SaleCompRow extends SaleComp {
  pricePerUnit: number | null
  pricePerSqFt: number | null
  capRate: number | null
  grossRentMultiplier: number | null
}

export interface SaleCompSummary {
  count: number
  rows: SaleCompRow[]
  averagePricePerUnit: number | null
  medianPricePerUnit: number | null
  averagePricePerSqFt: number | null
  averageCapRate: number | null
  averageGrm: number | null
}

export function summarizeSaleComps(comps: SaleComp[]): SaleCompSummary {
  const included = comps.filter((c) => c.include && c.price > 0)
  const rows: SaleCompRow[] = included.map((c) => ({
    ...c,
    pricePerUnit: c.units > 0 ? safeDiv(c.price, c.units) : null,
    pricePerSqFt: c.buildingSqFt > 0 ? safeDiv(c.price, c.buildingSqFt) : null,
    capRate: c.noi > 0 ? safeDiv(c.noi, c.price) : null,
    grossRentMultiplier: c.grossAnnualRent > 0 ? safeDiv(c.price, c.grossAnnualRent) : null,
  }))

  const ppu = rows.map((r) => r.pricePerUnit).filter((n): n is number => n !== null)
  const ppsf = rows.map((r) => r.pricePerSqFt).filter((n): n is number => n !== null)
  const caps = rows.map((r) => r.capRate).filter((n): n is number => n !== null)
  const grms = rows.map((r) => r.grossRentMultiplier).filter((n): n is number => n !== null)

  return {
    count: rows.length,
    rows,
    averagePricePerUnit: mean(ppu),
    medianPricePerUnit: median(ppu),
    averagePricePerSqFt: mean(ppsf),
    averageCapRate: mean(caps),
    averageGrm: mean(grms),
  }
}

export interface SubjectVsComps {
  subjectPricePerUnit: number | null
  subjectPricePerSqFt: number | null
  subjectCapRate: number | null
  subjectGrm: number | null
  pricePerUnitDelta: number | null
  pricePerSqFtDelta: number | null
  capRateDelta: number | null
}

export function compareSubjectToComps(
  subject: { price: number; units: number; sqFt: number; noi: number; grossAnnualRent: number },
  comps: SaleCompSummary,
): SubjectVsComps {
  const subjectPricePerUnit = subject.units > 0 ? safeDiv(subject.price, subject.units) : null
  const subjectPricePerSqFt = subject.sqFt > 0 ? safeDiv(subject.price, subject.sqFt) : null
  const subjectCapRate = subject.price > 0 ? safeDiv(subject.noi, subject.price) : null
  const subjectGrm = subject.grossAnnualRent > 0 ? safeDiv(subject.price, subject.grossAnnualRent) : null

  return {
    subjectPricePerUnit,
    subjectPricePerSqFt,
    subjectCapRate,
    subjectGrm,
    pricePerUnitDelta:
      subjectPricePerUnit !== null && comps.averagePricePerUnit
        ? subjectPricePerUnit / comps.averagePricePerUnit - 1
        : null,
    pricePerSqFtDelta:
      subjectPricePerSqFt !== null && comps.averagePricePerSqFt
        ? subjectPricePerSqFt / comps.averagePricePerSqFt - 1
        : null,
    capRateDelta:
      subjectCapRate !== null && comps.averageCapRate ? subjectCapRate - comps.averageCapRate : null,
  }
}
