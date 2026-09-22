import { useState } from 'react'
import type { Deal, Unit } from '@/engine/types'
import type { UnderwriteResult } from '@/engine/underwrite'
import { useDealEdit } from '@/lib/dealEdit'
import { buildUnit } from '@/data/defaults'
import {
  Badge,
  Callout,
  Collapsible,
  Kpi,
  MoneyInput,
  NumberInput,
  Panel,
  Segmented,
  TableWrap,
  Toggle,
  cx,
} from '@/components/ui/primitives'
import { Note, SectionGrid } from '@/components/shared'
import { fmtCAD, fmtNumber, fmtPct } from '@/engine/money'
import { ONTARIO_RENT_GUIDELINE, ONTARIO_RENT_GUIDELINE_NOTE } from '@/data/ottawa'
import { suggestedRentForBedrooms } from '@/engine/comps'

type View = 'CORE' | 'ANCILLARY' | 'LEASE'

export default function RentRollPage({ deal, r }: { deal: Deal; r: UnderwriteResult }) {
  const edit = useDealEdit(deal.id)
  const [view, setView] = useState<View>('CORE')
  const rr = r.rentRoll

  return (
    <div className="space-y-5">
      <SectionGrid cols={4}>
        <Kpi label="Current monthly rent" value={fmtCAD(rr.currentMonthlyResidentialRent)} sub={`${fmtCAD(rr.currentAnnualResidentialRent)} annual`} />
        <Kpi label="Market monthly rent" value={fmtCAD(rr.marketMonthlyResidentialRent)} sub={`${fmtCAD(rr.marketAnnualResidentialRent)} annual`} />
        <Kpi
          label="Current gross scheduled income"
          value={fmtCAD(rr.currentMonthlyGSI)}
          sub={`Incl. ${fmtCAD(rr.currentMonthlyAncillary)} ancillary · ${fmtCAD(rr.currentAnnualGSI)}/yr`}
        />
        <Kpi
          label="Stabilized gross scheduled income"
          value={fmtCAD(rr.stabilizedMonthlyGSI)}
          sub={`Incl. ${fmtCAD(rr.marketMonthlyAncillary)} ancillary · ${fmtCAD(rr.stabilizedAnnualGSI)}/yr`}
        />
      </SectionGrid>

      {rr.belowMarketUnits.length > 0 && (
        <Callout tone="warn" title={`${rr.belowMarketUnits.length} occupied unit(s) below market`}>
          <p>
            Combined gap of {fmtCAD(rr.belowMarketUnits.reduce((s, u) => s + u.belowMarketGap, 0))}/month
            ({fmtCAD(rr.belowMarketUnits.reduce((s, u) => s + u.belowMarketGap, 0) * 12)}/year).
            {' '}
            <strong className="text-ink">
              This is not income you have on closing.
            </strong>{' '}
            {ONTARIO_RENT_GUIDELINE_NOTE} The {new Date().getFullYear()} guideline is{' '}
            {fmtPct(ONTARIO_RENT_GUIDELINE[new Date().getFullYear()] ?? 0.025, 1)}.
          </p>
          <ul className="mt-2 space-y-0.5">
            {rr.belowMarketUnits.map((u) => (
              <li key={u.unitId}>
                Unit {u.unitNumber}: {fmtCAD(u.currentRent)} vs {fmtCAD(u.marketRent)} market —{' '}
                <span className="text-warn">
                  {fmtCAD(u.belowMarketGap)}/mo ({fmtPct(u.belowMarketPercent)} below)
                </span>
              </li>
            ))}
          </ul>
        </Callout>
      )}

      <Panel
        title="Unit-by-unit rent roll"
        subtitle="Never a single building total — every unit is underwritten separately."
        actions={
          <div className="flex items-center gap-2">
            <Segmented
              value={view}
              onChange={setView}
              size="sm"
              options={[
                { value: 'CORE', label: 'Rent' },
                { value: 'ANCILLARY', label: 'Other income' },
                { value: 'LEASE', label: 'Lease' },
              ]}
            />
            <button
              className="btn btn-xs"
              onClick={() => edit.addUnit(buildUnit(deal.units.length))}
            >
              Add unit
            </button>
          </div>
        }
        dense
      >
        <TableWrap>
          <thead className="border-b border-line bg-raised">
            <tr>
              <th className="th w-16">Unit</th>
              <th className="th w-16 text-center">Legal</th>
              {view === 'CORE' && (
                <>
                  <th className="th w-16 text-right">Beds</th>
                  <th className="th w-16 text-right">Baths</th>
                  <th className="th w-20 text-right">Sq ft</th>
                  <th className="th w-20 text-center">Occupied</th>
                  <th className="th w-32 text-right">Current rent</th>
                  <th className="th w-32 text-right">Market rent</th>
                  <th className="th w-24 text-right">Gap</th>
                  <th className="th w-28 text-right">Suggested</th>
                </>
              )}
              {view === 'ANCILLARY' && (
                <>
                  <th className="th w-28 text-right">Parking</th>
                  <th className="th w-28 text-right">Storage</th>
                  <th className="th w-28 text-right">Laundry</th>
                  <th className="th w-28 text-right">Other</th>
                  <th className="th w-28 text-right">Market total</th>
                </>
              )}
              {view === 'LEASE' && (
                <>
                  <th className="th w-36">Lease start</th>
                  <th className="th w-36">Lease expiry</th>
                  <th className="th w-20 text-center">M2M</th>
                  <th className="th w-36">Last increase</th>
                  <th className="th w-36">Next legal increase</th>
                  <th className="th w-40 text-center">Tenant pays</th>
                </>
              )}
              <th className="th">Notes</th>
              <th className="th w-10" />
            </tr>
          </thead>
          <tbody className="divide-y divide-line/60">
            {deal.units.map((u) => (
              <UnitRow key={u.id} unit={u} view={view} r={r} edit={edit} />
            ))}
            {deal.units.length === 0 && (
              <tr>
                <td className="td text-muted" colSpan={12}>
                  No units yet — add one to start the rent roll.
                </td>
              </tr>
            )}
          </tbody>
          <tfoot className="border-t-2 border-line bg-raised font-semibold">
            <tr>
              <td className="td" colSpan={2}>
                Total ({deal.units.length} units)
              </td>
              {view === 'CORE' && (
                <>
                  <td className="td-num">{fmtNumber(rr.totalBedrooms)}</td>
                  <td className="td" />
                  <td className="td-num">{fmtNumber(rr.totalSqFt)}</td>
                  <td className="td-num">{rr.occupiedCount}/{rr.unitCount}</td>
                  <td className="td-num">{fmtCAD(rr.currentMonthlyResidentialRent)}</td>
                  <td className="td-num">{fmtCAD(rr.marketMonthlyResidentialRent)}</td>
                  <td className="td-num text-warn">{fmtCAD(rr.monthlyRentUpside)}</td>
                  <td className="td" />
                </>
              )}
              {view === 'ANCILLARY' && (
                <>
                  <td className="td-num">{fmtCAD(deal.units.reduce((s, u) => s + u.parkingIncome, 0))}</td>
                  <td className="td-num">{fmtCAD(deal.units.reduce((s, u) => s + u.storageIncome, 0))}</td>
                  <td className="td-num">{fmtCAD(deal.units.reduce((s, u) => s + u.laundryIncome, 0))}</td>
                  <td className="td-num">{fmtCAD(deal.units.reduce((s, u) => s + u.otherIncome, 0))}</td>
                  <td className="td-num">{fmtCAD(rr.marketMonthlyAncillary)}</td>
                </>
              )}
              {view === 'LEASE' && <td className="td" colSpan={6} />}
              <td className="td" colSpan={2} />
            </tr>
          </tfoot>
        </TableWrap>
      </Panel>

      <div className="grid gap-5 lg:grid-cols-2">
        <Panel title="Current income" subtitle="What the building produces today, at contract rents.">
          <StatLine label="Current monthly residential rent" value={fmtCAD(rr.currentMonthlyResidentialRent)} />
          <StatLine label="Current annual residential rent" value={fmtCAD(rr.currentAnnualResidentialRent)} />
          <StatLine label="Current monthly ancillary income" value={fmtCAD(rr.currentMonthlyAncillary)} />
          <StatLine label="Current annual ancillary income" value={fmtCAD(rr.currentAnnualAncillary)} />
          <StatLine label="Current gross scheduled income (monthly)" value={fmtCAD(rr.currentMonthlyGSI)} strong />
          <StatLine label="Current gross scheduled income (annual)" value={fmtCAD(rr.currentAnnualGSI)} strong />
          <div className="mt-3">
            <Note>
              Vacant units contribute nothing here. That is deliberate — current income is what is
              actually being collected.
            </Note>
          </div>
        </Panel>

        <Panel title="Stabilized / market income" subtitle="What the building produces once vacant units are let at market.">
          <StatLine label="Potential monthly market rent" value={fmtCAD(rr.marketMonthlyResidentialRent)} />
          <StatLine label="Potential annual market rent" value={fmtCAD(rr.marketAnnualResidentialRent)} />
          <StatLine label="Potential monthly ancillary income" value={fmtCAD(rr.marketMonthlyAncillary)} />
          <StatLine label="Potential annual ancillary income" value={fmtCAD(rr.marketAnnualAncillary)} />
          <StatLine label="Stabilized gross scheduled income (monthly)" value={fmtCAD(rr.stabilizedMonthlyGSI)} strong />
          <StatLine label="Stabilized gross scheduled income (annual)" value={fmtCAD(rr.stabilizedAnnualGSI)} strong />
          <div className="mt-3">
            <Note>
              The stabilized figure keeps sitting tenants on their contract rent. Only the Optimistic
              scenario marks them to market, and it says so.
            </Note>
          </div>
        </Panel>
      </div>

      <Collapsible title="Rent metrics" subtitle="Per bedroom, per square foot and per unit.">
        <SectionGrid cols={4}>
          <Kpi label="Average rent per unit" value={fmtCAD(rr.averageRentPerUnit)} sub="Occupied units only" />
          <Kpi label="Median rent per unit" value={fmtCAD(rr.medianRentPerUnit)} />
          <Kpi label="Rent per bedroom" value={fmtCAD(rr.rentPerBedroom)} sub={`${rr.totalBedrooms} bedrooms`} />
          <Kpi label="Rent per square foot" value={rr.rentPerSqFt ? `${fmtCAD(rr.rentPerSqFt, 2)}` : '—'} sub={`${fmtNumber(rr.totalSqFt)} sq ft`} />
        </SectionGrid>
      </Collapsible>
    </div>
  )
}

