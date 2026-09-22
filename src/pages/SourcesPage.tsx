import type { DataOrigin, Deal } from '@/engine/types'
import type { UnderwriteResult } from '@/engine/underwrite'
import { useStore } from '@/store/useStore'
import {
  Badge,
  Callout,
  Panel,
  Select,
  TableWrap,
  cx,
} from '@/components/ui/primitives'
import { Note } from '@/components/shared'

const ORIGINS: { value: DataOrigin; label: string; tone: 'info' | 'pos' | 'warn' | 'muted'; note: string }[] = [
  { value: 'LISTING_DATA', label: 'Listing data', tone: 'info', note: 'Taken from the MLS listing or the vendor package.' },
  { value: 'USER_INPUT', label: 'User input', tone: 'pos', note: 'Typed by you. Never overwritten by the model.' },
  { value: 'MODEL_ASSUMPTION', label: 'Model assumption', tone: 'warn', note: 'A default this tool supplied because no actual figure exists.' },
  { value: 'LIVE_MARKET_DATA', label: 'Live market data', tone: 'muted', note: 'Reserved for future API integrations.' },
]

/** Fields worth documenting, offered as quick-add buttons. */
const SUGGESTED_FIELDS = [
  { field: 'info.askingPrice', label: 'Listing price' },
  { field: 'expenses.PROPERTY_TAX', label: 'Property tax' },
  { field: 'expenses.INSURANCE', label: 'Insurance quote' },
  { field: 'units.currentRent', label: 'Tenant rents (leases / estoppel)' },
  { field: 'units.marketRent', label: 'Market rent estimate' },
  { field: 'rentComps', label: 'Rent comparable' },
  { field: 'saleComps', label: 'Sales comparable' },
  { field: 'refinance.annualRate', label: 'Mortgage rate quote' },
  { field: 'info.legalUnits', label: 'Legal unit count' },
  { field: 'info.zoning', label: 'Zoning' },
  { field: 'components', label: 'Inspection report' },
]

