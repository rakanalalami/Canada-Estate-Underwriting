/**
 * §20 Property age / CapEx risk.
 *
 * The point of this module: an 8% cap rate on a building needing C$100,000 of
 * work is NOT the same asset as an 8% cap rate on a recently renovated one.
 * Forecast capital costs are reported in 1/3/5/10-year buckets and converted
 * into a risk score that the scorecard reads directly.
 */

import type { BuildingComponentKey, ComponentNote, PropertyCondition } from './types'
import { safeDiv, sum } from './money'

export interface ComponentSpec {
  key: BuildingComponentKey
  label: string
  /** Typical useful life in years; null where the concept does not apply. */
  usefulLifeYears: number | null
  /** Default replacement cost, per building unless perUnit is true. */
  defaultCost: number
  perUnit: boolean
  /** Hazard components are condition-driven, not age-driven. */
  hazard: boolean
}

/**
 * Ottawa-area order-of-magnitude replacement costs for small multifamily.
 * These are editable defaults, not fixed constants — every figure can be
 * overridden per property.
 */
export const COMPONENT_SPECS: ComponentSpec[] = [
  { key: 'ROOF', label: 'Roof', usefulLifeYears: 25, defaultCost: 15000, perUnit: false, hazard: false },
  { key: 'WINDOWS', label: 'Windows', usefulLifeYears: 30, defaultCost: 4000, perUnit: true, hazard: false },
  { key: 'ELECTRICAL', label: 'Electrical system', usefulLifeYears: 40, defaultCost: 6000, perUnit: true, hazard: false },
  { key: 'PLUMBING', label: 'Plumbing', usefulLifeYears: 50, defaultCost: 5000, perUnit: true, hazard: false },
  { key: 'FOUNDATION', label: 'Foundation', usefulLifeYears: 75, defaultCost: 30000, perUnit: false, hazard: false },
  { key: 'SEWER', label: 'Sewer lateral', usefulLifeYears: 60, defaultCost: 18000, perUnit: false, hazard: false },
  { key: 'HVAC', label: 'HVAC / air conditioning', usefulLifeYears: 18, defaultCost: 5500, perUnit: false, hazard: false },
  { key: 'BOILER', label: 'Boiler', usefulLifeYears: 30, defaultCost: 15000, perUnit: false, hazard: false },
  { key: 'FURNACE', label: 'Furnace', usefulLifeYears: 20, defaultCost: 6000, perUnit: false, hazard: false },
  { key: 'HOT_WATER', label: 'Hot water tanks', usefulLifeYears: 12, defaultCost: 1800, perUnit: true, hazard: false },
  { key: 'INSULATION', label: 'Insulation', usefulLifeYears: 40, defaultCost: 8000, perUnit: false, hazard: false },
  { key: 'EXTERIOR', label: 'Exterior / cladding', usefulLifeYears: 30, defaultCost: 20000, perUnit: false, hazard: false },
  { key: 'PARKING', label: 'Parking surface', usefulLifeYears: 20, defaultCost: 8000, perUnit: false, hazard: false },
  { key: 'ENVIRONMENTAL', label: 'Environmental concerns', usefulLifeYears: null, defaultCost: 25000, perUnit: false, hazard: true },
  { key: 'ASBESTOS', label: 'Asbestos', usefulLifeYears: null, defaultCost: 20000, perUnit: false, hazard: true },
  { key: 'KNOB_AND_TUBE', label: 'Knob-and-tube wiring', usefulLifeYears: null, defaultCost: 18000, perUnit: false, hazard: true },
  { key: 'GALVANIZED_PLUMBING', label: 'Galvanized plumbing', usefulLifeYears: null, defaultCost: 14000, perUnit: false, hazard: true },
  { key: 'OTHER_DEFERRED', label: 'Other deferred maintenance', usefulLifeYears: null, defaultCost: 0, perUnit: false, hazard: true },
]

export const COMPONENT_SPEC_BY_KEY: Record<BuildingComponentKey, ComponentSpec> = Object.fromEntries(
  COMPONENT_SPECS.map((s) => [s.key, s]),
) as Record<BuildingComponentKey, ComponentSpec>

