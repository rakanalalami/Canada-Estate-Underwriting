/**
 * §8 Cash purchase + refinance, §27 refinance conservatism, §40.7–40.9, §40.14.
 *
 * Guardrails enforced here:
 *  - The appraised value is an explicit LOW / BASE / HIGH input. Nothing in the
 *    engine assumes that leasing a property raises its appraisal, and the BASE
 *    case defaults to the purchase price, never above it.
 *  - Income capitalisation (NOI / cap rate) is only used when the investor
 *    explicitly selects it. For 2–4 unit residential the default is comparable
 *    residential sales, which is what lenders actually use.
 *  - Gross proceeds are never reported as released cash: existing debt and all
 *    refinance costs are deducted first (§40.25).
 */

import type { AppraisalCase, MortgageTerms, RefinancePlan } from './types'
import { amortize, computePayment, yearSplit } from './finance'
import { capitalRecycleRatio, cashOnCash, dscr, ltv } from './metrics'
import { safeDiv } from './money'
import { trace, type TraceStep } from './trace'

export interface RefinanceInput {
  plan: RefinancePlan
  /**
   * The purchase price. Used as the fallback appraised value when no appraisal
   * has been entered, so a deal that has never had its Refinance page opened
   * cannot produce a mortgage against a value it was never given (§27: the
   * appraisal is never assumed to exceed what was paid).
   */
  purchasePrice?: number
  /** Cash sunk into the asset: price + closing + renovation (no reserve). */
  capitalInProperty: number
  /** Stabilized annual NOI used for post-refinance coverage. */
  stabilizedNoi: number
  /** Override the appraised value (used by stress matrices). */
  appraisedValueOverride?: number
  /** Override the LTV (used by the LTV ladder). */
  ltvOverride?: number
  /** Override the rate (used by interest-rate stress). */
  rateOverride?: number
}

export interface RefinanceResult {
  appraisedValue: number
  appraisalCase: AppraisalCase | 'CUSTOM'
  valuationNote: string
  ltv: number
  mortgageAmount: number
  grossProceeds: number
  existingDebtPayoff: number
  refinanceCosts: number
  netCashReleased: number
  capitalInProperty: number
  cashRemainingInvested: number
  equityRemaining: number
  postRefinanceLtv: number | null
  terms: MortgageTerms
  monthlyPayment: number
  periodicPayment: number
  annualDebtService: number
  principalYear1: number
  interestYear1: number
  stabilizedNoi: number
  annualCashFlow: number
  monthlyCashFlow: number
  dscr: number | null
  cashOnCash: number | null
  capitalRecycleRatio: number | null
  percentCapitalRecycled: number | null
  steps: TraceStep[]
}

/**
 * Value used for the refinance. Comparable-sales and manual methods use the
 * appraisal inputs directly; income capitalisation is opt-in only.
 */
export function refinanceValue(
  plan: RefinancePlan,
  stabilizedNoi: number,
  which: AppraisalCase,
  purchasePrice = 0,
): {
  value: number
  note: string
} {
  if (plan.valuationMethod === 'INCOME_CAP_RATE') {
    if (plan.valuationCapRate > 0 && stabilizedNoi > 0) {
      const base = stabilizedNoi / plan.valuationCapRate
      // LOW/HIGH keep the same relative spread the investor entered.
      const spreadLow = plan.appraisalBase > 0 ? plan.appraisalLow / plan.appraisalBase : 0.95
      const spreadHigh = plan.appraisalBase > 0 ? plan.appraisalHigh / plan.appraisalBase : 1.08
      const value = which === 'LOW' ? base * spreadLow : which === 'HIGH' ? base * spreadHigh : base
      return {
        value,
        note: `Income capitalisation: NOI ÷ ${(plan.valuationCapRate * 100).toFixed(2)}% cap rate (explicitly selected).`,
      }
    }
    return { value: plan.appraisalBase, note: 'Income capitalisation selected but no cap rate / NOI available — fell back to the entered appraisal.' }
  }

  const entered = which === 'LOW' ? plan.appraisalLow : which === 'HIGH' ? plan.appraisalHigh : plan.appraisalBase

  if (entered <= 0) {
    // No appraisal recorded. Fall back to the purchase price — never above it.
    const fallback = which === 'LOW' ? purchasePrice * 0.95 : purchasePrice
    return {
      value: Math.max(0, fallback),
      note:
        purchasePrice > 0
          ? 'No appraisal entered, so the purchase price is used. Record low, base and high appraisals on the Refinance page — the value a lender actually assigns is the single biggest unknown in this strategy.'
          : 'No appraisal and no purchase price entered yet.',
    }
  }

  const note =
    plan.valuationMethod === 'COMPARABLE_SALES'
      ? 'Comparable residential sales. For 2–4 unit properties lenders weight comparable sales heavily; a higher NOI does not automatically raise the appraisal.'
      : 'Manually entered appraised value.'
  return { value: entered, note }
}

