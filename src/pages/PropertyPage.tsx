import type { Deal, ComplianceState, PropertyCondition, PropertyType, OccupancyStatus } from '@/engine/types'
import type { UnderwriteResult } from '@/engine/underwrite'
import { useDealEdit } from '@/lib/dealEdit'
import {
  Badge,
  Callout,
  Collapsible,
  MoneyInput,
  NumberInput,
  Panel,
  Select,
  TableWrap,
  TextArea,
  TextInput,
  Toggle,
  cx,
} from '@/components/ui/primitives'
import { Note, SectionGrid } from '@/components/shared'
import { OTTAWA_NEIGHBOURHOODS } from '@/data/ottawa'
import { COMPONENT_SPECS } from '@/engine/capex'
import { fmtCAD, fmtNumber } from '@/engine/money'

const PROPERTY_TYPES: { value: PropertyType; label: string }[] = [
  { value: 'DUPLEX', label: 'Duplex' },
  { value: 'TRIPLEX', label: 'Triplex' },
  { value: 'FOURPLEX', label: 'Fourplex' },
  { value: 'MULTIFAMILY_5_PLUS', label: '5+ unit multifamily' },
  { value: 'HOUSE_WITH_SDU', label: 'House with legal secondary dwelling' },
  { value: 'OTHER', label: 'Other' },
]

const CONDITIONS: { value: PropertyCondition; label: string }[] = [
  { value: 'NEW', label: 'New' },
  { value: 'EXCELLENT', label: 'Excellent' },
  { value: 'GOOD', label: 'Good' },
  { value: 'AVERAGE', label: 'Average' },
  { value: 'RENOVATION_REQUIRED', label: 'Renovation required' },
  { value: 'MAJOR_CAPITAL_REQUIRED', label: 'Major capital work required' },
]

const OCCUPANCY: { value: OccupancyStatus; label: string }[] = [
  { value: 'FULLY_OCCUPIED', label: 'Fully occupied' },
  { value: 'PARTIALLY_OCCUPIED', label: 'Partially occupied' },
  { value: 'VACANT', label: 'Vacant' },
  { value: 'OWNER_OCCUPIED', label: 'Owner occupied' },
  { value: 'MIXED', label: 'Mixed' },
]

const COMPLIANCE: { value: ComplianceState; label: string }[] = [
  { value: 'CONFIRMED', label: 'Confirmed' },
  { value: 'UNVERIFIED', label: 'Unverified' },
  { value: 'NON_COMPLIANT', label: 'Non-compliant' },
  { value: 'NA', label: 'Not applicable' },
]

const CONDITION_OPTIONS = [
  { value: 'GOOD' as const, label: 'Good' },
  { value: 'FAIR' as const, label: 'Fair' },
  { value: 'POOR' as const, label: 'Poor' },
  { value: 'UNKNOWN' as const, label: 'Unknown' },
  { value: 'NA' as const, label: 'N/A' },
]

const UTILITIES = ['Hydro', 'Heat', 'Water', 'Internet', 'Gas']

