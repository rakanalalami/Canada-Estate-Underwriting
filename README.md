# Ottawa Underwriting

Institutional-grade investment underwriting for small multifamily property in
Ottawa, Ontario — duplexes, triplexes, fourplexes, 5+ unit buildings and houses
with legal secondary dwellings.

It is built around one strategy:

```
BUY CASH → STABILIZE → REFINANCE → EXTRACT CAPITAL → BUY NEXT → REPEAT
```

Everything is in Canadian dollars. Nothing leaves the browser.

---

## What it answers

Enter a listing and, within minutes:

| Question | Where |
| --- | --- |
| What is the *real* cap rate? | NOI & cap rate |
| What is current vs stabilized NOI? | NOI & cap rate |
| How much should I offer? | Offer analysis |
| What is my monthly cash flow? | Cash flow & returns |
| What if rates rise or rent falls 5%? | Sensitivity |
| What large repairs might hurt this? | Scorecard & risk |
| Can the property support its mortgage? | Cash flow & returns |
| How much can I refinance, and extract? | Refinance |
| How much cash stays trapped? | Refinance |
| Can the released cash buy property #2? | Capital recycling |
| How many properties reach C$5–7k/month? | Capital recycling |
| What is my 5- and 10-year equity? | Projection |
| Is the return real cash or assumed appreciation? | Cash flow & returns |
| Is the property legally configured for this income? | Property |
| How does this compare with my other deals? | Compare deals |

---

## The rules the engine enforces

These are structural, not cosmetic — they are implemented in the pure engine and
covered by tests, so no part of the UI can bypass them.

- **Current and stabilized income are always separate figures.** A sitting
  tenant's below-market rent is never silently replaced with market rent.
  Ontario caps annual increases for existing tenants at the provincial
  guideline; the gap closes on turnover, not on closing.
- **Vacant units are never priced at the best comparable.** Suggested rents are
  the 25th percentile (conservative), median (base) and 75th percentile
  (optimistic) of the comparables entered. The maximum is shown for reference
  only.
- **Non-conforming unit income is excluded from the conservative case** unless
  explicitly overridden, and the override is stated loudly.
- **NOI excludes mortgage payments, income taxes and appreciation.** The NOI
  module has no access to the financing model at all.
- **Principal repayment is never called cash flow.** It is reported separately
  as equity build.
- **Refinance proceeds are always net** of existing debt and refinance costs.
- **The refinance appraisal never defaults above the purchase price**, and low /
  base / high appraisals are all run.
- **Maximum LTV is never assumed to be best.** The LTV ladder shows what each
  extra 5% of leverage releases *and* what it permanently costs in monthly
  income.
- **Cash is a single running balance in the simulator**, so refinance proceeds
  cannot be double-counted, and an acquisition that would breach the liquidity
  reserve is blocked and reported rather than quietly funded.
- **Appreciation is never blended into operating performance**, and total return
  labels every component as cash or non-cash.
- **There is no single "investment score".** Twelve independent dimensions are
  reported alongside a hard PASS / INVESTIGATE / FAIL check of the investor's own
  stated requirements.

---

## Canadian specifics

**Mortgage maths.** Canadian fixed-rate mortgages compound **semi-annually, not
in advance**. The periodic rate is

```
i = (1 + r/2)^(2/p) − 1
```

where `r` is the nominal annual rate and `p` the payments per year — *not*
`r/12`. At 4.75% that is 0.391960%/month rather than 0.395833%: about C$9/month
on a C$422,500 mortgage. The convention is switchable (semi-annual or monthly)
and always displayed. Accelerated bi-weekly and weekly payments amortize
correctly and faster than their nominal schedule.

**Ontario land transfer tax.** Computed from the real progressive brackets
(0.5% / 1.0% / 1.5% / 2.0% / 2.5%), not estimated. The 2.5% band above
C$2,000,000 applies only to land with one or two single-family residences, so a
triplex or larger stays at 2.0% on the top band. **Ottawa has no municipal land
transfer tax** and Toronto's MLTT is never applied. The Non-Resident
Speculation Tax is available as an explicit opt-in.

**Ontario rent control.** The annual guideline is surfaced on the rent roll and
the below-market warning explains why that gap is not available on closing.

