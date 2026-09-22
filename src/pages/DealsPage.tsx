import { useMemo, useState } from 'react'
import { useStore } from '@/store/useStore'
import { underwrite } from '@/engine/underwrite'
import { statusMeta, DEAL_STATUS_META } from '@/components/statusMeta'
import { FILTER_PRESETS } from '@/data/defaults'
import {
  Badge,
  EmptyState,
  MoneyInput,
  NumberInput,
  Panel,
  PercentInput,
  Segmented,
  Select,
  TableWrap,
  Toggle,
  cx,
} from '@/components/ui/primitives'
import { Note } from '@/components/shared'
import { fmtCAD, fmtMultiple, fmtPct } from '@/engine/money'

export default function DealsPage() {
  const deals = useStore((s) => s.deals)
  const profile = useStore((s) => s.profile)
  const addDeal = useStore((s) => s.addDeal)
  const addSample = useStore((s) => s.addSampleDeal)
  const duplicateDeal = useStore((s) => s.duplicateDeal)
  const deleteDeal = useStore((s) => s.deleteDeal)
  const archiveDeal = useStore((s) => s.archiveDeal)
  const setActive = useStore((s) => s.setActiveDeal)
  const setStatus = useStore((s) => s.setDealStatus)
  const toggleInPortfolio = useStore((s) => s.toggleInPortfolio)
  const compareIds = useStore((s) => s.compareIds)
  const toggleCompare = useStore((s) => s.toggleCompare)

  const [showArchived, setShowArchived] = useState(false)
  const [statusFilter, setStatusFilter] = useState<string>('ALL')
  const [minCap, setMinCap] = useState(0)
  const [minCashFlow, setMinCashFlow] = useState(0)
  const [minDscr, setMinDscr] = useState(0)
  const [maxPrice, setMaxPrice] = useState(0)
  const [minUnits, setMinUnits] = useState(0)
  const [neighbourhood, setNeighbourhood] = useState('')
  const [requireLegal, setRequireLegal] = useState(false)
  const [requireSeparateUtilities, setRequireSeparateUtilities] = useState(false)
  const [maxCapexRisk, setMaxCapexRisk] = useState<'ANY' | 'LOW' | 'MODERATE'>('ANY')

  const rows = useMemo(
    () =>
      deals.map((d) => {
        const r = underwrite(d, { profile })
        const isCashRefi = d.financing.structure === 'CASH_THEN_REFINANCE'
        return {
          deal: d,
          r,
          cap: r.scenarios.STABILIZED.capRateOnOffer,
          currentCap: r.scenarios.CONSERVATIVE.capRateOnOffer,
          cashFlow: isCashRefi ? r.refinance.monthlyCashFlow : r.scenarios.STABILIZED.cashFlow.monthlyCashFlow,
          dscr: isCashRefi ? r.refinance.dscr : r.scenarios.STABILIZED.cashFlow.dscr,
          coc: isCashRefi ? r.refinance.cashOnCash : r.scenarios.STABILIZED.cashFlow.cashOnCash,
          pricePerUnit: d.units.length > 0 ? r.price / d.units.length : null,
        }
      }),
    [deals, profile],
  )

  const filtered = rows.filter(({ deal: d, r, cap, cashFlow, dscr }) => {
    if (!showArchived && d.archived) return false
    if (statusFilter !== 'ALL' && d.status !== statusFilter) return false
    if (minCap > 0 && (cap ?? 0) < minCap) return false
    if (minCashFlow > 0 && cashFlow < minCashFlow) return false
    if (minDscr > 0 && (dscr ?? 0) < minDscr) return false
    if (maxPrice > 0 && r.price > maxPrice) return false
    if (minUnits > 0 && d.units.length < minUnits) return false
    if (neighbourhood && !d.info.neighbourhood.toLowerCase().includes(neighbourhood.toLowerCase())) return false
    if (requireLegal && (r.legal.nonConformingUnits > 0 || r.legal.excessUnits > 0)) return false
    if (requireSeparateUtilities && !d.info.separateHydroMeters) return false
    if (maxCapexRisk === 'LOW' && r.capex.riskLevel !== 'LOW') return false
    if (maxCapexRisk === 'MODERATE' && r.capex.riskLevel === 'HIGH') return false
    return true
  })

  const applyPreset = (key: string) => {
    const p = FILTER_PRESETS.find((x) => x.key === key)
    if (!p) return
    setMinCap(p.minCapRate)
    setMinCashFlow(p.minMonthlyCashFlow)
    setMinDscr(p.minDscr)
    setRequireLegal(p.requireAllLegalUnits)
    setRequireSeparateUtilities(p.requireSeparateUtilities)
    setMaxCapexRisk(p.maxCapexRisk === 'HIGH' ? 'ANY' : p.maxCapexRisk === 'MODERATE' ? 'MODERATE' : 'LOW')
  }

  const clearFilters = () => {
    setMinCap(0); setMinCashFlow(0); setMinDscr(0); setMaxPrice(0); setMinUnits(0)
    setNeighbourhood(''); setRequireLegal(false); setRequireSeparateUtilities(false); setMaxCapexRisk('ANY')
  }

  return (
    <div className="space-y-5">
      <Panel
        title="Investor presets"
        subtitle="Filter the deals you have underwritten against a strategy."
        actions={
          <div className="flex gap-2">
            <button className="btn btn-xs" onClick={clearFilters}>Clear</button>
            <button className="btn btn-xs" onClick={() => addSample()}>Load example</button>
            <button className="btn-primary btn-xs" onClick={() => addDeal()}>New deal</button>
          </div>
        }
      >
        <div className="flex flex-wrap gap-2">
          {FILTER_PRESETS.map((p) => (
            <button key={p.key} className="btn btn-xs" onClick={() => applyPreset(p.key)} title={p.description}>
              {p.name}
            </button>
          ))}
        </div>

        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <PercentInput label="Minimum cap rate" value={minCap} onChange={setMinCap} />
          <MoneyInput label="Minimum monthly cash flow" value={minCashFlow} onChange={setMinCashFlow} />
          <NumberInput label="Minimum DSCR" value={minDscr} onChange={setMinDscr} decimals={2} suffix="x" />
          <MoneyInput label="Maximum price" value={maxPrice} onChange={setMaxPrice} />
          <NumberInput label="Minimum units" value={minUnits} onChange={setMinUnits} min={0} />
          <div>
            <label className="label mb-1">Neighbourhood contains</label>
            <input className="field" value={neighbourhood} onChange={(e) => setNeighbourhood(e.target.value)} placeholder="Overbrook" />
          </div>
          <Select
            label="Status"
            value={statusFilter}
            onChange={setStatusFilter}
            options={[{ value: 'ALL', label: 'All statuses' }, ...DEAL_STATUS_META.map((s) => ({ value: s.key, label: s.label }))]}
          />
          <div>
            <div className="label mb-1.5">Maximum CapEx risk</div>
            <Segmented
              value={maxCapexRisk}
              onChange={setMaxCapexRisk}
              size="sm"
              options={[
                { value: 'ANY', label: 'Any' },
                { value: 'MODERATE', label: 'Moderate' },
                { value: 'LOW', label: 'Low' },
              ]}
            />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Toggle checked={requireLegal} onChange={setRequireLegal} label="All units must be legal" />
            <Toggle checked={requireSeparateUtilities} onChange={setRequireSeparateUtilities} label="Separate hydro metering required" />
            <Toggle checked={showArchived} onChange={setShowArchived} label="Show archived deals" />
          </div>
        </div>
      </Panel>

      {deals.length === 0 ? (
        <EmptyState
          title="No deals yet"
          action={
            <div className="flex gap-2">
              <button className="btn-primary" onClick={() => addDeal()}>New deal</button>
              <button className="btn" onClick={() => addSample()}>Load the worked example</button>
            </div>
          }
        >
          Start with the worked example to see how everything fits together, or create a blank deal
          with Ottawa defaults.
        </EmptyState>
      ) : (
        <Panel
          title={`${filtered.length} of ${deals.length} deals`}
          subtitle="Tick to compare side by side."
          actions={
            compareIds.length > 0 && (
              <a className="btn-primary btn-xs" href="#/compare">
                Compare {compareIds.length}
              </a>
            )
          }
          dense
        >
          <TableWrap>
            <thead className="border-b border-line bg-raised">
              <tr>
                <th className="th w-12 text-center">Cmp</th>
                <th className="th">Deal</th>
                <th className="th">Status</th>
                <th className="th">Neighbourhood</th>
                <th className="th text-right">Price</th>
                <th className="th text-right">Units</th>
                <th className="th text-right">Per unit</th>
                <th className="th text-right">NOI</th>
                <th className="th text-right">Cap (current)</th>
                <th className="th text-right">Cap (stabilized)</th>
                <th className="th text-right">Cash flow</th>
                <th className="th text-right">DSCR</th>
                <th className="th text-right">CoC</th>
                <th className="th text-center">Risk</th>
                <th className="th text-center">Owned</th>
                <th className="th w-32" />
              </tr>
            </thead>
            <tbody className="divide-y divide-line/60">
              {filtered.map(({ deal: d, r, cap, currentCap, cashFlow, dscr, coc, pricePerUnit }) => {
                const meta = statusMeta(d.status)
                return (
                  <tr key={d.id} className={cx('row-hover', d.archived && 'opacity-50')}>
                    <td className="td text-center">
                      <input
                        type="checkbox"
                        checked={compareIds.includes(d.id)}
                        onChange={() => toggleCompare(d.id)}
                        className="h-3.5 w-3.5 rounded border-line text-accent"
                      />
                    </td>
                    <td className="td">
                      <a
                        className="font-medium hover:text-accent hover:underline"
                        href="#/dashboard"
                        onClick={() => setActive(d.id)}
                      >
                        {d.name || 'Untitled'}
                      </a>
                      {d.info.address && <div className="text-2xs text-subtle">{d.info.address}</div>}
                    </td>
                    <td className="td">
                      <select
                        className="field text-2xs"
                        value={d.status}
                        onChange={(e) => setStatus(d.id, e.target.value as typeof d.status)}
                      >
                        {DEAL_STATUS_META.map((s) => (
                          <option key={s.key} value={s.key}>{s.label}</option>
                        ))}
                      </select>
                      <div className="mt-1"><Badge tone={meta.tone}>{meta.label}</Badge></div>
                    </td>
                    <td className="td text-muted">{d.info.neighbourhood || '—'}</td>
                    <td className="td-num">{fmtCAD(r.price)}</td>
                    <td className="td-num">{d.units.length}</td>
                    <td className="td-num text-muted">{fmtCAD(pricePerUnit)}</td>
                    <td className="td-num">{fmtCAD(r.scenarios.STABILIZED.noi.noi)}</td>
                    <td className="td-num">{fmtPct(currentCap)}</td>
                    <td className={cx('td-num font-medium', (cap ?? 0) >= profile.minCapRate ? 'text-pos' : 'text-warn')}>
                      {fmtPct(cap)}
                    </td>
                    <td className={cx('td-num', cashFlow < 0 && 'text-neg')}>{fmtCAD(cashFlow)}</td>
                    <td className={cx('td-num', (dscr ?? 9) < profile.minDscr && 'text-warn')}>{fmtMultiple(dscr)}</td>
                    <td className="td-num">{fmtPct(coc)}</td>
                    <td className="td text-center">
                      <div className="flex flex-col items-center gap-1">
                        {r.dealBreakers.redCount > 0 && <Badge tone="neg">{r.dealBreakers.redCount} red</Badge>}
                        <Badge tone={r.capex.riskLevel === 'LOW' ? 'pos' : r.capex.riskLevel === 'MODERATE' ? 'warn' : 'neg'}>
                          {r.capex.riskLevel}
                        </Badge>
                      </div>
                    </td>
                    <td className="td text-center">
                      <input
                        type="checkbox"
                        checked={d.inPortfolio}
                        onChange={() => toggleInPortfolio(d.id)}
                        className="h-3.5 w-3.5 rounded border-line text-accent"
                        title="Include in the portfolio roll-up"
                      />
                    </td>
                    <td className="td">
                      <div className="flex justify-end gap-1">
                        <button className="btn-ghost btn-xs" onClick={() => duplicateDeal(d.id)} title="Duplicate">Copy</button>
                        <button className="btn-ghost btn-xs" onClick={() => archiveDeal(d.id, !d.archived)} title={d.archived ? 'Unarchive' : 'Archive'}>
                          {d.archived ? 'Restore' : 'Archive'}
                        </button>
                        <button
                          className="btn-ghost btn-xs text-neg"
                          onClick={() => {
                            if (confirm(`Delete "${d.name}"? This cannot be undone.`)) deleteDeal(d.id)
                          }}
                          title="Delete"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
              {filtered.length === 0 && (
                <tr>
                  <td className="td text-muted" colSpan={16}>
                    No deals match these filters.
                  </td>
                </tr>
              )}
            </tbody>
          </TableWrap>
        </Panel>
      )}

      <Panel title="How filtering works here">
        <Note>
          These filters run against deals you have already underwritten in this browser, not against a
          live listing feed. When a permitted listings API becomes available the same filter set —
          price, units, cap rate, cash flow, DSCR, price per unit, separate utilities, vacancy,
          value-add potential, legal unit count and refinance potential — applies directly to it,
          because the underwriting engine is independent of where the property data came from.
        </Note>
      </Panel>
    </div>
  )
}
