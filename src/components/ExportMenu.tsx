import { useEffect, useRef, useState } from 'react'
import type { Deal } from '@/engine/types'
import type { UnderwriteResult } from '@/engine/underwrite'
import { buildDealCsv, download, safeFilename } from '@/export/csv'
import { cx } from '@/components/ui/primitives'

export function ExportMenu({
  deal,
  result,
  route,
  onClose,
}: {
  deal: Deal
  result: UnderwriteResult | null
  route: string
  onClose: () => void
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('mousedown', onClick)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onClick)
      document.removeEventListener('keydown', onKey)
    }
  }, [onClose])

  const run = async (label: string, fn: () => Promise<void> | void) => {
    setBusy(label)
    setError(null)
    try {
      await fn()
      onClose()
    } catch (err) {
      console.error(err)
      setError(err instanceof Error ? err.message : 'Export failed')
    } finally {
      setBusy(null)
    }
  }

  const items: { key: string; label: string; hint: string; action: () => Promise<void> | void }[] = [
    {
      key: 'pdf',
      label: 'PDF investment report',
      hint: 'Full report: overview, rent roll, NOI, refinance, forecast, sensitivity, risk, sources',
      action: async () => {
        if (!result) throw new Error('Underwriting unavailable')
        const { exportPdf } = await import('@/export/pdf')
        await exportPdf(deal, result)
      },
    },
    {
      key: 'xlsx',
      label: 'Excel underwriting model',
      hint: 'Live formulas — change a rent or rate and Excel recalculates',
      action: async () => {
        if (!result) throw new Error('Underwriting unavailable')
        const { exportExcel } = await import('@/export/excel')
        await exportExcel(deal, result)
      },
    },
    {
      key: 'csv',
      label: 'CSV',
      hint: 'Every figure as plain values',
      action: () => {
        if (!result) throw new Error('Underwriting unavailable')
        download(`${safeFilename(deal.name)}-underwriting.csv`, buildDealCsv(deal, result))
      },
    },
    {
      key: 'json',
      label: 'JSON (deal inputs)',
      hint: 'A backup of everything you entered',
      action: () => {
        download(
          `${safeFilename(deal.name)}-deal.json`,
          JSON.stringify(deal, null, 2),
          'application/json',
        )
      },
    },
    {
      key: 'print',
      label: 'Printable summary',
      hint: 'Print or save the current page as PDF',
      action: () => {
        window.print()
      },
    },
  ]

  return (
    <div
      ref={ref}
      className="absolute right-0 top-9 z-50 w-80 overflow-hidden rounded-lg border border-line bg-surface shadow-pop"
    >
      <div className="border-b border-line px-3 py-2">
        <div className="text-2xs font-semibold uppercase tracking-wider text-muted">Export</div>
        <div className="mt-0.5 truncate text-xs">{deal.name}</div>
      </div>
      <ul>
        {items.map((it) => (
          <li key={it.key}>
            <button
              className={cx(
                'flex w-full flex-col items-start gap-0.5 px-3 py-2.5 text-left transition-colors hover:bg-raised',
                busy === it.key && 'opacity-60',
              )}
              disabled={busy !== null}
              onClick={() => run(it.key, it.action)}
            >
              <span className="text-sm font-medium">
                {it.label}
                {busy === it.key && <span className="ml-2 text-2xs text-muted">preparing…</span>}
              </span>
              <span className="text-2xs leading-relaxed text-subtle">{it.hint}</span>
            </button>
          </li>
        ))}
      </ul>
      {error && (
        <div className="border-t border-line bg-neg/5 px-3 py-2 text-2xs text-neg">{error}</div>
      )}
      <div className="border-t border-line px-3 py-2 text-2xs leading-relaxed text-subtle">
        Exports cover the whole deal, not just the {route.replace('-', ' ')} view.
      </div>
    </div>
  )
}
