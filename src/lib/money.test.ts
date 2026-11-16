import { describe, expect, it } from 'vitest';
import {
  basisPointsToPercent,
  divideHalfUp,
  parseRupiah,
  percentToBasisPoints,
  rupiah,
} from './money';
import {
  marginBasisPoints,
  netProfit,
  netRevenue,
  ppnAdded,
  ppnIncluded,
  pphFinal,
} from './financial';

describe('money and financial rules', () => {
  it('rounds integer rupiah half up and handles negatives symmetrically', () => {
    expect(divideHalfUp(5, 2)).toBe(3);
    expect(divideHalfUp(1, 3)).toBe(0);
    expect(divideHalfUp(-5, 2)).toBe(-3);
    expect(divideHalfUp(1_110_000 * 1_100, 11_100)).toBe(110_000);
  });

  it('formats and parses rupiah without hidden decimal fractions', () => {
    expect(rupiah(1_234_567)).toBe('Rp 1.234.567');
    expect(rupiah(0)).toBe('Rp 0');
    expect(parseRupiah('Rp 1.250.000')).toBe(1_250_000);
    expect(parseRupiah('1 250 000')).toBe(1_250_000);
    expect(parseRupiah('')).toBe(0);
  });

  it('converts percentages to basis points and back', () => {
    expect(percentToBasisPoints('11')).toBe(1_100);
    expect(percentToBasisPoints('0,5')).toBe(50);
    expect(percentToBasisPoints('11.5%')).toBe(1_150);
    expect(basisPointsToPercent(1_100)).toBe('11,00%');
  });

  it('keeps PPN and PPh separate from profit calculations', () => {
    expect(ppnIncluded(1_110_000, 1_100)).toBe(110_000);
    expect(ppnAdded(1_000_000, 1_100)).toBe(110_000);
    expect(pphFinal(1_110_000, 50)).toBe(5_550);

    const net = netRevenue(1_110_000, 10_000, 50_000);
    expect(net).toBe(1_050_000);
    expect(netProfit(400_000, 5_550)).toBe(394_450);
    expect(marginBasisPoints(25_000, 100_000)).toBe(2_500);
  });
});
