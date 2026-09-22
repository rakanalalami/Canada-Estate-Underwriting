import { useStore } from '@/store/useStore'
import { Callout, Panel } from '@/components/ui/primitives'
import { NEW_DEAL_ROUTE, goTo } from '@/lib/navigate'

export function WelcomeScreen() {
  const addDeal = useStore((s) => s.addDeal)
  const addSample = useStore((s) => s.addSampleDeal)
  const deals = useStore((s) => s.deals)

  return (
    <div className="mx-auto max-w-3xl space-y-5 py-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Ottawa small multifamily underwriting</h1>
        <p className="mt-2 text-sm leading-relaxed text-muted">
          Enter a listing and get the real cap rate, the current and stabilized NOI, what you should
          offer, how much you can refinance out, and how many properties it takes to reach your
          monthly income target. Every number can be expanded to show the arithmetic behind it.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <button
          className="btn-primary justify-start px-4 py-3 text-left"
          onClick={() => {
            addDeal()
            goTo(NEW_DEAL_ROUTE)
          }}
        >
          <div>
            <div className="text-sm font-semibold">Start a new deal</div>
            <div className="mt-0.5 text-2xs font-normal opacity-80">
              Opens the property form — address, price and units first
            </div>
          </div>
        </button>
        <button
          className="btn justify-start px-4 py-3 text-left"
          onClick={() => {
            addSample()
            goTo('dashboard')
          }}
        >
          <div>
            <div className="text-sm font-semibold">Load the worked example</div>
            <div className="mt-0.5 text-2xs font-normal text-muted">
              C$650,000 Overbrook triplex, C$2,250/unit
            </div>
          </div>
        </button>
      </div>

      {deals.length > 0 && (
        <Callout tone="info" title="You have saved deals">
          Pick one from the sidebar, or open <a className="underline" href="#/deals">All deals</a>.
        </Callout>
      )}

      <Panel title="What this tool will not do">
        <ul className="space-y-2 text-xs leading-relaxed text-muted">
          <li>
            <strong className="text-ink">It will not swap a sitting tenant's rent for market rent.</strong>{' '}
            Current and stabilized income are always separate figures. Ontario rent control means a
            below-market rent closes on turnover or by the annual guideline, not on closing.
          </li>
          <li>
            <strong className="text-ink">It will not price a vacant unit at the best comparable.</strong>{' '}
            Suggested rents are the 25th percentile, median and 75th percentile of the comparables you
            enter. The highest is shown for reference only.
          </li>
          <li>
            <strong className="text-ink">It will not count a non-conforming unit in the conservative case</strong>{' '}
            unless you explicitly choose to, and it says so loudly when you do.
          </li>
          <li>
            <strong className="text-ink">It will not assume the refinance appraisal beats the purchase price,</strong>{' '}
            or that the lender's maximum LTV is achievable. Low, base and high appraisals are all run.
          </li>
          <li>
            <strong className="text-ink">It will not call mortgage principal "cash flow",</strong> or dress
            up a weak deal with an appreciation assumption. Cash and non-cash returns are labelled
            separately everywhere.
          </li>
        </ul>
      </Panel>

      <p className="text-2xs leading-relaxed text-subtle">
        All data stays in this browser's local storage. Nothing is uploaded. Figures are in Canadian
        dollars and mortgages use the Canadian semi-annual compounding convention by default. This is
        an analysis tool, not financial, tax or legal advice — verify every assumption before you
        firm up an offer.
      </p>
    </div>
  )
}
