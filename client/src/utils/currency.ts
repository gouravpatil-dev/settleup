/**
 * The backend stores and validates all amounts as integer minor units
 * (paise) to stay float-free. Humans think in rupees. This is the one
 * place that boundary gets crossed, so it only has to be right once.
 */
export function toMinorUnits(rupees: number): number {
  return Math.round(rupees * 100);
}

export function toMajorUnits(minorUnits: number): number {
  return minorUnits / 100;
}

const formatter = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 2,
});

export function formatCurrency(minorUnits: number): string {
  return formatter.format(toMajorUnits(minorUnits));
}
