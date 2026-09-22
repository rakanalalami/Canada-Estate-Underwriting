/**
 * Shared UI primitives. Deliberately small and typed — the app is data-dense,
 * so every control is compact, aligned and uses tabular figures.
 */

import React, { useEffect, useId, useRef, useState } from 'react'
import type { Tone } from '@/engine/metrics'
import { fmtCAD, fmtMultiple, fmtNumber, fmtPct, parseNumeric } from '@/engine/money'
import type { TraceStep } from '@/engine/trace'

/* ----------------------------- Tone helpers -------------------------- */

export const toneText: Record<Tone, string> = {
  pos: 'text-pos',
  warn: 'text-warn',
  neg: 'text-neg',
  info: 'text-info',
  muted: 'text-muted',
}

export const toneBg: Record<Tone, string> = {
  pos: 'bg-pos/10 text-pos',
  warn: 'bg-warn/12 text-warn',
  neg: 'bg-neg/10 text-neg',
  info: 'bg-info/10 text-info',
  muted: 'bg-line/60 text-muted',
}

export const toneBorder: Record<Tone, string> = {
  pos: 'border-pos/35',
  warn: 'border-warn/40',
  neg: 'border-neg/40',
  info: 'border-info/35',
  muted: 'border-line',
}

export function cx(...parts: unknown[]): string {
  return parts.filter((p): p is string => typeof p === 'string' && p.length > 0).join(' ')
}

/* -------------------------------- Badge ------------------------------ */

export function Badge({
  tone = 'muted',
  children,
  title,
}: {
  tone?: Tone
  children: React.ReactNode
  title?: string
}) {
  return (
    <span className={cx('chip', toneBg[tone])} title={title}>
      {children}
    </span>
  )
}

/* ------------------------------- Panel ------------------------------- */

export function Panel({
  title,
  subtitle,
  actions,
  children,
  className,
  dense,
  id,
}: {
  title?: React.ReactNode
  subtitle?: React.ReactNode
  actions?: React.ReactNode
  children: React.ReactNode
  className?: string
  dense?: boolean
  id?: string
}) {
  return (
    <section id={id} className={cx('card overflow-hidden', className)}>
      {(title || actions) && (
        <header className="flex flex-wrap items-start justify-between gap-3 border-b border-line px-4 py-3">
          <div className="min-w-0">
            {title && <h3 className="text-sm font-semibold tracking-tight">{title}</h3>}
            {subtitle && <p className="mt-0.5 text-xs leading-relaxed text-muted">{subtitle}</p>}
          </div>
          {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
        </header>
      )}
      <div className={dense ? '' : 'p-4'}>{children}</div>
    </section>
  )
}

/* ----------------------------- Collapsible --------------------------- */

export function Collapsible({
  title,
  subtitle,
  children,
  defaultOpen = false,
  badge,
}: {
  title: React.ReactNode
  subtitle?: React.ReactNode
  children: React.ReactNode
  defaultOpen?: boolean
  badge?: React.ReactNode
}) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="card overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition-colors hover:bg-raised"
      >
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold tracking-tight">{title}</span>
            {badge}
          </div>
          {subtitle && <p className="mt-0.5 text-xs text-muted">{subtitle}</p>}
        </div>
        <svg
          viewBox="0 0 20 20"
          className={cx('h-4 w-4 shrink-0 text-muted transition-transform', open && 'rotate-180')}
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
        >
          <path d="M5 8l5 5 5-5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {open && <div className="border-t border-line p-4">{children}</div>}
    </div>
  )
}

/* ------------------------------- Callout ----------------------------- */

export function Callout({
  tone = 'info',
  title,
  children,
  compact,
}: {
  tone?: Tone
  title?: React.ReactNode
  children?: React.ReactNode
  compact?: boolean
}) {
  return (
    <div
      className={cx(
        'rounded-md border-l-[3px] bg-raised',
        compact ? 'px-3 py-2' : 'px-3.5 py-3',
        tone === 'pos' && 'border-l-pos',
        tone === 'warn' && 'border-l-warn',
        tone === 'neg' && 'border-l-neg',
        tone === 'info' && 'border-l-info',
        tone === 'muted' && 'border-l-subtle',
      )}
    >
      {title && (
        <div className={cx('text-xs font-semibold', toneText[tone])}>{title}</div>
      )}
      {children && (
        <div className={cx('text-xs leading-relaxed text-muted', title && 'mt-1')}>{children}</div>
      )}
    </div>
  )
}

