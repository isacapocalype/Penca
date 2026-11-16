import { divideHalfUp } from './money';

export function netRevenue(grossRevenue: number, sellerDiscount: number, refund: number): number {
  return grossRevenue - sellerDiscount - refund;
}

export function grossProfit(net: number, hpp: number): number {
  return net - hpp;
}

export function operatingProfit(gross: number, marketplaceFees: number, ads: number, operational: number): number {
  return gross - marketplaceFees - ads - operational;
}

export function netProfit(operating: number, pphFinal: number): number {
  return operating - pphFinal;
}

export function marginBasisPoints(net: number, revenue: number): number {
  if (revenue === 0) {
    return 0;
  }

  return divideHalfUp(net * 10000, revenue);
}

/** PPN sudah termasuk dalam harga. */
export function ppnIncluded(baseAmount: number, rateBasisPoints: number): number {
  return divideHalfUp(baseAmount * rateBasisPoints, 10000 + rateBasisPoints);
}

/** PPN ditambahkan di atas harga. */
export function ppnAdded(baseAmount: number, rateBasisPoints: number): number {
  return divideHalfUp(baseAmount * rateBasisPoints, 10000);
}

export function pphFinal(baseAmount: number, rateBasisPoints: number): number {
  return divideHalfUp(baseAmount * rateBasisPoints, 10000);
}