export default function SourcesPage({ deal, r }: { deal: Deal; r: UnderwriteResult }) {
  const addSource = useStore((s) => s.addSource)
  const removeSource = useStore((s) => s.removeSource)
  const patchDeal = useStore((s) => s.patchDeal)

  const documented = new Set(deal.sources.map((s) => s.field))
  const undocumented = SUGGESTED_FIELDS.filter((f) => !documented.has(f.field))

  return (
    <div className="space-y-5">
      <Panel title="Data types" subtitle="Every number in this tool belongs to exactly one of these categories.">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {ORIGINS.map((o) => (
            <div key={o.value} className="rounded-md border border-line p-3">
              <Badge tone={o.tone}>{o.label}</Badge>
              <p className="mt-2 text-2xs leading-relaxed text-muted">{o.note}</p>
            </div>
          ))}
        </div>
        <div className="mt-4">
          <Callout tone="info" compact>
            <strong className="text-ink">A manual assumption is never silently overwritten.</strong>{' '}
            Where you enter a verified actual, the ACTUAL/ESTIMATED switch on the Expenses page uses
            it; where you have not, the model assumption is used and visibly marked "est." The tool
            never quietly substitutes one for the other.
          </Callout>
        </div>
      </Panel>

      {undocumented.length > 0 && (
        <Panel title="Undocumented figures" subtitle="Click to start an audit-trail entry for any of these.">
          <div className="flex flex-wrap gap-2">
            {undocumented.map((f) => (
              <button
                key={f.field}
                className="btn btn-xs"
                onClick={() => addSource(deal.id, { field: f.field, label: f.label })}
              >
                + {f.label}
              </button>
            ))}
          </div>
          {!documented.has('units.currentRent') && (
            <div className="mt-3">
              <Callout tone="warn" compact>
                Tenant rents have no recorded source. A vendor's rent roll is a marketing document
                until the leases, a rent roll certificate or an estoppel confirms it — this fires the
                "Tenant rents not verified" red flag.
              </Callout>
            </div>
          )}
        </Panel>
      )}

      <Panel
        title="Audit trail"
        subtitle={`${deal.sources.length} documented ${deal.sources.length === 1 ? 'source' : 'sources'}.`}
        actions={
          <button className="btn btn-xs" onClick={() => addSource(deal.id, {})}>
            Add entry
          </button>
        }
        dense
      >
        {deal.sources.length === 0 ? (
          <div className="p-4">
            <Note>
              Nothing documented yet. For a deal you intend to act on, every externally sourced
              number should carry its source, a URL, the date retrieved and whether it was entered by
              hand or fetched.
            </Note>
          </div>
        ) : (
          <TableWrap>
            <thead className="border-b border-line bg-raised">
              <tr>
                <th className="th">Figure</th>
                <th className="th w-44">Type</th>
                <th className="th">Source</th>
                <th className="th">URL</th>
                <th className="th w-36">Retrieved</th>
                <th className="th w-24 text-center">Entry</th>
                <th className="th">Note</th>
                <th className="th w-10" />
              </tr>
            </thead>
            <tbody className="divide-y divide-line/60">
              {deal.sources.map((s) => (
                <tr key={s.id} className="row-hover align-top">
                  <td className="td">
                    <input
                      className="field min-w-[140px]"
                      value={s.label}
                      onChange={(e) =>
                        patchDeal(deal.id, (d) => ({
                          ...d,
                          sources: d.sources.map((x) => (x.id === s.id ? { ...x, label: e.target.value } : x)),
                        }))
                      }
                      placeholder="What this documents"
                    />
                    <div className="mt-0.5 mono text-2xs text-subtle">{s.field || '—'}</div>
                  </td>
                  <td className="td">
                    <Select
                      value={s.origin}
                      onChange={(v) =>
                        patchDeal(deal.id, (d) => ({
                          ...d,
                          sources: d.sources.map((x) => (x.id === s.id ? { ...x, origin: v } : x)),
                        }))
                      }
                      options={ORIGINS.map((o) => ({ value: o.value, label: o.label }))}
                    />
                  </td>
                  <td className="td">
                    <input
                      className="field min-w-[130px]"
                      value={s.source}
                      onChange={(e) =>
                        patchDeal(deal.id, (d) => ({
                          ...d,
                          sources: d.sources.map((x) => (x.id === s.id ? { ...x, source: e.target.value } : x)),
                        }))
                      }
                      placeholder="MLS listing, tax bill, broker…"
                    />
                  </td>
                  <td className="td">
                    <input
                      className="field min-w-[150px]"
                      value={s.url}
                      onChange={(e) =>
                        patchDeal(deal.id, (d) => ({
                          ...d,
                          sources: d.sources.map((x) => (x.id === s.id ? { ...x, url: e.target.value } : x)),
                        }))
                      }
                      placeholder="https://"
                    />
                  </td>
                  <td className="td">
                    <input
                      type="date"
                      className="field"
                      value={s.retrievedAt}
                      onChange={(e) =>
                        patchDeal(deal.id, (d) => ({
                          ...d,
                          sources: d.sources.map((x) => (x.id === s.id ? { ...x, retrievedAt: e.target.value } : x)),
                        }))
                      }
                    />
                  </td>
                  <td className="td text-center">
                    <button
                      className={cx('chip', s.manual ? 'bg-pos/10 text-pos' : 'bg-info/10 text-info')}
                      onClick={() =>
                        patchDeal(deal.id, (d) => ({
                          ...d,
                          sources: d.sources.map((x) => (x.id === s.id ? { ...x, manual: !x.manual } : x)),
                        }))
                      }
                    >
                      {s.manual ? 'Manual' : 'Automated'}
                    </button>
                  </td>
                  <td className="td">
                    <input
                      className="field min-w-[120px]"
                      value={s.note}
                      onChange={(e) =>
                        patchDeal(deal.id, (d) => ({
                          ...d,
                          sources: d.sources.map((x) => (x.id === s.id ? { ...x, note: e.target.value } : x)),
                        }))
                      }
                    />
                  </td>
                  <td className="td text-right">
                    <button className="btn-ghost btn-xs text-neg" onClick={() => removeSource(deal.id, s.id)} title="Remove">
                      ×
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </TableWrap>
        )}
      </Panel>

      <Panel title="Model assumptions currently in use" subtitle="Figures this tool supplied because no verified actual exists." dense>
        <TableWrap>
          <thead className="border-b border-line bg-raised">
            <tr>
              <th className="th">Assumption</th>
              <th className="th text-right">Value in use</th>
              <th className="th">Where it comes from</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line/60">
            {r.scenarios.STABILIZED.noi.expenses.lines
              .filter((l) => !l.isActual && l.annual > 0)
              .map((l) => (
                <tr key={l.key} className="row-hover">
                  <td className="td">
                    {l.label}
                    <Badge tone="warn">assumption</Badge>
                  </td>
                  <td className="td-num">
                    {l.mode === 'PERCENT'
                      ? `${((l.percent ?? 0) * 100).toFixed(2)}% of ${l.basis?.replace(/_/g, ' ').toLowerCase()}`
                      : `C$${Math.round(l.annual).toLocaleString('en-CA')}/yr`}
                  </td>
                  <td className="td text-2xs text-muted">{l.note || 'Editable default on the Expenses page.'}</td>
                </tr>
              ))}
            <tr className="row-hover">
              <td className="td">Refinance appraisal<Badge tone="warn">assumption</Badge></td>
              <td className="td-num">C${Math.round(r.refinance.appraisedValue).toLocaleString('en-CA')}</td>
              <td className="td text-2xs text-muted">{r.refinance.valuationNote}</td>
            </tr>
            <tr className="row-hover">
              <td className="td">Annual appreciation<Badge tone="warn">assumption</Badge></td>
              <td className="td-num">{(deal.projection.annualAppreciation * 100).toFixed(1)}%</td>
              <td className="td text-2xs text-muted">
                Set by you on the Projection page. Never used in NOI, cap rate, cash flow or DSCR.
              </td>
            </tr>
          </tbody>
        </TableWrap>
      </Panel>

      <Panel title="Live data integrations" subtitle="Designed for, not yet connected.">
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {[
            'Property listings (permitted sources)',
            'Rent listings',
            'Mortgage rates',
            'Municipal property tax data',
            'Neighbourhood analytics',
            'Land registry (where API access exists)',
            'Maps',
            'Transit',
            'Schools',
            'Walkability',
            'Crime / public safety datasets',
          ].map((s) => (
            <div key={s} className="flex items-center justify-between rounded-md border border-dashed border-line px-3 py-2">
              <span className="text-xs text-muted">{s}</span>
              <Badge tone="muted">Manual entry</Badge>
            </div>
          ))}
        </div>
        <div className="mt-4">
          <Note>
            The data model already separates listing data, user input, model assumptions and live
            market data, so an integration can be added without rewriting the underwriting. This tool
            will not scrape services whose terms prohibit automated use — until a permitted API
            exists, every figure is entered by hand with its source attached.
          </Note>
        </div>
      </Panel>
    </div>
  )
}
