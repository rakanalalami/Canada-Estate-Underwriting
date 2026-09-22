/**
 * Application state. Persisted to localStorage so an analysis survives a
 * refresh without any server or database — the whole app runs client-side.
 *
 * The store holds inputs only. Every derived figure comes from the pure engine
 * in src/engine, so there is exactly one implementation of each formula.
 */

import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import type { Deal, DealStatus, InvestorProfile, SourceRecord } from '@/engine/types'
import type { CapexEvent, SimProperty } from '@/engine/simulator'
import type { AutoProjectionAssumptions } from '@/engine/simulatorExtras'
import type { EndStateTarget } from '@/engine/simulatorExtras'
import { createDeal, defaultInvestorProfile, uid } from '@/data/defaults'
import { createSampleDeal } from '@/data/sampleDeal'

export type ThemeMode = 'light' | 'dark'

export interface SimulatorState {
  properties: SimProperty[]
  capexEvents: CapexEvent[]
  appraisalCase: 'LOW' | 'BASE' | 'HIGH'
  rentFactor: number
  rateOverride: number | null
  refinanceDelayOverride: number | null
  ltvOverride: number | null
  useAutoProjection: boolean
  auto: AutoProjectionAssumptions
  endState: EndStateTarget
}

interface StoreState {
  theme: ThemeMode
  deals: Deal[]
  activeDealId: string | null
  profile: InvestorProfile
  simulator: SimulatorState
  compareIds: string[]

  /* Deals */
  addDeal: (deal?: Partial<Deal>) => string
  addSampleDeal: () => string
  updateDeal: (id: string, patch: Partial<Deal>) => void
  patchDeal: (id: string, updater: (d: Deal) => Deal) => void
  deleteDeal: (id: string) => void
  duplicateDeal: (id: string) => string
  setActiveDeal: (id: string) => void
  setDealStatus: (id: string, status: DealStatus) => void
  archiveDeal: (id: string, archived: boolean) => void
  toggleInPortfolio: (id: string) => void
  addSource: (dealId: string, source: Partial<SourceRecord>) => void
  removeSource: (dealId: string, sourceId: string) => void

  /* Profile */
  setProfile: (patch: Partial<InvestorProfile>) => void

  /* Simulator */
  setSimulator: (patch: Partial<SimulatorState>) => void
  addSimProperty: (p?: Partial<SimProperty>) => void
  updateSimProperty: (id: string, patch: Partial<SimProperty>) => void
  removeSimProperty: (id: string) => void
  moveSimProperty: (id: string, direction: -1 | 1) => void
  syncSimPropertyFromDeal: (simId: string, dealId: string) => void
  addCapexEvent: (e?: Partial<CapexEvent>) => void
  updateCapexEvent: (id: string, patch: Partial<CapexEvent>) => void
  removeCapexEvent: (id: string) => void

  /* Compare */
  toggleCompare: (id: string) => void
  clearCompare: () => void

  setTheme: (t: ThemeMode) => void
  resetAll: () => void
}

const DEFAULT_SIM_VACANCY = 0.03
const DEFAULT_SIM_OPEX_RATIO = 0.3
const DEFAULT_SIM_CAP_RATE = 0.065

/**
 * Gross rent that delivers a given cap rate at a given price, so the seeded
 * simulator properties are internally consistent rather than arbitrary:
 *   NOI = price x cap,  EGI = NOI / (1 - opex),  GSI = EGI / (1 - vacancy)
 */
function grossRentForCapRate(price: number, cap = DEFAULT_SIM_CAP_RATE): number {
  const noi = price * cap
  const egi = noi / (1 - DEFAULT_SIM_OPEX_RATIO)
  return Math.round(egi / (1 - DEFAULT_SIM_VACANCY))
}