/* ------------------------------ KPI card ----------------------------- */

export function Kpi({
  label,
  value,
  sub,
  tone,
  band,
  trace,
  emphasis,
  hint,
}: {
  label: string
  value: React.ReactNode
  sub?: React.ReactNode
  tone?: Tone
  band?: string
  trace?: TraceStep[]
  emphasis?: boolean
  hint?: string
}) {
  return (
    <div
      className={cx(
        'card flex flex-col justify-between p-3.5',
        emphasis && 'ring-1 ring-accent/25',
      )}
      title={hint}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="label leading-tight">{label}</span>
        {trace && trace.length > 0 && <TracePopover steps={trace} label={label} />}
      </div>
      <div
        className={cx(
          'num mt-2 font-semibold tracking-tight',
          emphasis ? 'text-2xl' : 'text-xl',
          tone ? toneText[tone] : 'text-ink',
        )}
      >
        {value}
      </div>
      {(sub || band) && (
        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
          {band && tone && <Badge tone={tone}>{band}</Badge>}
          {sub && <span className="text-2xs text-muted">{sub}</span>}
        </div>
      )}
    </div>
  )
}

/* ---------------------------- Trace popover -------------------------- */

function formatTraceValue(step: TraceStep): string {
  if (step.value === null) return ''
  switch (step.format) {
    case 'percent':
      return fmtPct(step.value)
    case 'multiple':
      return fmtMultiple(step.value)
    case 'number':
      return fmtNumber(step.value)
    default:
      return fmtCAD(step.value)
  }
}

