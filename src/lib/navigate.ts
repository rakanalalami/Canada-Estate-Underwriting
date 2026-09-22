/**
 * Hash navigation helper. Creating a deal has to land the investor somewhere
 * they can actually type — the dashboard is read-only, so dropping a brand-new
 * deal there leaves nothing to do and nothing to enter.
 */
export function goTo(route: string): void {
  window.location.hash = `#/${route}`
}

/** Where a newly created blank deal should open. */
export const NEW_DEAL_ROUTE = 'property'