export function defaultSimProperty(index: number, overrides: Partial<SimProperty> = {}): SimProperty {
  const price = overrides.purchasePrice ?? 650_000
  const gross = grossRentForCapRate(price)
  return {
    id: uid('sim'),
    name: `Property ${index}`,
    linkedDealId: null,
    purchasePrice: price,
    closingCosts: Math.round(price * 0.031),
    renovationCosts: 0,
    units: 3,
    stabilizedGrossAnnualRent: gross,
    currentGrossAnnualRent: Math.round(gross * 0.96),
    vacancyPercent: DEFAULT_SIM_VACANCY,
    operatingExpenseRatio: DEFAULT_SIM_OPEX_RATIO,
    operatingExpensesAnnual: 0,
    monthsToStabilization: 4,
    monthsUntilRefinance: 6,
    // The appraisal never defaults above the purchase price (§27, §40.25).
    appraisalLow: Math.round(price * 0.95),
    appraisalBase: price,
    appraisalHigh: Math.round(price * 1.05),
    refinanceLtv: 0.65,
    refinanceRate: 0.0475,
    refinanceAmortizationYears: 25,
    refinanceTermYears: 5,
    refinanceCosts: 3_300,
    paymentFrequency: 'MONTHLY',
    compounding: 'SEMI_ANNUAL',
    neighbourhood: 'Overbrook',
    propertyType: 'Triplex',
    gapMonthsAfterRefinance: 1,
    enabled: true,
    ...overrides,
  }
}

function defaultAuto(): AutoProjectionAssumptions {
  return {
    averagePurchasePrice: 650_000,
    averageCapRate: 0.065,
    averageUnits: 3,
    averageClosingCostPercent: 0.03,
    averageRenovationBudget: 10_000,
    averageAppraisalFactor: 1,
    averageRefinanceLtv: 0.65,
    averageMortgageRate: 0.0475,
    averageAmortizationYears: 25,
    averageRefinanceCosts: 3_300,
    averageMonthsToRefinance: 6,
    averageMonthsBetweenAcquisitions: 1,
    averageVacancy: 0.03,
    averageOperatingExpenseRatio: 0.32,
    maxProperties: 5,
  }
}

function defaultEndState(): EndStateTarget {
  return {
    properties: 4,
    units: 12,
    portfolioValue: 3_000_000,
    portfolioDebt: 1_700_000,
    portfolioEquity: 1_300_000,
    monthlyCashFlow: 6_500,
  }
}

function defaultSimulatorState(): SimulatorState {
  return {
    // A realistic stepped sequence: the second purchase must be smaller than
    // the first because only part of the capital comes back at 65% LTV.
    properties: [650_000, 620_000, 575_000].map((price, i) =>
      defaultSimProperty(i + 1, { purchasePrice: price }),
    ),
    capexEvents: [],
    appraisalCase: 'BASE',
    rentFactor: 1,
    rateOverride: null,
    refinanceDelayOverride: null,
    ltvOverride: null,
    useAutoProjection: false,
    auto: defaultAuto(),
    endState: defaultEndState(),
  }
}

/**
 * Bump this whenever stored state should be discarded rather than reused —
 * see the `migrate` note on the persist config below.
 */
const PERSIST_VERSION = 2

const touched = (d: Deal): Deal => ({ ...d, updatedAt: new Date().toISOString() })

/**
 * Fill any block a stored deal is missing from the current defaults.
 *
 * Stored state is only as trustworthy as the version of the app that wrote it.
 * A deal saved by an older build — or edited by hand, or half-written when a
 * tab was closed — can be missing whole sections, and reading through to
 * `deal.financing.structure` on one of those takes the entire app down to a
 * blank page. Reconciling on hydration keeps a partial record usable instead.
 */
