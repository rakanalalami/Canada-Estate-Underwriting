/**
 * §32 Excel underwriting model.
 *
 * This is a working model, not a screenshot: the Underwriting sheet carries
 * live formulas so changing a rent, a rate or the purchase price recalculates
 * NOI, cap rate, debt service, DSCR and cash flow inside Excel. The Canadian
 * semi-annual compounding convention is written into the payment formula
 * rather than approximated with rate/12.
 */

import type { Deal } from '@/engine/types'
import type { UnderwriteResult } from '@/engine/underwrite'
import { downloadBlob, safeFilename } from './csv'

const MONEY = '"C$"#,##0'
const MONEY2 = '"C$"#,##0.00'
const PCT = '0.00%'
const MULT = '0.00"x"'

export async function exportExcel(deal: Deal, r: UnderwriteResult): Promise<void> {
  const ExcelJS = (await import('exceljs')).default
  const wb = new ExcelJS.Workbook()
  wb.creator = 'Ottawa Underwriting'
  wb.created = new Date()

  const s = r.scenarios.STABILIZED
  const c = r.scenarios.CONSERVATIVE
  const o = r.scenarios.OPTIMISTIC
  const isCashRefi = deal.financing.structure === 'CASH_THEN_REFINANCE'

  /* ------------------------------------------------------------------ *
   * Sheet 1 — Underwriting (live formulas)
   * ------------------------------------------------------------------ */
  const ws = wb.addWorksheet('Underwriting', { views: [{ state: 'frozen', ySplit: 1 }] })
  ws.columns = [
    { width: 42 },
    { width: 18 },
    { width: 18 },
    { width: 18 },
    { width: 56 },
  ]

  let row = 1
  const title = (text: string) => {
    const r0 = ws.getRow(row++)
    r0.getCell(1).value = text
    r0.getCell(1).font = { bold: true, size: 12, color: { argb: 'FF14407C' } }
    r0.height = 20
    row++
  }
  const header = (...cells: string[]) => {
    const r0 = ws.getRow(row++)
    cells.forEach((t, i) => {
      const cell = r0.getCell(i + 1)
      cell.value = t
      cell.font = { bold: true, size: 9 }
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F3F6' } }
      cell.border = { bottom: { style: 'thin', color: { argb: 'FFD7DCE3' } } }
    })
  }
  const line = (
    label: string,
    value: number | string | { formula: string },
    fmt?: string,
    note?: string,
    bold = false,
  ) => {
    const r0 = ws.getRow(row++)
    r0.getCell(1).value = label
    if (bold) r0.getCell(1).font = { bold: true }
    const v = r0.getCell(2)
    v.value = typeof value === 'object' ? { formula: value.formula } : value
    if (fmt) v.numFmt = fmt
    if (bold) v.font = { bold: true }
    if (note) {
      r0.getCell(5).value = note
      r0.getCell(5).font = { size: 8, color: { argb: 'FF7A8798' } }
      r0.getCell(5).alignment = { wrapText: true, vertical: 'top' }
    }
    return row - 1
  }

  ws.getCell('A1').value = `${deal.name} — Ottawa small multifamily underwriting model`
  ws.getCell('A1').font = { bold: true, size: 14 }
  row = 3
  line('Address', `${deal.info.address}, ${deal.info.city}, ${deal.info.province} ${deal.info.postalCode}`)
  line('Neighbourhood', deal.info.neighbourhood)
  line('MLS', deal.info.mlsNumber)
  line('Generated', new Date().toISOString().slice(0, 10))
  line('Currency', 'CAD — every figure in this workbook')
  row++

  title('INPUTS — change these and the model recalculates')
  const rPrice = line('Purchase price', r.price, MONEY, 'Your offer price. Asking price is on the Summary sheet.')
  const rAsking = line('Asking price', r.askingPrice, MONEY)
  const rUnits = line('Units', deal.units.length, '0')
  const rSqFt = line('Building size (sq ft)', deal.info.buildingSizeSqFt, '#,##0')
  const rGrossRent = line('Stabilized gross scheduled income (annual)', s.noi.totalPotentialGrossIncome, MONEY, 'From the Rent roll sheet.')
  line('Current gross scheduled income (annual)', c.noi.totalPotentialGrossIncome, MONEY, 'In-place rents only. Never assume this becomes market rent on closing.')
  const rVacancy = line('Vacancy rate', s.noi.vacancyPercent, PCT)
  const rBadDebt = line('Bad debt rate', s.noi.badDebtPercent, PCT)
  const rOpex = line('Operating expenses (annual)', s.noi.operatingExpenses, MONEY, 'From the Expenses sheet. Includes the CapEx reserve where selected.')
  const rClosing = line('Closing costs', r.acquisition.totalClosingCosts, MONEY, 'Includes Ontario land transfer tax. Ottawa has no municipal LTT.')
  const rReno = line('Renovation budget', r.acquisition.renovationBudget, MONEY)
  const rAppraisal = line('Refinance appraised value', r.refinance.appraisedValue, MONEY, 'Never assumed above the purchase price unless you have evidence.')
  const rLtv = line('Refinance LTV', r.refinance.ltv, PCT)
  const rRate = line('Mortgage rate (nominal annual)', isCashRefi ? deal.refinance.annualRate : deal.financing.annualRate, PCT)
  const rAmort = line('Amortization (years)', isCashRefi ? deal.refinance.amortizationYears : deal.financing.amortizationYears, '0')
  const rRefiCosts = line('Refinance costs', r.refinance.refinanceCosts, MONEY)
  row++

  title('INCOME — NET OPERATING INCOME')
  const rGpi = line('Total potential gross income', { formula: `B${rGrossRent}` }, MONEY)
  const rVacLoss = line('Less vacancy', { formula: `-B${rGpi}*B${rVacancy}` }, MONEY)
  const rBadLoss = line('Less bad debt', { formula: `-B${rGpi}*B${rBadDebt}` }, MONEY)
  const rEgi = line('Effective gross income', { formula: `B${rGpi}+B${rVacLoss}+B${rBadLoss}` }, MONEY, undefined, true)
  const rOpexRef = line('Less operating expenses', { formula: `-B${rOpex}` }, MONEY)
  const rNoi = line('NET OPERATING INCOME', { formula: `B${rEgi}+B${rOpexRef}` }, MONEY, 'Excludes mortgage payments, income taxes and appreciation by definition.', true)
  line('NOI per unit', { formula: `IF(B${rUnits}=0,"",B${rNoi}/B${rUnits})` }, MONEY)
  line('NOI per square foot', { formula: `IF(B${rSqFt}=0,"",B${rNoi}/B${rSqFt})` }, MONEY2)
  line('Operating expense ratio', { formula: `IF(B${rEgi}=0,"",-B${rOpexRef}/B${rEgi})` }, PCT)
  row++

  title('CAP RATE')
  line('Cap rate on offer price', { formula: `IF(B${rPrice}=0,"",B${rNoi}/B${rPrice})` }, PCT, undefined, true)
  line('Cap rate on asking price', { formula: `IF(B${rAsking}=0,"",B${rNoi}/B${rAsking})` }, PCT)
  line('Current (in-place) cap rate', c.capRateOnOffer ?? 0, PCT, 'Computed on in-place rents, not stabilized ones.')
  row++

  title('ACQUISITION')
  const rCapital = line('Capital in property', { formula: `B${rPrice}+B${rClosing}+B${rReno}` }, MONEY, 'Price + closing + renovation. The base for trapped-capital maths.', true)
  line('Initial reserve fund', r.acquisition.initialReserveFund, MONEY, 'Held as liquidity, not sunk into the asset.')
  line('Total cash required to acquire', { formula: `B${rCapital}+${r.acquisition.initialReserveFund}` }, MONEY, undefined, true)
  row++

  title('REFINANCE')
  const rMortgage = line('New mortgage', { formula: `B${rAppraisal}*B${rLtv}` }, MONEY, undefined, true)
  const rNetCash = line('Net cash released', { formula: `MAX(0,B${rMortgage}-B${rRefiCosts}-${r.refinance.existingDebtPayoff})` }, MONEY, 'Gross proceeds less refinance costs and any existing debt — never the gross figure.', true)
  const rTrapped = line('Cash remaining invested', { formula: `B${rCapital}-B${rNetCash}` }, MONEY, undefined, true)
  line('Capital recycled', { formula: `IF(B${rCapital}=0,"",B${rNetCash}/B${rCapital})` }, PCT)
  line('Equity remaining', { formula: `B${rAppraisal}-B${rMortgage}` }, MONEY)
  line('Post-refinance LTV', { formula: `IF(B${rAppraisal}=0,"",B${rMortgage}/B${rAppraisal})` }, PCT)
  row++

  title('DEBT SERVICE — Canadian semi-annual compounding')
  const rPeriodic = line(
    'Effective monthly rate',
    { formula: `(1+B${rRate}/2)^(1/6)-1` },
    '0.0000%',
    'Canadian fixed-rate mortgages compound semi-annually, not in advance. This is NOT rate/12.',
  )
  const rPayment = line(
    'Monthly payment',
    { formula: `IF(OR(B${rMortgage}=0,B${rAmort}=0),0,B${rMortgage}*B${rPeriodic}/(1-(1+B${rPeriodic})^(-B${rAmort}*12)))` },
    MONEY2,
    undefined,
    true,
  )
  const rAds = line('Annual debt service', { formula: `B${rPayment}*12` }, MONEY, undefined, true)
  row++

  title('CASH FLOW AND RETURNS')
  const rAnnualCf = line('Annual pre-tax cash flow', { formula: `B${rNoi}-B${rAds}` }, MONEY, undefined, true)
  line('Monthly cash flow', { formula: `B${rAnnualCf}/12` }, MONEY, undefined, true)
  line('DSCR', { formula: `IF(B${rAds}=0,"",B${rNoi}/B${rAds})` }, MULT, 'NOI divided by annual debt service.', true)
  line('Cash-on-cash after refinance', { formula: `IF(B${rTrapped}<=0,"",B${rAnnualCf}/B${rTrapped})` }, PCT, 'Denominator is the cash still invested, not the original outlay.')
  line('Break-even occupancy', { formula: `IF(B${rGpi}=0,"",(-B${rOpexRef}+B${rAds})/B${rGpi})` }, PCT)
  line('Principal repaid year 1 (equity build, NOT cash flow)', r.refinance.principalYear1, MONEY, 'Reported separately — never counted as spendable cash.')
  row++

  title('WHAT YOU SHOULD PAY')
  header('Target', 'Required price', 'Formula')
  for (const cap of [0.06, 0.065, 0.07, 0.075]) {
    const r0 = ws.getRow(row++)
    r0.getCell(1).value = `${(cap * 100).toFixed(2)}% cap rate`
    r0.getCell(2).value = { formula: `B${rNoi}/${cap}` }
    r0.getCell(2).numFmt = MONEY
    r0.getCell(3).value = `= NOI / ${cap}`
    r0.getCell(3).font = { size: 8, color: { argb: 'FF7A8798' } }
  }
  for (const dscrTarget of [1.2, 1.3, 1.4]) {
    const r0 = ws.getRow(row++)
    r0.getCell(1).value = `Maximum loan at ${dscrTarget.toFixed(2)}x DSCR`
    r0.getCell(2).value = {
      formula: `(B${rNoi}/${dscrTarget}/12)*(1-(1+B${rPeriodic})^(-B${rAmort}*12))/B${rPeriodic}`,
    }
    r0.getCell(2).numFmt = MONEY
    r0.getCell(3).value = 'Present value of the payment NOI can support'
    r0.getCell(3).font = { size: 8, color: { argb: 'FF7A8798' } }
  }

  /* ------------------------------------------------------------------ *
   * Sheet 2 — Rent roll
   * ------------------------------------------------------------------ */
  const rr = wb.addWorksheet('Rent roll')
  rr.columns = [
    { header: 'Unit', key: 'unit', width: 10 },
    { header: 'Legal', key: 'legal', width: 8 },
    { header: 'Beds', key: 'beds', width: 7 },
    { header: 'Baths', key: 'baths', width: 7 },
    { header: 'Sq ft', key: 'sqft', width: 9 },
    { header: 'Status', key: 'status', width: 11 },
    { header: 'Current rent', key: 'current', width: 14, style: { numFmt: MONEY } },
    { header: 'Market rent', key: 'market', width: 14, style: { numFmt: MONEY } },
    { header: 'Gap', key: 'gap', width: 12, style: { numFmt: MONEY } },
    { header: 'Parking', key: 'parking', width: 11, style: { numFmt: MONEY } },
    { header: 'Storage', key: 'storage', width: 11, style: { numFmt: MONEY } },
    { header: 'Laundry', key: 'laundry', width: 11, style: { numFmt: MONEY } },
    { header: 'Other', key: 'other', width: 11, style: { numFmt: MONEY } },
    { header: 'Lease start', key: 'start', width: 13 },
    { header: 'Lease end', key: 'end', width: 13 },
    { header: 'M2M', key: 'm2m', width: 7 },
    { header: 'Notes', key: 'notes', width: 34 },
  ]
  styleHeader(rr)
  for (const u of deal.units) {
    rr.addRow({
      unit: u.unitNumber,
      legal: u.legalUnit ? 'Yes' : 'NO',
      beds: u.bedrooms,
      baths: u.bathrooms,
      sqft: u.sqFt,
      status: u.occupied ? 'Occupied' : 'Vacant',
      current: u.occupied ? u.currentRent : 0,
      market: u.marketRent,
      gap: Math.max(0, u.marketRent - (u.occupied ? u.currentRent : 0)),
      parking: u.parkingIncome,
      storage: u.storageIncome,
      laundry: u.laundryIncome,
      other: u.otherIncome,
      start: u.leaseStart,
      end: u.leaseEnd,
      m2m: u.monthToMonth ? 'Yes' : '',
      notes: u.notes,
    })
  }
  const rrTotal = rr.addRow({
    unit: 'TOTAL',
    current: { formula: `SUM(G2:G${rr.rowCount})` },
    market: { formula: `SUM(H2:H${rr.rowCount})` },
    gap: { formula: `SUM(I2:I${rr.rowCount})` },
    parking: { formula: `SUM(J2:J${rr.rowCount})` },
    storage: { formula: `SUM(K2:K${rr.rowCount})` },
    laundry: { formula: `SUM(L2:L${rr.rowCount})` },
    other: { formula: `SUM(M2:M${rr.rowCount})` },
  })
  rrTotal.font = { bold: true }
  rr.addRow({})
  rr.addRow({ unit: 'Note', current: '', notes: 'Current and market rents are separate figures. A sitting tenant cannot be moved to market rent on closing — Ontario caps annual increases at the provincial guideline.' })

  /* ------------------------------------------------------------------ *
   * Sheet 3 — Expenses
   * ------------------------------------------------------------------ */
  const ex = wb.addWorksheet('Expenses')
  ex.columns = [
    { header: 'Line', key: 'label', width: 32 },
    { header: 'Basis', key: 'basis', width: 34 },
    { header: 'Annual', key: 'annual', width: 14, style: { numFmt: MONEY } },
    { header: 'Monthly', key: 'monthly', width: 14, style: { numFmt: MONEY } },
    { header: 'Per unit', key: 'perUnit', width: 13, style: { numFmt: MONEY } },
    { header: 'Share of EGI', key: 'share', width: 13, style: { numFmt: PCT } },
    { header: 'Source', key: 'source', width: 18 },
    { header: 'Note', key: 'note', width: 60 },
  ]
  styleHeader(ex)
  for (const l of s.noi.expenses.lines.filter((x) => x.annual > 0)) {
    ex.addRow({
      label: l.label,
      basis: l.mode === 'PERCENT' ? `${((l.percent ?? 0) * 100).toFixed(2)}% of ${l.basis?.replace(/_/g, ' ').toLowerCase()}` : 'Fixed annual amount',
      annual: l.annual,
      monthly: l.monthly,
      perUnit: deal.units.length ? l.annual / deal.units.length : 0,
      share: s.noi.effectiveGrossIncome > 0 ? l.annual / s.noi.effectiveGrossIncome : 0,
      source: l.isActual ? 'Verified actual' : 'Model assumption',
      note: l.note,
    })
  }
  const exTotal = ex.addRow({
    label: 'TOTAL OPERATING EXPENSES',
    annual: { formula: `SUM(C2:C${ex.rowCount})` },
    monthly: { formula: `SUM(D2:D${ex.rowCount})` },
    share: s.noi.expenseRatio ?? 0,
  })
  exTotal.font = { bold: true }

  /* ------------------------------------------------------------------ *
   * Sheet 4 — Scenarios
   * ------------------------------------------------------------------ */
  const sc = wb.addWorksheet('Scenarios')
  sc.columns = [
    { header: 'Metric', key: 'metric', width: 38 },
    { header: 'Conservative / current', key: 'c', width: 22, style: { numFmt: MONEY } },
    { header: 'Stabilized / base', key: 's', width: 20, style: { numFmt: MONEY } },
    { header: 'Optimistic', key: 'o', width: 18, style: { numFmt: MONEY } },
  ]
  styleHeader(sc)
  const scRow = (metric: string, cv: number | null, sv: number | null, ov: number | null, fmt = MONEY) => {
    const r0 = sc.addRow({ metric, c: cv ?? 0, s: sv ?? 0, o: ov ?? 0 })
    ;['B', 'C', 'D'].forEach((col) => (r0.getCell(col).numFmt = fmt))
    return r0
  }
  scRow('Gross scheduled income', c.noi.totalPotentialGrossIncome, s.noi.totalPotentialGrossIncome, o.noi.totalPotentialGrossIncome)
  scRow('Vacancy rate', c.noi.vacancyPercent, s.noi.vacancyPercent, o.noi.vacancyPercent, PCT)
  scRow('Effective gross income', c.noi.effectiveGrossIncome, s.noi.effectiveGrossIncome, o.noi.effectiveGrossIncome)
  scRow('Operating expenses', c.noi.operatingExpenses, s.noi.operatingExpenses, o.noi.operatingExpenses)
  scRow('Net operating income', c.noi.noi, s.noi.noi, o.noi.noi).font = { bold: true }
  scRow('Cap rate on offer', c.capRateOnOffer, s.capRateOnOffer, o.capRateOnOffer, PCT).font = { bold: true }
  scRow('Monthly cash flow after refinance',
    (c.noi.noi - r.refinance.annualDebtService) / 12,
    (s.noi.noi - r.refinance.annualDebtService) / 12,
    (o.noi.noi - r.refinance.annualDebtService) / 12,
  ).font = { bold: true }
  sc.addRow({})
  sc.addRow({ metric: 'Conservative excludes non-conforming income and uses in-place rents with higher vacancy.' })
  sc.addRow({ metric: 'Stabilized lets vacant units at market but leaves sitting tenants on contract rent.' })
  sc.addRow({ metric: 'Optimistic is the only scenario that marks occupied units to market. It is never the default.' })

  /* ------------------------------------------------------------------ *
   * Sheet 5 — LTV ladder
   * ------------------------------------------------------------------ */
  const lv = wb.addWorksheet('Refinance LTV')
  lv.columns = [
    { header: 'LTV', key: 'ltv', width: 9, style: { numFmt: '0%' } },
    { header: 'Mortgage', key: 'mortgage', width: 15, style: { numFmt: MONEY } },
    { header: 'Cash released', key: 'released', width: 15, style: { numFmt: MONEY } },
    { header: 'Monthly payment', key: 'payment', width: 16, style: { numFmt: MONEY } },
    { header: 'Monthly cash flow', key: 'cashFlow', width: 17, style: { numFmt: MONEY } },
    { header: 'DSCR', key: 'dscr', width: 10, style: { numFmt: MULT } },
    { header: 'Cash-on-cash', key: 'coc', width: 14, style: { numFmt: PCT } },
    { header: 'Cash trapped', key: 'trapped', width: 15, style: { numFmt: MONEY } },
    { header: 'Equity remaining', key: 'equity', width: 17, style: { numFmt: MONEY } },
  ]
  styleHeader(lv)
  for (const row2 of r.ltvLadder.rows) {
    lv.addRow({
      ltv: row2.ltv,
      mortgage: row2.mortgageAmount,
      released: row2.netCashReleased,
      payment: row2.monthlyPayment,
      cashFlow: row2.monthlyCashFlow,
      dscr: row2.dscr ?? 0,
      coc: row2.cashOnCash ?? 0,
      trapped: row2.cashRemainingInvested,
      equity: row2.equityRemaining,
    })
  }
  lv.addRow({})
  lv.addRow({ ltv: null, mortgage: null, released: 'Maximum extraction is not automatically best: every extra 5% of LTV releases more capital and permanently reduces monthly income.' })

  /* ------------------------------------------------------------------ *
   * Sheet 6 — Offer analysis
   * ------------------------------------------------------------------ */
  const of = wb.addWorksheet('Offer analysis')
  of.columns = [
    { header: 'Offer', key: 'label', width: 16 },
    { header: 'Price', key: 'price', width: 15, style: { numFmt: MONEY } },
    { header: 'Land transfer tax', key: 'ltt', width: 17, style: { numFmt: MONEY } },
    { header: 'Cash required', key: 'cash', width: 16, style: { numFmt: MONEY } },
    { header: 'Cap rate', key: 'cap', width: 11, style: { numFmt: PCT } },
    { header: 'Monthly cash flow', key: 'cf', width: 17, style: { numFmt: MONEY } },
    { header: 'DSCR', key: 'dscr', width: 10, style: { numFmt: MULT } },
    { header: 'Cash-on-cash', key: 'coc', width: 14, style: { numFmt: PCT } },
  ]
  styleHeader(of)
  for (const row2 of r.offers) {
    of.addRow({
      label: row2.label,
      price: row2.price,
      ltt: row2.landTransferTax,
      cash: row2.totalCashRequired,
      cap: row2.capRate ?? 0,
      cf: row2.monthlyCashFlow,
      dscr: row2.dscr ?? 0,
      coc: row2.cashOnCash ?? 0,
    })
  }
  of.addRow({})
  const tpHeader = of.addRow({ label: 'PRICE REQUIRED TO ACHIEVE', price: 'Price', ltt: 'Discount from asking', cash: 'Note' })
  tpHeader.font = { bold: true }
  for (const t of r.targetPrices) {
    of.addRow({ label: t.label, price: t.price ?? 0, ltt: t.discountFromAsking ?? 0, cash: t.note })
  }

  /* ------------------------------------------------------------------ *
   * Sheet 7 — Projection
   * ------------------------------------------------------------------ */
  const pj = wb.addWorksheet('Projection')
  pj.columns = [
    { header: 'Year', key: 'year', width: 7 },
    { header: 'Gross income', key: 'gross', width: 15, style: { numFmt: MONEY } },
    { header: 'Vacancy', key: 'vac', width: 13, style: { numFmt: MONEY } },
    { header: 'Expenses', key: 'opex', width: 14, style: { numFmt: MONEY } },
    { header: 'NOI', key: 'noi', width: 14, style: { numFmt: MONEY } },
    { header: 'Debt service', key: 'ds', width: 15, style: { numFmt: MONEY } },
    { header: 'Cash flow', key: 'cf', width: 14, style: { numFmt: MONEY } },
    { header: 'DSCR', key: 'dscr', width: 10, style: { numFmt: MULT } },
    { header: 'Principal repaid', key: 'principal', width: 16, style: { numFmt: MONEY } },
    { header: 'Mortgage balance', key: 'balance', width: 17, style: { numFmt: MONEY } },
    { header: 'Property value', key: 'value', width: 16, style: { numFmt: MONEY } },
    { header: 'Equity', key: 'equity', width: 15, style: { numFmt: MONEY } },
    { header: 'Capital event', key: 'capital', width: 15, style: { numFmt: MONEY } },
  ]
  styleHeader(pj)
  for (const y of r.projectionTenYear.years) {
    pj.addRow({
      year: y.year, gross: y.grossIncome, vac: -y.vacancyLoss, opex: -y.operatingExpenses,
      noi: y.noi, ds: -y.debtService, cf: y.cashFlow, dscr: y.dscr ?? 0,
      principal: y.principalRepaid, balance: y.mortgageBalance, value: y.propertyValue,
      equity: y.equity, capital: y.capitalEvent,
    })
  }
  pj.addRow({})
  const sale = r.projectionTenYear.saleAtAppreciation
  pj.addRow({ year: 'SALE', gross: 'Future value', vac: sale.futureValue }).font = { bold: true }
  pj.addRow({ gross: 'Selling costs', vac: -sale.sellingCosts })
  pj.addRow({ gross: 'Mortgage repayment', vac: -sale.mortgageRepayment })
  pj.addRow({ gross: 'Net sale proceeds', vac: sale.netSaleProceeds })
  pj.addRow({ gross: 'Total profit', vac: sale.totalProfit })
  pj.addRow({ gross: 'IRR', vac: sale.irr ?? 0 })
  pj.addRow({ gross: 'Equity multiple', vac: sale.equityMultiple ?? 0 })

  /* ------------------------------------------------------------------ *
   * Sheet 8 — Sensitivity
   * ------------------------------------------------------------------ */
  const sn = wb.addWorksheet('Sensitivity')
  let snRow = 1
  for (const m of r.sensitivity) {
    const t = sn.getRow(snRow++)
    t.getCell(1).value = `${m.title} — monthly cash flow`
    t.getCell(1).font = { bold: true, color: { argb: 'FF14407C' } }
    const h = sn.getRow(snRow++)
    h.getCell(1).value = `${m.rowLabel} \\ ${m.colLabel}`
    h.getCell(1).font = { bold: true, size: 9 }
    m.colValues.forEach((cv, i) => {
      const cell = h.getCell(i + 2)
      cell.value = m.colFormat === 'percent' ? cv : m.colFormat === 'rentDelta' ? `${cv > 0 ? '+' : ''}${(cv * 100).toFixed(0)}%` : cv
      if (m.colFormat === 'percent') cell.numFmt = PCT
      if (m.colFormat === 'currency') cell.numFmt = MONEY
      cell.font = { bold: true, size: 9 }
    })
    m.cells.forEach((cells, i) => {
      const r0 = sn.getRow(snRow++)
      const label = r0.getCell(1)
      label.value = m.rowValues[i]
      label.numFmt = m.rowFormat === 'percent' ? PCT : m.rowFormat === 'currency' ? MONEY : '0%'
      label.font = { bold: true, size: 9 }
      cells.forEach((cell, j) => {
        const v = r0.getCell(j + 2)
        v.value = cell.monthlyCashFlow
        v.numFmt = MONEY
        if (cell.flags.negativeCashFlow) v.font = { color: { argb: 'FFB22727' } }
        else if (cell.flags.belowDscrTarget) v.font = { color: { argb: 'FFA86806' } }
        else if (cell.flags.aboveTwoThousand) v.font = { color: { argb: 'FF0D764A' }, bold: true }
      })
    })
    snRow += 2
  }
  sn.getColumn(1).width = 20
  for (let i = 2; i <= 8; i++) sn.getColumn(i).width = 14

  /* ------------------------------------------------------------------ *
   * Sheet 9 — Risk
   * ------------------------------------------------------------------ */
  const rk = wb.addWorksheet('Risk')
  rk.columns = [
    { header: 'Item', key: 'item', width: 34 },
    { header: 'Value', key: 'value', width: 22 },
    { header: 'Detail', key: 'detail', width: 80 },
  ]
  styleHeader(rk)
  rk.addRow({ item: 'CAPITAL EXPENDITURE', value: r.capex.riskLevel, detail: r.capex.drivers.join(' · ') }).font = { bold: true }
  rk.addRow({ item: 'Within 1 year', value: r.capex.withinOneYear })
  rk.addRow({ item: 'Within 3 years', value: r.capex.withinThreeYears })
  rk.addRow({ item: 'Within 5 years', value: r.capex.withinFiveYears })
  rk.addRow({ item: 'Within 10 years', value: r.capex.totalTenYear })
  rk.addRow({ item: 'Implied annual reserve', value: r.capex.impliedAnnualReserve })
  rk.addRow({})
  rk.addRow({ item: 'LEGAL', value: r.legal.riskLevel, detail: r.legal.messages.join(' · ') }).font = { bold: true }
  for (const i of r.legal.items) rk.addRow({ item: i.label, value: i.state })
  rk.addRow({})
  rk.addRow({ item: 'RED FLAGS', value: `${r.dealBreakers.redCount} red / ${r.dealBreakers.amberCount} caution` }).font = { bold: true }
  for (const h of r.dealBreakers.hits) rk.addRow({ item: h.label, value: h.severity, detail: `${h.message} ${h.detail}` })
  rk.addRow({})
  rk.addRow({ item: 'SCORECARD', value: r.scorecard.summary }).font = { bold: true }
  for (const d of r.scorecard.dimensions) rk.addRow({ item: d.label, value: `${Math.round(d.score)} (${d.grade})`, detail: d.headline })
  rk.addRow({})
  rk.addRow({ item: 'REQUIREMENTS' }).font = { bold: true }
  for (const q of r.scorecard.requirements) rk.addRow({ item: q.label, value: `${q.actual} vs ${q.requirement} — ${q.result}`, detail: q.note })
  for (const col of ['B']) rk.getColumn(col).alignment = { horizontal: 'left' }

  /* ------------------------------------------------------------------ *
   * Sheet 10 — Sources
   * ------------------------------------------------------------------ */
  const so = wb.addWorksheet('Sources')
  so.columns = [
    { header: 'Figure', key: 'label', width: 28 },
    { header: 'Field', key: 'field', width: 24 },
    { header: 'Type', key: 'origin', width: 20 },
    { header: 'Source', key: 'source', width: 26 },
    { header: 'URL', key: 'url', width: 44 },
    { header: 'Retrieved', key: 'date', width: 13 },
    { header: 'Entry', key: 'manual', width: 12 },
    { header: 'Note', key: 'note', width: 44 },
  ]
  styleHeader(so)
  for (const src of deal.sources) {
    so.addRow({
      label: src.label, field: src.field, origin: src.origin, source: src.source,
      url: src.url, date: src.retrievedAt, manual: src.manual ? 'Manual' : 'Automated', note: src.note,
    })
  }
  if (deal.sources.length === 0) so.addRow({ label: 'No sources documented yet.' })

  const buf = await wb.xlsx.writeBuffer()
  downloadBlob(
    `${safeFilename(deal.name)}-underwriting.xlsx`,
    new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }),
  )
}

function styleHeader(ws: { getRow: (n: number) => { font: unknown; fill: unknown; height: number } }): void {
  const h = ws.getRow(1)
  h.font = { bold: true, size: 9 }
  h.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F3F6' } }
  h.height = 18
}