export function TraceTable({ steps }: { steps: TraceStep[] }) {
  return (
    <table className="w-full text-xs">
      <tbody>
        {steps.map((s, i) => (
          <tr
            key={i}
            className={cx(
              'border-b border-line/60 last:border-0',
              s.kind === 'total' && 'font-semibold',
              s.kind === 'subtotal' && 'font-medium',
            )}
          >
            <td className="py-1.5 pr-3 align-top">
              <span className={cx(s.kind === 'note' && 'text-muted')}>
                {s.kind === 'deduct' ? '− ' : s.kind === 'add' ? '+ ' : ''}
                {s.label}
              </span>
              {s.formula && <div className="mt-0.5 text-2xs text-subtle">{s.formula}</div>}
            </td>
            <td
              className={cx(
                'num whitespace-nowrap py-1.5 text-right align-top',
                s.kind === 'deduct' && 'text-neg',
                s.kind === 'total' && 'text-ink',
              )}
            >
              {formatTraceValue(s)}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

export function TracePopover({ steps, label }: { steps: TraceStep[]; label: string }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('mousedown', onClick)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onClick)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div ref={ref} className="relative no-print">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label={`Show how ${label} is calculated`}
        className="rounded p-0.5 text-subtle transition-colors hover:bg-line/60 hover:text-ink"
      >
        <svg viewBox="0 0 20 20" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.6">
          <circle cx="10" cy="10" r="7.25" />
          <path d="M10 9v4.5M10 6.6v.1" strokeLinecap="round" />
        </svg>
      </button>
      {open && (
        <div className="absolute right-0 top-6 z-40 w-80 rounded-lg border border-line bg-surface p-3 shadow-pop">
          <div className="mb-2 text-2xs font-semibold uppercase tracking-wider text-muted">
            How {label} is calculated
          </div>
          <TraceTable steps={steps} />
        </div>
      )}
    </div>
  )
}

/* ------------------------------- Inputs ------------------------------ */

interface BaseFieldProps {
  label?: string
  hint?: string
  className?: string
  required?: boolean
}

export function Field({
  label,
  hint,
  children,
  className,
}: BaseFieldProps & { children: React.ReactNode }) {
  return (
    <div className={className}>
      {label && <label className="label mb-1">{label}</label>}
      {children}
      {hint && <p className="mt-1 text-2xs leading-relaxed text-subtle">{hint}</p>}
    </div>
  )
}

/**
 * Number entry that accepts 650000, 650,000, $650,000, C$650,000 or 650k
 * (§30). The raw text is kept while focused so typing is never fought with,
 * and the formatted value is shown once focus leaves.
 */
export function NumberInput({
  value,
  onChange,
  label,
  hint,
  className,
  prefix,
  suffix,
  placeholder,
  decimals = 0,
  min,
  disabled,
  allowNull,
}: BaseFieldProps & {
  value: number | null
  onChange: (v: number) => void
  prefix?: string
  suffix?: string
  placeholder?: string
  decimals?: number
  min?: number
  disabled?: boolean
  allowNull?: boolean
}) {
  const [draft, setDraft] = useState<string | null>(null)
  const id = useId()

  const display =
    draft !== null
      ? draft
      : value === null || value === undefined
        ? ''
        : fmtNumber(value, decimals)

  const commit = (raw: string) => {
    const parsed = parseNumeric(raw)
    if (parsed === null) {
      if (allowNull) onChange(0)
      setDraft(null)
      return
    }
    onChange(min !== undefined ? Math.max(min, parsed) : parsed)
    setDraft(null)
  }

  return (
    <Field label={label} hint={hint} className={className}>
      <div className="relative">
        {prefix && (
          <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-subtle">
            {prefix}
          </span>
        )}
        <input
          id={id}
          inputMode="decimal"
          disabled={disabled}
          className={cx('field-num', prefix && 'pl-8', suffix && 'pr-8')}
          value={display}
          placeholder={placeholder}
          onChange={(e) => setDraft(e.target.value)}
          onFocus={(e) => {
            setDraft(value === null ? '' : String(value))
            requestAnimationFrame(() => e.target.select())
          }}
          onBlur={(e) => commit(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
          }}
        />
        {suffix && (
          <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-subtle">
            {suffix}
          </span>
        )}
      </div>
    </Field>
  )
}

/** Money input — always CAD. */
export function MoneyInput(props: Omit<React.ComponentProps<typeof NumberInput>, 'prefix'>) {
  return <NumberInput {...props} prefix="C$" />
}

/** Percent input: displays 6.5, stores 0.065. */
export function PercentInput({
  value,
  onChange,
  decimals = 2,
  ...rest
}: Omit<React.ComponentProps<typeof NumberInput>, 'value' | 'onChange' | 'suffix'> & {
  value: number
  onChange: (v: number) => void
  decimals?: number
}) {
  return (
    <NumberInput
      {...rest}
      suffix="%"
      decimals={decimals}
      value={value === null || value === undefined ? null : Math.round(value * 1_000_000) / 10_000}
      onChange={(v) => onChange(v / 100)}
    />
  )
}

export function TextInput({
  value,
  onChange,
  label,
  hint,
  className,
  placeholder,
  type = 'text',
  disabled,
}: BaseFieldProps & {
  value: string
  onChange: (v: string) => void
  placeholder?: string
  type?: string
  disabled?: boolean
}) {
  return (
    <Field label={label} hint={hint} className={className}>
      <input
        type={type}
        className="field"
        value={value}
        disabled={disabled}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
      />
    </Field>
  )
}

export function TextArea({
  value,
  onChange,
  label,
  hint,
  className,
  rows = 3,
  placeholder,
}: BaseFieldProps & {
  value: string
  onChange: (v: string) => void
  rows?: number
  placeholder?: string
}) {
  return (
    <Field label={label} hint={hint} className={className}>
      <textarea
        className="field resize-y leading-relaxed"
        rows={rows}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
      />
    </Field>
  )
}

export function Select<T extends string>({
  value,
  onChange,
  options,
  label,
  hint,
  className,
  disabled,
}: BaseFieldProps & {
  value: T
  onChange: (v: T) => void
  options: { value: T; label: string }[]
  disabled?: boolean
}) {
  return (
    <Field label={label} hint={hint} className={className}>
      <select
        className="field appearance-none bg-[length:16px] bg-[right_0.5rem_center] bg-no-repeat pr-8"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 20 20' fill='none' stroke='%238692a4' stroke-width='1.8'%3E%3Cpath d='M5 8l5 5 5-5'/%3E%3C/svg%3E\")",
        }}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value as T)}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </Field>
  )
}

