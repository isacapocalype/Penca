import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { closeDatabase, createTestDatabase } from '../lib/db';
import type { Database } from '../lib/db/types';
import type { MarketplaceFee, Order } from '../lib/types';
import { buildXlsx } from '../lib/export/xlsx-writer';
import { readTextFile } from '../lib/files';
import { makeStore } from '../test/fixtures';
import {
  analyzeImport,
  autoMapImportHeaders,
  commitImport,
  importBatchErrors,
  importFailuresCsv,
  normalizeImportStatus,
  parseImportFile,
  type ImportMapping,
  type ParsedImportFile,
} from './import';

let db: Database;

beforeEach(async () => {
  db = await createTestDatabase();
});

afterEach(async () => {
  await db.close();
  await closeDatabase();
});

const HEADER =
  'Order ID,Tanggal pesanan,Status,SKU,Nama produk,Jumlah,Harga satuan,Diskon penjual,HPP satuan,Nominal fee,Keterangan fee,Tanggal selesai';

interface CsvFile {
  fileName: string;
  bytes: Uint8Array;
  parsed: ParsedImportFile;
  mapping: ImportMapping;
}

function csvFile(...lines: string[]): CsvFile {
  const bytes = new TextEncoder().encode(`${[HEADER, ...lines].join('\r\n')}\r\n`);
  const parsed = parseImportFile('marketplace.csv', bytes);

  return {
    fileName: 'marketplace.csv',
    bytes,
    parsed,
    mapping: autoMapImportHeaders(parsed.headers),
  };
}