function reconcileDeal(stored: Partial<Deal> | null | undefined): Deal | null {
  if (!stored || typeof stored !== 'object' || !stored.id) return null
  const base = createDeal()
  return {
    ...base,
    ...stored,
    id: stored.id,
    info: { ...base.info, ...(stored.info ?? {}) },
    legal: { ...base.legal, ...(stored.legal ?? {}) },
    ratings: { ...base.ratings, ...(stored.ratings ?? {}) },
    financing: { ...base.financing, ...(stored.financing ?? {}) },
    refinance: { ...base.refinance, ...(stored.refinance ?? {}) },
    projection: { ...base.projection, ...(stored.projection ?? {}) },
    purchaseCosts: { ...base.purchaseCosts, ...(stored.purchaseCosts ?? {}) },
    scenarios: { ...base.scenarios, ...(stored.scenarios ?? {}) },
    expenses: {
      ...base.expenses,
      ...(stored.expenses ?? {}),
      deductions: { ...base.expenses.deductions, ...(stored.expenses?.deductions ?? {}) },
      lines: stored.expenses?.lines?.length ? stored.expenses.lines : base.expenses.lines,
    },
    components: stored.components?.length ? stored.components : base.components,
    units: Array.isArray(stored.units) ? stored.units : [],
    rentComps: Array.isArray(stored.rentComps) ? stored.rentComps : [],
    saleComps: Array.isArray(stored.saleComps) ? stored.saleComps : [],
    dealBreakers: stored.dealBreakers?.length ? stored.dealBreakers : base.dealBreakers,
    sources: Array.isArray(stored.sources) ? stored.sources : [],
  }
}

