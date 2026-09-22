/**
 * §23 Investment scorecard.
 *
 * Deliberately NOT a single blended score. Twelve independent dimensions are
 * reported, each with its own reasoning, alongside a hard PASS / INVESTIGATE /
 * FAIL check of the investor's own stated requirements. Nothing in this module
 * ever concludes that a property "is a good investment".
 */

import type { InvestorProfile, MarketRatings } from './types'
import type { Tone } from './metrics'

export type ScoreKey =
  | 'INCOME_STRENGTH'
  | 'CAP_RATE'
  | 'CASH_FLOW'
  | 'DSCR'
  | 'RENTAL_DEMAND'
  | 'PROPERTY_CONDITION'
  | 'CAPEX_RISK'
  | 'RENT_UPSIDE'
  | 'LOCATION_QUALITY'
  | 'APPRECIATION_POTENTIAL'
  | 'REFINANCE_POTENTIAL'
  | 'LEGAL_ZONING_RISK'

export interface ScoreDimension {
  key: ScoreKey
  label: string
  /** 0–100, higher is better in every dimension (risk scores are inverted). */
  score: number
  grade: 'STRONG' | 'ADEQUATE' | 'WEAK' | 'POOR'
  tone: Tone
  headline: string
  detail: string
  /** True when the dimension rests on an investor judgement, not on maths. */
  subjective: boolean
}

export type RequirementResult = 'PASS' | 'INVESTIGATE' | 'FAIL'

export interface RequirementCheck {
  key: string
  label: string
  requirement: string
  actual: string
  result: RequirementResult
  note: string
}

export interface ScorecardResult {
  dimensions: ScoreDimension[]
  requirements: RequirementCheck[]
  passCount: number
  investigateCount: number
  failCount: number
  /** Factual count only — explicitly not a verdict. */
  summary: string
}

function grade(score: number): { grade: ScoreDimension['grade']; tone: Tone } {
  if (score >= 75) return { grade: 'STRONG', tone: 'pos' }
  if (score >= 55) return { grade: 'ADEQUATE', tone: 'info' }
  if (score >= 35) return { grade: 'WEAK', tone: 'warn' }
  return { grade: 'POOR', tone: 'neg' }
}

function dim(
  key: ScoreKey,
  label: string,
  score: number,
  headline: string,
  detail: string,
  subjective = false,
): ScoreDimension {
  const s = Math.max(0, Math.min(100, score))
  const g = grade(s)
  return { key, label, score: s, grade: g.grade, tone: g.tone, headline, detail, subjective }
}

/** Map a 1–5 investor rating to a 0–100 score. */
function fromRating(r: number): number {
  return Math.max(0, Math.min(100, ((r - 1) / 4) * 100))
}

export interface ScorecardInput {
  capRate: number | null
  stabilizedCapRate: number | null
  monthlyCashFlow: number
  dscr: number | null
  expenseRatio: number | null
  rentUpsideMonthly: number
  currentMonthlyRent: number
  capexRiskScore: number
  capexTenYear: number
  purchasePrice: number
  legalRiskScore: number
  conditionScore: number
  ratings: MarketRatings
  refinance: {
    netCashReleased: number
    capitalInProperty: number
    dscr: number | null
    monthlyCashFlow: number
  }
  profile: InvestorProfile
  belowMarketUnitCount: number
  unitCount: number
  nonConformingUnits: number
  allUnitsLegal: boolean
}

