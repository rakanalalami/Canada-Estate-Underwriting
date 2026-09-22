import { useMemo } from 'react'
import { useStore } from '@/store/useStore'
import { simulate, type SimProperty, type SimulatorSettings } from '@/engine/simulator'
import {
  appraisalStress,
  buildAutoProperties,
  interestRateStress,
  ltvStress,
  milestonesFrom,
  refinanceDelayStressSequence,
  rentStress,
} from '@/engine/simulatorExtras'
import { DEFAULT_RATE_SCENARIOS, DEFAULT_REFI_LTVS, DEFAULT_RENT_SCENARIOS } from '@/engine/metrics'

export function useSimulation() {
  const sim = useStore((s) => s.simulator)
  const profile = useStore((s) => s.profile)

  return useMemo(() => {
    const properties: SimProperty[] = sim.useAutoProjection
      ? buildAutoProperties({ ...sim.auto, maxProperties: Math.min(sim.auto.maxProperties, profile.maxProperties) })
      : sim.properties

    const settings: SimulatorSettings = {
      profile,
      appraisalCase: sim.appraisalCase,
      rentFactor: sim.rentFactor,
      rateOverride: sim.rateOverride,
      refinanceDelayOverride: sim.refinanceDelayOverride,
      ltvOverride: sim.ltvOverride,
      capexEvents: sim.capexEvents,
    }

    const result = simulate(properties, settings)

    return {
      properties,
      settings,
      result,
      milestones: milestonesFrom(result),
      rateStress: interestRateStress(properties, settings, DEFAULT_RATE_SCENARIOS),
      rentStressRows: rentStress(properties, settings, DEFAULT_RENT_SCENARIOS),
      delayStress: refinanceDelayStressSequence(properties, settings, [3, 6, 9, 12, 18]),
      appraisalStressRows: appraisalStress(properties, settings),
      ltvStressRows: ltvStress(properties, settings, DEFAULT_REFI_LTVS),
    }
  }, [sim, profile])
}