export interface CapexItem {
  key: BuildingComponentKey
  label: string
  ageYears: number | null
  usefulLifeYears: number | null
  remainingLifeYears: number | null
  estimatedCost: number
  /** The horizon bucket the spend lands in. */
  horizon: 1 | 3 | 5 | 10 | null
  condition: ComponentNote['condition']
  hazard: boolean
  note: string
  included: boolean
  /**
   * Why this item is in the forecast:
   *  - 'CONDITION'  you recorded the condition as fair or poor
   *  - 'AGE'        remaining life derived from the recorded age
   *  - 'UNKNOWN'    neither age nor condition recorded, so a ten-year
   *                 replacement is assumed. This is a placeholder for an
   *                 inspection, not evidence.
   */
  basis: 'CONDITION' | 'AGE' | 'UNKNOWN' | null
  /** true when the cost came from the editable default rather than your entry. */
  usesDefaultCost: boolean
}

export interface CapexForecast {
  items: CapexItem[]
  /** Spend that rests only on an "unknown condition" assumption. */
  assumedUnknownTotal: number
  /** Ten-year spend backed by a recorded age or condition. */
  evidencedTenYear: number
  withinOneYear: number
  withinThreeYears: number
  withinFiveYears: number
  withinTenYears: number
  /** Total identified spend over ten years. */
  totalTenYear: number
  hazardCount: number
  hazardCost: number
  perUnitTenYear: number | null
  /** Ten-year spend as a share of purchase price. */
  capexToPriceRatio: number | null
  /** Annualised reserve implied by the ten-year forecast. */
  impliedAnnualReserve: number
  score: number
  riskLevel: 'LOW' | 'MODERATE' | 'HIGH'
  drivers: string[]
}

function horizonFor(remaining: number | null, condition: ComponentNote['condition'], hazard: boolean): 1 | 3 | 5 | 10 | null {
  if (hazard) {
    if (condition === 'POOR') return 1
    if (condition === 'FAIR') return 3
    if (condition === 'UNKNOWN') return 5
    return null
  }
  if (condition === 'POOR') return 1
  if (remaining === null) return condition === 'UNKNOWN' ? 10 : null
  if (remaining <= 1) return 1
  if (remaining <= 3) return 3
  if (remaining <= 5) return 5
  if (remaining <= 10) return 10
  return null
}