export function buildScorecard(input: ScorecardInput): ScorecardResult {
  const dims: ScoreDimension[] = []

  /* Income strength — expense ratio and rent per unit consistency. */
  {
    const er = input.expenseRatio
    const score = er === null ? 50 : Math.max(0, Math.min(100, (1 - (er - 0.25) / 0.45) * 100))
    dims.push(
      dim(
        'INCOME_STRENGTH',
        'Income strength',
        score,
        er === null ? 'No expense ratio available' : `${(er * 100).toFixed(1)}% operating expense ratio`,
        'Operating expenses as a share of effective gross income. Small Ottawa multifamily typically runs 30–45%; below 25% usually means an expense line is missing.',
      ),
    )
  }

  /* Cap rate against the investor's own floor. */
  {
    const c = input.capRate
    const target = input.profile.minCapRate
    const score = c === null ? 0 : Math.max(0, Math.min(100, 50 + ((c - target) / 0.02) * 25))
    dims.push(
      dim(
        'CAP_RATE',
        'Cap rate',
        score,
        c === null ? 'No cap rate' : `${(c * 100).toFixed(2)}% current · ${input.stabilizedCapRate !== null ? (input.stabilizedCapRate * 100).toFixed(2) + '% stabilized' : 'no stabilized figure'}`,
        `Scored against your ${(target * 100).toFixed(2)}% minimum. A cap rate well above target is flagged for investigation, not rewarded.`,
      ),
    )
  }

  /* Cash flow against the investor's monthly target. */
  {
    const cf = input.monthlyCashFlow
    const target = Math.max(1, input.profile.targetMonthlyCashFlow / Math.max(1, input.profile.maxProperties))
    const score = Math.max(0, Math.min(100, (cf / target) * 70))
    dims.push(
      dim(
        'CASH_FLOW',
        'Cash flow',
        score,
        `C$${Math.round(cf).toLocaleString('en-CA')}/month`,
        `Compared with C$${Math.round(target).toLocaleString('en-CA')}/month, the per-property share of your C$${Math.round(input.profile.targetMonthlyCashFlow).toLocaleString('en-CA')} portfolio target across ${input.profile.maxProperties} properties.`,
      ),
    )
  }

  /* DSCR. */
  {
    const d = input.dscr
    const score = d === null ? 70 : Math.max(0, Math.min(100, 50 + ((d - input.profile.minDscr) / 0.2) * 25))
    dims.push(
      dim(
        'DSCR',
        'Debt service coverage',
        score,
        d === null ? 'Unlevered — no debt service' : `${d.toFixed(2)}x`,
        d === null
          ? 'An all-cash purchase has no debt service. The DSCR that matters is the post-refinance figure.'
          : `Scored against your ${input.profile.minDscr.toFixed(2)}x minimum.`,
      ),
    )
  }

  /* Tenant / rental demand — investor judgement. */
  dims.push(
    dim(
      'RENTAL_DEMAND',
      'Tenant / rental demand',
      fromRating(input.ratings.rentalDemand),
      `${input.ratings.rentalDemand}/5`,
      'Your assessment of demand depth for this unit mix in this pocket. Support it with the rent comparables you entered.',
      true,
    ),
  )

  /* Property condition. */
  dims.push(
    dim(
      'PROPERTY_CONDITION',
      'Property condition',
      input.conditionScore,
      '',
      'Derived from the recorded condition, year built and the state of each building component.',
    ),
  )

  /* CapEx risk — inverted. */
  {
    const score = 100 - input.capexRiskScore
    const ratio = input.purchasePrice > 0 ? input.capexTenYear / input.purchasePrice : 0
    dims.push(
      dim(
        'CAPEX_RISK',
        'Capital expenditure risk',
        score,
        `C$${Math.round(input.capexTenYear).toLocaleString('en-CA')} identified over 10 years (${(ratio * 100).toFixed(1)}% of price)`,
        'A high cap rate on a building that needs significant capital is not the same asset as the same cap rate on a renovated one.',
      ),
    )
  }

  /* Rent upside — real, but never assumed to arrive immediately. */
  {
    const upsidePct = input.currentMonthlyRent > 0 ? input.rentUpsideMonthly / input.currentMonthlyRent : 0
    const score = Math.max(0, Math.min(100, upsidePct * 400))
    dims.push(
      dim(
        'RENT_UPSIDE',
        'Rent upside',
        score,
        `C$${Math.round(input.rentUpsideMonthly).toLocaleString('en-CA')}/month (${(upsidePct * 100).toFixed(1)}%)`,
        input.belowMarketUnitCount > 0
          ? `${input.belowMarketUnitCount} occupied unit(s) sit below market. Ontario rent control means this gap closes on turnover or by the annual guideline — not on closing.`
          : 'No material gap between current and market rents.',
      ),
    )
  }

  dims.push(
    dim(
      'LOCATION_QUALITY',
      'Location quality',
      fromRating(input.ratings.locationQuality),
      `${input.ratings.locationQuality}/5`,
      'Your rating of the location for a long-term rental hold. Prestige is not the objective — rent-to-price, demand and trajectory are.',
      true,
    ),
  )

  dims.push(
    dim(
      'APPRECIATION_POTENTIAL',
      'Appreciation potential',
      fromRating(input.ratings.appreciationPotential),
      `${input.ratings.appreciationPotential}/5`,
      'Recorded separately and never blended into the operating return. A deal whose case depends on this rating is a speculation, not an income investment.',
      true,
    ),
  )

  /* Refinance potential. */
  {
    const recycled =
      input.refinance.capitalInProperty > 0
        ? input.refinance.netCashReleased / input.refinance.capitalInProperty
        : 0
    const dscrOk = (input.refinance.dscr ?? 0) >= input.profile.minDscr
    const cfOk = input.refinance.monthlyCashFlow > 0
    let score = Math.max(0, Math.min(100, recycled * 140))
    if (!dscrOk) score -= 30
    if (!cfOk) score -= 30
    dims.push(
      dim(
        'REFINANCE_POTENTIAL',
        'Refinance potential',
        score,
        `${(recycled * 100).toFixed(1)}% of capital recyclable · ${input.refinance.dscr !== null ? input.refinance.dscr.toFixed(2) + 'x DSCR' : 'no DSCR'}`,
        'Capital released at the selected LTV, after refinance costs, with the post-refinance coverage and cash flow it leaves behind.',
      ),
    )
  }

  /* Legal / zoning risk — inverted. */
  dims.push(
    dim(
      'LEGAL_ZONING_RISK',
      'Legal / zoning risk',
      100 - input.legalRiskScore,
      input.allUnitsLegal ? 'All units recorded as legal' : `${input.nonConformingUnits} non-conforming unit(s)`,
      'Non-conforming income is excluded from the conservative case unless you explicitly override it.',
    ),
  )

  /* ------------------------- Requirements ------------------------- */

  const p = input.profile
  const reqs: RequirementCheck[] = []

  const capForCheck = input.capRate
  reqs.push({
    key: 'CAP_RATE',
    label: 'Cap rate target',
    requirement: `${(p.minCapRate * 100).toFixed(2)}%+`,
    actual: capForCheck === null ? '—' : `${(capForCheck * 100).toFixed(2)}%`,
    result:
      capForCheck === null
        ? 'INVESTIGATE'
        : capForCheck >= p.minCapRate
          ? 'PASS'
          : capForCheck >= p.minCapRate - 0.005
            ? 'INVESTIGATE'
            : 'FAIL',
    note: capForCheck !== null && capForCheck >= 0.07 ? 'Above 7% — confirm why the yield is this high before treating it as a pass.' : '',
  })

  const refiDscr = input.refinance.dscr ?? input.dscr
  reqs.push({
    key: 'DSCR',
    label: 'DSCR minimum',
    requirement: `${p.minDscr.toFixed(2)}x+`,
    actual: refiDscr === null ? 'Unlevered' : `${refiDscr.toFixed(2)}x`,
    result:
      refiDscr === null
        ? 'INVESTIGATE'
        : refiDscr >= p.minDscr
          ? 'PASS'
          : refiDscr >= p.minDscr - 0.1
            ? 'INVESTIGATE'
            : 'FAIL',
    note: refiDscr === null ? 'No debt today — this is measured against the post-refinance mortgage.' : '',
  })

  const cfTarget = p.targetMonthlyCashFlow / Math.max(1, p.maxProperties)
  const refiCf = input.refinance.monthlyCashFlow
  reqs.push({
    key: 'CASH_FLOW',
    label: 'Monthly cash flow (post-refinance)',
    requirement: `C$${Math.round(cfTarget).toLocaleString('en-CA')}+`,
    actual: `C$${Math.round(refiCf).toLocaleString('en-CA')}`,
    result: refiCf >= cfTarget ? 'PASS' : refiCf >= cfTarget * 0.8 ? 'INVESTIGATE' : 'FAIL',
    note: `Per-property share of your C$${Math.round(p.targetMonthlyCashFlow).toLocaleString('en-CA')}/month portfolio target.`,
  })

  reqs.push({
    key: 'LEGAL_UNITS',
    label: 'Legal units',
    requirement: 'All income-producing units legal',
    actual: input.allUnitsLegal ? 'All legal' : `${input.nonConformingUnits} non-conforming`,
    result: input.allUnitsLegal ? 'PASS' : input.nonConformingUnits > 0 ? 'FAIL' : 'INVESTIGATE',
    note: input.allUnitsLegal ? '' : 'Verify with the City of Ottawa before relying on this income.',
  })

  const recycled =
    input.refinance.capitalInProperty > 0
      ? input.refinance.netCashReleased / input.refinance.capitalInProperty
      : 0
  reqs.push({
    key: 'REFINANCE',
    label: 'Refinance potential',
    requirement: 'Releases capital while holding DSCR and positive cash flow',
    actual: `${(recycled * 100).toFixed(1)}% recycled · C$${Math.round(refiCf).toLocaleString('en-CA')}/mo`,
    result:
      recycled >= 0.4 && (input.refinance.dscr ?? 0) >= p.minDscr && refiCf > 0
        ? 'PASS'
        : recycled >= 0.25 && refiCf > 0
          ? 'INVESTIGATE'
          : 'FAIL',
    note: '',
  })

  const passCount = reqs.filter((r) => r.result === 'PASS').length
  const investigateCount = reqs.filter((r) => r.result === 'INVESTIGATE').length
  const failCount = reqs.filter((r) => r.result === 'FAIL').length

  return {
    dimensions: dims,
    requirements: reqs,
    passCount,
    investigateCount,
    failCount,
    summary: `${passCount} of ${reqs.length} investor requirements met · ${investigateCount} to investigate · ${failCount} failing. These are checks against your own stated criteria, not a verdict on the property.`,
  }
}

/** Condition score from the recorded condition and building age. */
export function conditionScore(
  condition: string,
  yearBuilt: number | null,
  yearRenovated: number | null,
): number {
  const base: Record<string, number> = {
    NEW: 95,
    EXCELLENT: 88,
    GOOD: 72,
    AVERAGE: 55,
    RENOVATION_REQUIRED: 32,
    MAJOR_CAPITAL_REQUIRED: 12,
  }
  let score = base[condition] ?? 50
  const year = new Date().getFullYear()
  const effectiveYear = yearRenovated && yearRenovated > (yearBuilt ?? 0) ? yearRenovated : yearBuilt
  if (effectiveYear) {
    const age = year - effectiveYear
    if (age > 80) score -= 14
    else if (age > 60) score -= 10
    else if (age > 40) score -= 6
    else if (age > 25) score -= 3
    else if (age < 10) score += 5
  } else {
    score -= 5
  }
  return Math.max(0, Math.min(100, score))
}
