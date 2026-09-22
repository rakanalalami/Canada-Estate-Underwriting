/**
 * §13 Offer price analysis.
 *
 * Every offer level is fully re-underwritten rather than scaled: land transfer
 * tax is a progressive bracket, the mortgage moves with the price, and any
 * price-based expense follows. Scaling the headline numbers would quietly
 * misstate the cash required.
 */

export interface OfferMetrics {
  price: number
  noi: number
  capRate: number | null
  totalCashRequired: number
  cashRemainingInvested: number
  monthlyCashFlow: number
  annualCashFlow: number
  dscr: number | null
  cashOnCash: number | null
  mortgageAmount: number
  monthlyPayment: number
  landTransferTax: number
  totalClosingCosts: number
}

export type PriceEvaluator = (price: number) => OfferMetrics

export interface OfferRow extends OfferMetrics {
  label: string
  discountFromAsking: number
  isAsking: boolean
  isCustom: boolean
}

export function buildOfferLadder(
  evaluate: PriceEvaluator,
  askingPrice: number,
  discounts: number[],
  customPrice?: number | null,
): OfferRow[] {
  const rows: OfferRow[] = discounts.map((d) => {
    const price = askingPrice * (1 - d)
    return {
      ...evaluate(price),
      label: d === 0 ? 'Asking price' : `−${(d * 100).toFixed(1)}%`,
      discountFromAsking: d,
      isAsking: d === 0,
      isCustom: false,
    }
  })

  if (customPrice && customPrice > 0) {
    rows.push({
      ...evaluate(customPrice),
      label: 'Your offer',
      discountFromAsking: askingPrice > 0 ? 1 - customPrice / askingPrice : 0,
      isAsking: false,
      isCustom: true,
    })
  }

  return rows.sort((a, b) => b.price - a.price)
}

/* ------------------------- Target price solvers --------------------- */

type SolveStatus = 'SOLVED' | 'NEVER_MET' | 'ALWAYS_MET'

interface SolveResult {
  price: number | null
  status: SolveStatus
  searchCeiling: number
}

/**
 * Bisection on price. Cap rate, DSCR and cash flow all fall monotonically as
 * price rises, so a bracketed search is stable and needs no derivative.
 *
 * Three outcomes are distinguished rather than collapsed into "not reachable":
 * a target can be unreachable at any price (NEVER_MET), reachable only below a
 * solved price (SOLVED), or already met across the whole searched range
 * (ALWAYS_MET) — which means the constraint simply is not binding.
 */
function solvePrice(
  evaluate: PriceEvaluator,
  metric: (m: OfferMetrics) => number | null,
  target: number,
  hiSeed: number,
): SolveResult {
  let lo = 1_000
  let hi = Math.max(hiSeed * 3, 100_000)
  const searchCeiling = hi

  const at = (p: number): number | null => metric(evaluate(p))

  const fLo = at(lo)
  const fHi = at(hi)
  if (fLo === null || fHi === null) return { price: null, status: 'NEVER_MET', searchCeiling }
  if (fLo < target) return { price: null, status: 'NEVER_MET', searchCeiling }
  if (fHi > target) return { price: null, status: 'ALWAYS_MET', searchCeiling }

  for (let i = 0; i < 90; i++) {
    const mid = (lo + hi) / 2
    const f = at(mid)
    if (f === null) return { price: null, status: 'NEVER_MET', searchCeiling }
    if (f > target) lo = mid
    else hi = mid
    if (hi - lo < 1) break
  }
  return { price: (lo + hi) / 2, status: 'SOLVED', searchCeiling }
}

export interface TargetPriceRow {
  key: string
  label: string
  target: number
  targetKind: 'CAP_RATE' | 'MONTHLY_CASH_FLOW' | 'DSCR'
  price: number | null
  metrics: OfferMetrics | null
  discountFromAsking: number | null
  achievable: boolean
  /** The target is met across the whole searched price range. */
  notBinding: boolean
  note: string
}

function toRow(
  key: string,
  label: string,
  target: number,
  targetKind: TargetPriceRow['targetKind'],
  solved: SolveResult,
  evaluate: PriceEvaluator,
  askingPrice: number,
  unreachableNote: string,
): TargetPriceRow {
  const price = solved.price
  return {
    key,
    label,
    target,
    targetKind,
    price,
    metrics: price ? evaluate(price) : null,
    discountFromAsking: price && askingPrice > 0 ? 1 - price / askingPrice : null,
    achievable: solved.status !== 'NEVER_MET',
    notBinding: solved.status === 'ALWAYS_MET',
    note:
      solved.status === 'NEVER_MET'
        ? unreachableNote
        : solved.status === 'ALWAYS_MET'
          ? `Met at every price tested up to C$${Math.round(solved.searchCeiling).toLocaleString('en-CA')} — this target is not the binding constraint on price.`
          : '',
  }
}

export function buildTargetPrices(
  evaluate: PriceEvaluator,
  askingPrice: number,
  capTargets: number[],
  cashFlowTargets: number[],
  dscrTargets: number[] = [],
): TargetPriceRow[] {
  const rows: TargetPriceRow[] = []

  for (const cap of capTargets) {
    rows.push(
      toRow(
        `cap-${cap}`,
        `${(cap * 100).toFixed(2)}% cap rate`,
        cap,
        'CAP_RATE',
        solvePrice(evaluate, (m) => m.capRate, cap, askingPrice),
        evaluate,
        askingPrice,
        'Not reachable at any sensible price with this NOI.',
      ),
    )
  }

  for (const cf of cashFlowTargets) {
    rows.push(
      toRow(
        `cf-${cf}`,
        `C$${cf.toLocaleString('en-CA')}/month cash flow`,
        cf,
        'MONTHLY_CASH_FLOW',
        solvePrice(evaluate, (m) => m.monthlyCashFlow, cf, askingPrice),
        evaluate,
        askingPrice,
        'Not reachable — the income cannot support this cash flow at any price.',
      ),
    )
  }

  for (const d of dscrTargets) {
    rows.push(
      toRow(
        `dscr-${d}`,
        `${d.toFixed(2)}x DSCR`,
        d,
        'DSCR',
        solvePrice(evaluate, (m) => m.dscr, d, askingPrice),
        evaluate,
        askingPrice,
        'Not reachable — NOI cannot cover this coverage ratio at any price.',
      ),
    )
  }

  return rows
}
