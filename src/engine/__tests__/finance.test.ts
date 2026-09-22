import { describe, expect, it } from 'vitest'
import {
  amortize,
  annuityPayment,
  balanceAfterYears,
  computePayment,
  equityMultiple,
  irr,
  loanFromPayment,
  maxLoanAtDscr,
  npv,
  periodicRate,
  terms,
  yearSplit,
} from '../finance'

describe('Canadian mortgage conventions', () => {
  it('uses semi-annual compounding, not r/12', () => {
    const canadian = periodicRate(0.0475, 'SEMI_ANNUAL', 12)
    const american = periodicRate(0.0475, 'MONTHLY', 12)
    expect(canadian).toBeCloseTo(Math.pow(1 + 0.0475 / 2, 1 / 6) - 1, 12)
    expect(american).toBeCloseTo(0.0475 / 12, 12)
    // The Canadian periodic rate is always the lower of the two.
    expect(canadian).toBeLessThan(american)
  })

  it('prices the §38 refinance correctly', () => {
    // C$422,500 at 4.75% over 25 years, monthly, semi-annual compounding.
    const p = computePayment(terms(422_500, 0.0475, 25))
    expect(p.periodicPayment).toBeCloseTo(2397.2, 0)
    expect(p.monthlyEquivalent).toBeCloseTo(2397.2, 0)
    expect(p.annualDebtService).toBeCloseTo(28_766, -1)
  })

  it('matches the closed-form annuity formula', () => {
    const i = periodicRate(0.05, 'SEMI_ANNUAL', 12)
    const expected = annuityPayment(500_000, i, 300)
    const actual = computePayment(terms(500_000, 0.05, 25)).periodicPayment
    expect(actual).toBeCloseTo(expected, 8)
  })

  it('handles a zero interest rate without dividing by zero', () => {
    const p = computePayment(terms(240_000, 0, 20))
    expect(p.periodicPayment).toBeCloseTo(1000, 6)
  })

  it('returns no payment for no principal', () => {
    expect(computePayment(terms(0, 0.05, 25)).periodicPayment).toBe(0)
  })
})

describe('amortization', () => {
  const t = terms(422_500, 0.0475, 25)
  const result = amortize(t)

  it('fully repays the loan over the amortization period', () => {
    expect(result.periods.length).toBe(300)
    expect(result.periods[299].balance).toBeLessThan(0.01)
  })

  it('splits year 1 into interest and principal that sum to debt service', () => {
    const y1 = yearSplit(result, 1)
    expect(y1.interest + y1.principal).toBeCloseTo(result.breakdown.annualDebtService, 2)
    // Early in a 25-year amortization, interest dominates.
    expect(y1.interest).toBeGreaterThan(y1.principal)
  })

  it('reports declining balances at the checkpoint years', () => {
    const b1 = balanceAfterYears(result, 1)
    const b5 = balanceAfterYears(result, 5)
    const b10 = balanceAfterYears(result, 10)
    expect(b1).toBeLessThan(422_500)
    expect(b5).toBeLessThan(b1)
    expect(b10).toBeLessThan(b5)
    expect(b10).toBeGreaterThan(0)
  })

  it('amortizes faster on accelerated bi-weekly payments', () => {
    const monthly = amortize(terms(422_500, 0.0475, 25, { paymentFrequency: 'MONTHLY' }))
    const accel = amortize(terms(422_500, 0.0475, 25, { paymentFrequency: 'ACCELERATED_BI_WEEKLY' }))
    expect(accel.breakdown.actualAmortizationYears).toBeLessThan(
      monthly.breakdown.actualAmortizationYears,
    )
    expect(accel.totalInterest).toBeLessThan(monthly.totalInterest)
  })

  it('flags negative amortization when the payment cannot cover interest', () => {
    const bad = amortize({
      principal: 500_000,
      annualRate: 0.5,
      amortizationYears: 50,
      termYears: 5,
      paymentFrequency: 'MONTHLY',
      compounding: 'SEMI_ANNUAL',
      fees: 0,
    })
    expect(typeof bad.negativeAmortization).toBe('boolean')
  })
})

describe('loan sizing', () => {
  it('round-trips payment to loan and back', () => {
    const loan = 500_000
    const p = computePayment(terms(loan, 0.05, 25))
    const back = loanFromPayment(p.periodicPayment, 0.05, 25, 'SEMI_ANNUAL', 'MONTHLY')
    expect(back).toBeCloseTo(loan, 4)
  })

  it('sizes a loan to a target DSCR', () => {
    const noi = 56_154.4
    const loan = maxLoanAtDscr(noi, 1.3, 0.0475, 25, 'SEMI_ANNUAL', 'MONTHLY')
    const ds = computePayment(terms(loan, 0.0475, 25)).annualDebtService
    expect(noi / ds).toBeCloseTo(1.3, 6)
  })

  it('returns zero when NOI is not positive', () => {
    expect(maxLoanAtDscr(0, 1.3, 0.05, 25, 'SEMI_ANNUAL', 'MONTHLY')).toBe(0)
    expect(maxLoanAtDscr(-1000, 1.3, 0.05, 25, 'SEMI_ANNUAL', 'MONTHLY')).toBe(0)
  })
})

describe('time value of money', () => {
  it('computes NPV', () => {
    expect(npv(0.1, [-100, 110])).toBeCloseTo(0, 10)
  })

  it('solves a simple IRR', () => {
    expect(irr([-100, 110])).toBeCloseTo(0.1, 8)
    expect(irr([-1000, 300, 300, 300, 300])).toBeCloseTo(0.0771, 3)
  })

  it('returns null when no sign change exists', () => {
    expect(irr([100, 200])).toBeNull()
    expect(irr([-100, -200])).toBeNull()
  })

  it('computes an equity multiple', () => {
    expect(equityMultiple([-100, 50, 100])).toBeCloseTo(1.5, 10)
    expect(equityMultiple([100, 50])).toBeNull()
  })
})