---

## Architecture

```
src/
  engine/          Pure TypeScript. No React, no I/O, no globals.
    money.ts         CAD formatting + tolerant input parsing
    finance.ts       Canadian mortgage maths, amortization, IRR, NPV
    ltt.ts           Ontario land transfer tax
    rentRoll.ts      Unit-by-unit income, current vs stabilized
    expenses.ts      Amount-or-percentage lines, actual vs estimated
    noi.ts           The §4 NOI waterfall
    metrics.ts       Cap rate, DSCR, cash-on-cash, break-even, status bands
    purchase.ts      Acquisition costs; capital-in-property vs cash-required
    financing.ts     Acquisition debt
    refinance.ts     Refinance, LTV ladder, appraisal matrix, delay stress
    cashflow.ts      Cash flow and total return
    breakeven.ts     What the income supports, and what it is worth
    offer.ts         Offer ladder and target-price solvers
    comps.ts         Rent and sales comparables
    projection.ts    5/10-year forecast and sale scenarios
    sensitivity.ts   Rate / rent / price matrices
    capex.ts         Component lives, CapEx forecast and risk score
    legal.ts         Unit legality and compliance risk
    scorecard.ts     Twelve dimensions + investor requirements
    dealBreakers.ts  Configurable red flags
    portfolio.ts     Portfolio roll-up and concentration
    simulator.ts     Capital recycling simulation
    simulatorExtras.ts  Stress runs, exit scenarios, end-state
    reverse.ts       First acquisition, reverse deal finder, goal seek
    underwrite.ts    Orchestrator — one deal in, every output out
  data/            Editable defaults, Ottawa reference data, worked example
  store/           Zustand state, persisted to localStorage
  components/      UI primitives, charts, shared display components
  pages/           One view per spec area
  export/          PDF, Excel (live formulas), CSV, JSON
```

The engine is the product. The UI, the exports, the portfolio roll-up and the
simulator all call the same functions, so there is **exactly one implementation
of each formula** in the codebase. Every headline number can be expanded in the
UI to show the arithmetic that produced it.

---

## Running it

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # 104 engine tests
npm run typecheck
npm run build      # -> dist/
npm start          # serves dist/ on $PORT (default 8080)
```

### Deploying to Railway

The repository is deploy-ready: `railway.json` sets the build and start
commands and points the health check at `/healthz`. Connect the repo to a
Railway service and generate a domain — no database, no volumes, no paid
add-ons, because the application is a static bundle plus a small Express server
and all state lives in the visitor's browser.

---

## Testing

104 tests cover the parts where being wrong is expensive:

- Canadian semi-annual compounding against the closed-form annuity
- The §38 worked example end to end (NOI, cap rate, LTT, refinance, trapped
  capital, DSCR, cash-on-cash)
- Ontario LTT brackets including the 2%-vs-2.5% top-band rule
- That NOI is identical whether a deal is financed or all cash
- That occupied below-market rents are never marked to market outside the
  explicitly optimistic scenario
- That vacant units are priced from the 25th percentile, not the top comparable
- That non-conforming income is excluded from the conservative case
- That principal repayment never enters the cash-flow figure
- Capital-recycling identities: cash cannot be double-counted, gross proceeds
  are never reported as net, reserve breaches block acquisitions
- IRR, equity multiple, amortization balances, LTV/appraisal/rate/rent stress
  monotonicity

---

## Data and privacy

Everything is stored in the browser's `localStorage`. Nothing is uploaded, and
the server holds no user data. Clearing site data, switching browser or using a
private window starts fresh — export anything worth keeping.

The data model already separates **listing data**, **user input**, **model
assumption** and **live market data**, so listing, rent, tax, mortgage-rate and
neighbourhood integrations can be added later without touching the underwriting.
Until a permitted API exists, figures are entered by hand with their source
attached; this tool will not scrape services whose terms prohibit automated use.

---

## Scope

This is an analysis tool, not financial, tax, legal or mortgage advice. Verify
every assumption — rents against leases, taxes against the bill, insurance
against a bindable quote, and unit legality against the City of Ottawa — before
waiving a condition.
