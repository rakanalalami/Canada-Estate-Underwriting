import type { RouteDef } from '@/lib/routes'

export function PageHeader({ def }: { def: RouteDef }) {
  return (
    <header className="mb-5 flex flex-wrap items-end justify-between gap-3 border-b border-line pb-4">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">{def.label}</h1>
        <p className="mt-0.5 text-xs text-muted">{def.hint}</p>
      </div>
      <span className="mono text-2xs text-subtle">{def.spec}</span>
    </header>
  )
}
