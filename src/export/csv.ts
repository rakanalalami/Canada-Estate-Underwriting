/** §32 CSV export. Plain, unformatted values so the file re-imports cleanly. */

import type { Deal } from '@/engine/types'
import type { UnderwriteResult } from '@/engine/underwrite'

function esc(v: unknown): string {
  if (v === null || v === undefined) return ''
  const s = String(v)
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

function rows(data: (string | number | null)[][]): string {
  return data.map((r) => r.map(esc).join(',')).join('\n')
}

export function buildDealCsv(deal: Deal, r: UnderwriteResult): string {
  const s = r.scenarios.STABILIZED
  const c = r.scenarios.CONSERVATIVE
  const o = r.scenarios.OPTIMISTIC
  const isCashRefi = deal.financing.structure === 'CASH_THEN_REFINANCE'

  const out: (string | number | null)[][] = []
  const section = (title: string) => {
    out.push([])
    out.push([title])
  }

  out.push(['Ottawa small multifamily underwriting — all figures in CAD'])
  out.push(['Generated', new Date().toISOString().slice(0, 19).replace('T', ' ')])
  out.push(['Deal', deal.name])
  out.push(['Address', deal.info.address, deal.info.city, deal.info.province, deal.info.postalCode])
  out.push(['Neighbourhood', deal.info.neighbourhood])
  out.push(['MLS', deal.info.mlsNumber])
  out.push(['Status', deal.status])

  section('PROPERTY')
  out.push(['Property type', deal.info.propertyType])
  out.push(['Year built', deal.info.yearBuilt])
  out.push(['Year renovated', deal.info.yearRenovated])
  out.push(['Units (rent roll)', deal.units.length])
  out.push(['Legal units', deal.info.legalUnits])
  out.push(['Non-conforming units', r.legal.nonConformingUnits])
  out.push(['Building size (sq ft)', deal.info.buildingSizeSqFt])
  out.push(['Lot size (sq ft)', deal.info.lotSizeSqFt])
  out.push(['Zoning', deal.info.zoning])
  out.push(['Condition', deal.info.condition])
  out.push(['Separate hydro meters', deal.info.separateHydroMeters ? 'Yes' : 'No'])
  out.push(['Separate gas meters', deal.info.separateGasMeters ? 'Yes' : 'No'])
  out.push(['Separate water meters', deal.info.separateWaterMeters ? 'Yes' : 'No'])

  section('PRICING')
  out.push(['Asking price', r.askingPrice])
  out.push(['Offer price', r.price])
  out.push(['Price per unit', deal.units.length ? r.price / deal.units.length : null])
  out.push(['Price per sq ft', deal.info.buildingSizeSqFt ? r.price / deal.info.buildingSizeSqFt : null])

  section('RENT ROLL')
  out.push([
    'Unit', 'Legal', 'Beds', 'Baths', 'Sq ft', 'Occupied', 'Current rent', 'Market rent',
    'Gap', 'Parking', 'Storage', 'Laundry', 'Other', 'Lease start', 'Lease end', 'Month to month',
    'Tenant pays hydro', 'Tenant pays heat', 'Tenant pays water', 'Last increase', 'Next legal increase', 'Notes',
  ])
  for (const u of deal.units) {
    out.push([
      u.unitNumber, u.legalUnit ? 'Yes' : 'No', u.bedrooms, u.bathrooms, u.sqFt,
      u.occupied ? 'Occupied' : 'Vacant', u.currentRent, u.marketRent,
      Math.max(0, u.marketRent - (u.occupied ? u.currentRent : 0)),
      u.parkingIncome, u.storageIncome, u.laundryIncome, u.otherIncome,
      u.leaseStart, u.leaseEnd, u.monthToMonth ? 'Yes' : 'No',
      u.tenantPaysHydro ? 'Yes' : 'No', u.tenantPaysHeat ? 'Yes' : 'No', u.tenantPaysWater ? 'Yes' : 'No',
      u.lastRentIncrease, u.nextLegalIncreaseDate, u.notes,
    ])
  }
  out.push(['TOTAL', '', r.rentRoll.totalBedrooms, '', r.rentRoll.totalSqFt, `${r.rentRoll.occupiedCount}/${r.rentRoll.unitCount}`,
    r.rentRoll.currentMonthlyResidentialRent, r.rentRoll.marketMonthlyResidentialRent, r.rentRoll.monthlyRentUpside])

  section('INCOME SUMMARY (annual)')
  out.push(['Metric', 'Conservative / current', 'Stabilized / base', 'Optimistic'])
  out.push(['Gross scheduled income', c.noi.totalPotentialGrossIncome, s.noi.totalPotentialGrossIncome, o.noi.totalPotentialGrossIncome])
  out.push(['Vacancy rate', c.noi.vacancyPercent, s.noi.vacancyPercent, o.noi.vacancyPercent])
  out.push(['Vacancy loss', c.noi.vacancyLoss, s.noi.vacancyLoss, o.noi.vacancyLoss])
  out.push(['Bad debt loss', c.noi.badDebtLoss, s.noi.badDebtLoss, o.noi.badDebtLoss])
  out.push(['Effective gross income', c.noi.effectiveGrossIncome, s.noi.effectiveGrossIncome, o.noi.effectiveGrossIncome])
  out.push(['Operating expenses', c.noi.operatingExpenses, s.noi.operatingExpenses, o.noi.operatingExpenses])
  out.push(['NET OPERATING INCOME', c.noi.noi, s.noi.noi, o.noi.noi])
  out.push(['NOI per unit', c.noi.noiPerUnit, s.noi.noiPerUnit, o.noi.noiPerUnit])
  out.push(['NOI per sq ft', c.noi.noiPerSqFt, s.noi.noiPerSqFt, o.noi.noiPerSqFt])
  out.push(['Cap rate on asking', c.capRateOnAsking, s.capRateOnAsking, o.capRateOnAsking])
  out.push(['Cap rate on offer', c.capRateOnOffer, s.capRateOnOffer, o.capRateOnOffer])

  section('OPERATING EXPENSES (stabilized, annual)')
  out.push(['Line', 'Basis', 'Annual', 'Monthly', 'Per unit', 'Share of EGI', 'Source'])
  for (const l of s.noi.expenses.lines.filter((x) => x.annual > 0)) {
    out.push([
      l.label,
      l.mode === 'PERCENT' ? `${((l.percent ?? 0) * 100).toFixed(2)}% of ${l.basis}` : 'Fixed amount',
      l.annual, l.monthly,
      deal.units.length ? l.annual / deal.units.length : null,
      s.noi.effectiveGrossIncome > 0 ? l.annual / s.noi.effectiveGrossIncome : null,
      l.isActual ? 'Verified actual' : 'Model assumption',
    ])
  }
  out.push(['TOTAL', '', s.noi.operatingExpenses, s.noi.operatingExpenses / 12, s.noi.expenses.perUnitAnnual, s.noi.expenseRatio, ''])

  section('ACQUISITION COSTS')
  for (const l of r.acquisition.closingLines) out.push([l.label, l.amount])
  out.push(['Total closing costs', r.acquisition.totalClosingCosts])
  out.push(['Renovation budget', r.acquisition.renovationBudget])
  out.push(['Capital in property', r.acquisition.capitalInProperty])
  out.push(['Initial reserve fund', r.acquisition.initialReserveFund])
  out.push(['TOTAL CASH REQUIRED', r.acquisition.totalCashRequired])

  section('FINANCING')
  out.push(['Structure', deal.financing.structure])
  out.push(['Compounding convention', deal.financing.compounding === 'SEMI_ANNUAL' ? 'Semi-annual (Canadian)' : 'Monthly'])
  if (!isCashRefi) {
    out.push(['Down payment', s.debt.downPayment])
    out.push(['Mortgage amount', s.debt.mortgageAmount])
    out.push(['Interest rate', deal.financing.annualRate])
    out.push(['Amortization (years)', deal.financing.amortizationYears])
    out.push(['Payment', s.debt.periodicPayment])
    out.push(['Monthly equivalent', s.debt.monthlyPayment])
    out.push(['Annual debt service', s.debt.annualDebtService])
    out.push(['Interest year 1', s.debt.interestYear1])
    out.push(['Principal year 1', s.debt.principalYear1])
    for (const b of s.debt.balances) out.push([`Balance after ${b.years} year(s)`, b.balance])
  }

  section('REFINANCE')
  out.push(['Months until refinance', deal.refinance.monthsUntilRefinance])
  out.push(['Valuation method', deal.refinance.valuationMethod])
  out.push(['Appraised value', r.refinance.appraisedValue])
  out.push(['Refinance LTV', r.refinance.ltv])
  out.push(['Mortgage amount', r.refinance.mortgageAmount])
  out.push(['Gross proceeds', r.refinance.grossProceeds])
  out.push(['Refinance costs', r.refinance.refinanceCosts])
  out.push(['Existing debt discharged', r.refinance.existingDebtPayoff])
  out.push(['NET CASH RELEASED', r.refinance.netCashReleased])
  out.push(['Cash remaining invested', r.refinance.cashRemainingInvested])
  out.push(['Capital recycled', r.refinance.percentCapitalRecycled])
  out.push(['Equity remaining', r.refinance.equityRemaining])
  out.push(['Post-refinance LTV', r.refinance.postRefinanceLtv])
  out.push(['Monthly payment', r.refinance.monthlyPayment])
  out.push(['Annual debt service', r.refinance.annualDebtService])
  out.push(['Monthly cash flow', r.refinance.monthlyCashFlow])
  out.push(['DSCR', r.refinance.dscr])
  out.push(['Cash-on-cash', r.refinance.cashOnCash])

  section('REFINANCE LTV LADDER')
  out.push(['LTV', 'Mortgage', 'Cash released', 'Monthly payment', 'Monthly cash flow', 'DSCR', 'Cash-on-cash', 'Cash trapped', 'Equity remaining'])
  for (const row of r.ltvLadder.rows) {
    out.push([row.ltv, row.mortgageAmount, row.netCashReleased, row.monthlyPayment, row.monthlyCashFlow, row.dscr, row.cashOnCash, row.cashRemainingInvested, row.equityRemaining])
  }

  section('OFFER ANALYSIS')
  out.push(['Offer', 'Price', 'Land transfer tax', 'Cash required', 'Cap rate', 'Monthly cash flow', 'DSCR', 'Cash-on-cash'])
  for (const row of r.offers) {
    out.push([row.label, row.price, row.landTransferTax, row.totalCashRequired, row.capRate, row.monthlyCashFlow, row.dscr, row.cashOnCash])
  }

  section('PRICE REQUIRED TO ACHIEVE')
  out.push(['Target', 'Required price', 'Discount from asking', 'Note'])
  for (const t of r.targetPrices) out.push([t.label, t.price, t.discountFromAsking, t.note])

  section('MAXIMUM PRICE BY TARGET CAP RATE')
  out.push(['Target cap rate', 'Maximum price'])
  for (const p of s.breakEven.maxPrices) out.push([p.capRate, p.maxPrice])

  section('MAXIMUM LOAN BY DSCR')
  out.push(['DSCR target', 'Max annual debt service', 'Max monthly payment', 'Max loan'])
  for (const l of s.breakEven.maxLoans) out.push([l.dscr, l.maxAnnualDebtService, l.maxMonthlyPayment, l.maxLoan])

  section('PROJECTION (10 year)')
  out.push(['Year', 'Gross income', 'Vacancy', 'Expenses', 'NOI', 'Debt service', 'Cash flow', 'DSCR', 'Principal repaid', 'Mortgage balance', 'Property value', 'Equity', 'Capital event'])
  for (const y of r.projectionTenYear.years) {
    out.push([y.year, y.grossIncome, y.vacancyLoss, y.operatingExpenses, y.noi, y.debtService, y.cashFlow, y.dscr, y.principalRepaid, y.mortgageBalance, y.propertyValue, y.equity, y.capitalEvent])
  }

  section('SALE SCENARIO (appreciation basis)')
  out.push(['Future value', r.projectionTenYear.saleAtAppreciation.futureValue])
  out.push(['Selling costs', r.projectionTenYear.saleAtAppreciation.sellingCosts])
  out.push(['Mortgage repayment', r.projectionTenYear.saleAtAppreciation.mortgageRepayment])
  out.push(['Net sale proceeds', r.projectionTenYear.saleAtAppreciation.netSaleProceeds])
  out.push(['Total profit', r.projectionTenYear.saleAtAppreciation.totalProfit])
  out.push(['IRR', r.projectionTenYear.saleAtAppreciation.irr])
  out.push(['Equity multiple', r.projectionTenYear.saleAtAppreciation.equityMultiple])

  for (const m of r.sensitivity) {
    section(`SENSITIVITY — ${m.title} (monthly cash flow)`)
    out.push([`${m.rowLabel} \\ ${m.colLabel}`, ...m.colValues.map(String)])
    m.cells.forEach((row, i) => {
      out.push([String(m.rowValues[i]), ...row.map((cell) => cell.monthlyCashFlow)])
    })
  }

  section('CAPITAL EXPENDITURE FORECAST')
  out.push(['Component', 'Age', 'Typical life', 'Remaining life', 'Condition', 'Estimated cost', 'Due within (years)', 'Note'])
  for (const i of r.capex.items.filter((x) => x.included || x.estimatedCost > 0)) {
    out.push([i.label, i.ageYears, i.usefulLifeYears, i.remainingLifeYears, i.condition, i.estimatedCost, i.horizon, i.note])
  }
  out.push(['Within 1 year', r.capex.withinOneYear])
  out.push(['Within 3 years', r.capex.withinThreeYears])
  out.push(['Within 5 years', r.capex.withinFiveYears])
  out.push(['Within 10 years', r.capex.totalTenYear])
  out.push(['Risk level', r.capex.riskLevel])

  section('SCORECARD')
  out.push(['Dimension', 'Score (0-100)', 'Grade', 'Headline'])
  for (const d of r.scorecard.dimensions) out.push([d.label, Math.round(d.score), d.grade, d.headline])

  section('INVESTOR REQUIREMENTS')
  out.push(['Requirement', 'Target', 'Actual', 'Result'])
  for (const q of r.scorecard.requirements) out.push([q.label, q.requirement, q.actual, q.result])

  section('RED FLAGS')
  out.push(['Severity', 'Rule', 'Message', 'Detail'])
  for (const h of r.dealBreakers.hits) out.push([h.severity, h.label, h.message, h.detail])

  section('RENT COMPARABLES')
  out.push(['Address', 'Distance (km)', 'Neighbourhood', 'Beds', 'Baths', 'Sq ft', 'Monthly rent', 'Parking included', 'Utilities included', 'Furnished', 'Condition', 'Listed', 'Source', 'Included'])
  for (const c2 of deal.rentComps) {
    out.push([c2.address, c2.distanceKm, c2.neighbourhood, c2.bedrooms, c2.bathrooms, c2.sqFt, c2.monthlyRent, c2.parkingIncluded ? 'Yes' : 'No', c2.utilitiesIncluded.join(' / '), c2.furnished ? 'Yes' : 'No', c2.condition, c2.listingDate, c2.sourceUrl, c2.include ? 'Yes' : 'No'])
  }

  section('SALES COMPARABLES')
  out.push(['Address', 'Price', 'Units', 'Building sq ft', 'Lot sq ft', 'Year built', 'Gross rent', 'NOI', 'Price per unit', 'Price per sq ft', 'Cap rate', 'Sale date', 'Distance', 'Source'])
  for (const row of r.saleComps.rows) {
    out.push([row.address, row.price, row.units, row.buildingSqFt, row.lotSqFt, row.yearBuilt, row.grossAnnualRent, row.noi, row.pricePerUnit, row.pricePerSqFt, row.capRate, row.saleDate, row.distanceKm, row.source])
  }

  section('SOURCES / AUDIT TRAIL')
  out.push(['Figure', 'Field', 'Type', 'Source', 'URL', 'Retrieved', 'Entry', 'Note'])
  for (const src of deal.sources) {
    out.push([src.label, src.field, src.origin, src.source, src.url, src.retrievedAt, src.manual ? 'Manual' : 'Automated', src.note])
  }

  section('NOTES')
  out.push([deal.notes])

  return rows(out)
}

export function download(filename: string, content: string, mime = 'text/csv;charset=utf-8'): void {
  const blob = new Blob([content], { type: mime })
  downloadBlob(filename, blob)
}

export function downloadBlob(filename: string, blob: Blob): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export function safeFilename(name: string): string {
  return (name || 'deal').replace(/[^a-z0-9\-_ ]/gi, '').replace(/\s+/g, '-').slice(0, 60)
}
