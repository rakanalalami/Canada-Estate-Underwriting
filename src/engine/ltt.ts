/**
 * Ontario Land Transfer Tax.
 *
 * Marginal brackets on the value of the consideration:
 *   0.5%  on the first        C$55,000
 *   1.0%  on  C$55,000    – C$250,000
 *   1.5%  on  C$250,000   – C$400,000
 *   2.0%  on  C$400,000   – C$2,000,000
 *   2.5%  on amounts above C$2,000,000 — but ONLY where the land contains one
 *         or two single family residences. A triplex, fourplex or larger
 *         multi-residential building stays at 2.0% on the top band.
 *
 * Ottawa levies NO municipal land transfer tax. Toronto's MLTT must never be
 * applied here; the municipal figure is kept in the model at zero so other
 * cities can be added later without changing the maths.
 */

import type { PropertyType } from './types'
import { trace, type TraceStep } from './trace'

export interface LttBracket {
  from: number
  to: number | null
  rate: number
}

export const ONTARIO_LTT_BRACKETS: LttBracket[] = [
  { from: 0, to: 55_000, rate: 0.005 },
  { from: 55_000, to: 250_000, rate: 0.01 },
  { from: 250_000, to: 400_000, rate: 0.015 },
  { from: 400_000, to: 2_000_000, rate: 0.02 },
  { from: 2_000_000, to: null, rate: 0.025 },
]

/** Top band collapses to 2.0% for 3+ unit multi-residential. */
function bracketsFor(unitCount: number, propertyType: PropertyType): LttBracket[] {
  const oneOrTwoSFR =
    unitCount <= 2 &&
    (propertyType === 'DUPLEX' || propertyType === 'HOUSE_WITH_SDU' || propertyType === 'OTHER')
  if (oneOrTwoSFR) return ONTARIO_LTT_BRACKETS
  return ONTARIO_LTT_BRACKETS.map((b) => (b.to === null ? { ...b, rate: 0.02 } : b))
}

export interface LttResult {
  provincial: number
  municipal: number
  nrst: number
  total: number
  steps: TraceStep[]
  topRateCappedAtTwoPercent: boolean
}

export interface LttOptions {
  price: number
  unitCount: number
  propertyType: PropertyType
  city: string
  /** Ontario Non-Resident Speculation Tax — 25% province-wide, opt-in. */
  nonResidentPurchaser?: boolean
  nrstRate?: number
}

export function ontarioLandTransferTax(opts: LttOptions): LttResult {
  const { price, unitCount, propertyType, city } = opts
  const brackets = bracketsFor(unitCount, propertyType)
  const capped = brackets[brackets.length - 1].rate === 0.02

  const t = trace()
  let provincial = 0
  for (const b of brackets) {
    const upper = b.to === null ? price : Math.min(price, b.to)
    const taxable = Math.max(0, upper - b.from)
    if (taxable <= 0) continue
    const tax = taxable * b.rate
    provincial += tax
    t.add(
      `${(b.rate * 100).toFixed(1)}% band`,
      tax,
      `C$${Math.round(taxable).toLocaleString('en-CA')} x ${(b.rate * 100).toFixed(1)}%`,
    )
  }

  // Ottawa (and every Ontario municipality except Toronto) has no municipal LTT.
  const isToronto = /toronto/i.test(city)
  const municipal = 0
  if (!isToronto) {
    t.note('Municipal land transfer tax', `${city || 'Ottawa'} does not levy a municipal LTT — C$0`)
  } else {
    t.note('Municipal land transfer tax', 'Toronto MLTT is not modelled by this Ottawa-first build')
  }

  const nrstRate = opts.nrstRate ?? 0.25
  const nrst = opts.nonResidentPurchaser ? price * nrstRate : 0
  if (nrst > 0) {
    t.add('Non-Resident Speculation Tax', nrst, `C$${Math.round(price).toLocaleString('en-CA')} x ${(nrstRate * 100).toFixed(0)}%`)
  }

  const total = provincial + municipal + nrst
  t.total('Total land transfer tax', total)

  return { provincial, municipal, nrst, total, steps: t.build(), topRateCappedAtTwoPercent: capped }
}