export function computeRefinance(input: RefinanceInput): RefinanceResult {
  const { plan, capitalInProperty, stabilizedNoi } = input

  const resolved =
    input.appraisedValueOverride !== undefined
      ? { value: input.appraisedValueOverride, note: 'Custom appraised value (stress scenario).' }
      : refinanceValue(plan, stabilizedNoi, plan.appraisalCase, input.purchasePrice ?? 0)

  const appraisedValue = Math.max(0, resolved.value)
  const targetLtv = input.ltvOverride ?? plan.ltv
  const mortgageAmount = appraisedValue * targetLtv
  const rate = input.rateOverride ?? plan.annualRate

  const terms: MortgageTerms = {
    principal: mortgageAmount,
    annualRate: rate,
    amortizationYears: plan.amortizationYears,
    termYears: plan.termYears,
    paymentFrequency: plan.paymentFrequency,
    compounding: plan.compounding,
    fees: plan.refinanceFees,
  }

  const breakdown = computePayment(terms)
  const amortization = amortize(terms)
  const y1 = yearSplit(amortization, 1)

  const refinanceCosts =
    (plan.refinanceFees || 0) + (plan.legalFees || 0) + (plan.appraisalFee || 0) + (plan.otherLenderCosts || 0)
  const existingDebtPayoff = plan.existingDebtPayoff || 0

  const grossProceeds = mortgageAmount
  const netCashReleased = Math.max(0, grossProceeds - existingDebtPayoff - refinanceCosts)

  const cashRemainingInvested = capitalInProperty - netCashReleased
  const equityRemaining = appraisedValue - mortgageAmount

  const annualDebtService = mortgageAmount > 0 ? breakdown.annualDebtService : 0
  const annualCashFlow = stabilizedNoi - annualDebtService

  const t = trace()
  t.input('Appraised value', appraisedValue, resolved.note)
  t.input('Refinance LTV', targetLtv, `${(targetLtv * 100).toFixed(1)}%`, 'percent')
  t.subtotal('Gross refinance proceeds (new mortgage)', grossProceeds, `${Math.round(appraisedValue).toLocaleString('en-CA')} x ${(targetLtv * 100).toFixed(1)}%`)
  t.deduct('Existing debt discharged', existingDebtPayoff)
  t.deduct('Refinance costs (fees + legal + appraisal + lender)', refinanceCosts)
  t.total('NET CASH RELEASED', netCashReleased)
  t.note('Capital in property', `${Math.round(capitalInProperty).toLocaleString('en-CA')} = price + closing + renovation`)
  t.subtotal('Cash remaining invested', cashRemainingInvested, 'Capital in property − net cash released')
  t.subtotal('Equity remaining', equityRemaining, 'Appraised value − new mortgage')

  return {
    appraisedValue,
    appraisalCase: input.appraisedValueOverride !== undefined ? 'CUSTOM' : plan.appraisalCase,
    valuationNote: resolved.note,
    ltv: targetLtv,
    mortgageAmount,
    grossProceeds,
    existingDebtPayoff,
    refinanceCosts,
    netCashReleased,
    capitalInProperty,
    cashRemainingInvested,
    equityRemaining,
    postRefinanceLtv: ltv(mortgageAmount, appraisedValue),
    terms,
    monthlyPayment: breakdown.monthlyEquivalent,
    periodicPayment: breakdown.periodicPayment,
    annualDebtService,
    principalYear1: y1.principal,
    interestYear1: y1.interest,
    stabilizedNoi,
    annualCashFlow,
    monthlyCashFlow: annualCashFlow / 12,
    dscr: dscr(stabilizedNoi, annualDebtService),
    cashOnCash: cashOnCash(annualCashFlow, cashRemainingInvested),
    capitalRecycleRatio: capitalRecycleRatio(netCashReleased, capitalInProperty),
    percentCapitalRecycled: safeDiv(netCashReleased, capitalInProperty),
    steps: t.build(),
  }
}

/* ------------------------- §40.9 LTV ladder ------------------------- */