function UnitRow({
  unit,
  view,
  r,
  edit,
}: {
  unit: Unit
  view: View
  r: UnderwriteResult
  edit: ReturnType<typeof useDealEdit>
}) {
  const gap = unit.occupied ? Math.max(0, unit.marketRent - unit.currentRent) : 0
  const suggestion = suggestedRentForBedrooms(r.rentComps, unit.bedrooms)

  return (
    <tr className={cx('row-hover align-top', !unit.legalUnit && 'bg-neg/5')}>
      <td className="td">
        <input
          className="field w-14 text-center"
          value={unit.unitNumber}
          onChange={(e) => edit.unit(unit.id, { unitNumber: e.target.value })}
        />
      </td>
      <td className="td text-center">
        <input
          type="checkbox"
          checked={unit.legalUnit}
          onChange={(e) => edit.unit(unit.id, { legalUnit: e.target.checked })}
          className="h-3.5 w-3.5 rounded border-line text-accent"
        />
      </td>

      {view === 'CORE' && (
        <>
          <td className="td"><NumberInput value={unit.bedrooms} onChange={(v) => edit.unit(unit.id, { bedrooms: v })} className="w-14" min={0} /></td>
          <td className="td"><NumberInput value={unit.bathrooms} onChange={(v) => edit.unit(unit.id, { bathrooms: v })} className="w-14" min={0} decimals={1} /></td>
          <td className="td"><NumberInput value={unit.sqFt || null} onChange={(v) => edit.unit(unit.id, { sqFt: v })} className="w-20" min={0} /></td>
          <td className="td text-center">
            <input
              type="checkbox"
              checked={unit.occupied}
              onChange={(e) => edit.unit(unit.id, { occupied: e.target.checked })}
              className="h-3.5 w-3.5 rounded border-line text-accent"
            />
          </td>
          <td className="td"><MoneyInput value={unit.currentRent || null} onChange={(v) => edit.unit(unit.id, { currentRent: v })} className="w-32" min={0} /></td>
          <td className="td"><MoneyInput value={unit.marketRent || null} onChange={(v) => edit.unit(unit.id, { marketRent: v })} className="w-32" min={0} /></td>
          <td className={cx('td-num', gap > 0 && 'text-warn')}>{gap > 0 ? fmtCAD(gap) : '—'}</td>
          <td className="td-num text-2xs text-subtle">
            {suggestion.base !== null ? (
              <button
                className="underline decoration-dotted hover:text-accent"
                title={`Comparables suggest ${fmtCAD(suggestion.conservative)} conservative / ${fmtCAD(suggestion.base)} base / ${fmtCAD(suggestion.optimistic)} optimistic${suggestion.matched ? '' : ' (no bedroom-matched comps)'} — click to apply the base figure`}
                onClick={() => edit.unit(unit.id, { marketRent: Math.round(suggestion.base!) })}
              >
                {fmtCAD(suggestion.base)}
              </button>
            ) : (
              '—'
            )}
          </td>
        </>
      )}

      {view === 'ANCILLARY' && (
        <>
          <td className="td"><MoneyInput value={unit.parkingIncome || null} onChange={(v) => edit.unit(unit.id, { parkingIncome: v })} className="w-24" min={0} /></td>
          <td className="td"><MoneyInput value={unit.storageIncome || null} onChange={(v) => edit.unit(unit.id, { storageIncome: v })} className="w-24" min={0} /></td>
          <td className="td"><MoneyInput value={unit.laundryIncome || null} onChange={(v) => edit.unit(unit.id, { laundryIncome: v })} className="w-24" min={0} /></td>
          <td className="td"><MoneyInput value={unit.otherIncome || null} onChange={(v) => edit.unit(unit.id, { otherIncome: v })} className="w-24" min={0} /></td>
          <td className="td">
            <MoneyInput
              value={
                (unit.parkingIncomeMarket || unit.parkingIncome) +
                  (unit.storageIncomeMarket || unit.storageIncome) +
                  (unit.laundryIncomeMarket || unit.laundryIncome) +
                  (unit.otherIncomeMarket || unit.otherIncome) || null
              }
              onChange={(v) =>
                edit.unit(unit.id, {
                  parkingIncomeMarket: v,
                  storageIncomeMarket: 0,
                  laundryIncomeMarket: 0,
                  otherIncomeMarket: 0,
                })
              }
              className="w-28"
              min={0}
            />
          </td>
        </>
      )}

      {view === 'LEASE' && (
        <>
          <td className="td">
            <input type="date" className="field" value={unit.leaseStart} onChange={(e) => edit.unit(unit.id, { leaseStart: e.target.value })} />
          </td>
          <td className="td">
            <input type="date" className="field" value={unit.leaseEnd} onChange={(e) => edit.unit(unit.id, { leaseEnd: e.target.value })} />
          </td>
          <td className="td text-center">
            <input
              type="checkbox"
              checked={unit.monthToMonth}
              onChange={(e) => edit.unit(unit.id, { monthToMonth: e.target.checked })}
              className="h-3.5 w-3.5 rounded border-line text-accent"
            />
          </td>
          <td className="td">
            <input type="date" className="field" value={unit.lastRentIncrease} onChange={(e) => edit.unit(unit.id, { lastRentIncrease: e.target.value })} />
          </td>
          <td className="td">
            <input type="date" className="field" value={unit.nextLegalIncreaseDate} onChange={(e) => edit.unit(unit.id, { nextLegalIncreaseDate: e.target.value })} />
            {unit.lastRentIncrease && (
              <div className="mt-0.5 text-2xs text-subtle">
                Guideline: {fmtCAD(unit.currentRent * (ONTARIO_RENT_GUIDELINE[new Date().getFullYear()] ?? 0.025))}/mo
              </div>
            )}
          </td>
          <td className="td">
            <div className="flex flex-col gap-1">
              <Toggle checked={unit.tenantPaysHydro} onChange={(v) => edit.unit(unit.id, { tenantPaysHydro: v })} label={<span className="text-2xs">Hydro</span>} />
              <Toggle checked={unit.tenantPaysHeat} onChange={(v) => edit.unit(unit.id, { tenantPaysHeat: v })} label={<span className="text-2xs">Heat</span>} />
              <Toggle checked={unit.tenantPaysWater} onChange={(v) => edit.unit(unit.id, { tenantPaysWater: v })} label={<span className="text-2xs">Water</span>} />
            </div>
          </td>
        </>
      )}

      <td className="td">
        <input
          className="field min-w-[140px]"
          value={unit.notes}
          onChange={(e) => edit.unit(unit.id, { notes: e.target.value })}
          placeholder="—"
        />
        {!unit.legalUnit && (
          <div className="mt-1">
            <Badge tone="neg">Non-conforming</Badge>
          </div>
        )}
      </td>
      <td className="td text-right">
        <button
          className="btn-ghost btn-xs text-neg"
          onClick={() => edit.removeUnit(unit.id)}
          aria-label={`Remove unit ${unit.unitNumber}`}
          title="Remove unit"
        >
          ×
        </button>
      </td>
    </tr>
  )
}

function StatLine({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className={cx('flex items-baseline justify-between gap-3 border-b border-line/50 py-1.5 last:border-0', strong && 'font-semibold')}>
      <span className="text-xs text-muted">{label}</span>
      <span className="num text-sm">{value}</span>
    </div>
  )
}
