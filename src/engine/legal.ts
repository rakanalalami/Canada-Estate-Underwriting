/**
 * §21 Legal / unit risk.
 *
 * Non-conforming unit income is excluded from the conservative case by default.
 * A prominent warning fires whenever the units being underwritten exceed the
 * legal unit count, or when compliance items are unverified.
 */

import type { ComplianceState, Deal, LegalProfile, Unit } from './types'
import { sum } from './money'

export interface LegalRiskItem {
  key: string
  label: string
  state: ComplianceState
  severity: 'RED' | 'AMBER' | 'OK' | 'NA'
}

export interface LegalRiskResult {
  legalUnits: number
  actualUnits: number
  nonConformingUnits: number
  excessUnits: number
  /** WARNING — NON-CONFORMING / UNVERIFIED RENTAL UNIT */
  hasNonConformingWarning: boolean
  nonConformingMonthlyIncome: number
  nonConformingAnnualIncome: number
  includeNonConformingInConservative: boolean
  items: LegalRiskItem[]
  unverifiedCount: number
  nonCompliantCount: number
  score: number
  riskLevel: 'LOW' | 'MODERATE' | 'HIGH'
  messages: string[]
}

const LABELS: Record<keyof Omit<LegalProfile, 'includeNonConformingIncomeInConservative' | 'notes'>, string> = {
  zoningConfirmed: 'Zoning confirmation',
  fireCompliance: 'Fire compliance',
  buildingPermits: 'Building permits',
  occupancyPermits: 'Occupancy permits',
  separateEntrances: 'Separate entrances',
  egress: 'Egress',
  electricalCompliance: 'Electrical compliance',
}

function severityFor(state: ComplianceState): LegalRiskItem['severity'] {
  switch (state) {
    case 'CONFIRMED':
      return 'OK'
    case 'UNVERIFIED':
      return 'AMBER'
    case 'NON_COMPLIANT':
      return 'RED'
    case 'NA':
      return 'NA'
  }
}

export function assessLegalRisk(deal: Deal, units: Unit[]): LegalRiskResult {
  const legal = deal.legal
  const actualUnits = units.length
  const declaredLegalUnits = deal.info.legalUnits
  const nonConformingFromRoll = units.filter((u) => !u.legalUnit).length
  const nonConformingUnits = Math.max(nonConformingFromRoll, deal.info.nonConformingUnits || 0)
  const excessUnits = Math.max(0, actualUnits - declaredLegalUnits)

  const nonConformingMonthlyIncome = sum(
    units
      .filter((u) => !u.legalUnit)
      .map(
        (u) =>
          (u.occupied ? u.currentRent : u.marketRent) +
          (u.parkingIncome || 0) +
          (u.storageIncome || 0) +
          (u.laundryIncome || 0) +
          (u.otherIncome || 0),
      ),
  )

  const items: LegalRiskItem[] = (Object.keys(LABELS) as (keyof typeof LABELS)[]).map((k) => ({
    key: k,
    label: LABELS[k],
    state: legal[k],
    severity: severityFor(legal[k]),
  }))

  const unverifiedCount = items.filter((i) => i.severity === 'AMBER').length
  const nonCompliantCount = items.filter((i) => i.severity === 'RED').length

  const messages: string[] = []
  const hasNonConformingWarning = excessUnits > 0 || nonConformingUnits > 0

  if (excessUnits > 0) {
    messages.push(
      `WARNING — NON-CONFORMING / UNVERIFIED RENTAL UNIT: ${actualUnits} units are being underwritten but only ${declaredLegalUnits} are recorded as legal.`,
    )
  } else if (nonConformingUnits > 0) {
    messages.push(
      `WARNING — NON-CONFORMING / UNVERIFIED RENTAL UNIT: ${nonConformingUnits} unit(s) in the rent roll are marked non-legal.`,
    )
  }
  if (nonConformingMonthlyIncome > 0 && !legal.includeNonConformingIncomeInConservative) {
    messages.push(
      `C$${Math.round(nonConformingMonthlyIncome).toLocaleString('en-CA')}/month of non-conforming income is excluded from the conservative case.`,
    )
  }
  if (nonConformingMonthlyIncome > 0 && legal.includeNonConformingIncomeInConservative) {
    messages.push(
      'You have explicitly chosen to include non-conforming unit income in the conservative case. This income can disappear on a municipal order.',
    )
  }
  if (nonCompliantCount > 0) messages.push(`${nonCompliantCount} compliance item(s) recorded as NON-COMPLIANT.`)
  if (unverifiedCount > 0) messages.push(`${unverifiedCount} compliance item(s) still unverified.`)

  let score = 0
  score += excessUnits * 30
  score += nonConformingUnits > 0 && excessUnits === 0 ? 20 : 0
  score += nonCompliantCount * 15
  score += unverifiedCount * 6
  score = Math.max(0, Math.min(100, score))

  return {
    legalUnits: declaredLegalUnits,
    actualUnits,
    nonConformingUnits,
    excessUnits,
    hasNonConformingWarning,
    nonConformingMonthlyIncome,
    nonConformingAnnualIncome: nonConformingMonthlyIncome * 12,
    includeNonConformingInConservative: legal.includeNonConformingIncomeInConservative,
    items,
    unverifiedCount,
    nonCompliantCount,
    score,
    riskLevel: score < 20 ? 'LOW' : score < 50 ? 'MODERATE' : 'HIGH',
    messages,
  }
}
