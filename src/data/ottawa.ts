/**
 * §35 Ottawa-specific reference data.
 *
 * The neighbourhood list is the investor's own search area. It is deliberately
 * NOT ranked by prestige — the notes describe rent-to-price relationship,
 * tenant demand, housing stock age and trajectory, which is what actually
 * drives an income investment.
 */

export interface OttawaNeighbourhood {
  name: string
  ward: string
  note: string
  /** Typical vintage of the small multifamily stock. */
  housingStock: string
  /** Investor-relevant watch-outs. */
  watchOuts: string
  focus: boolean
}

export const OTTAWA_NEIGHBOURHOODS: OttawaNeighbourhood[] = [
  {
    name: 'Overbrook',
    ward: 'Rideau-Vanier / Rideau-Rockcliffe',
    note: 'Strong rent-to-price relationship. Close to downtown, the Rideau River and LRT access at Hurdman/Tremblay.',
    housingStock: 'Post-war bungalows and 1950s–70s low-rise, many converted to two and three units.',
    watchOuts: 'Verify conversions are legal. Older electrical and single-pipe heating are common.',
    focus: true,
  },
  {
    name: 'Vanier North',
    ward: 'Rideau-Vanier',
    note: 'Among the highest gross yields inside the Greenbelt. Ongoing redevelopment along Montreal Road.',
    housingStock: 'Mixed 1940s–1970s duplex and triplex stock, some purpose-built.',
    watchOuts: 'Block-by-block variation is extreme. Tenant quality and turnover cost need careful underwriting.',
    focus: true,
  },
  {
    name: 'Beechwood fringe',
    ward: 'Rideau-Rockcliffe',
    note: 'Transitional pocket next to an established retail spine. Improving without prime-area pricing.',
    housingStock: 'Older semis and small walk-ups, some newer infill.',
    watchOuts: 'Pricing already reflects some of the improvement — check the rent-to-price maths, not the story.',
    focus: true,
  },
  {
    name: 'New Edinburgh fringe',
    ward: 'Rideau-Rockcliffe',
    note: 'Edge of an established area. Stable demand, lower yields than Vanier.',
    housingStock: 'Century homes and conversions.',
    watchOuts: 'Heritage constraints and high renovation costs on older stock.',
    focus: true,
  },
  {
    name: 'West Centre Town',
    ward: 'Somerset',
    note: 'Walkable, high tenant demand, close to downtown employment.',
    housingStock: 'Late-1800s to 1920s rowhouses and conversions.',
    watchOuts: 'Knob-and-tube, galvanized plumbing and parking scarcity are routine.',
    focus: true,
  },
  {
    name: 'Little Italy',
    ward: 'Somerset / Kitchissippi',
    note: 'Strong rental demand from students and young professionals; intensification along Preston.',
    housingStock: 'Early-1900s doubles and triples, plus newer mid-rise.',
    watchOuts: 'Land value can exceed income value — do not underwrite a redevelopment premium as income.',
    focus: true,
  },
  {
    name: 'Mechanicsville',
    ward: 'Kitchissippi',
    note: 'Directly adjacent to Bayview station and the LRT interchange. Long-term trajectory is upward.',
    housingStock: 'Small, older stock on compact lots.',
    watchOuts: 'Some blocks carry environmental history from industrial use. Order a Phase I where warranted.',
    focus: true,
  },
  {
    name: 'Hintonburg fringe',
    ward: 'Kitchissippi',
    note: 'Established demand with pricing that still works on the fringes rather than in the core of the area.',
    housingStock: '1900–1940 doubles, many already converted.',
    watchOuts: 'Core Hintonburg pricing has moved well ahead of rents — the fringe is where the maths still works.',
    focus: true,
  },
  {
    name: 'Carlington',
    ward: 'River',
    note: 'Good rent-to-price relationship, near the Civic campus and the new Ottawa Hospital site.',
    housingStock: 'Post-war bungalows and low-rise walk-ups.',
    watchOuts: 'Verify secondary dwelling units against zoning and fire code.',
    focus: true,
  },
  {
    name: 'Nepean (central)',
    ward: 'College / Knoxdale-Merivale',
    note: 'Larger lots, newer stock, lower maintenance risk. Lower gross yields than the inner-city pockets.',
    housingStock: '1960s–1990s detached with secondary suites; some purpose-built low-rise.',
    watchOuts: 'Cap rates compress here — the return relies more on stability than yield.',
    focus: true,
  },
  {
    name: 'Orléans (selected)',
    ward: 'Orléans East-Cumberland / West-Innes',
    note: 'Diversification away from the inner city. Newer housing, family tenants, longer tenancies.',
    housingStock: '1980s onward, secondary suites common.',
    watchOuts: 'Lower yields; car-dependent. Confirm demand for the specific unit mix.',
    focus: false,
  },
  {
    name: 'Barrhaven (selected)',
    ward: 'Barrhaven East / West',
    note: 'Diversification play. Strong family demand, very low maintenance risk on newer stock.',
    housingStock: '1990s onward.',
    watchOuts: 'Lowest cap rates of the search area. Works for stability, not for yield.',
    focus: false,
  },
]

export const OTTAWA_NEIGHBOURHOOD_NAMES = OTTAWA_NEIGHBOURHOODS.map((n) => n.name)

/**
 * §35 evaluation dimensions. Displayed as a checklist so the analysis is
 * driven by investment fundamentals rather than by an area's reputation.
 */
export const NEIGHBOURHOOD_EVALUATION_FACTORS = [
  { key: 'RENT_TO_PRICE', label: 'Rent-to-price relationship', detail: 'Monthly gross rent against purchase price — the single most predictive screen.' },
  { key: 'CAP_RATE', label: 'Cap rate achievable', detail: 'What the area actually trades at, from your sales comparables.' },
  { key: 'TENANT_DEMAND', label: 'Tenant demand', detail: 'Days on market for rentals, applicant volume, employment anchors.' },
  { key: 'INFRASTRUCTURE', label: 'Future infrastructure', detail: 'LRT stages, hospital campus, road and bridge projects.' },
  { key: 'TRAJECTORY', label: 'Neighbourhood trajectory', detail: 'Direction of travel over 5–10 years, evidenced by permits and sales.' },
  { key: 'STOCK_AGE', label: 'Age of housing stock', detail: 'Drives capital expenditure and insurability more than anything else.' },
  { key: 'PROPERTY_TAX', label: 'Property tax', detail: 'Multi-residential class and assessment level after sale.' },
  { key: 'INSURANCE', label: 'Insurance availability', detail: 'Older wiring and plumbing can make cover expensive or unobtainable.' },
  { key: 'MAINTENANCE_RISK', label: 'Maintenance risk', detail: 'Ottawa freeze-thaw cycles punish roofs, foundations and parking surfaces.' },
  { key: 'LIQUIDITY', label: 'Liquidity / resale demand', detail: 'Who buys this asset from you, and how quickly.' },
] as const

/**
 * Ontario rent increase guideline by year. Applies to most units first
 * occupied before 15 November 2018; newer units are exempt from the guideline.
 * Editable in the app — never used to inflate income automatically.
 */
export const ONTARIO_RENT_GUIDELINE: Record<number, number> = {
  2021: 0.0,
  2022: 0.012,
  2023: 0.025,
  2024: 0.025,
  2025: 0.025,
  2026: 0.025,
}

export const ONTARIO_RENT_GUIDELINE_NOTE =
  'Ontario caps annual increases for sitting tenants at the provincial guideline. Units first occupied after 15 November 2018 are exempt. A below-market rent closes on turnover or by the guideline — not on closing.'
