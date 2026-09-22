export interface RouteDef {
  key: string
  label: string
  group: 'DEAL' | 'STRATEGY' | 'MANAGE'
  /** Short description shown in the nav tooltip. */
  hint: string
  /** Spec sections this view covers, shown in the page header. */
  spec: string
  /** Requires an active deal. */
  needsDeal: boolean
}

export const ROUTES: RouteDef[] = [
  { key: 'dashboard', label: 'Dashboard', group: 'DEAL', hint: 'Headline underwriting result', spec: '§29', needsDeal: true },
  { key: 'property', label: 'Property', group: 'DEAL', hint: 'Address, type, condition, legal status', spec: '§1 · §20 · §21', needsDeal: true },
  { key: 'rent-roll', label: 'Rent roll', group: 'DEAL', hint: 'Unit-by-unit income, current vs market', spec: '§2', needsDeal: true },
  { key: 'expenses', label: 'Operating expenses', group: 'DEAL', hint: 'Actual or estimated, dollars or percentages', spec: '§3', needsDeal: true },
  { key: 'noi', label: 'NOI & cap rate', group: 'DEAL', hint: 'Income waterfall and yield', spec: '§4 · §5 · §22', needsDeal: true },
  { key: 'acquisition', label: 'Acquisition', group: 'DEAL', hint: 'Ontario closing costs and financing', spec: '§6 · §7', needsDeal: true },
  { key: 'refinance', label: 'Refinance', group: 'DEAL', hint: 'Cash purchase then refinance, LTV ladder, appraisal risk', spec: '§8 · §27', needsDeal: true },
  { key: 'cashflow', label: 'Cash flow & returns', group: 'DEAL', hint: 'Cash flow, DSCR, cash-on-cash, total return', spec: '§9 · §10 · §11 · §17', needsDeal: true },
  { key: 'offer', label: 'Offer analysis', group: 'DEAL', hint: 'What should I pay?', spec: '§12 · §13', needsDeal: true },
  { key: 'projection', label: 'Projection', group: 'DEAL', hint: '5- and 10-year forecast and sale scenario', spec: '§16 · §18', needsDeal: true },
  { key: 'sensitivity', label: 'Sensitivity', group: 'DEAL', hint: 'Rate, rent and price stress matrices', spec: '§19', needsDeal: true },
  { key: 'comparables', label: 'Comparables', group: 'DEAL', hint: 'Rent and sales comparables', spec: '§14 · §15', needsDeal: true },
  { key: 'risk', label: 'Scorecard & risk', group: 'DEAL', hint: 'Scorecard, CapEx risk, deal breakers', spec: '§20 · §23 · §28', needsDeal: true },
  { key: 'sources', label: 'Sources', group: 'DEAL', hint: 'Audit trail for every external number', spec: '§33 · §34', needsDeal: true },

  { key: 'simulator', label: 'Capital recycling', group: 'STRATEGY', hint: 'Buy cash → stabilize → refinance → repeat', spec: '§25 · §40', needsDeal: false },
  { key: 'first-deal', label: 'First acquisition', group: 'STRATEGY', hint: 'Reverse-engineer property #1 and screen listings', spec: '§40.21 · §40.22 · §40.23', needsDeal: false },
  { key: 'portfolio', label: 'Portfolio', group: 'STRATEGY', hint: 'Roll-up and concentration across owned properties', spec: '§24', needsDeal: false },

  { key: 'compare', label: 'Compare deals', group: 'MANAGE', hint: 'Side-by-side comparison', spec: '§31', needsDeal: false },
  { key: 'deals', label: 'All deals', group: 'MANAGE', hint: 'Saved properties, status and filters', spec: '§31 · §36', needsDeal: false },
  { key: 'settings', label: 'Investor profile', group: 'MANAGE', hint: 'Capital, targets and strategy defaults', spec: '§26 · §40.1', needsDeal: false },
]

export const ROUTE_GROUPS: { key: RouteDef['group']; label: string }[] = [
  { key: 'DEAL', label: 'Underwriting' },
  { key: 'STRATEGY', label: 'Strategy' },
  { key: 'MANAGE', label: 'Manage' },
]

export function routeFromHash(): string {
  const h = window.location.hash.replace(/^#\/?/, '')
  const key = h.split('?')[0]
  return ROUTES.some((r) => r.key === key) ? key : 'dashboard'
}
