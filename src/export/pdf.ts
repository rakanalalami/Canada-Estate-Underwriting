/**
 * §32 PDF investment report.
 *
 * Contains the full required set: property overview, financial summary, rent
 * roll, expenses, NOI, mortgage, cash flow, cap rate, DSCR, refinance analysis,
 * five-year forecast, sensitivity, risk analysis and sources.
 */

import type { Deal } from '@/engine/types'
import type { UnderwriteResult } from '@/engine/underwrite'
import { fmtCAD, fmtMultiple, fmtPct } from '@/engine/money'
import { capRateBand, dscrBand } from '@/engine/metrics'
import { downloadBlob, safeFilename } from './csv'

const INK: [number, number, number] = [11, 18, 32]
const ACCENT: [number, number, number] = [20, 63, 124]
const MUTED: [number, number, number] = [110, 122, 140]
const NEG: [number, number, number] = [178, 39, 39]
const POS: [number, number, number] = [13, 118, 74]
const WARN: [number, number, number] = [168, 104, 6]

export async function exportPdf(deal: Deal, r: UnderwriteResult): Promise<void> {
  const { jsPDF } = await import('jspdf')
  const autoTableMod = await import('jspdf-autotable')
  const autoTable = (autoTableMod.default ?? autoTableMod) as unknown as (doc: unknown, opts: unknown) => void

  const doc = new jsPDF({ unit: 'pt', format: 'letter' })
  const W = doc.internal.pageSize.getWidth()
  const M = 40
  let y = M

  const s = r.scenarios.STABILIZED
  const c = r.scenarios.CONSERVATIVE
  const isCashRefi = deal.financing.structure === 'CASH_THEN_REFINANCE'
  const monthlyCf = isCashRefi ? r.refinance.monthlyCashFlow : s.cashFlow.monthlyCashFlow
  const dscr = isCashRefi ? r.refinance.dscr : s.cashFlow.dscr

  const lastY = (): number => {
    const t = (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable
    return t ? t.finalY : y
  }

  const ensure = (needed: number) => {
    if (y + needed > doc.internal.pageSize.getHeight() - 60) {
      doc.addPage()
      y = M
    }
  }

  const heading = (text: string, spec?: string) => {
    ensure(40)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(12)
    doc.setTextColor(...ACCENT)
    doc.text(text, M, y)
    if (spec) {
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(7.5)
      doc.setTextColor(...MUTED)
      doc.text(spec, W - M, y, { align: 'right' })
    }
    doc.setDrawColor(222, 227, 234)
    doc.setLineWidth(0.6)
    doc.line(M, y + 5, W - M, y + 5)
    y += 18
  }

  const paragraph = (text: string, color = MUTED) => {
    ensure(30)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8.5)
    doc.setTextColor(...color)
    const lines = doc.splitTextToSize(text, W - M * 2) as string[]
    doc.text(lines, M, y)
    y += lines.length * 11 + 6
  }

  const table = (head: string[], body: (string | number)[][], opts: Record<string, unknown> = {}) => {
    ensure(60)
    autoTable(doc, {
      startY: y,
      head: [head],
      body,
      margin: { left: M, right: M },
      styles: { font: 'helvetica', fontSize: 8, cellPadding: 3.5, textColor: INK, lineColor: [228, 232, 238], lineWidth: 0.4 },
      headStyles: { fillColor: [241, 243, 246], textColor: INK, fontStyle: 'bold', fontSize: 7.5 },
      alternateRowStyles: { fillColor: [250, 251, 252] },
      theme: 'grid',
      ...opts,
    })
    y = lastY() + 16
  }

  /* ----------------------------- Cover ----------------------------- */
  doc.setFillColor(...ACCENT)
  doc.rect(0, 0, W, 86, 'F')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(17)
  doc.setTextColor(255, 255, 255)
  doc.text(deal.name || 'Untitled property', M, 40)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9.5)
  doc.text(
    [deal.info.address, deal.info.neighbourhood, `${deal.info.city}, ${deal.info.province} ${deal.info.postalCode}`]
      .filter(Boolean)
      .join(' · '),
    M,
    58,
  )
  doc.setFontSize(8)
  doc.text(
    `Investment underwriting report · ${new Date().toLocaleDateString('en-CA', { year: 'numeric', month: 'long', day: 'numeric' })} · All figures CAD`,
    M,
    73,
  )
  y = 108

  /* ------------------------- Headline metrics ---------------------- */
  const kpis: [string, string][] = [
    ['Purchase price', fmtCAD(r.price)],
    ['Total cash required', fmtCAD(r.acquisition.totalCashRequired - (isCashRefi ? 0 : s.debt.mortgageAmount))],
    ['Units', String(deal.units.length)],
    ['Gross rent (monthly)', fmtCAD(s.noi.totalPotentialGrossIncome / 12)],
    ['Net operating income', fmtCAD(s.noi.noi)],
    ['Cap rate', fmtPct(s.capRateOnOffer)],
    ['Mortgage', fmtCAD(isCashRefi ? r.refinance.mortgageAmount : s.debt.mortgageAmount)],
    ['Monthly payment', fmtCAD(isCashRefi ? r.refinance.monthlyPayment : s.debt.monthlyPayment)],
    ['Monthly cash flow', fmtCAD(monthlyCf)],
    ['Cash-on-cash', fmtPct(isCashRefi ? r.refinance.cashOnCash : s.cashFlow.cashOnCash)],
    ['DSCR', fmtMultiple(dscr)],
    ['Break-even occupancy', fmtPct(s.breakEven.breakEvenOccupancy)],
    ['Refinance proceeds', fmtCAD(r.refinance.netCashReleased)],
    ['Cash remaining in deal', fmtCAD(r.refinance.cashRemainingInvested)],
    ['Equity', fmtCAD(r.refinance.equityRemaining)],
    ['Capital recycled', fmtPct(r.refinance.percentCapitalRecycled)],
  ]

  const cols = 4
  const cw = (W - M * 2) / cols
  const ch = 40
  kpis.forEach((kpi, i) => {
    const col = i % cols
    const rowIdx = Math.floor(i / cols)
    const x = M + col * cw
    const yy = y + rowIdx * ch
    doc.setDrawColor(228, 232, 238)
    doc.setLineWidth(0.5)
    doc.rect(x, yy, cw - 6, ch - 6)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(6.5)
    doc.setTextColor(...MUTED)
    doc.text(kpi[0].toUpperCase(), x + 6, yy + 13)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(11)
    doc.setTextColor(...INK)
    doc.text(kpi[1], x + 6, yy + 28)
  })
  y += Math.ceil(kpis.length / cols) * ch + 12

  /* --------------------------- Red flags --------------------------- */
  if (r.dealBreakers.hits.length > 0) {
    heading('Red flags', '§28')
    table(
      ['Severity', 'Flag', 'Detail'],
      r.dealBreakers.hits.map((h) => [h.severity, h.message, h.detail]),
      {
        columnStyles: { 0: { cellWidth: 55 }, 1: { cellWidth: 200 } },
        didParseCell: (data: { section: string; column: { index: number }; cell: { styles: Record<string, unknown> }; row: { index: number } }) => {
          if (data.section === 'body' && data.column.index === 0) {
            data.cell.styles.textColor = r.dealBreakers.hits[data.row.index]?.severity === 'RED' ? NEG : WARN
            data.cell.styles.fontStyle = 'bold'
          }
        },
      },
    )
  }

  /* ------------------------ Property overview ---------------------- */
  heading('Property overview', '§1')
  table(
    ['Attribute', 'Value', 'Attribute', 'Value'],
    [
      ['Property type', deal.info.propertyType.replace(/_/g, ' '), 'Zoning', deal.info.zoning || '—'],
      ['Year built', String(deal.info.yearBuilt ?? '—'), 'Year renovated', String(deal.info.yearRenovated ?? '—')],
      ['Units (rent roll)', String(deal.units.length), 'Legal units', String(deal.info.legalUnits)],
      ['Non-conforming units', String(r.legal.nonConformingUnits), 'Occupancy', deal.info.occupancyStatus.replace(/_/g, ' ')],
      ['Bedrooms', String(deal.info.totalBedrooms), 'Bathrooms', String(deal.info.totalBathrooms)],
      ['Building size', `${deal.info.buildingSizeSqFt.toLocaleString('en-CA')} sq ft`, 'Lot size', `${deal.info.lotSizeSqFt.toLocaleString('en-CA')} sq ft`],
      ['Parking spaces', String(deal.info.parkingSpaces), 'Condition', deal.info.condition.replace(/_/g, ' ')],
      ['Separate hydro', deal.info.separateHydroMeters ? 'Yes' : 'No', 'Separate gas', deal.info.separateGasMeters ? 'Yes' : 'No'],
      ['Separate water', deal.info.separateWaterMeters ? 'Yes' : 'No', 'MLS', deal.info.mlsNumber || '—'],
      ['Tenant-paid utilities', deal.info.tenantPaidUtilities.join(', ') || '—', 'Landlord-paid utilities', deal.info.landlordPaidUtilities.join(', ') || '—'],
    ],
  )

  /* ---------------------------- Rent roll -------------------------- */
  heading('Rent roll', '§2')
  table(
    ['Unit', 'Legal', 'Beds', 'Sq ft', 'Status', 'Current rent', 'Market rent', 'Gap', 'Other income'],
    [
      ...deal.units.map((u) => [
        u.unitNumber,
        u.legalUnit ? 'Yes' : 'NO',
        String(u.bedrooms),
        u.sqFt ? u.sqFt.toLocaleString('en-CA') : '—',
        u.occupied ? 'Occupied' : 'Vacant',
        fmtCAD(u.occupied ? u.currentRent : 0),
        fmtCAD(u.marketRent),
        fmtCAD(Math.max(0, u.marketRent - (u.occupied ? u.currentRent : 0))),
        fmtCAD(u.parkingIncome + u.storageIncome + u.laundryIncome + u.otherIncome),
      ]),
      [
        'TOTAL', '', String(r.rentRoll.totalBedrooms), r.rentRoll.totalSqFt.toLocaleString('en-CA'),
        `${r.rentRoll.occupiedCount}/${r.rentRoll.unitCount}`,
        fmtCAD(r.rentRoll.currentMonthlyResidentialRent),
        fmtCAD(r.rentRoll.marketMonthlyResidentialRent),
        fmtCAD(r.rentRoll.monthlyRentUpside),
        fmtCAD(r.rentRoll.currentMonthlyAncillary),
      ],
    ],
    { columnStyles: { 5: { halign: 'right' }, 6: { halign: 'right' }, 7: { halign: 'right' }, 8: { halign: 'right' } } },
  )
  if (r.rentRoll.belowMarketUnits.length > 0) {
    paragraph(
      `${r.rentRoll.belowMarketUnits.length} occupied unit(s) sit below market by a combined ${fmtCAD(r.rentRoll.belowMarketUnits.reduce((a, b) => a + b.belowMarketGap, 0))}/month. Ontario caps annual increases for sitting tenants at the provincial guideline — this gap closes on turnover, not on closing, and is not counted as income in the current or stabilized scenarios.`,
      WARN,
    )
  }

  /* --------------------------- Expenses ---------------------------- */
  heading('Operating expenses', '§3')
  table(
    ['Line', 'Basis', 'Annual', 'Monthly', 'Share of EGI', 'Source'],
    [
      ...s.noi.expenses.lines
        .filter((l) => l.annual > 0)
        .sort((a, b) => b.annual - a.annual)
        .map((l) => [
          l.label,
          l.mode === 'PERCENT' ? `${((l.percent ?? 0) * 100).toFixed(2)}% of ${l.basis?.replace(/_/g, ' ').toLowerCase()}` : 'Fixed',
          fmtCAD(l.annual),
          fmtCAD(l.monthly),
          fmtPct(s.noi.effectiveGrossIncome > 0 ? l.annual / s.noi.effectiveGrossIncome : null, 1),
          l.isActual ? 'Actual' : 'Assumption',
        ]),
      ['TOTAL', '', fmtCAD(s.noi.operatingExpenses), fmtCAD(s.noi.operatingExpenses / 12), fmtPct(s.noi.expenseRatio, 1), ''],
    ],
    { columnStyles: { 2: { halign: 'right' }, 3: { halign: 'right' }, 4: { halign: 'right' } } },
  )

  /* ------------------------------ NOI ------------------------------ */
  heading('Net operating income and cap rate', '§4 · §5 · §22')
  table(
    ['', 'Conservative / current', 'Stabilized / base', 'Optimistic'],
    [
      ['Gross scheduled income', fmtCAD(c.noi.totalPotentialGrossIncome), fmtCAD(s.noi.totalPotentialGrossIncome), fmtCAD(r.scenarios.OPTIMISTIC.noi.totalPotentialGrossIncome)],
      ['Vacancy rate', fmtPct(c.noi.vacancyPercent), fmtPct(s.noi.vacancyPercent), fmtPct(r.scenarios.OPTIMISTIC.noi.vacancyPercent)],
      ['Less vacancy and bad debt', fmtCAD(-(c.noi.vacancyLoss + c.noi.badDebtLoss)), fmtCAD(-(s.noi.vacancyLoss + s.noi.badDebtLoss)), fmtCAD(-(r.scenarios.OPTIMISTIC.noi.vacancyLoss + r.scenarios.OPTIMISTIC.noi.badDebtLoss))],
      ['Effective gross income', fmtCAD(c.noi.effectiveGrossIncome), fmtCAD(s.noi.effectiveGrossIncome), fmtCAD(r.scenarios.OPTIMISTIC.noi.effectiveGrossIncome)],
      ['Less operating expenses', fmtCAD(-c.noi.operatingExpenses), fmtCAD(-s.noi.operatingExpenses), fmtCAD(-r.scenarios.OPTIMISTIC.noi.operatingExpenses)],
      ['NET OPERATING INCOME', fmtCAD(c.noi.noi), fmtCAD(s.noi.noi), fmtCAD(r.scenarios.OPTIMISTIC.noi.noi)],
      ['NOI per unit', fmtCAD(c.noi.noiPerUnit), fmtCAD(s.noi.noiPerUnit), fmtCAD(r.scenarios.OPTIMISTIC.noi.noiPerUnit)],
      ['Cap rate on asking price', fmtPct(c.capRateOnAsking), fmtPct(s.capRateOnAsking), fmtPct(r.scenarios.OPTIMISTIC.capRateOnAsking)],
      ['Cap rate on offer price', fmtPct(c.capRateOnOffer), fmtPct(s.capRateOnOffer), fmtPct(r.scenarios.OPTIMISTIC.capRateOnOffer)],
    ],
    { columnStyles: { 1: { halign: 'right' }, 2: { halign: 'right' }, 3: { halign: 'right' } } },
  )
  paragraph(
    `Cap rate status: ${capRateBand(s.capRateOnOffer).label}. ${capRateBand(s.capRateOnOffer).note ?? ''} NOI excludes mortgage payments, income taxes and capital appreciation by definition.`,
  )

  /* -------------------------- Acquisition -------------------------- */
  heading('Acquisition costs and financing', '§6 · §7')
  table(
    ['Item', 'Amount', 'Item', 'Amount'],
    [
      ['Purchase price', fmtCAD(r.price), 'Ontario land transfer tax', fmtCAD(r.acquisition.landTransferTax)],
      ['Municipal LTT (Ottawa: none)', fmtCAD(0), 'Total closing costs', fmtCAD(r.acquisition.totalClosingCosts)],
      ['Renovation budget', fmtCAD(r.acquisition.renovationBudget), 'Initial reserve fund', fmtCAD(r.acquisition.initialReserveFund)],
      ['Capital in property', fmtCAD(r.acquisition.capitalInProperty), 'TOTAL CASH REQUIRED', fmtCAD(r.acquisition.totalCashRequired)],
      ['Acquisition structure', deal.financing.structure.replace(/_/g, ' '), 'Compounding', deal.financing.compounding === 'SEMI_ANNUAL' ? 'Semi-annual (Canadian)' : 'Monthly'],
    ],
    { columnStyles: { 1: { halign: 'right' }, 3: { halign: 'right' } } },
  )

  /* --------------------------- Refinance --------------------------- */
  heading('Refinance analysis', '§8 · §27')
  table(
    ['Item', 'Amount'],
    [
      ['Appraised value', fmtCAD(r.refinance.appraisedValue)],
      ['Refinance LTV', fmtPct(r.refinance.ltv, 1)],
      ['Gross refinance proceeds', fmtCAD(r.refinance.grossProceeds)],
      ['Less refinance costs', fmtCAD(-r.refinance.refinanceCosts)],
      ['Less existing debt discharged', fmtCAD(-r.refinance.existingDebtPayoff)],
      ['NET CASH RELEASED', fmtCAD(r.refinance.netCashReleased)],
      ['Cash remaining invested', fmtCAD(r.refinance.cashRemainingInvested)],
      ['Capital recycled', fmtPct(r.refinance.percentCapitalRecycled)],
      ['Equity remaining', fmtCAD(r.refinance.equityRemaining)],
      ['Monthly payment', fmtCAD(r.refinance.monthlyPayment)],
      ['Annual debt service', fmtCAD(r.refinance.annualDebtService)],
      ['Monthly cash flow after refinance', fmtCAD(r.refinance.monthlyCashFlow)],
      ['DSCR', `${fmtMultiple(r.refinance.dscr)} — ${dscrBand(r.refinance.dscr).label}`],
      ['Cash-on-cash after refinance', fmtPct(r.refinance.cashOnCash)],
    ],
    { columnStyles: { 1: { halign: 'right' } } },
  )
  paragraph(r.refinance.valuationNote)

  table(
    ['LTV', 'Mortgage', 'Cash released', 'Monthly payment', 'Monthly cash flow', 'DSCR', 'Cash trapped'],
    r.ltvLadder.rows.map((row) => [
      fmtPct(row.ltv, 0),
      fmtCAD(row.mortgageAmount),
      fmtCAD(row.netCashReleased),
      fmtCAD(row.monthlyPayment),
      fmtCAD(row.monthlyCashFlow),
      fmtMultiple(row.dscr),
      fmtCAD(row.cashRemainingInvested),
    ]),
    { columnStyles: { 1: { halign: 'right' }, 2: { halign: 'right' }, 3: { halign: 'right' }, 4: { halign: 'right' }, 5: { halign: 'right' }, 6: { halign: 'right' } } },
  )
  paragraph(
    'Maximum extraction is not automatically the best decision: each additional 5% of LTV releases more capital and permanently reduces monthly income and debt coverage.',
  )

  /* --------------------------- Cash flow --------------------------- */
  heading('Cash flow', '§9 · §10 · §11')
  table(
    ['', 'Monthly', 'Annual'],
    [
      ['Gross scheduled rent', fmtCAD(s.noi.totalPotentialGrossIncome / 12), fmtCAD(s.noi.totalPotentialGrossIncome)],
      ['Vacancy and bad debt', fmtCAD(-(s.noi.vacancyLoss + s.noi.badDebtLoss) / 12), fmtCAD(-(s.noi.vacancyLoss + s.noi.badDebtLoss))],
      ['Effective gross income', fmtCAD(s.noi.effectiveGrossIncome / 12), fmtCAD(s.noi.effectiveGrossIncome)],
      ['Operating expenses', fmtCAD(-s.noi.operatingExpenses / 12), fmtCAD(-s.noi.operatingExpenses)],
      ['Net operating income', fmtCAD(s.noi.noi / 12), fmtCAD(s.noi.noi)],
      ['Mortgage debt service', fmtCAD(-(isCashRefi ? r.refinance.annualDebtService : s.debt.annualDebtService) / 12), fmtCAD(-(isCashRefi ? r.refinance.annualDebtService : s.debt.annualDebtService))],
      ['PRE-TAX CASH FLOW', fmtCAD(monthlyCf), fmtCAD(monthlyCf * 12)],
      ['Equity build from principal (NOT cash flow)', fmtCAD((isCashRefi ? r.refinance.principalYear1 : s.debt.principalYear1) / 12), fmtCAD(isCashRefi ? r.refinance.principalYear1 : s.debt.principalYear1)],
    ],
    { columnStyles: { 1: { halign: 'right' }, 2: { halign: 'right' } } },
  )

  /* -------------------------- Offer analysis ----------------------- */
  heading('Offer analysis', '§12 · §13')
  table(
    ['Offer', 'Price', 'Land transfer tax', 'Cash required', 'Cap rate', 'Cash flow', 'DSCR'],
    r.offers.map((o) => [
      o.label, fmtCAD(o.price), fmtCAD(o.landTransferTax), fmtCAD(o.totalCashRequired),
      fmtPct(o.capRate), fmtCAD(o.monthlyCashFlow), fmtMultiple(o.dscr),
    ]),
    { columnStyles: { 1: { halign: 'right' }, 2: { halign: 'right' }, 3: { halign: 'right' }, 4: { halign: 'right' }, 5: { halign: 'right' }, 6: { halign: 'right' } } },
  )
  table(
    ['Target', 'Required price', 'Discount from asking', 'Note'],
    r.targetPrices.map((t) => [
      t.label,
      t.price ? fmtCAD(t.price) : '—',
      t.notBinding ? 'Already met' : t.discountFromAsking !== null ? `${t.discountFromAsking > 0 ? '−' : '+'}${fmtPct(Math.abs(t.discountFromAsking), 1)}` : '—',
      t.note,
    ]),
    { columnStyles: { 1: { halign: 'right' }, 2: { halign: 'right' }, 3: { cellWidth: 190 } } },
  )

  /* -------------------------- Projection --------------------------- */
  heading('Five-year forecast', '§16 · §18')
  table(
    ['Year', 'Gross income', 'Expenses', 'NOI', 'Debt service', 'Cash flow', 'Principal', 'Balance', 'Value', 'Equity'],
    r.projection.years.map((yr) => [
      String(yr.year), fmtCAD(yr.grossIncome), fmtCAD(-yr.operatingExpenses), fmtCAD(yr.noi),
      fmtCAD(-yr.debtService), fmtCAD(yr.cashFlow), fmtCAD(yr.principalRepaid),
      fmtCAD(yr.mortgageBalance), fmtCAD(yr.propertyValue), fmtCAD(yr.equity),
    ]),
    { styles: { fontSize: 7, cellPadding: 3 }, columnStyles: Object.fromEntries([1, 2, 3, 4, 5, 6, 7, 8, 9].map((i) => [i, { halign: 'right' }])) },
  )
  const sale = r.projection.saleAtAppreciation
  table(
    ['Sale scenario', 'Amount'],
    [
      ['Future property value', fmtCAD(sale.futureValue)],
      ['Selling costs', fmtCAD(-sale.sellingCosts)],
      ['Mortgage repayment', fmtCAD(-sale.mortgageRepayment)],
      ['Net sale proceeds', fmtCAD(sale.netSaleProceeds)],
      ['Total profit', fmtCAD(sale.totalProfit)],
      ['IRR', fmtPct(sale.irr)],
      ['Equity multiple', fmtMultiple(sale.equityMultiple)],
    ],
    { columnStyles: { 1: { halign: 'right' } } },
  )
  paragraph(
    `Appreciation is assumed at ${fmtPct(deal.projection.annualAppreciation, 1)} per year. It is an assumption, not a fact, and it never enters NOI, cap rate, DSCR or cash flow anywhere in this report.`,
  )

  /* -------------------------- Sensitivity -------------------------- */
  heading('Sensitivity', '§19')
  for (const m of r.sensitivity) {
    table(
      [`${m.rowLabel} \\ ${m.colLabel}`, ...m.colValues.map((cv) =>
        m.colFormat === 'percent' ? fmtPct(cv, 2) : m.colFormat === 'currency' ? fmtCAD(cv) : cv === 0 ? 'Base' : `${cv > 0 ? '+' : ''}${(cv * 100).toFixed(0)}%`,
      )],
      m.cells.map((cells, i) => [
        m.rowFormat === 'percent' ? fmtPct(m.rowValues[i], 2) : m.rowFormat === 'currency' ? fmtCAD(m.rowValues[i]) : String(m.rowValues[i]),
        ...cells.map((cell) => fmtCAD(cell.monthlyCashFlow)),
      ]),
      {
        styles: { fontSize: 7.5, cellPadding: 3 },
        columnStyles: Object.fromEntries([1, 2, 3, 4, 5, 6].map((i) => [i, { halign: 'right' }])),
        didParseCell: (data: { section: string; column: { index: number }; row: { index: number }; cell: { styles: Record<string, unknown> } }) => {
          if (data.section !== 'body' || data.column.index === 0) return
          const cell = m.cells[data.row.index]?.[data.column.index - 1]
          if (!cell) return
          if (cell.flags.negativeCashFlow) data.cell.styles.textColor = NEG
          else if (cell.flags.belowDscrTarget) data.cell.styles.textColor = WARN
          else if (cell.flags.aboveTwoThousand) data.cell.styles.textColor = POS
        },
      },
    )
  }

  /* -------------------------- Risk analysis ------------------------ */
  heading('Risk analysis', '§20 · §21 · §23')
  table(
    ['Capital expenditure', 'Amount'],
    [
      ['Within 1 year', fmtCAD(r.capex.withinOneYear)],
      ['Within 3 years', fmtCAD(r.capex.withinThreeYears)],
      ['Within 5 years', fmtCAD(r.capex.withinFiveYears)],
      ['Within 10 years', fmtCAD(r.capex.totalTenYear)],
      ['Implied annual reserve', fmtCAD(r.capex.impliedAnnualReserve)],
      ['Reserve modelled in NOI', fmtCAD(s.noi.expenses.capexReserveAnnual)],
      ['CapEx risk level', `${r.capex.riskLevel} (${Math.round(r.capex.score)}/100)`],
    ],
    { columnStyles: { 1: { halign: 'right' } } },
  )
  if (r.capex.drivers.length) paragraph(`Risk drivers: ${r.capex.drivers.join(' · ')}`)

  table(
    ['Legal compliance', 'Status'],
    [
      ...r.legal.items.map((i) => [i.label, i.state.replace(/_/g, ' ')]),
      ['Legal units', String(r.legal.legalUnits)],
      ['Units in rent roll', String(r.legal.actualUnits)],
      ['Non-conforming income', `${fmtCAD(r.legal.nonConformingMonthlyIncome)}/month`],
    ],
  )
  if (r.legal.messages.length) paragraph(r.legal.messages.join(' '), NEG)

  table(
    ['Scorecard dimension', 'Score', 'Grade', 'Headline'],
    r.scorecard.dimensions.map((d) => [d.label, `${Math.round(d.score)}/100`, d.grade, d.headline]),
    { columnStyles: { 1: { halign: 'right', cellWidth: 45 }, 2: { cellWidth: 60 } } },
  )
  table(
    ['Investor requirement', 'Target', 'Actual', 'Result'],
    r.scorecard.requirements.map((q) => [q.label, q.requirement, q.actual, q.result]),
  )
  paragraph(r.scorecard.summary)

  /* ----------------------------- Sources --------------------------- */
  heading('Sources and audit trail', '§33')
  if (deal.sources.length > 0) {
    table(
      ['Figure', 'Type', 'Source', 'Retrieved', 'Entry'],
      deal.sources.map((src) => [src.label || src.field, src.origin.replace(/_/g, ' '), `${src.source}${src.url ? ` — ${src.url}` : ''}`, src.retrievedAt, src.manual ? 'Manual' : 'Automated']),
    )
  } else {
    paragraph('No external sources documented for this deal.', WARN)
  }

  const assumptions = s.noi.expenses.lines.filter((l) => !l.isActual && l.annual > 0)
  if (assumptions.length > 0) {
    table(
      ['Model assumption in use', 'Value'],
      assumptions.map((l) => [
        l.label,
        l.mode === 'PERCENT' ? `${((l.percent ?? 0) * 100).toFixed(2)}% of ${l.basis?.replace(/_/g, ' ').toLowerCase()}` : fmtCAD(l.annual),
      ]),
      { columnStyles: { 1: { halign: 'right' } } },
    )
  }

  if (deal.notes) {
    heading('Notes')
    paragraph(deal.notes, INK)
  }

  /* ---------------------------- Footers ---------------------------- */
  const pages = doc.getNumberOfPages()
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i)
    const h = doc.internal.pageSize.getHeight()
    doc.setDrawColor(228, 232, 238)
    doc.setLineWidth(0.5)
    doc.line(M, h - 34, W - M, h - 34)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7)
    doc.setTextColor(...MUTED)
    doc.text(
      'Analysis tool output — not financial, tax, legal or mortgage advice. Verify every assumption before waiving conditions.',
      M,
      h - 22,
    )
    doc.text(`${i} / ${pages}`, W - M, h - 22, { align: 'right' })
  }

  downloadBlob(`${safeFilename(deal.name)}-investment-report.pdf`, doc.output('blob'))
}