export interface LtvLadderRow extends RefinanceResult {
  /** Change in monthly cash flow versus the previous (lower) LTV rung. */
  cashFlowDeltaFromPrevious: number | null
  cashReleasedDeltaFromPrevious: number | null
  isSelected: boolean
}

export interface LtvLadder {
  rows: LtvLadderRow[]
  bestCashFlowLtv: number | null
  bestCapitalRecycledLtv: number | null
  bestDscrLtv: number | null
  /** Highest LTV that still clears the investor's DSCR floor. */
  bestBalancedLtv: number | null
  minDscr: number
}

export function computeLtvLadder(
  input: RefinanceInput,
  ltvs: number[],
  minDscr: number,
): LtvLadder {
  const rows: LtvLadderRow[] = []
  let prev: RefinanceResult | null = null

  for (const l of ltvs) {
    const r = computeRefinance({ ...input, ltvOverride: l })
    rows.push({
      ...r,
      cashFlowDeltaFromPrevious: prev ? r.monthlyCashFlow - prev.monthlyCashFlow : null,
      cashReleasedDeltaFromPrevious: prev ? r.netCashReleased - prev.netCashReleased : null,
      isSelected: Math.abs(l - (input.plan.ltv ?? 0)) < 1e-9,
    })
    prev = r
  }

  const viable = rows.filter((r) => (r.dscr ?? 0) >= minDscr)
  const byCashFlow = [...rows].sort((a, b) => b.monthlyCashFlow - a.monthlyCashFlow)[0]
  const byRecycled = [...rows].sort((a, b) => b.netCashReleased - a.netCashReleased)[0]
  const byDscr = [...rows].sort((a, b) => (b.dscr ?? 0) - (a.dscr ?? 0))[0]
  // "Balanced" = most capital released that still clears the DSCR floor.
  const balanced = [...viable].sort((a, b) => b.netCashReleased - a.netCashReleased)[0]

  return {
    rows,
    bestCashFlowLtv: byCashFlow?.ltv ?? null,
    bestCapitalRecycledLtv: byRecycled?.ltv ?? null,
    bestDscrLtv: byDscr?.ltv ?? null,
    bestBalancedLtv: balanced?.ltv ?? null,
    minDscr,
  }
}

/* --------------------- §40.14 Appraisal risk ------------------------ */

export interface AppraisalMatrixCell {
  appraisalCase: AppraisalCase
  appraisedValue: number
  ltv: number
  mortgageAmount: number
  netCashReleased: number
  cashRemainingInvested: number
  monthlyCashFlow: number
  dscr: number | null
}

export function computeAppraisalMatrix(
  input: RefinanceInput,
  ltvs: number[],
): AppraisalMatrixCell[] {
  const cases: AppraisalCase[] = ['LOW', 'BASE', 'HIGH']
  const out: AppraisalMatrixCell[] = []
  for (const c of cases) {
    const { value } = refinanceValue(input.plan, input.stabilizedNoi, c, input.purchasePrice ?? 0)
    for (const l of ltvs) {
      const r = computeRefinance({ ...input, appraisedValueOverride: value, ltvOverride: l })
      out.push({
        appraisalCase: c,
        appraisedValue: value,
        ltv: l,
        mortgageAmount: r.mortgageAmount,
        netCashReleased: r.netCashReleased,
        cashRemainingInvested: r.cashRemainingInvested,
        monthlyCashFlow: r.monthlyCashFlow,
        dscr: r.dscr,
      })
    }
  }
  return out
}

/* ------------------ §40.13 Refinance delay stress ------------------- */

export interface RefinanceDelayRow {
  months: number
  /** Cash flow forgone while the property is held unlevered but stabilizing. */
  cumulativeUnleveredCashFlow: number
  netCashReleased: number
  /** Month the next acquisition could realistically begin. */
  nextAcquisitionMonth: number
  cashAvailableAtRefinance: number
}

export function refinanceDelayStress(
  base: RefinanceInput,
  monthsOptions: number[],
  unleveredMonthlyCashFlow: number,
  cashOnHandBeforeRefinance: number,
): RefinanceDelayRow[] {
  const r = computeRefinance(base)
  return monthsOptions.map((months) => ({
    months,
    cumulativeUnleveredCashFlow: unleveredMonthlyCashFlow * months,
    netCashReleased: r.netCashReleased,
    nextAcquisitionMonth: months + 1,
    cashAvailableAtRefinance:
      cashOnHandBeforeRefinance + unleveredMonthlyCashFlow * months + r.netCashReleased,
  }))
}