export function buildCapexForecast(
  components: ComponentNote[],
  opts: { unitCount: number; purchasePrice: number; yearBuilt: number | null; condition: PropertyCondition },
): CapexForecast {
  const items: CapexItem[] = components.map((c) => {
    const spec = COMPONENT_SPEC_BY_KEY[c.key]
    const usefulLifeYears = spec?.usefulLifeYears ?? null
    const remaining =
      c.remainingLifeYears !== null && Number.isFinite(c.remainingLifeYears)
        ? c.remainingLifeYears
        : usefulLifeYears !== null && c.ageYears !== null
          ? usefulLifeYears - c.ageYears
          : null

    const defaultCost = spec ? (spec.perUnit ? spec.defaultCost * Math.max(1, opts.unitCount) : spec.defaultCost) : 0
    const estimatedCost = c.estimatedCost > 0 ? c.estimatedCost : defaultCost
    const horizon = c.includeInForecast ? horizonFor(remaining, c.condition, spec?.hazard ?? false) : null

    const basis: CapexItem['basis'] =
      horizon === null
        ? null
        : c.condition === 'POOR' || c.condition === 'FAIR'
          ? 'CONDITION'
          : remaining !== null
            ? 'AGE'
            : 'UNKNOWN'

    return {
      key: c.key,
      label: spec?.label ?? c.key,
      ageYears: c.ageYears,
      usefulLifeYears,
      remainingLifeYears: remaining,
      estimatedCost,
      horizon,
      condition: c.condition,
      hazard: spec?.hazard ?? false,
      note: c.note,
      included: c.includeInForecast && horizon !== null && estimatedCost > 0,
      basis,
      usesDefaultCost: c.estimatedCost <= 0 && defaultCost > 0,
    }
  })

  const inBucket = (maxHorizon: number) =>
    sum(items.filter((i) => i.included && i.horizon !== null && i.horizon <= maxHorizon).map((i) => i.estimatedCost))

  const withinOneYear = inBucket(1)
  const withinThreeYears = inBucket(3)
  const withinFiveYears = inBucket(5)
  const withinTenYears = inBucket(10)
  const totalTenYear = withinTenYears

  const assumedUnknownTotal = sum(
    items.filter((i) => i.included && i.basis === 'UNKNOWN').map((i) => i.estimatedCost),
  )
  const evidencedTenYear = withinTenYears - assumedUnknownTotal

  const hazards = items.filter((i) => i.hazard && i.included)
  const age = opts.yearBuilt ? new Date().getFullYear() - opts.yearBuilt : null

  // Score 0–100, higher = more capital risk.
  let score = 0
  const drivers: string[] = []

  const ratio = opts.purchasePrice > 0 ? totalTenYear / opts.purchasePrice : 0
  if (ratio > 0) {
    const ratioScore = Math.min(45, ratio * 300)
    score += ratioScore
    if (ratio >= 0.05) drivers.push(`Ten-year identified capital is ${(ratio * 100).toFixed(1)}% of price`)
  }

  if (withinOneYear > 0) {
    score += Math.min(20, (withinOneYear / Math.max(1, opts.purchasePrice)) * 400)
    drivers.push(`C$${Math.round(withinOneYear).toLocaleString('en-CA')} of work is due within 12 months`)
  }

  if (age !== null) {
    if (age >= 80) { score += 18; drivers.push(`Building is ${age} years old`) }
    else if (age >= 60) { score += 13; drivers.push(`Building is ${age} years old`) }
    else if (age >= 40) { score += 8 }
    else if (age >= 25) { score += 4 }
  } else {
    score += 6
    drivers.push('Year built unknown')
  }

  if (hazards.length > 0) {
    score += Math.min(22, hazards.length * 8)
    drivers.push(`${hazards.length} hazard item(s) flagged: ${hazards.map((h) => h.label).join(', ')}`)
  }

  const poor = items.filter((i) => i.condition === 'POOR')
  if (poor.length) {
    score += Math.min(12, poor.length * 4)
    drivers.push(`${poor.length} component(s) in poor condition`)
  }

  if (opts.condition === 'MAJOR_CAPITAL_REQUIRED') { score += 15; drivers.push('Property flagged as needing major capital work') }
  else if (opts.condition === 'RENOVATION_REQUIRED') { score += 9; drivers.push('Property flagged as needing renovation') }
  else if (opts.condition === 'NEW' || opts.condition === 'EXCELLENT') score -= 8

  const unknowns = items.filter((i) => i.included && i.basis === 'UNKNOWN')
  if (unknowns.length >= 3) {
    score += 6
    drivers.push(
      `${unknowns.length} component(s) have neither an age nor a condition recorded — C$${Math.round(assumedUnknownTotal).toLocaleString('en-CA')} of this forecast is a placeholder for an inspection, not evidence`,
    )
  }

  score = Math.max(0, Math.min(100, score))
  const riskLevel = score < 30 ? 'LOW' : score < 60 ? 'MODERATE' : 'HIGH'

  return {
    items,
    assumedUnknownTotal,
    evidencedTenYear,
    withinOneYear,
    withinThreeYears,
    withinFiveYears,
    withinTenYears,
    totalTenYear,
    hazardCount: hazards.length,
    hazardCost: sum(hazards.map((h) => h.estimatedCost)),
    perUnitTenYear: opts.unitCount > 0 ? safeDiv(totalTenYear, opts.unitCount) : null,
    capexToPriceRatio: opts.purchasePrice > 0 ? safeDiv(totalTenYear, opts.purchasePrice) : null,
    impliedAnnualReserve: totalTenYear / 10,
    score,
    riskLevel,
    drivers,
  }
}
