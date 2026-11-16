import dayjs from 'dayjs';
import type { FinancialSummary } from '../lib/types';
import { compactRupiah, formatDecimal, rupiah } from '../lib/money';
import { formatLongDate, periodLabel, TIMEZONE } from '../lib/date';
import { buildXlsx, type XlsxRow } from '../lib/export/xlsx-writer';
import { SimplePdf } from '../lib/export/simple-pdf';
import { writeBytesFile, writeTextFile } from '../lib/files';
import { AppError } from '../lib/errors';
import { nowIso } from '../lib/db/helpers';

export type ReportFormat = 'csv' | 'xlsx' | 'pdf';

export interface ReportFile {
  path: string;
  name: string;
  mime: string;
}

export function summaryLabel(summary: FinancialSummary): string {
  return periodLabel(summary.start, summary.end);
}

export function summaryRows(summary: FinancialSummary): Array<[string, string]> {
  return [
    ['Omzet bruto', rupiah(summary.grossRevenue)],
    ['Diskon penjual', rupiah(summary.sellerDiscount)],
    ['Refund', rupiah(summary.refunds)],
    ['Pendapatan neto', rupiah(summary.netRevenue)],
    ['HPP', rupiah(summary.hpp)],
    ['Laba kotor', rupiah(summary.grossProfit)],
    ['Fee marketplace', rupiah(summary.marketplaceFees)],
    ['Biaya iklan', rupiah(summary.advertising)],
    ['Biaya operasional', rupiah(summary.operational)],
    ['Laba operasional', rupiah(summary.operatingProfit)],
    ['PPh Final', rupiah(summary.pphFinal)],
    ['Laba bersih', rupiah(summary.netProfit)],
    ['Margin', `${formatDecimal(summary.marginBp / 100, 2)}%`],
    ['PPN keluaran', rupiah(summary.ppnOutput)],
    ['PPN masukan', rupiah(summary.ppnInput)],
    ['PPN kurang bayar', rupiah(summary.ppnPayable)],
    ['Jumlah pesanan', String(summary.orderCount)],
    ['Produk terjual', String(summary.itemsSold)],
    ['Dana dicairkan', rupiah(summary.settlementTotal)],
  ];
}

export function dailyRows(summary: FinancialSummary): string[][] {
  return summary.daily.map((day) => [
    dayjs(day.date).locale('id').format('D MMM YYYY'),
    String(day.orders),
    rupiah(day.gross),
    rupiah(day.operating_profit),
    rupiah(day.net_profit),
  ]);
}

export function storeRows(summary: FinancialSummary): string[][] {
  return summary.stores.map((store) => [
    store.name,
    store.marketplace,
    String(store.orders),
    rupiah(store.gross),
    rupiah(store.fees),
    rupiah(store.ads),
    rupiah(store.hpp),
    rupiah(store.refunds),
    rupiah(store.net_profit),
  ]);
}

function createdLabel(): string {
  return `${dayjs().tz(TIMEZONE).locale('id').format('D MMMM YYYY HH:mm')} WIB`;
}

function csvCell(value: string): string {
  return /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

function buildCsv(summary: FinancialSummary): string {
  const lines: string[][] = [];
  lines.push(['Laporan Penca']);
  lines.push(['Periode', summaryLabel(summary)]);
  lines.push(['Toko', summary.storeName]);
  lines.push(['Dibuat', createdLabel()]);
  lines.push([]);
  lines.push(['Ringkasan', 'Nilai']);

  for (const row of summaryRows(summary)) {
    lines.push(row);
  }

  lines.push([]);
  lines.push(['Harian', 'Pesanan', 'Omzet', 'Laba operasional', 'Laba bersih']);

  for (const row of dailyRows(summary)) {
    lines.push(row);
  }

  lines.push([]);
  lines.push(['Toko', 'Marketplace', 'Pesanan', 'Omzet', 'Fee', 'Iklan', 'HPP', 'Refund', 'Laba bersih']);

  for (const row of storeRows(summary)) {
    lines.push(row);
  }

  return `\uFEFF${lines.map((line) => line.map(csvCell).join(',')).join('\r\n')}\r\n`;
}

function buildXlsxRows(summary: FinancialSummary): XlsxRow[] {
  const rows: XlsxRow[] = [
    { cells: ['Laporan Penca'], bold: true },
    { cells: ['Periode', summaryLabel(summary)] },
    { cells: ['Toko', summary.storeName] },
    { cells: ['Dibuat', createdLabel()] },
    { cells: [] },
    { cells: ['Ringkasan', 'Nilai'], bold: true },
  ];

  for (const row of summaryRows(summary)) {
    rows.push({ cells: row });
  }

  rows.push({ cells: [] });
  rows.push({ cells: ['Harian', 'Pesanan', 'Omzet', 'Laba operasional', 'Laba bersih'], bold: true });

  for (const row of dailyRows(summary)) {
    rows.push({ cells: row });
  }

  rows.push({ cells: [] });
  rows.push({
    cells: ['Toko', 'Marketplace', 'Pesanan', 'Omzet', 'Fee', 'Iklan', 'HPP', 'Refund', 'Laba bersih'],
    bold: true,
  });

  for (const row of storeRows(summary)) {
    rows.push({ cells: row });
  }

  return rows;
}

function buildPdf(summary: FinancialSummary): Uint8Array {
  const pdf = new SimplePdf('Laporan Penca');
  pdf.titleText('Laporan Keuangan Penca');
  pdf.subtitle(`Periode: ${summaryLabel(summary)}`);
  pdf.subtitle(`Toko: ${summary.storeName}`);
  pdf.subtitle(`Dibuat: ${createdLabel()}`);
  pdf.section('Ringkasan');

  for (const [label, value] of summaryRows(summary)) {
    pdf.field(label, value);
  }

  pdf.section('Rincian harian');
  pdf.table(
    ['Tanggal', 'Pesanan', 'Omzet', 'Laba operasional', 'Laba bersih'],
    dailyRows(summary),
    [100, 70, 120, 120, 120],
  );

  pdf.section('Performa toko');
  pdf.table(
    ['Toko', 'Marketplace', 'Pesanan', 'Omzet', 'Laba bersih'],
    summary.stores.map((store) => [
      store.name,
      store.marketplace,
      String(store.orders),
      rupiah(store.gross),
      rupiah(store.net_profit),
    ]),
    [120, 80, 60, 110, 120],
  );

  return pdf.save();
}

/** Membuat file laporan nyata di penyimpanan aplikasi. */
export async function exportReport(summary: FinancialSummary, format: ReportFormat): Promise<ReportFile> {
  const stamp = nowIso().replace(/\D/g, '').slice(0, 14);
  const base = `penca-laporan-${stamp}`;
  const name = `${base}.${format}`;
  const path = `exports/${name}`;
  const mime =
    format === 'csv'
      ? 'text/csv'
      : format === 'xlsx'
        ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        : 'application/pdf';

  if (format === 'csv') {
    await writeTextFile(path, buildCsv(summary));
  } else if (format === 'xlsx') {
    await writeBytesFile(path, buildXlsx(buildXlsxRows(summary), 'Laporan'));
  } else if (format === 'pdf') {
    await writeBytesFile(path, buildPdf(summary));
  } else {
    throw new AppError('Format laporan harus CSV, XLSX, atau PDF.');
  }

  return { path, name, mime };
}

export function compactSummaryValue(value: number): string {
  return compactRupiah(value);
}

export function summaryDateLabel(value: string): string {
  return formatLongDate(value);
}
