import { strFromU8, unzipSync } from 'fflate';
import { afterEach, describe, expect, it } from 'vitest';
import type { FinancialSummary } from '../lib/types';
import { readBytesFile, readTextFile } from '../lib/files';
import {
  compactSummaryValue,
  dailyRows,
  exportReport,
  storeRows,
  summaryDateLabel,
  summaryLabel,
  summaryRows,
  type ReportFormat,
} from './reports';

function exampleSummary(): FinancialSummary {
  return {
    start: '2026-03-01',
    end: '2026-03-31',
    storeId: null,
    storeName: 'Semua Toko',
    grossRevenue: 1_234_567,
    sellerDiscount: 20_000,
    refunds: 10_000,
    netRevenue: 1_204_567,
    hpp: 400_000,
    grossProfit: 804_567,
    marketplaceFees: 50_000,
    advertising: 25_000,
    operational: 30_000,
    operatingProfit: 699_567,
    pphFinal: 6_172,
    netProfit: 693_395,
    marginBp: 5_756,
    ppnOutput: 110_000,
    ppnInput: 30_000,
    ppnPayable: 80_000,
    orderCount: 12,
    itemsSold: 18,
    settlementTotal: 900_000,
    daily: [
      {
        date: '2026-03-05',
        gross: 1_234_567,
        operating_profit: 699_567,
        net_profit: 693_395,
        orders: 12,
      },
    ],
    stores: [
      {
        store_id: 'store-1',
        name: 'Konveksi Amanah',
        marketplace: 'Shopee',
        gross: 1_234_567,
        orders: 12,
        ads: 25_000,
        fees: 50_000,
        hpp: 400_000,
        refunds: 10_000,
        operating_profit: 699_567,
        net_profit: 693_395,
      },
    ],
  };
}

afterEach(() => {
  // Reports only write to the in-memory file layer during tests.
});

describe('report labels and exports', () => {
  it('formats summary, daily, and store rows for every report format', () => {
    const summary = exampleSummary();

    expect(summaryLabel(summary)).toBe('1 Mar 2026 – 31 Maret 2026');
    expect(summaryDateLabel('2026-03-31')).toBe('31 Maret 2026');
    expect(compactSummaryValue(1_234_567)).toBe('Rp 1,2 jt');

    const rows = summaryRows(summary);
    expect(rows).toHaveLength(19);
    expect(rows[0]).toEqual(['Omzet bruto', 'Rp 1.234.567']);
    expect(rows).toContainEqual(['Laba bersih', 'Rp 693.395']);
    expect(rows).toContainEqual(['Margin', '57,56%']);
    expect(rows).toContainEqual(['PPN kurang bayar', 'Rp 80.000']);

    expect(dailyRows(summary)).toEqual([
      ['5 Mar 2026', '12', 'Rp 1.234.567', 'Rp 699.567', 'Rp 693.395'],
    ]);
    expect(storeRows(summary)).toEqual([
      [
        'Konveksi Amanah',
        'Shopee',
        '12',
        'Rp 1.234.567',
        'Rp 50.000',
        'Rp 25.000',
        'Rp 400.000',
        'Rp 10.000',
        'Rp 693.395',
      ],
    ]);
  });

  it('writes a UTF-8 CSV with a BOM and the report sections', async () => {
    const file = await exportReport(exampleSummary(), 'csv');

    expect(file.name).toMatch(/^penca-laporan-\d{14}\.csv$/);
    expect(file.mime).toBe('text/csv');

    const text = await readTextFile(file.path);
    expect(text.charCodeAt(0)).toBe(0xfeff);
    expect(text).toContain('Laporan Penca');
    expect(text).toContain('1 Mar 2026 – 31 Maret 2026');
    expect(text).toContain('Rp 1.234.567');
    expect(text).toContain('Konveksi Amanah');
  });

  it('writes a ZIP-based XLSX workbook with the expected sheet data', async () => {
    const file = await exportReport(exampleSummary(), 'xlsx');

    expect(file.name).toMatch(/^penca-laporan-\d{14}\.xlsx$/);
    expect(file.mime).toBe('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');

    const bytes = await readBytesFile(file.path);
    expect(bytes[0]).toBe(0x50);
    expect(bytes[1]).toBe(0x4b);

    const archive = unzipSync(bytes);
    expect(Object.keys(archive)).toContain('xl/worksheets/sheet1.xml');

    const sheet = strFromU8(archive['xl/worksheets/sheet1.xml']);
    expect(sheet).toContain('Laporan Penca');
    expect(sheet).toContain('Konveksi Amanah');
    expect(sheet).toContain('Omzet bruto');
  });

  it('writes a readable PDF document', async () => {
    const file = await exportReport(exampleSummary(), 'pdf');

    expect(file.name).toMatch(/^penca-laporan-\d{14}\.pdf$/);
    expect(file.mime).toBe('application/pdf');

    const text = new TextDecoder().decode(await readBytesFile(file.path));
    expect(text.startsWith('%PDF-1.4')).toBe(true);
    expect(text).toContain('Laporan Keuangan Penca');
    expect(text).toContain('Ringkasan');
    expect(text.trimEnd().endsWith('%%EOF')).toBe(true);
  });

  it('rejects an unsupported report format', async () => {
    await expect(exportReport(exampleSummary(), 'docx' as ReportFormat)).rejects.toThrow(
      /Format laporan/,
    );
  });
});
