import type { Deal } from '@/engine/types'
import type { UnderwriteResult } from '@/engine/underwrite'
import { useDealEdit } from '@/lib/dealEdit'
import { useStore } from '@/store/useStore'
import {
  Badge,
  Callout,
  Kpi,
  MoneyInput,
  Panel,
  TableWrap,
  cx,
} from '@/components/ui/primitives'
import { Note, SectionGrid } from '@/components/shared'
import { fmtCAD, fmtMultiple, fmtPct } from '@/engine/money'
import { capRateBand } from '@/engine/metrics'

export default function OfferPage({ deal, r }: { deal: Deal; r: UnderwriteResult }) {
  const edit = useDealEdit(deal.id)
  const profile = useStore((s) => s.profile)
  const be = r.scenarios.STABILIZED.breakEven
  const isCashRefi = deal.financing.structure === 'CASH_THEN_REFINANCE'

  const bestCapPrice = r.targetPrices.find((t) => t.key === `cap-${profile.minCapRate}`)?.price ?? null

  return (
    <div className="space-y-5">
      <SectionGrid cols={4}>
        <Kpi label="Asking price" value={fmtCAD(r.askingPrice)} />
        <Kpi label="Your offer" value={fmtCAD(r.price)} sub={r.price !== r.askingPrice ? `${fmtPct(1 - r.price / r.askingPrice, 1)} below asking` : 'At asking'} emphasis />
        <Kpi
          label={`Price at your ${fmtPct(profile.minCapRate, 2)} cap floor`}
          value={fmtCAD(be.maxPrices.find((p) => Math.abs(p.capRate - profile.minCapRate) < 1e-9)?.maxPrice ?? bestCapPrice)}
          sub="Stabilized NOI ÷ target cap rate"
        />
        <Kpi
          label="Maximum loan at your DSCR floor"
          value={fmtCAD(be.maxLoans.find((l) => Math.abs(l.dscr - profile.minDscr) < 1e-9)?.maxLoan ?? null)}
          sub={`${profile.minDscr.toFixed(2)}x coverage`}
        />
      </SectionGrid>

      <Panel
        title="Offer ladder"
        subtitle="Every level is fully re-underwritten — land transfer tax brackets, mortgage sizing and percentage expenses all move with the price."
        actions={
          <MoneyInput
            value={deal.info.offerPrice || null}
            onChange={(v) => edit.info({ offerPrice: v })}
            placeholder="Custom offer"
            className="w-40"
          />
        }
        dense
      >
        <TableWrap>
          <thead className="border-b border-line bg-raised">
            <tr>
              <th className="th">Offer</th>
              <th className="th text-right">Purchase price</th>
              <th className="th text-right">Land transfer tax</th>
              <th className="th text-right">Cash required</th>
              <th className="th text-right">Cap rate</th>
              <th className="th text-right">Monthly cash flow</th>
              <th className="th text-right">DSCR</th>
              <th className="th text-right">Cash-on-cash</th>
              <th className="th text-right">Cash left in deal</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line/60">
            {r.offers.map((o) => {
              const capB = capRateBand(o.capRate)
              return (
                <tr
                  key={`${o.label}-${o.price}`}
                  className={cx('row-hover', o.isCustom && 'bg-accent/5 font-medium', o.isAsking && 'border-t-2 border-line')}
                >
                  <td className="td">
                    {o.label}
                    {o.isCustom && <Badge tone="info">yours</Badge>}
                  </td>
                  <td className="td-num font-medium">{fmtCAD(o.price)}</td>
                  <td className="td-num text-muted">{fmtCAD(o.landTransferTax)}</td>
                  <td className="td-num">{fmtCAD(o.totalCashRequired)}</td>
                  <td className={cx('td-num', capB.tone === 'pos' && 'text-pos', capB.tone === 'neg' && 'text-neg')}>
                    {fmtPct(o.capRate)}
                  </td>
                  <td className={cx('td-num', o.monthlyCashFlow < 0 && 'text-neg')}>{fmtCAD(o.monthlyCashFlow)}</td>
                  <td className={cx('td-num', (o.dscr ?? 9) < profile.minDscr && 'text-warn')}>{fmtMultiple(o.dscr)}</td>
                  <td className="td-num">{fmtPct(o.cashOnCash)}</td>
                  <td className="td-num text-muted">{fmtCAD(o.cashRemainingInvested)}</td>
                </tr>
              )
            })}
          </tbody>
        </TableWrap>
        <div className="border-t border-line px-4 py-3">
          <Note>
            {isCashRefi
              ? 'Cash flow, DSCR and cash-on-cash are the POST-REFINANCE figures, because an unlevered cash purchase produces the same cash flow at every price — which would make this table useless. The refinance appraisal is scaled with the offer: paying less does not entitle you to the original appraised value.'
              : 'Cash required is the down payment plus closing costs and renovation at each price level.'}
          </Note>
        </div>
      </Panel>

      <Panel
        title="Price required to achieve each target"
        subtitle="Solved by bisection against the full underwriting, not by scaling."
        dense
      >
        <TableWrap>
          <thead className="border-b border-line bg-raised">
            <tr>
              <th className="th">Target</th>
              <th className="th text-right">Required price</th>
              <th className="th text-right">Discount from asking</th>
              <th className="th text-right">Cap rate there</th>
              <th className="th text-right">Cash flow there</th>
              <th className="th text-right">DSCR there</th>
              <th className="th">Note</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line/60">
            {r.targetPrices.map((t) => (
              <tr key={t.key} className="row-hover">
                <td className="td font-medium">{t.label}</td>
                <td className="td-num">{t.price ? fmtCAD(t.price) : '—'}</td>
                <td className="td-num">
                  {t.notBinding ? (
                    <Badge tone="pos">Already met</Badge>
                  ) : t.discountFromAsking !== null ? (
                    <span className={t.discountFromAsking > 0.1 ? 'text-neg' : t.discountFromAsking > 0 ? 'text-warn' : 'text-pos'}>
                      {t.discountFromAsking > 0 ? '−' : '+'}
                      {fmtPct(Math.abs(t.discountFromAsking), 1)}
                    </span>
                  ) : (
                    '—'
                  )}
                </td>
                <td className="td-num">{t.metrics ? fmtPct(t.metrics.capRate) : '—'}</td>
                <td className="td-num">{t.metrics ? fmtCAD(t.metrics.monthlyCashFlow) : '—'}</td>
                <td className="td-num">{t.metrics ? fmtMultiple(t.metrics.dscr) : '—'}</td>
                <td className="td text-2xs text-muted">{t.note}</td>
              </tr>
            ))}
          </tbody>
        </TableWrap>
        <div className="border-t border-line px-4 py-3">
          <Callout tone="info" compact>
            A "not binding" row means the target is already satisfied at every price tested — it is
            not the constraint that should set your offer. The binding constraint is whichever target
            demands the lowest price.
          </Callout>
        </div>
      </Panel>

      <div className="grid gap-5 lg:grid-cols-2">
        <Panel title="Maximum purchase price by target cap rate" subtitle="NOI ÷ target cap rate." dense>
          <TableWrap>
            <thead className="border-b border-line bg-raised">
              <tr>
                <th className="th">Target cap rate</th>
                <th className="th text-right">Maximum price</th>
                <th className="th text-right">vs asking</th>
                <th className="th text-right">vs your offer</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line/60">
              {be.maxPrices.map((p) => (
                <tr key={p.capRate} className={cx('row-hover', Math.abs(p.capRate - profile.minCapRate) < 1e-9 && 'bg-accent/5 font-medium')}>
                  <td className="td">{fmtPct(p.capRate, 2)}</td>
                  <td className="td-num">{fmtCAD(p.maxPrice)}</td>
                  <td className={cx('td-num', (p.vsAskingPrice ?? 0) < 0 ? 'text-neg' : 'text-pos')}>
                    {p.vsAskingPrice !== null ? `${p.vsAskingPrice > 0 ? '+' : ''}${fmtCAD(p.vsAskingPrice)}` : '—'}
                  </td>
                  <td className={cx('td-num', (p.vsOfferPrice ?? 0) < 0 ? 'text-neg' : 'text-pos')}>
                    {p.vsOfferPrice !== null ? `${p.vsOfferPrice > 0 ? '+' : ''}${fmtCAD(p.vsOfferPrice)}` : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </TableWrap>
          <div className="border-t border-line px-4 py-3">
            <Note>
              Based on the stabilized NOI of {fmtCAD(r.scenarios.STABILIZED.noi.noi)}. Using the
              conservative NOI of {fmtCAD(r.scenarios.CONSERVATIVE.noi.noi)} would lower every figure
              here by about {fmtPct(1 - r.scenarios.CONSERVATIVE.noi.noi / Math.max(1, r.scenarios.STABILIZED.noi.noi), 1)}.
            </Note>
          </div>
        </Panel>

        <Panel title="Break-even and debt capacity" subtitle="What the income can carry." dense>
          <div className="space-y-1 p-4">
            <Row label="Break-even occupancy" value={fmtPct(be.breakEvenOccupancy)} />
            <Row
              label="Rent level at which cash flow hits zero"
              value={be.breakEvenRentFactor !== null ? fmtPct(be.breakEvenRentFactor) : '—'}
              note="As a share of the modelled effective gross income"
            />
            <Row label="Maximum annual debt service at 1.00x" value={fmtCAD(be.maxAnnualDebtServiceAtParity)} />
            <Row label="Maximum monthly payment at 1.00x" value={fmtCAD(be.maxMonthlyPaymentAtParity)} />
            <Row label="Maximum loan at 1.00x" value={fmtCAD(be.maxLoanAtParity)} />
          </div>
          <TableWrap>
            <thead className="border-b border-t border-line bg-raised">
              <tr>
                <th className="th">DSCR target</th>
                <th className="th text-right">Max annual debt service</th>
                <th className="th text-right">Max monthly payment</th>
                <th className="th text-right">Max loan</th>
                <th className="th text-right">Implied price at {fmtPct(deal.refinance.ltv, 0)} LTV</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line/60">
              {be.maxLoans.map((l) => (
                <tr key={l.dscr} className={cx('row-hover', Math.abs(l.dscr - profile.minDscr) < 1e-9 && 'bg-accent/5 font-medium')}>
                  <td className="td">{l.dscr.toFixed(2)}x</td>
                  <td className="td-num">{fmtCAD(l.maxAnnualDebtService)}</td>
                  <td className="td-num">{fmtCAD(l.maxMonthlyPayment)}</td>
                  <td className="td-num">{fmtCAD(l.maxLoan)}</td>
                  <td className="td-num text-muted">{fmtCAD(l.impliedPriceAtLtv)}</td>
                </tr>
              ))}
            </tbody>
          </TableWrap>
        </Panel>
      </div>

      <Panel title="What to actually offer">
        <div className="space-y-3 text-sm leading-relaxed">
          <p>
            The binding constraint on this deal is{' '}
            <strong>
              {(() => {
                const binding = r.targetPrices
                  .filter((t) => t.achievable && !t.notBinding && t.price !== null)
                  .sort((a, b) => (a.price ?? 0) - (b.price ?? 0))[0]
                return binding ? `${binding.label} at ${fmtCAD(binding.price)}` : 'none of the tested targets'
              })()}
            </strong>
            . That is the lowest price any of your targets demands, so it is the number that should
            anchor the offer.
          </p>
          <p className="text-xs text-muted">
            Your leverage in the negotiation is the cash purchase itself: no financing condition, a
            short close, and certainty for the vendor. That is worth a real discount on an Ottawa
            small multifamily — but only price it into the offer, never into the underwriting.
          </p>
          {r.dealBreakers.redCount > 0 && (
            <Callout tone="neg" title={`${r.dealBreakers.redCount} red flag(s) are still open`}>
              Resolve these before submitting anything. Every figure above assumes the inputs are
              correct.
            </Callout>
          )}
        </div>
      </Panel>
    </div>
  )
}

function Row({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-line/50 py-1.5 last:border-0">
      <span className="text-xs text-muted">
        {label}
        {note && <span className="block text-2xs text-subtle">{note}</span>}
      </span>
      <span className="num text-sm font-medium">{value}</span>
    </div>
  )
}
