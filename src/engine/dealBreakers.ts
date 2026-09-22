/**
 * §28 Deal breakers — user-configurable red flags, evaluated against the
 * underwriting result and shown prominently rather than buried in a tab.
 */

import type { ComponentNote, Deal, DealBreakerRule } from './types'
import type { CapexForecast } from './capex'
import type { LegalRiskResult } from './legal'

export interface DealBreakerHit {
  key: string
  label: string
  severity: 'RED' | 'AMBER'
  message: string
  detail: string
}

export interface DealBreakerEvaluation {
  hits: DealBreakerHit[]
  redCount: number
  amberCount: number
}

export interface DealBreakerContext {
  deal: Deal
  capRate: number | null
  stabilizedCapRate: number | null
  dscr: number | null
  monthlyCashFlow: number
  effectiveGrossIncome: number
  propertyTaxAnnual: number
  insuranceAnnual: number
  landlordPaidUtilitiesAnnual: number
  renovationBudget: number
  purchasePrice: number
  capex: CapexForecast
  legal: LegalRiskResult
  belowMarketGapPercent: number | null
  rentsVerified: boolean
  components: ComponentNote[]
}

export const DEFAULT_DEAL_BREAKERS: DealBreakerRule[] = [
  { key: 'CAP_RATE_MIN', label: 'Cap rate below threshold', enabled: true, severity: 'RED', threshold: 0.06 },
  { key: 'DSCR_MIN', label: 'DSCR below threshold', enabled: true, severity: 'RED', threshold: 1.2 },
  { key: 'NEGATIVE_CASH_FLOW', label: 'Negative monthly cash flow', enabled: true, severity: 'RED', threshold: 0 },
  { key: 'ILLEGAL_UNITS', label: 'Non-conforming / illegal units', enabled: true, severity: 'RED', threshold: 0 },
  { key: 'OLD_ELECTRICAL', label: 'Very old electrical (knob-and-tube or poor)', enabled: true, severity: 'RED', threshold: 0 },
  { key: 'FOUNDATION', label: 'Major foundation issue', enabled: true, severity: 'RED', threshold: 0 },
  { key: 'ROOF_IMMINENT', label: 'Roof replacement imminent', enabled: true, severity: 'AMBER', threshold: 2 },
  { key: 'UNVERIFIED_RENTS', label: 'Tenant rents not verified', enabled: true, severity: 'AMBER', threshold: 0 },
  { key: 'LEGACY_LOW_RENTS', label: 'Extremely low legacy rents', enabled: true, severity: 'AMBER', threshold: 0.25 },
  { key: 'LANDLORD_UTILITIES', label: 'Large landlord-paid utilities', enabled: true, severity: 'AMBER', threshold: 0.12 },
  { key: 'HIGH_PROPERTY_TAX', label: 'Property taxes unusually high', enabled: true, severity: 'AMBER', threshold: 0.14 },
  { key: 'INSURANCE_UNAVAILABLE', label: 'Insurance unavailable or not quoted', enabled: true, severity: 'AMBER', threshold: 0 },
  { key: 'EXCESSIVE_RENOVATION', label: 'Excessive renovation requirement', enabled: true, severity: 'AMBER', threshold: 0.15 },
]