export default function PropertyPage({ deal, r }: { deal: Deal; r: UnderwriteResult }) {
  const edit = useDealEdit(deal.id)
  const info = deal.info
  const hood = OTTAWA_NEIGHBOURHOODS.find((n) => n.name === info.neighbourhood)

  return (
    <div className="space-y-5">
      <Panel title="Identification" subtitle="Where the property is and how it is listed.">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <TextInput label="Deal name" value={deal.name} onChange={(v) => edit.deal({ name: v })} className="lg:col-span-2" />
          <TextInput label="Address" value={info.address} onChange={(v) => edit.info({ address: v })} className="lg:col-span-2" />
          <TextInput label="City" value={info.city} onChange={(v) => edit.info({ city: v })} />
          <TextInput label="Province" value={info.province} onChange={(v) => edit.info({ province: v })} />
          <TextInput label="Postal code" value={info.postalCode} onChange={(v) => edit.info({ postalCode: v })} />
          <div>
            <label className="label mb-1">Neighbourhood</label>
            <input
              className="field"
              list="ottawa-neighbourhoods"
              value={info.neighbourhood}
              onChange={(e) => edit.info({ neighbourhood: e.target.value })}
              placeholder="Overbrook"
            />
            <datalist id="ottawa-neighbourhoods">
              {OTTAWA_NEIGHBOURHOODS.map((n) => (
                <option key={n.name} value={n.name} />
              ))}
            </datalist>
          </div>
          <TextInput label="MLS number" value={info.mlsNumber} onChange={(v) => edit.info({ mlsNumber: v })} />
          <TextInput
            label="Listing URL"
            value={info.listingUrl}
            onChange={(v) => edit.info({ listingUrl: v })}
            className="lg:col-span-3"
            hint="Attach the source so the figures can be traced back (§33)."
          />
        </div>

        {hood && (
          <div className="mt-4">
            <Callout tone="info" title={`${hood.name} — ${hood.ward}`}>
              <p>{hood.note}</p>
              <p className="mt-1">
                <strong className="text-ink">Housing stock:</strong> {hood.housingStock}
              </p>
              <p className="mt-1">
                <strong className="text-ink">Watch-outs:</strong> {hood.watchOuts}
              </p>
            </Callout>
          </div>
        )}
      </Panel>

      <Panel title="Pricing" subtitle="Asking and proposed offer. Cap rates are reported against both.">
        <SectionGrid cols={4}>
          <MoneyInput label="Asking price" value={info.askingPrice} onChange={(v) => edit.info({ askingPrice: v })} />
          <MoneyInput
            label="Proposed offer price"
            value={info.offerPrice}
            onChange={(v) => edit.info({ offerPrice: v })}
            hint="Leave at zero to underwrite at asking."
          />
          <div className="rounded-md border border-line bg-raised p-3">
            <div className="label">Price per unit</div>
            <div className="num mt-1 text-lg font-semibold">
              {fmtCAD(deal.units.length > 0 ? r.price / deal.units.length : null)}
            </div>
            {r.saleComps.averagePricePerUnit && (
              <Note>Comparable average {fmtCAD(r.saleComps.averagePricePerUnit)}</Note>
            )}
          </div>
          <div className="rounded-md border border-line bg-raised p-3">
            <div className="label">Price per square foot</div>
            <div className="num mt-1 text-lg font-semibold">
              {fmtCAD(info.buildingSizeSqFt > 0 ? r.price / info.buildingSizeSqFt : null)}
            </div>
            {r.saleComps.averagePricePerSqFt && (
              <Note>Comparable average {fmtCAD(r.saleComps.averagePricePerSqFt)}</Note>
            )}
          </div>
        </SectionGrid>
      </Panel>

      <Panel title="Building" subtitle="Physical characteristics and configuration.">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Select label="Property type" value={info.propertyType} onChange={(v) => edit.info({ propertyType: v })} options={PROPERTY_TYPES} />
          <Select label="Condition" value={info.condition} onChange={(v) => edit.info({ condition: v })} options={CONDITIONS} />
          <NumberInput label="Year built" value={info.yearBuilt} onChange={(v) => edit.info({ yearBuilt: v })} placeholder="1962" />
          <NumberInput label="Year substantially renovated" value={info.yearRenovated} onChange={(v) => edit.info({ yearRenovated: v })} />
          <NumberInput label="Legal units" value={info.legalUnits} onChange={(v) => edit.info({ legalUnits: v })} min={0} />
          <NumberInput
            label="Non-conforming units"
            value={info.nonConformingUnits}
            onChange={(v) => edit.info({ nonConformingUnits: v })}
            min={0}
            hint="Income from these is excluded from the conservative case."
          />
          <NumberInput label="Total bedrooms" value={info.totalBedrooms} onChange={(v) => edit.info({ totalBedrooms: v })} min={0} />
          <NumberInput label="Total bathrooms" value={info.totalBathrooms} onChange={(v) => edit.info({ totalBathrooms: v })} min={0} decimals={1} />
          <NumberInput label="Parking spaces" value={info.parkingSpaces} onChange={(v) => edit.info({ parkingSpaces: v })} min={0} />
          <NumberInput label="Lot size (sq ft)" value={info.lotSizeSqFt} onChange={(v) => edit.info({ lotSizeSqFt: v })} min={0} />
          <NumberInput label="Building size (sq ft)" value={info.buildingSizeSqFt} onChange={(v) => edit.info({ buildingSizeSqFt: v })} min={0} />
          <TextInput label="Zoning" value={info.zoning} onChange={(v) => edit.info({ zoning: v })} placeholder="R4" />
          <Select label="Current occupancy" value={info.occupancyStatus} onChange={(v) => edit.info({ occupancyStatus: v })} options={OCCUPANCY} />
        </div>
      </Panel>

      <Panel title="Utilities and metering" subtitle="Who pays what. Without separate meters, heating inflation lands on the owner.">
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="space-y-2.5">
            <Toggle checked={info.separateHydroMeters} onChange={(v) => edit.info({ separateHydroMeters: v })} label="Separate hydro meters" />
            <Toggle checked={info.separateGasMeters} onChange={(v) => edit.info({ separateGasMeters: v })} label="Separate gas meters" />
            <Toggle checked={info.separateWaterMeters} onChange={(v) => edit.info({ separateWaterMeters: v })} label="Separate water meters" />
          </div>
          <UtilityPicker
            label="Tenant-paid utilities"
            selected={info.tenantPaidUtilities}
            onChange={(v) => edit.info({ tenantPaidUtilities: v })}
          />
          <UtilityPicker
            label="Landlord-paid utilities"
            selected={info.landlordPaidUtilities}
            onChange={(v) => edit.info({ landlordPaidUtilities: v })}
          />
        </div>
        {!info.separateHydroMeters && (
          <div className="mt-4">
            <Callout tone="warn" compact>
              Without separate hydro meters the owner carries every tenant's electricity. Price the
              risk in the Electricity expense line and expect a valuation discount on resale.
            </Callout>
          </div>
        )}
      </Panel>

      {/* §21 Legal */}
      <Panel
        title="Legal and unit compliance"
        subtitle="The income you underwrite is only as good as the units' legal status."
        actions={
          r.legal.hasNonConformingWarning ? <Badge tone="neg">Warning</Badge> : <Badge tone="pos">Clear</Badge>
        }
      >
        {r.legal.messages.length > 0 && (
          <div className="mb-4 space-y-2">
            {r.legal.messages.map((m, i) => (
              <Callout key={i} tone={m.startsWith('WARNING') ? 'neg' : 'warn'} compact>
                {m}
              </Callout>
            ))}
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Select label="Zoning confirmation" value={deal.legal.zoningConfirmed} onChange={(v) => edit.legal({ zoningConfirmed: v })} options={COMPLIANCE} />
          <Select label="Fire compliance" value={deal.legal.fireCompliance} onChange={(v) => edit.legal({ fireCompliance: v })} options={COMPLIANCE} />
          <Select label="Building permits" value={deal.legal.buildingPermits} onChange={(v) => edit.legal({ buildingPermits: v })} options={COMPLIANCE} />
          <Select label="Occupancy permits" value={deal.legal.occupancyPermits} onChange={(v) => edit.legal({ occupancyPermits: v })} options={COMPLIANCE} />
          <Select label="Separate entrances" value={deal.legal.separateEntrances} onChange={(v) => edit.legal({ separateEntrances: v })} options={COMPLIANCE} />
          <Select label="Egress" value={deal.legal.egress} onChange={(v) => edit.legal({ egress: v })} options={COMPLIANCE} />
          <Select label="Electrical compliance" value={deal.legal.electricalCompliance} onChange={(v) => edit.legal({ electricalCompliance: v })} options={COMPLIANCE} />
        </div>

        <div className="mt-4 space-y-3">
          <Toggle
            checked={deal.legal.includeNonConformingIncomeInConservative}
            onChange={(v) => edit.legal({ includeNonConformingIncomeInConservative: v })}
            label="Include non-conforming unit income in the conservative case"
            hint="Off by default. Turning this on means the conservative scenario relies on income that a municipal order could remove."
          />
          <TextArea label="Legal notes" value={deal.legal.notes} onChange={(v) => edit.legal({ notes: v })} rows={2} />
        </div>
      </Panel>

      {/* §1 + §20 component notes */}
      <Panel
        title="Building components and deferred maintenance"
        subtitle="Ages and conditions drive the CapEx forecast and the capital risk score."
        actions={
          <Badge tone={r.capex.riskLevel === 'LOW' ? 'pos' : r.capex.riskLevel === 'MODERATE' ? 'warn' : 'neg'}>
            {r.capex.riskLevel} risk
          </Badge>
        }
        dense
      >
        <TableWrap>
          <thead className="border-b border-line bg-raised">
            <tr>
              <th className="th">Component</th>
              <th className="th w-24 text-right">Age (yrs)</th>
              <th className="th w-28">Condition</th>
              <th className="th w-32 text-right">Est. cost</th>
              <th className="th w-28 text-right">Remaining life</th>
              <th className="th w-24">Basis</th>
              <th className="th w-20 text-center">Forecast</th>
              <th className="th">Notes</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line/60">
            {deal.components.map((c) => {
              const spec = COMPONENT_SPECS.find((s) => s.key === c.key)!
              const item = r.capex.items.find((i) => i.key === c.key)
              return (
                <tr key={c.key} className="row-hover">
                  <td className="td">
                    <span className="font-medium">{spec.label}</span>
                    {spec.hazard && <Badge tone="warn">hazard</Badge>}
                    {spec.usefulLifeYears && (
                      <div className="text-2xs text-subtle">~{spec.usefulLifeYears} yr typical life</div>
                    )}
                  </td>
                  <td className="td">
                    <NumberInput value={c.ageYears} onChange={(v) => edit.component(c.key, { ageYears: v })} className="w-20" />
                  </td>
                  <td className="td">
                    <Select value={c.condition} onChange={(v) => edit.component(c.key, { condition: v })} options={CONDITION_OPTIONS} />
                  </td>
                  <td className="td">
                    <MoneyInput
                      value={c.estimatedCost || null}
                      onChange={(v) => edit.component(c.key, { estimatedCost: v })}
                      placeholder={String(spec.perUnit ? spec.defaultCost * deal.units.length : spec.defaultCost)}
                      className="w-32"
                    />
                  </td>
                  <td className={cx('td-num', item?.remainingLifeYears !== null && item?.remainingLifeYears !== undefined && item.remainingLifeYears <= 3 && 'text-warn')}>
                    {item?.remainingLifeYears !== null && item?.remainingLifeYears !== undefined
                      ? fmtNumber(item.remainingLifeYears)
                      : '—'}
                  </td>
                  <td className="td">
                    {item?.basis === 'CONDITION' && <Badge tone="info">Condition</Badge>}
                    {item?.basis === 'AGE' && <Badge tone="info">Age</Badge>}
                    {item?.basis === 'UNKNOWN' && <Badge tone="warn">Assumed</Badge>}
                    {!item?.basis && <span className="text-2xs text-subtle">—</span>}
                  </td>
                  <td className="td text-center">
                    <input
                      type="checkbox"
                      checked={c.includeInForecast}
                      onChange={(e) => edit.component(c.key, { includeInForecast: e.target.checked })}
                      className="h-3.5 w-3.5 rounded border-line text-accent"
                    />
                  </td>
                  <td className="td">
                    <input
                      className="field w-full min-w-[160px]"
                      value={c.note}
                      onChange={(e) => edit.component(c.key, { note: e.target.value })}
                      placeholder="—"
                    />
                  </td>
                </tr>
              )
            })}
          </tbody>
        </TableWrap>
        <div className="border-t border-line px-4 py-3">
          <Note>
            Blank cost cells fall back to the editable Ottawa default for that component
            ({fmtCAD(COMPONENT_SPECS.find((s) => s.key === 'ROOF')!.defaultCost)} for a roof, for example).
            Ticking "Forecast" includes the item in the 1/3/5/10-year capital buckets on the Scorecard
            &amp; risk page. A component marked <em>Assumed</em> has neither an age nor a condition
            recorded, so the model places a full replacement in the ten-year bucket — a placeholder
            for an inspection, not a finding. Recording ages turns those into real forecasts.
          </Note>
        </div>
      </Panel>

      <Collapsible title="Market ratings" subtitle="Your judgement, recorded separately from the arithmetic (§23, §35).">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <RatingInput label="Rental demand" value={deal.ratings.rentalDemand} onChange={(v) => edit.ratings({ rentalDemand: v })} />
          <RatingInput label="Location quality" value={deal.ratings.locationQuality} onChange={(v) => edit.ratings({ locationQuality: v })} />
          <RatingInput label="Appreciation potential" value={deal.ratings.appreciationPotential} onChange={(v) => edit.ratings({ appreciationPotential: v })} />
          <RatingInput label="Neighbourhood trajectory" value={deal.ratings.neighbourhoodTrajectory} onChange={(v) => edit.ratings({ neighbourhoodTrajectory: v })} />
          <RatingInput label="Liquidity / resale demand" value={deal.ratings.liquidityResaleDemand} onChange={(v) => edit.ratings({ liquidityResaleDemand: v })} />
        </div>
        <div className="mt-4">
          <TextArea label="Notes" value={deal.ratings.notes} onChange={(v) => edit.ratings({ notes: v })} rows={2} />
        </div>
        <div className="mt-3">
          <Note>
            These feed the scorecard's subjective dimensions and nothing else. They never enter NOI,
            cap rate, DSCR or cash flow.
          </Note>
        </div>
      </Collapsible>

      <Panel title="Deal notes">
        <TextArea value={deal.notes} onChange={(v) => edit.deal({ notes: v })} rows={4} placeholder="Showing notes, vendor motivation, conditions, timelines…" />
      </Panel>
    </div>
  )
}

function UtilityPicker({
  label,
  selected,
  onChange,
}: {
  label: string
  selected: string[]
  onChange: (v: string[]) => void
}) {
  return (
    <div>
      <div className="label mb-1.5">{label}</div>
      <div className="flex flex-wrap gap-1.5">
        {UTILITIES.map((u) => {
          const on = selected.includes(u)
          return (
            <button
              key={u}
              type="button"
              onClick={() => onChange(on ? selected.filter((x) => x !== u) : [...selected, u])}
              className={cx(
                'rounded-full border px-2.5 py-1 text-2xs font-medium transition-colors',
                on ? 'border-accent bg-accent/10 text-accent' : 'border-line text-muted hover:bg-raised',
              )}
            >
              {u}
            </button>
          )
        })}
      </div>
    </div>
  )
}

function RatingInput({
  label,
  value,
  onChange,
}: {
  label: string
  value: number
  onChange: (v: number) => void
}) {
  return (
    <div>
      <div className="label mb-1.5">{label}</div>
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => onChange(n)}
            className={cx(
              'h-8 flex-1 rounded-md border text-xs font-semibold transition-colors',
              value >= n ? 'border-accent bg-accent/10 text-accent' : 'border-line text-subtle hover:bg-raised',
            )}
          >
            {n}
          </button>
        ))}
      </div>
    </div>
  )
}
