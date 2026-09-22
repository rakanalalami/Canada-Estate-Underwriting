import type { Deal } from '@/engine/types'
import type { UnderwriteResult } from '@/engine/underwrite'
import { useDealEdit } from '@/lib/dealEdit'
import {
  Badge,
  Callout,
  Kpi,
  MoneyInput,
  NumberInput,
  Panel,
  TableWrap,
  cx,
} from '@/components/ui/primitives'
import { Note, SectionGrid } from '@/components/shared'
import { fmtCAD, fmtNumber, fmtPct } from '@/engine/money'

export default function ComparablesPage({ deal, r }: { deal: Deal; r: UnderwriteResult }) {
  const edit = useDealEdit(deal.id)
  const rc = r.rentComps
  const sc = r.saleComps

  return (
    <div className="space-y-5">
      {/* §14 Rent comparables */}
      <SectionGrid cols={4}>
        <Kpi label="Average comparable rent" value={fmtCAD(rc.averageRent)} sub={`${rc.count} included`} />
        <Kpi label="Median comparable rent" value={fmtCAD(rc.medianRent)} />
        <Kpi label="Rent per bedroom" value={fmtCAD(rc.rentPerBedroom)} />
        <Kpi label="Rent per square foot" value={rc.rentPerSqFt ? fmtCAD(rc.rentPerSqFt, 2) : '—'} />
      </SectionGrid>

      <Panel
        title="Suggested rents"
        subtitle="Percentile-based. The highest comparable is shown for reference and never used as a suggestion."
      >
        <div className="grid gap-3 sm:grid-cols-4">
          <SuggestionCard label="Conservative" value={rc.conservativeRent} note="25th percentile" tone="pos" />
          <SuggestionCard label="Base" value={rc.baseRent} note="Median" tone="info" />
          <SuggestionCard label="Optimistic" value={rc.optimisticRent} note="75th percentile" tone="warn" />
          <SuggestionCard label="Highest comparable" value={rc.maxRent} note="Reference only — never used" tone="muted" />
        </div>
        <div className="mt-3">
          <Note>{rc.note}</Note>
        </div>
        {Object.keys(rc.byBedrooms).length > 0 && (
          <div className="mt-4">
            <div className="label mb-2">By bedroom count</div>
            <TableWrap>
              <thead className="border-b border-line bg-raised">
                <tr>
                  <th className="th">Bedrooms</th>
                  <th className="th text-right">Comps</th>
                  <th className="th text-right">Conservative</th>
                  <th className="th text-right">Base</th>
                  <th className="th text-right">Optimistic</th>
                  <th className="th text-right">Range</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line/60">
                {Object.entries(rc.byBedrooms)
                  .sort(([a], [b]) => Number(a) - Number(b))
                  .map(([beds, g]) => (
                    <tr key={beds} className="row-hover">
                      <td className="td">{beds} bed</td>
                      <td className="td-num">{g.count}</td>
                      <td className="td-num text-pos">{fmtCAD(g.conservativeRent)}</td>
                      <td className="td-num font-medium">{fmtCAD(g.baseRent)}</td>
                      <td className="td-num text-warn">{fmtCAD(g.optimisticRent)}</td>
                      <td className="td-num text-muted">
                        {fmtCAD(g.minRent)} – {fmtCAD(g.maxRent)}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </TableWrap>
          </div>
        )}
      </Panel>

      <Panel
        title="Rent comparables"
        subtitle="Enter what you actually found. Untick a row to exclude it from the statistics."
        actions={
          <button className="btn btn-xs" onClick={edit.addRentComp}>
            Add comparable
          </button>
        }
        dense
      >
        {deal.rentComps.length === 0 ? (
          <div className="p-4">
            <Callout tone="warn" title="No rent comparables entered">
              Without comparables the market rents in your rent roll are unsupported estimates, and
              the stabilized scenario rests entirely on them. Two or three genuine listings from the
              same pocket change the quality of this analysis more than any other input.
            </Callout>
          </div>
        ) : (
          <TableWrap>
            <thead className="border-b border-line bg-raised">
              <tr>
                <th className="th w-12 text-center">Use</th>
                <th className="th">Address</th>
                <th className="th w-20 text-right">Dist (km)</th>
                <th className="th">Neighbourhood</th>
                <th className="th w-16 text-right">Beds</th>
                <th className="th w-16 text-right">Baths</th>
                <th className="th w-20 text-right">Sq ft</th>
                <th className="th w-28 text-right">Monthly rent</th>
                <th className="th w-40">Includes</th>
                <th className="th w-28">Condition</th>
                <th className="th w-32">Listed</th>
                <th className="th">Source</th>
                <th className="th w-10" />
              </tr>
            </thead>
            <tbody className="divide-y divide-line/60">
              {deal.rentComps.map((c) => (
                <tr key={c.id} className={cx('row-hover align-top', !c.include && 'opacity-45')}>
                  <td className="td text-center">
                    <input
                      type="checkbox"
                      checked={c.include}
                      onChange={(e) => edit.rentComp(c.id, { include: e.target.checked })}
                      className="h-3.5 w-3.5 rounded border-line text-accent"
                    />
                  </td>
                  <td className="td">
                    <input className="field min-w-[150px]" value={c.address} onChange={(e) => edit.rentComp(c.id, { address: e.target.value })} placeholder="Address" />
                  </td>
                  <td className="td"><NumberInput value={c.distanceKm} onChange={(v) => edit.rentComp(c.id, { distanceKm: v })} decimals={1} className="w-20" /></td>
                  <td className="td">
                    <input className="field min-w-[110px]" value={c.neighbourhood} onChange={(e) => edit.rentComp(c.id, { neighbourhood: e.target.value })} />
                  </td>
                  <td className="td"><NumberInput value={c.bedrooms} onChange={(v) => edit.rentComp(c.id, { bedrooms: v })} className="w-14" min={0} /></td>
                  <td className="td"><NumberInput value={c.bathrooms} onChange={(v) => edit.rentComp(c.id, { bathrooms: v })} className="w-14" min={0} decimals={1} /></td>
                  <td className="td"><NumberInput value={c.sqFt || null} onChange={(v) => edit.rentComp(c.id, { sqFt: v })} className="w-20" min={0} /></td>
                  <td className="td"><MoneyInput value={c.monthlyRent || null} onChange={(v) => edit.rentComp(c.id, { monthlyRent: v })} className="w-28" min={0} /></td>
                  <td className="td">
                    <div className="flex flex-wrap gap-1">
                      <TinyToggle on={c.parkingIncluded} label="Parking" onClick={() => edit.rentComp(c.id, { parkingIncluded: !c.parkingIncluded })} />
                      {['Heat', 'Hydro', 'Water'].map((u) => (
                        <TinyToggle
                          key={u}
                          on={c.utilitiesIncluded.includes(u)}
                          label={u}
                          onClick={() =>
                            edit.rentComp(c.id, {
                              utilitiesIncluded: c.utilitiesIncluded.includes(u)
                                ? c.utilitiesIncluded.filter((x) => x !== u)
                                : [...c.utilitiesIncluded, u],
                            })
                          }
                        />
                      ))}
                      <TinyToggle on={c.furnished} label="Furnished" onClick={() => edit.rentComp(c.id, { furnished: !c.furnished })} />
                    </div>
                  </td>
                  <td className="td">
                    <input className="field w-24" value={c.condition} onChange={(e) => edit.rentComp(c.id, { condition: e.target.value })} placeholder="Good" />
                  </td>
                  <td className="td">
                    <input type="date" className="field" value={c.listingDate} onChange={(e) => edit.rentComp(c.id, { listingDate: e.target.value })} />
                  </td>
                  <td className="td">
                    <input className="field min-w-[120px]" value={c.sourceUrl} onChange={(e) => edit.rentComp(c.id, { sourceUrl: e.target.value })} placeholder="URL" />
                  </td>
                  <td className="td text-right">
                    <button className="btn-ghost btn-xs text-neg" onClick={() => edit.removeRentComp(c.id)} title="Remove">×</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </TableWrap>
        )}
        {deal.rentComps.some((c) => c.utilitiesIncluded.length > 0 || c.parkingIncluded) && (
          <div className="border-t border-line px-4 py-3">
            <Note>
              Comparables that include utilities or parking are not like-for-like with a unit where
              the tenant pays separately. Adjust the rent down before comparing, or exclude the comp.
            </Note>
          </div>
        )}
      </Panel>

      {/* §15 Sales comparables */}
      <SectionGrid cols={4}>
        <Kpi label="Average price per unit" value={fmtCAD(sc.averagePricePerUnit)} sub={`${sc.count} comparables`} />
        <Kpi label="Median price per unit" value={fmtCAD(sc.medianPricePerUnit)} />
        <Kpi label="Average price per sq ft" value={sc.averagePricePerSqFt ? fmtCAD(sc.averagePricePerSqFt) : '—'} />
        <Kpi label="Average cap rate" value={fmtPct(sc.averageCapRate)} />
      </SectionGrid>

      <Panel title="Subject versus comparables" subtitle="How this property prices against what has actually traded.">
        <TableWrap>
          <thead className="border-b border-line bg-raised">
            <tr>
              <th className="th">Metric</th>
              <th className="th text-right">Subject</th>
              <th className="th text-right">Comparable average</th>
              <th className="th text-right">Difference</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line/60">
            <tr className="row-hover">
              <td className="td">Price per unit</td>
              <td className="td-num">{fmtCAD(r.subjectVsComps.subjectPricePerUnit)}</td>
              <td className="td-num">{fmtCAD(sc.averagePricePerUnit)}</td>
              <td className={cx('td-num', (r.subjectVsComps.pricePerUnitDelta ?? 0) > 0 ? 'text-neg' : 'text-pos')}>
                {r.subjectVsComps.pricePerUnitDelta !== null ? `${r.subjectVsComps.pricePerUnitDelta > 0 ? '+' : ''}${fmtPct(r.subjectVsComps.pricePerUnitDelta, 1)}` : '—'}
              </td>
            </tr>
            <tr className="row-hover">
              <td className="td">Price per square foot</td>
              <td className="td-num">{r.subjectVsComps.subjectPricePerSqFt ? fmtCAD(r.subjectVsComps.subjectPricePerSqFt) : '—'}</td>
              <td className="td-num">{sc.averagePricePerSqFt ? fmtCAD(sc.averagePricePerSqFt) : '—'}</td>
              <td className={cx('td-num', (r.subjectVsComps.pricePerSqFtDelta ?? 0) > 0 ? 'text-neg' : 'text-pos')}>
                {r.subjectVsComps.pricePerSqFtDelta !== null ? `${r.subjectVsComps.pricePerSqFtDelta > 0 ? '+' : ''}${fmtPct(r.subjectVsComps.pricePerSqFtDelta, 1)}` : '—'}
              </td>
            </tr>
            <tr className="row-hover">
              <td className="td">Cap rate</td>
              <td className="td-num">{fmtPct(r.subjectVsComps.subjectCapRate)}</td>
              <td className="td-num">{fmtPct(sc.averageCapRate)}</td>
              <td className={cx('td-num', (r.subjectVsComps.capRateDelta ?? 0) < 0 ? 'text-neg' : 'text-pos')}>
                {r.subjectVsComps.capRateDelta !== null ? `${r.subjectVsComps.capRateDelta > 0 ? '+' : ''}${fmtPct(r.subjectVsComps.capRateDelta, 2)}` : '—'}
              </td>
            </tr>
            <tr className="row-hover">
              <td className="td">Gross rent multiplier</td>
              <td className="td-num">{r.subjectVsComps.subjectGrm ? r.subjectVsComps.subjectGrm.toFixed(2) : '—'}</td>
              <td className="td-num">{sc.averageGrm ? sc.averageGrm.toFixed(2) : '—'}</td>
              <td className="td" />
            </tr>
          </tbody>
        </TableWrap>
        <div className="mt-3">
          <Note>
            Price per unit and price per square foot are screening metrics, not valuations. A lower
            price per unit on a building with knob-and-tube wiring and a 26-year-old roof is not a
            better buy — read this alongside the CapEx forecast.
          </Note>
        </div>
      </Panel>

      <Panel
        title="Sales comparables"
        actions={
          <button className="btn btn-xs" onClick={edit.addSaleComp}>
            Add comparable
          </button>
        }
        dense
      >
        {deal.saleComps.length === 0 ? (
          <div className="p-4">
            <Note>
              No sales comparables entered. These matter most for the refinance: a lender valuing a
              2–4 unit property leans on comparable residential sales, so this is the evidence that
              supports your appraisal assumption.
            </Note>
          </div>
        ) : (
          <TableWrap>
            <thead className="border-b border-line bg-raised">
              <tr>
                <th className="th w-12 text-center">Use</th>
                <th className="th">Address</th>
                <th className="th w-32 text-right">Price</th>
                <th className="th w-16 text-right">Units</th>
                <th className="th w-24 text-right">Sq ft</th>
                <th className="th w-24 text-right">Lot sq ft</th>
                <th className="th w-20 text-right">Built</th>
                <th className="th w-32 text-right">Gross rent</th>
                <th className="th w-32 text-right">NOI</th>
                <th className="th w-24 text-right">Per unit</th>
                <th className="th w-24 text-right">Per sq ft</th>
                <th className="th w-20 text-right">Cap</th>
                <th className="th w-32">Sale date</th>
                <th className="th w-20 text-right">Dist</th>
                <th className="th">Source</th>
                <th className="th w-10" />
              </tr>
            </thead>
            <tbody className="divide-y divide-line/60">
              {sc.rows.map((row) => {
                const c = deal.saleComps.find((x) => x.id === row.id)!
                return (
                  <tr key={c.id} className={cx('row-hover align-top', !c.include && 'opacity-45')}>
                    <td className="td text-center">
                      <input type="checkbox" checked={c.include} onChange={(e) => edit.saleComp(c.id, { include: e.target.checked })} className="h-3.5 w-3.5 rounded border-line text-accent" />
                    </td>
                    <td className="td"><input className="field min-w-[150px]" value={c.address} onChange={(e) => edit.saleComp(c.id, { address: e.target.value })} /></td>
                    <td className="td"><MoneyInput value={c.price || null} onChange={(v) => edit.saleComp(c.id, { price: v })} className="w-32" min={0} /></td>
                    <td className="td"><NumberInput value={c.units} onChange={(v) => edit.saleComp(c.id, { units: v })} className="w-14" min={0} /></td>
                    <td className="td"><NumberInput value={c.buildingSqFt || null} onChange={(v) => edit.saleComp(c.id, { buildingSqFt: v })} className="w-24" min={0} /></td>
                    <td className="td"><NumberInput value={c.lotSqFt || null} onChange={(v) => edit.saleComp(c.id, { lotSqFt: v })} className="w-24" min={0} /></td>
                    <td className="td"><NumberInput value={c.yearBuilt} onChange={(v) => edit.saleComp(c.id, { yearBuilt: v })} className="w-20" /></td>
                    <td className="td"><MoneyInput value={c.grossAnnualRent || null} onChange={(v) => edit.saleComp(c.id, { grossAnnualRent: v })} className="w-32" min={0} /></td>
                    <td className="td"><MoneyInput value={c.noi || null} onChange={(v) => edit.saleComp(c.id, { noi: v })} className="w-32" min={0} /></td>
                    <td className="td-num text-muted">{fmtCAD(row.pricePerUnit)}</td>
                    <td className="td-num text-muted">{row.pricePerSqFt ? fmtCAD(row.pricePerSqFt) : '—'}</td>
                    <td className="td-num">{fmtPct(row.capRate)}</td>
                    <td className="td"><input type="date" className="field" value={c.saleDate} onChange={(e) => edit.saleComp(c.id, { saleDate: e.target.value })} /></td>
                    <td className="td"><NumberInput value={c.distanceKm} onChange={(v) => edit.saleComp(c.id, { distanceKm: v })} className="w-16" decimals={1} /></td>
                    <td className="td"><input className="field min-w-[100px]" value={c.source} onChange={(e) => edit.saleComp(c.id, { source: e.target.value })} placeholder="MLS / URL" /></td>
                    <td className="td text-right">
                      <button className="btn-ghost btn-xs text-neg" onClick={() => edit.removeSaleComp(c.id)} title="Remove">×</button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
            <tfoot className="border-t-2 border-line bg-raised font-semibold">
              <tr>
                <td className="td" colSpan={9}>Average ({sc.count} comparables)</td>
                <td className="td-num">{fmtCAD(sc.averagePricePerUnit)}</td>
                <td className="td-num">{sc.averagePricePerSqFt ? fmtCAD(sc.averagePricePerSqFt) : '—'}</td>
                <td className="td-num">{fmtPct(sc.averageCapRate)}</td>
                <td className="td" colSpan={4} />
              </tr>
            </tfoot>
          </TableWrap>
        )}
      </Panel>
    </div>
  )
}

function SuggestionCard({
  label,
  value,
  note,
  tone,
}: {
  label: string
  value: number | null
  note: string
  tone: 'pos' | 'info' | 'warn' | 'muted'
}) {
  return (
    <div
      className={cx(
        'rounded-md border p-3',
        tone === 'pos' && 'border-pos/35 bg-pos/5',
        tone === 'info' && 'border-info/35 bg-info/5',
        tone === 'warn' && 'border-warn/35 bg-warn/5',
        tone === 'muted' && 'border-line bg-raised',
      )}
    >
      <div className="label">{label}</div>
      <div className="num mt-1 text-xl font-semibold">{fmtCAD(value)}</div>
      <div className="mt-0.5 text-2xs text-muted">{note}</div>
    </div>
  )
}

function TinyToggle({ on, label, onClick }: { on: boolean; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cx(
        'rounded border px-1.5 py-0.5 text-2xs transition-colors',
        on ? 'border-accent bg-accent/10 text-accent' : 'border-line text-subtle hover:bg-raised',
      )}
    >
      {label}
    </button>
  )
}

export { fmtNumber, Badge }