export function evaluateDealBreakers(ctx: DealBreakerContext): DealBreakerEvaluation {
  const hits: DealBreakerHit[] = []
  const rules = ctx.deal.dealBreakers.length ? ctx.deal.dealBreakers : DEFAULT_DEAL_BREAKERS
  const byKey = new Map(rules.map((r) => [r.key, r]))

  const push = (key: string, message: string, detail: string) => {
    const rule = byKey.get(key)
    if (!rule || !rule.enabled) return
    hits.push({ key, label: rule.label, severity: rule.severity, message, detail })
  }

  const capRule = byKey.get('CAP_RATE_MIN')
  if (capRule?.enabled && ctx.capRate !== null && ctx.capRate < capRule.threshold) {
    push(
      'CAP_RATE_MIN',
      `Current cap rate is ${(ctx.capRate * 100).toFixed(2)}%, below your ${(capRule.threshold * 100).toFixed(2)}% floor.`,
      ctx.stabilizedCapRate !== null
        ? `Stabilized cap rate is ${(ctx.stabilizedCapRate * 100).toFixed(2)}% — but stabilization is not guaranteed and takes time.`
        : '',
    )
  }

  const dscrRule = byKey.get('DSCR_MIN')
  if (dscrRule?.enabled && ctx.dscr !== null && ctx.dscr < dscrRule.threshold) {
    push(
      'DSCR_MIN',
      `DSCR is ${ctx.dscr.toFixed(2)}x, below your ${dscrRule.threshold.toFixed(2)}x floor.`,
      'A lender is unlikely to advance the modelled amount at this coverage.',
    )
  }

  if (ctx.monthlyCashFlow < 0) {
    push(
      'NEGATIVE_CASH_FLOW',
      `Monthly cash flow is C$${Math.round(ctx.monthlyCashFlow).toLocaleString('en-CA')}.`,
      'The property does not pay for itself at the modelled rents and debt.',
    )
  }

  if (ctx.legal.nonConformingUnits > 0 || ctx.legal.excessUnits > 0) {
    push(
      'ILLEGAL_UNITS',
      `${Math.max(ctx.legal.nonConformingUnits, ctx.legal.excessUnits)} unit(s) are non-conforming or unverified.`,
      `C$${Math.round(ctx.legal.nonConformingMonthlyIncome).toLocaleString('en-CA')}/month of income depends on them.`,
    )
  }

  const electrical = ctx.components.find((c) => c.key === 'ELECTRICAL')
  const knob = ctx.components.find((c) => c.key === 'KNOB_AND_TUBE')
  if (
    (knob && knob.includeInForecast && (knob.condition === 'POOR' || knob.condition === 'FAIR')) ||
    (electrical && electrical.condition === 'POOR')
  ) {
    push(
      'OLD_ELECTRICAL',
      'Old or non-compliant electrical recorded.',
      'Knob-and-tube wiring routinely makes landlord insurance unobtainable or prohibitively expensive in Ontario.',
    )
  }

  const foundation = ctx.components.find((c) => c.key === 'FOUNDATION')
  if (foundation && foundation.condition === 'POOR') {
    push(
      'FOUNDATION',
      'Foundation recorded as poor.',
      `Estimated remediation C$${Math.round(foundation.estimatedCost || 0).toLocaleString('en-CA')}.`,
    )
  }

  const roofRule = byKey.get('ROOF_IMMINENT')
  const roof = ctx.capex.items.find((i) => i.key === 'ROOF')
  if (
    roofRule?.enabled &&
    roof &&
    roof.remainingLifeYears !== null &&
    roof.remainingLifeYears <= roofRule.threshold
  ) {
    push(
      'ROOF_IMMINENT',
      `Roof has about ${roof.remainingLifeYears} year(s) of life left.`,
      `Budget roughly C$${Math.round(roof.estimatedCost).toLocaleString('en-CA')}.`,
    )
  }

  if (!ctx.rentsVerified) {
    push(
      'UNVERIFIED_RENTS',
      'Tenant rents have no recorded source.',
      'Attach leases, a rent roll or an estoppel in the Sources tab before firming up.',
    )
  }

  const legacyRule = byKey.get('LEGACY_LOW_RENTS')
  if (
    legacyRule?.enabled &&
    ctx.belowMarketGapPercent !== null &&
    ctx.belowMarketGapPercent >= legacyRule.threshold
  ) {
    push(
      'LEGACY_LOW_RENTS',
      `Occupied rents sit ${(ctx.belowMarketGapPercent * 100).toFixed(0)}% below market.`,
      'Ontario rent control caps increases for sitting tenants. This gap closes on turnover, not on closing — do not underwrite it as immediate income.',
    )
  }

  const utilRule = byKey.get('LANDLORD_UTILITIES')
  if (utilRule?.enabled && ctx.effectiveGrossIncome > 0) {
    const share = ctx.landlordPaidUtilitiesAnnual / ctx.effectiveGrossIncome
    if (share >= utilRule.threshold) {
      push(
        'LANDLORD_UTILITIES',
        `Landlord-paid utilities are ${(share * 100).toFixed(1)}% of effective gross income.`,
        'Without separate meters, heating-cost inflation lands entirely on the owner.',
      )
    }
  }

  const taxRule = byKey.get('HIGH_PROPERTY_TAX')
  if (taxRule?.enabled && ctx.effectiveGrossIncome > 0) {
    const share = ctx.propertyTaxAnnual / ctx.effectiveGrossIncome
    if (share >= taxRule.threshold) {
      push(
        'HIGH_PROPERTY_TAX',
        `Property tax is ${(share * 100).toFixed(1)}% of effective gross income.`,
        'Check the multi-residential tax class and whether the assessment will be reviewed after the sale.',
      )
    }
  }

  if (ctx.insuranceAnnual <= 0) {
    push(
      'INSURANCE_UNAVAILABLE',
      'No insurance figure entered.',
      'Get a bindable quote before waiving conditions — older Ottawa multifamily with legacy wiring is regularly declined.',
    )
  }

  const renoRule = byKey.get('EXCESSIVE_RENOVATION')
  if (renoRule?.enabled && ctx.purchasePrice > 0) {
    const share = (ctx.renovationBudget + ctx.capex.withinOneYear) / ctx.purchasePrice
    if (share >= renoRule.threshold) {
      push(
        'EXCESSIVE_RENOVATION',
        `Near-term capital is ${(share * 100).toFixed(1)}% of the purchase price.`,
        'This capital competes directly with the cash you need for the next acquisition.',
      )
    }
  }

  return {
    hits,
    redCount: hits.filter((h) => h.severity === 'RED').length,
    amberCount: hits.filter((h) => h.severity === 'AMBER').length,
  }
}