export const useStore = create<StoreState>()(
  persist(
    (set, get) => ({
      theme:
        typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: dark)').matches
          ? 'dark'
          : 'light',
      deals: [],
      activeDealId: null,
      profile: defaultInvestorProfile(),
      simulator: defaultSimulatorState(),
      compareIds: [],

      addDeal: (partial) => {
        const deal = createDeal(partial)
        set((s) => ({ deals: [...s.deals, deal], activeDealId: deal.id }))
        return deal.id
      },

      addSampleDeal: () => {
        const deal = createSampleDeal()
        set((s) => ({ deals: [...s.deals, deal], activeDealId: deal.id }))
        return deal.id
      },

      updateDeal: (id, patch) =>
        set((s) => ({
          deals: s.deals.map((d) => (d.id === id ? touched({ ...d, ...patch }) : d)),
        })),

      patchDeal: (id, updater) =>
        set((s) => ({
          deals: s.deals.map((d) => (d.id === id ? touched(updater(d)) : d)),
        })),

      deleteDeal: (id) =>
        set((s) => {
          const deals = s.deals.filter((d) => d.id !== id)
          return {
            deals,
            activeDealId: s.activeDealId === id ? (deals[0]?.id ?? null) : s.activeDealId,
            compareIds: s.compareIds.filter((c) => c !== id),
          }
        }),

      duplicateDeal: (id) => {
        const source = get().deals.find((d) => d.id === id)
        if (!source) return id
        const copy: Deal = {
          ...structuredClone(source),
          id: uid('deal'),
          name: `${source.name} (copy)`,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          inPortfolio: false,
        }
        set((s) => ({ deals: [...s.deals, copy], activeDealId: copy.id }))
        return copy.id
      },

      setActiveDeal: (id) => set({ activeDealId: id }),

      setDealStatus: (id, status) =>
        set((s) => ({ deals: s.deals.map((d) => (d.id === id ? touched({ ...d, status }) : d)) })),

      archiveDeal: (id, archived) =>
        set((s) => ({ deals: s.deals.map((d) => (d.id === id ? touched({ ...d, archived }) : d)) })),

      toggleInPortfolio: (id) =>
        set((s) => ({
          deals: s.deals.map((d) => (d.id === id ? touched({ ...d, inPortfolio: !d.inPortfolio }) : d)),
        })),

      addSource: (dealId, source) =>
        set((s) => ({
          deals: s.deals.map((d) =>
            d.id === dealId
              ? touched({
                  ...d,
                  sources: [
                    ...d.sources,
                    {
                      id: uid('src'),
                      field: '',
                      label: '',
                      origin: 'USER_INPUT',
                      source: '',
                      url: '',
                      retrievedAt: new Date().toISOString().slice(0, 10),
                      manual: true,
                      note: '',
                      ...source,
                    },
                  ],
                })
              : d,
          ),
        })),

      removeSource: (dealId, sourceId) =>
        set((s) => ({
          deals: s.deals.map((d) =>
            d.id === dealId ? touched({ ...d, sources: d.sources.filter((x) => x.id !== sourceId) }) : d,
          ),
        })),

      setProfile: (patch) => set((s) => ({ profile: { ...s.profile, ...patch } })),

      setSimulator: (patch) => set((s) => ({ simulator: { ...s.simulator, ...patch } })),

      addSimProperty: (p) =>
        set((s) => ({
          simulator: {
            ...s.simulator,
            properties: [...s.simulator.properties, defaultSimProperty(s.simulator.properties.length + 1, p)],
          },
        })),

      updateSimProperty: (id, patch) =>
        set((s) => ({
          simulator: {
            ...s.simulator,
            properties: s.simulator.properties.map((p) => (p.id === id ? { ...p, ...patch } : p)),
          },
        })),

      removeSimProperty: (id) =>
        set((s) => ({
          simulator: { ...s.simulator, properties: s.simulator.properties.filter((p) => p.id !== id) },
        })),

      moveSimProperty: (id, direction) =>
        set((s) => {
          const list = [...s.simulator.properties]
          const i = list.findIndex((p) => p.id === id)
          const j = i + direction
          if (i < 0 || j < 0 || j >= list.length) return s
          ;[list[i], list[j]] = [list[j], list[i]]
          return { simulator: { ...s.simulator, properties: list } }
        }),

      /**
       * Pull a simulator slot's economics from a fully underwritten deal
       * (§40.2 "each property must inherit its own complete underwriting
       * model"). Only the inputs are copied — the maths still runs in the
       * engine.
       */
      syncSimPropertyFromDeal: (simId, dealId) => {
        const deal = get().deals.find((d) => d.id === dealId)
        if (!deal) return
        const price = deal.info.offerPrice || deal.info.askingPrice
        const grossMonthly = deal.units.reduce(
          (sum, u) =>
            sum +
            (u.occupied ? u.currentRent : 0) +
            u.parkingIncome +
            u.storageIncome +
            u.laundryIncome +
            u.otherIncome,
          0,
        )
        const marketMonthly = deal.units.reduce(
          (sum, u) =>
            sum +
            Math.max(u.marketRent, u.occupied ? u.currentRent : 0) +
            Math.max(u.parkingIncomeMarket, u.parkingIncome) +
            Math.max(u.storageIncomeMarket, u.storageIncome) +
            Math.max(u.laundryIncomeMarket, u.laundryIncome) +
            Math.max(u.otherIncomeMarket, u.otherIncome),
          0,
        )
        get().updateSimProperty(simId, {
          linkedDealId: dealId,
          name: deal.name,
          purchasePrice: price,
          units: deal.units.length,
          currentGrossAnnualRent: grossMonthly * 12,
          stabilizedGrossAnnualRent: marketMonthly * 12,
          vacancyPercent: deal.expenses.deductions.vacancyPercent,
          appraisalLow: deal.refinance.appraisalLow,
          appraisalBase: deal.refinance.appraisalBase,
          appraisalHigh: deal.refinance.appraisalHigh,
          refinanceLtv: deal.refinance.ltv,
          refinanceRate: deal.refinance.annualRate,
          refinanceAmortizationYears: deal.refinance.amortizationYears,
          refinanceTermYears: deal.refinance.termYears,
          refinanceCosts:
            deal.refinance.refinanceFees +
            deal.refinance.legalFees +
            deal.refinance.appraisalFee +
            deal.refinance.otherLenderCosts,
          monthsUntilRefinance: deal.refinance.monthsUntilRefinance,
          renovationCosts: deal.purchaseCosts.immediateRenovationBudget,
          neighbourhood: deal.info.neighbourhood,
          propertyType: deal.info.propertyType,
        })
      },

      addCapexEvent: (e) =>
        set((s) => ({
          simulator: {
            ...s.simulator,
            capexEvents: [
              ...s.simulator.capexEvents,
              {
                id: uid('capex'),
                label: 'Roof replacement',
                amount: 20_000,
                month: 12,
                propertyId: '',
                enabled: true,
                ...e,
              },
            ],
          },
        })),

      updateCapexEvent: (id, patch) =>
        set((s) => ({
          simulator: {
            ...s.simulator,
            capexEvents: s.simulator.capexEvents.map((c) => (c.id === id ? { ...c, ...patch } : c)),
          },
        })),

      removeCapexEvent: (id) =>
        set((s) => ({
          simulator: { ...s.simulator, capexEvents: s.simulator.capexEvents.filter((c) => c.id !== id) },
        })),

      toggleCompare: (id) =>
        set((s) => ({
          compareIds: s.compareIds.includes(id)
            ? s.compareIds.filter((c) => c !== id)
            : [...s.compareIds, id],
        })),

      clearCompare: () => set({ compareIds: [] }),

      setTheme: (theme) => {
        set({ theme })
        if (typeof document !== 'undefined') {
          document.documentElement.classList.toggle('dark', theme === 'dark')
          try {
            localStorage.setItem('oua.theme', theme)
          } catch {
            /* private mode — the class is still applied for this session */
          }
        }
      },

      resetAll: () =>
        set({
          deals: [],
          activeDealId: null,
          profile: defaultInvestorProfile(),
          simulator: defaultSimulatorState(),
          compareIds: [],
        }),
    }),
    {
      name: 'ottawa-underwriting-v1',
      storage: createJSONStorage(() => localStorage),
      version: PERSIST_VERSION,
      /**
       * Anything saved before PERSIST_VERSION 2 is discarded rather than
       * carried forward.
       *
       * Deals created before the appraisal fix stored a seeded C$650,000
       * refinance appraisal regardless of price, which produced a phantom
       * mortgage and phantom refinance proceeds. Repairing that in place would
       * leave other pre-fix assumptions silently in the data, so the stored
       * state is reset instead. Only the colour theme survives, because it is a
       * display preference rather than underwriting data.
       */
      migrate: (persisted, fromVersion) => {
        if (fromVersion >= PERSIST_VERSION) return persisted as Partial<StoreState>
        const theme = (persisted as Partial<StoreState> | undefined)?.theme
        return {
          ...(theme ? { theme } : {}),
          deals: [],
          activeDealId: null,
          profile: defaultInvestorProfile(),
          simulator: defaultSimulatorState(),
          compareIds: [],
        } satisfies Partial<StoreState>
      },
      /**
       * Reconcile each stored deal against the current shape before it reaches
       * the UI, so a partial record degrades to usable defaults rather than
       * crashing the render.
       */
      merge: (persisted, current) => {
        const incoming = (persisted ?? {}) as Partial<StoreState>
        const deals = Array.isArray(incoming.deals)
          ? incoming.deals.map(reconcileDeal).filter((d): d is Deal => d !== null)
          : current.deals
        const activeDealId =
          incoming.activeDealId && deals.some((d) => d.id === incoming.activeDealId)
            ? incoming.activeDealId
            : (deals[0]?.id ?? null)
        return {
          ...current,
          ...incoming,
          deals,
          activeDealId,
          profile: { ...current.profile, ...(incoming.profile ?? {}) },
          simulator: { ...current.simulator, ...(incoming.simulator ?? {}) },
          compareIds: (incoming.compareIds ?? []).filter((id) => deals.some((d) => d.id === id)),
        }
      },
      partialize: (s) => ({
        theme: s.theme,
        deals: s.deals,
        activeDealId: s.activeDealId,
        profile: s.profile,
        simulator: s.simulator,
        compareIds: s.compareIds,
      }),
    },
  ),
)

export function useActiveDeal(): Deal | null {
  return useStore((s) => s.deals.find((d) => d.id === s.activeDealId) ?? null)
}
