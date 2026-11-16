export function divideHalfUp(numerator: number, denominator: number): number {
  if (denominator <= 0) {
    throw new Error('Pembagi harus lebih dari nol.');
  }

  if (numerator >= 0) {
    return Math.trunc((numerator + Math.trunc(denominator / 2)) / denominator);
  }

  return -Math.trunc((Math.abs(numerator) + Math.trunc(denominator / 2)) / denominator);
}

export function rupiah(amount: number | null | undefined): string {
  const value = Math.trunc(Number(amount ?? 0));

  return `Rp ${new Intl.NumberFormat('id-ID', { maximumFractionDigits: 0 }).format(value)}`;
}

export function compactRupiah(amount: number | null | undefined): string {
  const value = Math.trunc(Number(amount ?? 0));
  const absolute = Math.abs(value);

  if (absolute >= 1_000_000_000) {
    return `Rp ${formatDecimal(value / 1_000_000_000, 1)} M`;
  }

  if (absolute >= 1_000_000) {
    return `Rp ${formatDecimal(value / 1_000_000, 1)} jt`;
  }

  if (absolute >= 1_000) {
    return `Rp ${formatDecimal(value / 1_000, 0)} rb`;
  }

  return rupiah(value);
}

export function formatDecimal(value: number, digits: number): string {
  return new Intl.NumberFormat('id-ID', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value);
}

export function formatInteger(value: number): string {
  return new Intl.NumberFormat('id-ID', { maximumFractionDigits: 0 }).format(value);
}

/** Mengubah input pengguna ("1.250.000", "Rp 1 250 000", "-12.500") menjadi rupiah penuh. */
export function parseRupiah(value: string | number | null | undefined): number {
  if (typeof value === 'number') {
    return Math.round(value);
  }

  const clean = String(value ?? '').replace(/[^0-9-]/g, '');

  if (clean === '' || clean === '-') {
    return 0;
  }

  const negative = clean.startsWith('-');
  const digits = clean.replace(/-/g, '');
  const parsed = Number.parseInt(digits || '0', 10) || 0;

  return negative ? -parsed : parsed;
}

export function basisPointsToPercent(bp: number): string {
  return `${formatDecimal(bp / 100, 2)}%`;
}

/** "11", "11,5", "11.5%" -> basis poin. */
export function percentToBasisPoints(value: string | number | null | undefined): number {
  if (typeof value === 'number') {
    return Math.round(value * 100);
  }

  const clean = String(value ?? '')
    .replace('%', '')
    .replace(/\s/g, '')
    .replace(',', '.');

  if (clean === '' || Number.isNaN(Number(clean))) {
    return 0;
  }

  return Math.round(Number(clean) * 100);
}

export function percentLabelFromBp(bp: number, digits = 2): string {
  return `${formatDecimal(bp / 100, digits)}%`;
}
