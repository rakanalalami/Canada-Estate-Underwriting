/**
 * §6 Acquisition costs, Ontario / Ottawa.
 *
 * Deliberate distinction used throughout the engine:
 *   capitalInProperty  = price + closing costs + renovation + other capital
 *   totalCashRequired  = capitalInProperty + the initial liquidity reserve
 *
 * The reserve is cash set aside FOR the property, not capital sunk INTO it, so
 * it is excluded from the "cash remaining invested" formula in §40.7 and from
 * cash-on-cash denominators. Both figures are always reported.
 */

import type { Deal, PurchaseCosts } from './types'
import { ontarioLandTransferTax, type LttResult } from './ltt'
import { sum } from './money'
import { trace, type TraceStep } from './trace'

export interface ClosingCostLine {
  key: string
  label: string
  amount: number
  computed: boolean
}

export interface AcquisitionCosts {
  price: number
  ltt: LttResult
  landTransferTax: number
  closingLines: ClosingCostLine[]
  totalClosingCosts: number
  renovationBudget: number
  initialReserveFund: number
  /** Cash sunk into the asset — the basis for trapped-capital maths. */
  capitalInProperty: number
  /** Everything the investor must have liquid on closing day. */
  totalCashRequired: number
  steps: TraceStep[]
}

export function computeAcquisitionCosts(
  price: number,
  costs: PurchaseCosts,
  opts: { unitCount: number; propertyType: Deal['info']['propertyType']; city: string; nonResident?: boolean },
): AcquisitionCosts {
  const ltt = ontarioLandTransferTax({
    price,
    unitCount: opts.unitCount,
    propertyType: opts.propertyType,
    city: opts.city,
    nonResidentPurchaser: opts.nonResident,
  })

  const landTransferTax =
    costs.landTransferTaxOverride !== null && Number.isFinite(costs.landTransferTaxOverride)
      ? costs.landTransferTaxOverride
      : ltt.total

  const closingLines: ClosingCostLine[] = [
    { key: 'LTT', label: 'Ontario land transfer tax', amount: landTransferTax, computed: costs.landTransferTaxOverride === null },
    { key: 'MLTT', label: 'Municipal land transfer tax (Ottawa: none)', amount: costs.municipalLandTransferTax || 0, computed: false },
    { key: 'LEGAL', label: 'Legal fees', amount: costs.legalFees || 0, computed: false },
    { key: 'INSPECTION', label: 'Inspection', amount: costs.inspection || 0, computed: false },
    { key: 'BUILDING_INSPECTION', label: 'Building inspection', amount: costs.buildingInspection || 0, computed: false },
    { key: 'ENGINEERING', label: 'Engineering inspection', amount: costs.engineeringInspection || 0, computed: false },
    { key: 'ENVIRONMENTAL', label: 'Environmental report', amount: costs.environmentalReport || 0, computed: false },
    { key: 'APPRAISAL', label: 'Appraisal', amount: costs.appraisal || 0, computed: false },
    { key: 'TITLE', label: 'Title insurance', amount: costs.titleInsurance || 0, computed: false },
    { key: 'LENDER', label: 'Lender fees', amount: costs.lenderFees || 0, computed: false },
    { key: 'BROKER', label: 'Mortgage broker fees', amount: costs.mortgageBrokerFees || 0, computed: false },
    { key: 'HST', label: 'HST (if applicable)', amount: costs.hstApplicable ? costs.hst || 0 : 0, computed: false },
    { key: 'OTHER', label: 'Other acquisition costs', amount: costs.otherAcquisitionCosts || 0, computed: false },
  ]

  const totalClosingCosts = sum(closingLines.map((l) => l.amount))
  const renovationBudget = costs.immediateRenovationBudget || 0
  const initialReserveFund = costs.initialReserveFund || 0
  const capitalInProperty = price + totalClosingCosts + renovationBudget
  const totalCashRequired = capitalInProperty + initialReserveFund

  const t = trace()
  t.input('Purchase price', price)
  t.add('Total closing costs', totalClosingCosts, `${closingLines.filter((l) => l.amount > 0).length} line items`)
  t.add('Renovation / stabilization budget', renovationBudget)
  t.subtotal('Capital in property', capitalInProperty, 'Price + closing + renovation')
  t.add('Initial reserve fund', initialReserveFund, 'Held as liquidity, not sunk into the asset')
  t.total('TOTAL CASH REQUIRED TO ACQUIRE', totalCashRequired)

  return {
    price,
    ltt,
    landTransferTax,
    closingLines,
    totalClosingCosts,
    renovationBudget,
    initialReserveFund,
    capitalInProperty,
    totalCashRequired,
    steps: t.build(),
  }
}
