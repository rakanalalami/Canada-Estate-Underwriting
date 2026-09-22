import { useMemo } from 'react'
import type {
  ComponentNote,
  Deal,
  ExpenseLine,
  FinancingPlan,
  LegalProfile,
  MarketRatings,
  ProjectionAssumptions,
  PropertyInfo,
  PurchaseCosts,
  RefinancePlan,
  RentComp,
  SaleComp,
  ScenarioSettings,
  Unit,
} from '@/engine/types'
import { useStore } from '@/store/useStore'
import { uid } from '@/data/defaults'

/** Typed field editors for the active deal. */
export function useDealEdit(dealId: string) {
  const patchDeal = useStore((s) => s.patchDeal)

  return useMemo(
    () => ({
      deal: (patch: Partial<Deal>) => patchDeal(dealId, (d) => ({ ...d, ...patch })),

      info: (patch: Partial<PropertyInfo>) =>
        patchDeal(dealId, (d) => ({ ...d, info: { ...d.info, ...patch } })),

      purchaseCosts: (patch: Partial<PurchaseCosts>) =>
        patchDeal(dealId, (d) => ({ ...d, purchaseCosts: { ...d.purchaseCosts, ...patch } })),

      financing: (patch: Partial<FinancingPlan>) =>
        patchDeal(dealId, (d) => ({ ...d, financing: { ...d.financing, ...patch } })),

      refinance: (patch: Partial<RefinancePlan>) =>
        patchDeal(dealId, (d) => ({ ...d, refinance: { ...d.refinance, ...patch } })),

      projection: (patch: Partial<ProjectionAssumptions>) =>
        patchDeal(dealId, (d) => ({ ...d, projection: { ...d.projection, ...patch } })),

      legal: (patch: Partial<LegalProfile>) =>
        patchDeal(dealId, (d) => ({ ...d, legal: { ...d.legal, ...patch } })),

      ratings: (patch: Partial<MarketRatings>) =>
        patchDeal(dealId, (d) => ({ ...d, ratings: { ...d.ratings, ...patch } })),

      scenarios: (patch: Partial<ScenarioSettings>) =>
        patchDeal(dealId, (d) => ({ ...d, scenarios: { ...d.scenarios, ...patch } })),

      /* Units */
      unit: (unitId: string, patch: Partial<Unit>) =>
        patchDeal(dealId, (d) => ({
          ...d,
          units: d.units.map((u) => (u.id === unitId ? { ...u, ...patch } : u)),
        })),

      addUnit: (unit: Unit) =>
        patchDeal(dealId, (d) => ({ ...d, units: [...d.units, unit] })),

      removeUnit: (unitId: string) =>
        patchDeal(dealId, (d) => ({ ...d, units: d.units.filter((u) => u.id !== unitId) })),

      /* Expenses */
      expenseLine: (key: string, patch: Partial<ExpenseLine>) =>
        patchDeal(dealId, (d) => ({
          ...d,
          expenses: {
            ...d.expenses,
            lines: d.expenses.lines.map((l) => (l.key === key ? { ...l, ...patch } : l)),
          },
        })),

      expenses: (patch: Partial<Deal['expenses']>) =>
        patchDeal(dealId, (d) => ({ ...d, expenses: { ...d.expenses, ...patch } })),

      deductions: (patch: Partial<Deal['expenses']['deductions']>) =>
        patchDeal(dealId, (d) => ({
          ...d,
          expenses: { ...d.expenses, deductions: { ...d.expenses.deductions, ...patch } },
        })),

      /* Components */
      component: (key: string, patch: Partial<ComponentNote>) =>
        patchDeal(dealId, (d) => ({
          ...d,
          components: d.components.map((c) => (c.key === key ? { ...c, ...patch } : c)),
        })),

      /* Comparables */
      addRentComp: () =>
        patchDeal(dealId, (d) => ({
          ...d,
          rentComps: [
            ...d.rentComps,
            {
              id: uid('rc'),
              address: '',
              distanceKm: 0,
              neighbourhood: d.info.neighbourhood,
              unitType: '',
              bedrooms: 2,
              bathrooms: 1,
              sqFt: 0,
              monthlyRent: 0,
              parkingIncluded: false,
              utilitiesIncluded: [],
              furnished: false,
              condition: '',
              listingDate: '',
              sourceUrl: '',
              include: true,
            } satisfies RentComp,
          ],
        })),

      rentComp: (id: string, patch: Partial<RentComp>) =>
        patchDeal(dealId, (d) => ({
          ...d,
          rentComps: d.rentComps.map((c) => (c.id === id ? { ...c, ...patch } : c)),
        })),

      removeRentComp: (id: string) =>
        patchDeal(dealId, (d) => ({ ...d, rentComps: d.rentComps.filter((c) => c.id !== id) })),

      addSaleComp: () =>
        patchDeal(dealId, (d) => ({
          ...d,
          saleComps: [
            ...d.saleComps,
            {
              id: uid('sc'),
              address: '',
              price: 0,
              units: 3,
              buildingSqFt: 0,
              lotSqFt: 0,
              yearBuilt: null,
              grossAnnualRent: 0,
              noi: 0,
              saleDate: '',
              distanceKm: 0,
              source: '',
              include: true,
            } satisfies SaleComp,
          ],
        })),

      saleComp: (id: string, patch: Partial<SaleComp>) =>
        patchDeal(dealId, (d) => ({
          ...d,
          saleComps: d.saleComps.map((c) => (c.id === id ? { ...c, ...patch } : c)),
        })),

      removeSaleComp: (id: string) =>
        patchDeal(dealId, (d) => ({ ...d, saleComps: d.saleComps.filter((c) => c.id !== id) })),

      /* Deal breakers */
      dealBreaker: (key: string, patch: Partial<Deal['dealBreakers'][number]>) =>
        patchDeal(dealId, (d) => ({
          ...d,
          dealBreakers: d.dealBreakers.map((r) => (r.key === key ? { ...r, ...patch } : r)),
        })),
    }),
    [dealId, patchDeal],
  )
}
