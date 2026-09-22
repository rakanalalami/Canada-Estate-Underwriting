import { useEffect, useState } from 'react'
import { ROUTES, ROUTE_GROUPS, routeFromHash } from '@/lib/routes'
import { useActiveDeal, useStore } from '@/store/useStore'
import { useUnderwriting } from '@/lib/useUnderwriting'
import { cx } from '@/components/ui/primitives'
import { TopBar } from '@/components/TopBar'
import { DealPicker } from '@/components/DealPicker'
import { PageHeader } from '@/components/PageHeader'
import { WelcomeScreen } from '@/components/WelcomeScreen'

import DashboardPage from '@/pages/DashboardPage'
import PropertyPage from '@/pages/PropertyPage'
import RentRollPage from '@/pages/RentRollPage'
import ExpensesPage from '@/pages/ExpensesPage'
import NoiPage from '@/pages/NoiPage'
import AcquisitionPage from '@/pages/AcquisitionPage'
import RefinancePage from '@/pages/RefinancePage'
import CashFlowPage from '@/pages/CashFlowPage'
import OfferPage from '@/pages/OfferPage'
import ProjectionPage from '@/pages/ProjectionPage'
import SensitivityPage from '@/pages/SensitivityPage'
import ComparablesPage from '@/pages/ComparablesPage'
import RiskPage from '@/pages/RiskPage'
import SourcesPage from '@/pages/SourcesPage'
import SimulatorPage from '@/pages/SimulatorPage'
import FirstDealPage from '@/pages/FirstDealPage'
import PortfolioPage from '@/pages/PortfolioPage'
import ComparePage from '@/pages/ComparePage'
import DealsPage from '@/pages/DealsPage'
import SettingsPage from '@/pages/SettingsPage'

export default function App() {
  const [route, setRoute] = useState(() => routeFromHash())
  const [navOpen, setNavOpen] = useState(false)
  const deals = useStore((s) => s.deals)
  const theme = useStore((s) => s.theme)
  const deal = useActiveDeal()
  const result = useUnderwriting(deal)

  useEffect(() => {
    const onHash = () => {
      setRoute(routeFromHash())
      setNavOpen(false)
      window.scrollTo({ top: 0 })
    }
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark')
  }, [theme])

  const def = ROUTES.find((r) => r.key === route) ?? ROUTES[0]
  const blocked = def.needsDeal && !deal

  return (
    <div className="flex min-h-screen flex-col bg-canvas">
      <TopBar onToggleNav={() => setNavOpen((o) => !o)} route={route} />

      <div className="flex flex-1">
        {/* Sidebar */}
        <nav
          className={cx(
            'no-print fixed inset-y-0 left-0 z-30 w-60 shrink-0 overflow-y-auto border-r border-line bg-surface pt-14 transition-transform lg:sticky lg:top-0 lg:h-screen lg:translate-x-0',
            navOpen ? 'translate-x-0' : '-translate-x-full',
          )}
        >
          <div className="px-3 py-4">
            <DealPicker />
          </div>
          <div className="px-2 pb-8">
            {ROUTE_GROUPS.map((g) => (
              <div key={g.key} className="mb-4">
                <div className="px-3 pb-1.5 text-2xs font-semibold uppercase tracking-wider text-subtle">
                  {g.label}
                </div>
                <ul className="space-y-px">
                  {ROUTES.filter((r) => r.group === g.key).map((r) => {
                    const disabled = r.needsDeal && !deal
                    return (
                      <li key={r.key}>
                        <a
                          href={`#/${r.key}`}
                          title={r.hint}
                          aria-current={route === r.key ? 'page' : undefined}
                          className={cx(
                            'flex items-center justify-between rounded-md px-3 py-1.5 text-sm transition-colors',
                            route === r.key
                              ? 'bg-accent/10 font-medium text-accent'
                              : 'text-muted hover:bg-raised hover:text-ink',
                            disabled && 'pointer-events-none opacity-40',
                          )}
                        >
                          <span>{r.label}</span>
                          <span className="text-2xs text-subtle">{r.spec.split(' · ')[0]}</span>
                        </a>
                      </li>
                    )
                  })}
                </ul>
              </div>
            ))}
          </div>
        </nav>

        {navOpen && (
          <button
            aria-label="Close navigation"
            className="fixed inset-0 z-20 bg-ink/30 lg:hidden"
            onClick={() => setNavOpen(false)}
          />
        )}

        {/* Main */}
        <main className="min-w-0 flex-1 pt-14">
          <div className="mx-auto w-full max-w-[1500px] px-4 py-5 sm:px-6 lg:px-8">
            {deals.length === 0 && def.needsDeal ? (
              <WelcomeScreen />
            ) : blocked ? (
              <WelcomeScreen />
            ) : (
              <>
                <PageHeader def={def} />
                <Body route={route} deal={deal} result={result} />
              </>
            )}
          </div>
        </main>
      </div>
    </div>
  )
}

function Body({
  route,
  deal,
  result,
}: {
  route: string
  deal: ReturnType<typeof useActiveDeal>
  result: ReturnType<typeof useUnderwriting>
}) {
  // Deal-scoped pages get a guaranteed non-null deal + result.
  if (deal && result) {
    switch (route) {
      case 'dashboard':
        return <DashboardPage deal={deal} r={result} />
      case 'property':
        return <PropertyPage deal={deal} r={result} />
      case 'rent-roll':
        return <RentRollPage deal={deal} r={result} />
      case 'expenses':
        return <ExpensesPage deal={deal} r={result} />
      case 'noi':
        return <NoiPage deal={deal} r={result} />
      case 'acquisition':
        return <AcquisitionPage deal={deal} r={result} />
      case 'refinance':
        return <RefinancePage deal={deal} r={result} />
      case 'cashflow':
        return <CashFlowPage deal={deal} r={result} />
      case 'offer':
        return <OfferPage deal={deal} r={result} />
      case 'projection':
        return <ProjectionPage deal={deal} r={result} />
      case 'sensitivity':
        return <SensitivityPage deal={deal} r={result} />
      case 'comparables':
        return <ComparablesPage deal={deal} r={result} />
      case 'risk':
        return <RiskPage deal={deal} r={result} />
      case 'sources':
        return <SourcesPage deal={deal} r={result} />
    }
  }

  switch (route) {
    case 'simulator':
      return <SimulatorPage />
    case 'first-deal':
      return <FirstDealPage />
    case 'portfolio':
      return <PortfolioPage />
    case 'compare':
      return <ComparePage />
    case 'deals':
      return <DealsPage />
    case 'settings':
      return <SettingsPage />
    default:
      return <WelcomeScreen />
  }
}