export function Toggle({
  checked,
  onChange,
  label,
  hint,
  disabled,
}: {
  checked: boolean
  onChange: (v: boolean) => void
  label?: React.ReactNode
  hint?: string
  disabled?: boolean
}) {
  return (
    <label className={cx('flex items-start gap-2.5', disabled ? 'opacity-50' : 'cursor-pointer')}>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cx(
          'mt-0.5 h-[18px] w-8 shrink-0 rounded-full p-0.5 transition-colors',
          checked ? 'bg-accent' : 'bg-line',
        )}
      >
        <span
          className={cx(
            'block h-[14px] w-[14px] rounded-full bg-white shadow-sm transition-transform',
            checked && 'translate-x-[14px]',
          )}
        />
      </button>
      {(label || hint) && (
        <span className="min-w-0">
          {label && <span className="block text-sm leading-tight">{label}</span>}
          {hint && <span className="mt-0.5 block text-2xs leading-relaxed text-subtle">{hint}</span>}
        </span>
      )}
    </label>
  )
}

export function Checkbox({
  checked,
  onChange,
  label,
}: {
  checked: boolean
  onChange: (v: boolean) => void
  label?: React.ReactNode
}) {
  return (
    <label className="inline-flex cursor-pointer items-center gap-2 text-sm">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-3.5 w-3.5 rounded border-line text-accent focus:ring-accent/30"
      />
      {label}
    </label>
  )
}

export function Segmented<T extends string>({
  value,
  onChange,
  options,
  size = 'md',
  className,
}: {
  value: T
  onChange: (v: T) => void
  options: { value: T; label: string; hint?: string }[]
  size?: 'sm' | 'md'
  className?: string
}) {
  return (
    <div className={cx('inline-flex rounded-md border border-line bg-raised p-0.5', className)}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          title={o.hint}
          onClick={() => onChange(o.value)}
          className={cx(
            'rounded font-medium transition-colors',
            size === 'sm' ? 'px-2 py-0.5 text-2xs' : 'px-3 py-1 text-xs',
            value === o.value
              ? 'bg-surface text-ink shadow-sm'
              : 'text-muted hover:text-ink',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

/* ------------------------------- Tables ------------------------------ */

export function TableWrap({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cx('-mx-px overflow-x-auto', className)}>
      <table className="w-full min-w-full border-collapse">{children}</table>
    </div>
  )
}

export function Progress({
  value,
  tone = 'info',
  height = 'h-2',
}: {
  value: number
  tone?: Tone
  height?: string
}) {
  const pct = Math.max(0, Math.min(1, value)) * 100
  return (
    <div className={cx('w-full overflow-hidden rounded-full bg-line', height)}>
      <div
        className={cx(
          'h-full rounded-full transition-all',
          tone === 'pos' && 'bg-pos',
          tone === 'warn' && 'bg-warn',
          tone === 'neg' && 'bg-neg',
          tone === 'info' && 'bg-info',
          tone === 'muted' && 'bg-subtle',
        )}
        style={{ width: `${pct}%` }}
      />
    </div>
  )
}

export function EmptyState({
  title,
  children,
  action,
}: {
  title: string
  children?: React.ReactNode
  action?: React.ReactNode
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-line px-6 py-10 text-center">
      <p className="text-sm font-medium">{title}</p>
      {children && <p className="max-w-md text-xs leading-relaxed text-muted">{children}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  )
}

export function StatRow({
  label,
  value,
  tone,
  hint,
  strong,
}: {
  label: React.ReactNode
  value: React.ReactNode
  tone?: Tone
  hint?: string
  strong?: boolean
}) {
  return (
    <div
      className={cx(
        'flex items-baseline justify-between gap-4 border-b border-line/60 py-1.5 last:border-0',
        strong && 'font-semibold',
      )}
      title={hint}
    >
      <span className={cx('text-xs', strong ? 'text-ink' : 'text-muted')}>{label}</span>
      <span className={cx('num text-sm', tone && toneText[tone])}>{value}</span>
    </div>
  )
}
