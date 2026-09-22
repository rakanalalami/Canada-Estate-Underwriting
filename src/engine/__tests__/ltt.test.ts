import { describe, expect, it } from 'vitest'
import { ontarioLandTransferTax } from '../ltt'

describe('Ontario land transfer tax', () => {
  it('computes the §38 triplex at C$650,000', () => {
    const r = ontarioLandTransferTax({
      price: 650_000,
      unitCount: 3,
      propertyType: 'TRIPLEX',
      city: 'Ottawa',
    })
    // 0.5%*55,000 + 1%*195,000 + 1.5%*150,000 + 2%*250,000
    expect(r.provincial).toBeCloseTo(9_475, 6)
    expect(r.total).toBeCloseTo(9_475, 6)
  })

  it('never applies a municipal land transfer tax in Ottawa', () => {
    const r = ontarioLandTransferTax({
      price: 900_000,
      unitCount: 4,
      propertyType: 'FOURPLEX',
      city: 'Ottawa',
    })
    expect(r.municipal).toBe(0)
    expect(r.total).toBe(r.provincial)
  })

  it('caps the top band at 2% for 3+ unit multi-residential', () => {
    const triplex = ontarioLandTransferTax({
      price: 3_000_000,
      unitCount: 3,
      propertyType: 'TRIPLEX',
      city: 'Ottawa',
    })
    const duplex = ontarioLandTransferTax({
      price: 3_000_000,
      unitCount: 2,
      propertyType: 'DUPLEX',
      city: 'Ottawa',
    })
    expect(triplex.topRateCappedAtTwoPercent).toBe(true)
    expect(duplex.topRateCappedAtTwoPercent).toBe(false)
    // The duplex pays the extra 0.5% on the amount above C$2M.
    expect(duplex.provincial - triplex.provincial).toBeCloseTo(1_000_000 * 0.005, 6)
  })

  it('handles small prices inside the first bracket', () => {
    const r = ontarioLandTransferTax({
      price: 40_000,
      unitCount: 2,
      propertyType: 'DUPLEX',
      city: 'Ottawa',
    })
    expect(r.provincial).toBeCloseTo(200, 6)
  })

  it('adds NRST only when explicitly selected', () => {
    const without = ontarioLandTransferTax({ price: 650_000, unitCount: 3, propertyType: 'TRIPLEX', city: 'Ottawa' })
    const with_ = ontarioLandTransferTax({
      price: 650_000,
      unitCount: 3,
      propertyType: 'TRIPLEX',
      city: 'Ottawa',
      nonResidentPurchaser: true,
    })
    expect(without.nrst).toBe(0)
    expect(with_.nrst).toBeCloseTo(162_500, 6)
  })
})
