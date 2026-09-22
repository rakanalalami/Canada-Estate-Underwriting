/**
 * Lightweight calculation trace. Every headline number in the app can be
 * expanded to show the arithmetic that produced it (§39 "every number can be
 * traced back to its source/input"), so assumptions are never hidden.
 */

export type TraceKind = 'input' | 'add' | 'deduct' | 'subtotal' | 'total' | 'note'

export interface TraceStep {
  label: string
  value: number | null
  /** Human-readable arithmetic, e.g. "C$81,000 x 3.00%". */
  formula?: string
  kind: TraceKind
  /** 'currency' | 'percent' | 'multiple' | 'number' */
  format?: 'currency' | 'percent' | 'multiple' | 'number'
}

export class TraceBuilder {
  readonly steps: TraceStep[] = []

  input(label: string, value: number | null, formula?: string, format: TraceStep['format'] = 'currency') {
    this.steps.push({ label, value, formula, kind: 'input', format })
    return this
  }
  add(label: string, value: number | null, formula?: string, format: TraceStep['format'] = 'currency') {
    this.steps.push({ label, value, formula, kind: 'add', format })
    return this
  }
  deduct(label: string, value: number | null, formula?: string, format: TraceStep['format'] = 'currency') {
    this.steps.push({ label, value, formula, kind: 'deduct', format })
    return this
  }
  subtotal(label: string, value: number | null, formula?: string, format: TraceStep['format'] = 'currency') {
    this.steps.push({ label, value, formula, kind: 'subtotal', format })
    return this
  }
  total(label: string, value: number | null, formula?: string, format: TraceStep['format'] = 'currency') {
    this.steps.push({ label, value, formula, kind: 'total', format })
    return this
  }
  note(label: string, formula?: string) {
    this.steps.push({ label, value: null, formula, kind: 'note' })
    return this
  }
  build(): TraceStep[] {
    return this.steps
  }
}

export function trace(): TraceBuilder {
  return new TraceBuilder()
}
