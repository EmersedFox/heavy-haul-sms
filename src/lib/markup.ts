// ─── lib/markup.ts ────────────────────────────────────────────────────────────
// Single source of truth for all parts markup calculations.
// Used by: invoice, print-invoice, public/invoice, print-inspection, public/inspection,
//          and the job ticket itself (for the sell-price preview column).
// ─────────────────────────────────────────────────────────────────────────────

export interface MarkupTier {
  upTo: number | null  // null = catches everything above previous tier
  markupPct: number
}

export interface ShopSettings {
  labor_rate:               number
  tax_rate:                 number
  parts_markup_retail:      number   // flat-rate fallback
  parts_markup_commercial:  number   // flat-rate fallback
  markup_matrix_retail:     MarkupTier[] | null
  markup_matrix_commercial: MarkupTier[] | null
}

export const DEFAULT_SETTINGS: ShopSettings = {
  labor_rate: 120,
  tax_rate: 7,
  parts_markup_retail: 30,
  parts_markup_commercial: 20,
  markup_matrix_retail: null,
  markup_matrix_commercial: null,
}

/**
 * Return the markup % for a given unit cost and customer type.
 * Walks the matrix tiers in order; first match wins.
 * Falls back to flat rate if no matrix configured.
 */
export function getMarkupPct(
  unitCost: number,
  customerType: 'retail' | 'commercial',
  settings: ShopSettings
): number {
  const matrix =
    customerType === 'commercial'
      ? settings.markup_matrix_commercial
      : settings.markup_matrix_retail

  if (matrix && matrix.length > 0) {
    for (const tier of matrix) {
      if (tier.upTo === null || unitCost <= tier.upTo) {
        return tier.markupPct
      }
    }
    return matrix[matrix.length - 1].markupPct
  }

  // flat-rate fallback
  return customerType === 'commercial'
    ? settings.parts_markup_commercial
    : settings.parts_markup_retail
}

/** Apply markup % to a unit cost, rounded to 2dp. */
export function applyMarkup(unitCost: number, markupPct: number): number {
  return Math.round(unitCost * (1 + markupPct / 100) * 100) / 100
}

/** Full sell-price: looks up tier then applies it. */
export function getSellPrice(
  unitCost: number,
  customerType: 'retail' | 'commercial',
  settings: ShopSettings
): number {
  const pct = getMarkupPct(unitCost, customerType, settings)
  return applyMarkup(unitCost, pct)
}

/** Safe currency formatter – always 2dp. */
export const fmt = (n: any): string =>
  `$${(Math.round((Number(n) || 0) * 100) / 100).toFixed(2)}`

/**
 * Compute invoice totals from service lines using marked-up part prices.
 * Returns { partsTotal, laborTotal, taxAmt, grandTotal }.
 */
export function computeTotals(
  serviceLines: any[],
  customerType: 'retail' | 'commercial',
  settings: ShopSettings
) {
  let partsTotal = 0
  let laborTotal = 0
  for (const line of serviceLines) {
    for (const l of line.labor || []) {
      laborTotal += (Number(l.hours) || 0) * (Number(l.rate) || 0)
    }
    for (const p of line.parts || []) {
      const sell = getSellPrice(Number(p.price) || 0, customerType, settings)
      partsTotal += (Number(p.qty) || 0) * sell
    }
  }
  partsTotal = Math.round(partsTotal * 100) / 100
  laborTotal = Math.round(laborTotal * 100) / 100
  const taxAmt = Math.round(partsTotal * (settings.tax_rate / 100) * 100) / 100
  return { partsTotal, laborTotal, taxAmt, grandTotal: partsTotal + laborTotal + taxAmt }
}