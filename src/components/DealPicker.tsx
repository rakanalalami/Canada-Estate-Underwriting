import { useActiveDeal, useStore } from '@/store/useStore'
import { DEAL_STATUS_META } from '@/components/statusMeta'
import { Badge, Select } from '@/components/ui/primitives'

export function DealPicker() {
  const deals = useStore((s) => s.deals)
  const activeId = useStore((s) => s.activeDealId)
  const setActive = useStore((s) => s.setActiveDeal)
  const addDeal = useStore((s) => s.addDeal)
  const setStatus = useStore((s) => s.setDealStatus)
  const deal = useActiveDeal()

  const visible = deals.filter((d) => !d.archived)

  return (
    <div className="space-y-2">
      <label className="label">Active deal</label>
      {visible.length > 0 ? (
        <select
          className="field text-sm"
          value={activeId ?? ''}
          onChange={(e) => setActive(e.target.value)}
        >
          {visible.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name || 'Untitled'}
            </option>
          ))}
        </select>
      ) : (
        <p className="text-xs text-muted">No deals yet.</p>
      )}

      {deal && (
        <>
          <Select
            value={deal.status}
            onChange={(v) => setStatus(deal.id, v)}
            options={DEAL_STATUS_META.map((s) => ({ value: s.key, label: s.label }))}
          />
          <div className="flex items-center justify-between">
            <Badge tone={DEAL_STATUS_META.find((s) => s.key === deal.status)?.tone ?? 'muted'}>
              {DEAL_STATUS_META.find((s) => s.key === deal.status)?.label}
            </Badge>
            {deal.inPortfolio && <Badge tone="pos">Owned</Badge>}
          </div>
        </>
      )}

      <div className="flex gap-2">
        <button className="btn btn-xs flex-1" onClick={() => addDeal()}>
          New deal
        </button>
        <a className="btn btn-xs flex-1 text-center" href="#/deals">
          All deals
        </a>
      </div>
    </div>
  )
}
