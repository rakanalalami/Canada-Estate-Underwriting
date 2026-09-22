import { describe, expect, it } from 'vitest'
import { fmtCAD, fmtCADCompact, fmtPct, mean, median, parseNumeric, safeDiv } from '../money'

describe('parseNumeric — §30 natural number entry', () => {
  it('accepts every way a person types a price', () => {
    for (const input of ['650000', '650,000', '$650,000', 'C$650,000', '650 000', '650k', '0.65m']) {
      expect(parseNumeric(input)).toBe(650_000)
    }
  })

  it('handles negatives in both notations', () => {
    expect(parseNumeric('-1200')).toBe(-1200)
    expect(parseNumeric('(1,200)')).toBe(-1200)
  })

  it('distinguishes empty from zero', () => {
    expect(parseNumeric('')).toBeNull()
    expect(parseNumeric('   ')).toBeNull()
    expect(parseNumeric(null)).toBeNull()
    expect(parseNumeric('0')).toBe(0)
  })

  it('rejects text that is not a number', () => {
    expect(parseNumeric('abc')).toBeNull()
    expect(parseNumeric('1.2.3')).toBeNull()
  })

  it('strips a trailing percent sign', () => {
    expect(parseNumeric('6.5%')).toBe(6.5)
  })
})

describe('formatting', () => {
  it('always shows CAD', () => {
    expect(fmtCAD(650_000)).toBe('C$650,000')
    expect(fmtCAD(null)).toBe('—')
  })

  it('compacts large figures for charts', () => {
    expect(fmtCADCompact(650_000)).toBe('C$650k')
    expect(fmtCADCompact(1_200_000)).toBe('C$1.20M')
  })

  it('renders rates as percentages', () => {
    expect(fmtPct(0.0643)).toBe('6.43%')
  })
})

describe('statistics helpers', () => {
  it('guards division by zero', () => {
    expect(safeDiv(10, 0)).toBeNull()
    expect(safeDiv(10, 2)).toBe(5)
  })
  it('computes mean and median', () => {
    expect(mean([1, 2, 3])).toBe(2)
    expect(median([1, 2, 3, 4])).toBe(2.5)
    expect(mean([])).toBeNull()
  })
})

describe('negative currency formatting', () => {
  it('puts the sign ahead of the whole symbol, not inside it', () => {
    expect(fmtCAD(-8140)).toBe('-C$8,140')
    expect(fmtCAD(-8140.5, 2)).toBe('-C$8,140.50')
    expect(fmtCAD(0)).toBe('C$0')
    expect(fmtCADCompact(-1_200_000)).toBe('-C$1.20M')
  })
})