describe('marketplace import', () => {
  it('parses CSV, previews rows, and imports orders with fees and discounts', async () => {
    const store = await makeStore(db);
    const file = csvFile(
      'INV-IMP-1,2026-03-05,completed,KA-01,Kaos Custom,2,"Rp 100.000",20000,40000,10000,Biaya admin,2026-03-06',
      'INV-IMP-2,06/03/2026,selesai,KA-01,Kaos Custom,1,100000,0,40000,,,',
    );

    expect(file.mapping).toMatchObject({
      marketplace_order_id: 0,
      ordered_at: 1,
      status: 2,
      sku: 3,
      product_name: 4,
      qty: 5,
      unit_price: 6,
      seller_discount: 7,
      hpp_unit_snapshot: 8,
      fee_amount: 9,
      fee_description: 10,
      completed_at: 11,
    });

    const preview = await analyzeImport(db, store.id, file.fileName, file.parsed, file.mapping);
    expect(preview.validRows).toBe(2);
    expect(preview.invalidRows).toBe(0);
    expect(preview.orderCount).toBe(2);
    expect(preview.rows[0]).toMatchObject({ orderId: 'INV-IMP-1', gross: 200_000 });

    const result = await commitImport(
      db,
      store.id,
      file.fileName,
      file.bytes,
      file.parsed,
      file.mapping,
    );

    expect(result).toMatchObject({
      status: 'completed',
      rowsTotal: 2,
      rowsImported: 2,
      rowsFailed: 0,
      rowsSkipped: 0,
      ordersImported: 2,
      duplicateFile: false,
    });

    const orders = await db.query<Order>(
      'SELECT * FROM orders WHERE store_id = ? ORDER BY marketplace_order_id',
      [store.id],
    );

    expect(orders).toHaveLength(2);
    expect(orders[0]).toMatchObject({
      marketplace_order_id: 'INV-IMP-1',
      gross_revenue: 200_000,
      seller_discount: 20_000,
      hpp_total: 80_000,
      status: 'completed',
      completed_at: '2026-03-06',
    });
    expect(orders[1]).toMatchObject({
      marketplace_order_id: 'INV-IMP-2',
      gross_revenue: 100_000,
      ordered_at: '2026-03-06',
      status: 'completed',
    });

    const fees = await db.query<MarketplaceFee>(
      'SELECT * FROM marketplace_fees WHERE order_id = ?',
      [orders[0].id],
    );
    expect(fees).toHaveLength(1);
    expect(fees[0]).toMatchObject({
      description: 'Biaya admin',
      amount: 10_000,
      borne_by: 'seller',
    });
  });

  it('skips duplicate files and existing order IDs without creating duplicate orders', async () => {
    const store = await makeStore(db);
    const file = csvFile(
      'INV-IDEMPOTENT-1,2026-03-05,completed,KA-01,Kaos Custom,1,100000,0,40000,,,',
    );

    const first = await commitImport(
      db,
      store.id,
      file.fileName,
      file.bytes,
      file.parsed,
      file.mapping,
    );
    expect(first.ordersImported).toBe(1);

    const duplicate = await commitImport(
      db,
      store.id,
      file.fileName,
      file.bytes,
      file.parsed,
      file.mapping,
    );
    expect(duplicate).toMatchObject({ duplicateFile: true, ordersImported: 0 });

    const next = csvFile(
      'INV-IDEMPOTENT-1,2026-03-05,completed,KA-01,Kaos Custom,1,100000,0,40000,,,',
      'INV-IDEMPOTENT-2,2026-03-06,delivered,KA-02,Topi,1,50000,0,20000,,,',
    );
    const partial = await commitImport(
      db,
      store.id,
      next.fileName,
      next.bytes,
      next.parsed,
      next.mapping,
    );

    expect(partial).toMatchObject({
      status: 'completed',
      rowsImported: 1,
      rowsSkipped: 1,
      ordersImported: 1,
      duplicateFile: false,
    });

    const count = await db.query<{ count: number }>('SELECT COUNT(*) AS count FROM orders');
    expect(Number(count[0].count)).toBe(2);
  });

  it('keeps failed rows out of the database and exports their errors as CSV', async () => {
    const store = await makeStore(db);
    const file = csvFile(
      'INV-BAD-1,2026-03-08,completed,KA-01,Kaos Custom,0,100000,0,40000,,,',
      'INV-GOOD-1,2026-03-09,completed,KA-01,Kaos Custom,1,100000,0,40000,,,',
    );

    const preview = await analyzeImport(db, store.id, file.fileName, file.parsed, file.mapping);
    expect(preview.validRows).toBe(1);
    expect(preview.invalidRows).toBe(1);
    expect(preview.errors[0].messages.join(' ')).toMatch(/Jumlah/);

    const result = await commitImport(
      db,
      store.id,
      file.fileName,
      file.bytes,
      file.parsed,
      file.mapping,
    );

    expect(result).toMatchObject({
      status: 'completed_with_errors',
      rowsImported: 1,
      rowsFailed: 1,
      ordersImported: 1,
      hadErrors: true,
    });

    const orders = await db.query<{ marketplace_order_id: string }>(
      'SELECT marketplace_order_id FROM orders',
    );
    expect(orders.map((order) => order.marketplace_order_id)).toEqual(['INV-GOOD-1']);

    const errors = await importBatchErrors(db, result.batchId);
    expect(errors).toHaveLength(1);
    expect(errors[0].row_number).toBe(2);
    expect(errors[0].message).toMatch(/Jumlah/);

    const failures = await importFailuresCsv(db, result.batchId);
    expect(failures.rows).toBe(1);

    const text = await readTextFile(failures.path);
    expect(text).toContain('INV-BAD-1');
    expect(text).toContain('Jumlah');
  });

  it('reads and imports a real XLSX file produced by the built-in writer', async () => {
    const store = await makeStore(db);
    const bytes = buildXlsx(
      [
        {
          cells: [
            'Order ID',
            'Tanggal pesanan',
            'Status',
            'SKU',
            'Nama produk',
            'Jumlah',
            'Harga satuan',
            'HPP satuan',
          ],
          bold: true,
        },
        {
          cells: [
            'INV-XLSX-1',
            '2026-03-12',
            'completed',
            'KA-01',
            'Kaos Custom',
            '1',
            '100000',
            '40000',
          ],
        },
      ],
      'Pesanan',
    );

    const parsed = parseImportFile('pesanan.xlsx', bytes);
    expect(parsed.headers).toEqual([
      'Order ID',
      'Tanggal pesanan',
      'Status',
      'SKU',
      'Nama produk',
      'Jumlah',
      'Harga satuan',
      'HPP satuan',
    ]);
    expect(parsed.rows).toHaveLength(1);

    const mapping = autoMapImportHeaders(parsed.headers);
    expect(mapping.marketplace_order_id).toBe(0);
    expect(mapping.hpp_unit_snapshot).toBe(7);

    const result = await commitImport(db, store.id, 'pesanan.xlsx', bytes, parsed, mapping);
    expect(result.ordersImported).toBe(1);

    const order = await db.query<Order>(
      "SELECT * FROM orders WHERE marketplace_order_id = 'INV-XLSX-1'",
    );
    expect(order[0]).toMatchObject({ gross_revenue: 100_000, hpp_total: 40_000 });
  });

  it('rejects unsupported formats and normalizes marketplace status text', () => {
    expect(() => parseImportFile('data.pdf', new Uint8Array([1, 2, 3]))).toThrow(/CSV atau XLSX/);
    expect(normalizeImportStatus('SELESAI')).toBe('completed');
    expect(normalizeImportStatus('Dikirim')).toBe('shipped');
    expect(normalizeImportStatus('entah')).toBeNull();
  });
});
