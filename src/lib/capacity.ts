/**
 * Capacity validation:
 * Ensures (sold_count + reserved_count + requested) does not exceed configured capacity.
 */
export function validateCapacity(
  capacity: number,
  soldCount: number,
  reservedCount: number,
  requestedCount: number
): { valid: boolean; remaining: number; error?: string } {
  if (requestedCount <= 0) {
    return { valid: false, remaining: 0, error: 'Jumlah tiket harus lebih dari 0' };
  }

  const currentlyCommitted = soldCount + reservedCount;
  const remaining = Math.max(0, capacity - currentlyCommitted);

  if (requestedCount > remaining) {
    return {
      valid: false,
      remaining,
      error: `Kapasitas tidak mencukupi. Sisa tiket tersedia: ${remaining}`,
    };
  }

  return { valid: true, remaining: remaining - requestedCount };
}

/**
 * Monetary calculations in minor units (IDR).
 * Calculates subtotal and grand total. Zero tax, zero administrative fees (0%).
 */
export function calculateOrderPricing(
  items: { unitPriceMinor: number; quantity: number }[]
): {
  subtotalMinor: number;
  feesMinor: number;
  totalMinor: number;
  isFree: boolean;
} {
  const subtotalMinor = items.reduce((sum, item) => {
    return sum + item.unitPriceMinor * item.quantity;
  }, 0);

  // Zero tax & zero platform fees: pure ticket price only
  const isFree = subtotalMinor === 0;
  const feesMinor = 0;
  const totalMinor = subtotalMinor;

  return {
    subtotalMinor,
    feesMinor,
    totalMinor,
    isFree,
  };
}

/**
 * Format IDR currency nicely.
 * e.g. 150000 -> "Rp 150.000", 0 -> "Gratis"
 */
export function formatCurrencyIDR(amountMinor: number): string {
  if (amountMinor === 0) {
    return 'Gratis';
  }
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(amountMinor);
}
