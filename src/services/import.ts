import { strFromU8, unzipSync } from 'fflate';
import dayjs from 'dayjs';
import '../lib/date';
import type { Database } from '../lib/db/types';
import type { ImportBatch, Order, Product, ProductCost } from '../lib/types';
import type { OrderStatus } from '../lib/constants';
import { AppError } from '../lib/errors';
import { newId } from '../lib/id';
import { nowIso } from '../lib/db/helpers';
import { addRefund, createOrder, type FeeInput, type OrderItemInput } from './orders';
import { parseRupiah } from '../lib/money';
import { sha256Hex } from '../lib/hash';
import { writeTextFile } from '../lib/files';

export const MAX_IMPORT_BYTES = 10 * 1024 * 1024;
export const MAX_IMPORT_ROWS = 10_000;

export const IMPORT_FIELD_LABELS = {
  marketplace_order_id: 'Order ID',
  ordered_at: 'Tanggal pesanan',
  status: 'Status',
  sku: 'SKU',
  product_name: 'Nama produk',
  qty: 'Jumlah',
  unit_price: 'Harga satuan',
  seller_discount: 'Diskon penjual',
  marketplace_discount: 'Diskon marketplace',
  hpp_unit_snapshot: 'HPP satuan',
  fee_description: 'Keterangan fee',
  fee_amount: 'Nominal fee',
  fee_basis: 'Dasar fee',
  fee_rate_bp: 'Tarif fee (bp)',
  refund_amount: 'Nominal refund',
  refunded_at: 'Tanggal refund',
  completed_at: 'Tanggal selesai',
  notes: 'Catatan',
} as const;

export type ImportField = keyof typeof IMPORT_FIELD_LABELS;

export const REQUIRED_IMPORT_FIELDS: ImportField[] = [
  'marketplace_order_id',
  'ordered_at',
  'status',
  'sku',
  'product_name',
  'qty',
  'unit_price',
];

const FIELD_ALIASES: Record<ImportField, string[]> = {
  marketplace_order_id: [
    'order id',
    'orderid',
    'marketplace order id',
    'no pesanan',
    'nomor pesanan',
    'id pesanan',
    'order',
    'invoice',
    'no invoice',
  ],
  ordered_at: ['tanggal', 'tanggal pesanan', 'order date', 'ordered at', 'date', 'tgl'],
  status: ['status', 'status pesanan', 'order status'],
  sku: ['sku', 'kode produk', 'seller sku', 'product sku', 'kode'],
  product_name: ['nama produk', 'produk', 'product name', 'nama barang', 'product'],
  qty: ['qty', 'quantity', 'jumlah', 'jumlah barang', 'kuantitas'],
  unit_price: ['harga satuan', 'harga', 'unit price', 'price', 'harga jual'],
  seller_discount: ['diskon penjual', 'diskon', 'seller discount', 'discount'],
  marketplace_discount: ['diskon marketplace', 'marketplace discount', 'diskon platform'],
  hpp_unit_snapshot: ['hpp satuan', 'hpp', 'hpp unit', 'modal', 'cost', 'unit cost'],
  fee_description: ['keterangan fee', 'fee description', 'biaya marketplace', 'jenis fee'],
  fee_amount: ['nominal fee', 'fee amount', 'biaya admin', 'admin fee', 'potongan', 'fee', 'biaya'],
  fee_basis: ['dasar fee', 'fee basis', 'basis'],
  fee_rate_bp: ['tarif fee', 'fee rate', 'persentase fee', 'rate bp', 'persen fee', 'fee persen'],
  refund_amount: ['nominal refund', 'refund', 'refund amount', 'nilai refund'],
  refunded_at: ['tanggal refund', 'refund date', 'refunded at'],
  completed_at: ['tanggal selesai', 'completion date', 'completed at', 'tanggal diterima'],
  notes: ['catatan', 'notes', 'note', 'keterangan'],
};

export type ImportMapping = Partial<Record<ImportField, number>>;

export interface ParsedImportFile {
  headers: string[];
  rows: string[][];
}

export interface ImportPreviewRow {
  orderId: string;
  orderedAt: string;
  status: OrderStatus;
  items: number;
  gross: number;
}

export interface ImportRowError {
  row: number;
  messages: string[];
}

export interface ImportPreview {
  fileName: string;
  headers: string[];
  mapping: ImportMapping;
  rows: ImportPreviewRow[];
  totalRows: number;
  orderCount: number;
  validRows: number;
  invalidRows: number;
  errors: ImportRowError[];
}

export interface ImportResult {
  batchId: string;
  status: string;
  rowsTotal: number;
  rowsImported: number;
  rowsFailed: number;
  rowsSkipped: number;
  ordersImported: number;
  duplicateFile: boolean;
  hadErrors: boolean;
}

interface ValidRow {
  row: number;
  data: Record<string, unknown>;
}

interface Inspection {
  headers: string[];
  rows: string[][];
  mapping: ImportMapping;
  valid: ValidRow[];
  errors: ImportRowError[];
  orderIds: string[];
  missing: string[];
}

export function normalizeImportText(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/%/g, ' persen ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

export function autoMapImportHeaders(headers: string[]): ImportMapping {
  const mapping: ImportMapping = {};

  for (const [index, header] of headers.entries()) {
    const normalized = normalizeImportText(header);

    for (const [field, aliases] of Object.entries(FIELD_ALIASES) as Array<[ImportField, string[]]>) {
      if (mapping[field] !== undefined) {
        continue;
      }

      if (aliases.some((alias) => normalizeImportText(alias) === normalized)) {
        mapping[field] = index;
      }
    }
  }

  return mapping;
}

export function normalizeImportMapping(headers: string[], mapping: ImportMapping): ImportMapping {
  const normalized: ImportMapping = {};

  for (const [field, index] of Object.entries(mapping) as Array<[ImportField, number | undefined]>) {
    if (!(field in IMPORT_FIELD_LABELS) || index === undefined) {
      continue;
    }

    if (Number.isInteger(index) && index >= 0 && index < headers.length) {
      normalized[field] = index;
    }
  }

  return normalized;
}

function parseCsv(text: string, delimiter: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;

  for (let index = 0; index < text.length; index++) {
    const character = text[index];

    if (quoted) {
      if (character === '"') {
        if (text[index + 1] === '"') {
          field += '"';
          index += 1;
        } else {
          quoted = false;
        }
      } else {
        field += character;
      }

      continue;
    }

    if (character === '"' && field.trim() === '') {
      quoted = true;
    } else if (character === delimiter) {
      row.push(field);
      field = '';
    } else if (character === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else if (character !== '\r') {
      field += character;
    }
  }

  if (field !== '' || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  return rows;
}

function detectDelimiter(line: string): string {
  const candidates: Array<[string, number]> = [
    [',', (line.match(/,/g) ?? []).length],
    [';', (line.match(/;/g) ?? []).length],
    ['\t', (line.match(/\t/g) ?? []).length],
  ];
  candidates.sort((a, b) => b[1] - a[1]);

  return candidates[0][1] > 0 ? candidates[0][0] : ',';
}

function decodeText(bytes: Uint8Array): string {
  return new TextDecoder('utf-8').decode(bytes).replace(/^\uFEFF/, '');
}

function parseCsvFile(bytes: Uint8Array): ParsedImportFile {
  const text = decodeText(bytes);
  const firstLine = text.split(/\r?\n/, 1)[0] ?? '';
  const rawRows = parseCsv(text, detectDelimiter(firstLine));
  const nonEmpty = rawRows.filter((row) => row.some((value) => value.trim() !== ''));

  if (nonEmpty.length === 0) {
    return { headers: [], rows: [] };
  }

  const headers = nonEmpty[0].map((header) => header.replace(/^\uFEFF/, '').trim());
  const rows = nonEmpty.slice(1).map((row) => row.map((value) => value.trim()));

  return { headers, rows };
}

function excelDate(serial: number): string | null {
  if (!Number.isFinite(serial) || serial < 1 || serial > 100000) {
    return null;
  }

  return dayjs('1899-12-30').add(Math.floor(serial), 'day').format('YYYY-MM-DD');
}

function xmlDocument(xml: string): Document {
  const document = new DOMParser().parseFromString(xml, 'application/xml');

  if (document.getElementsByTagName('parsererror').length > 0) {
    throw new AppError('Struktur XML di dalam file XLSX tidak valid.');
  }

  return document;
}

function xmlText(node: Element): string {
  return Array.from(node.getElementsByTagName('t'))
    .map((part) => part.textContent ?? '')
    .join('');
}

function columnIndex(reference: string): number {
  const letters = reference.replace(/\d+/g, '').toUpperCase();
  let index = 0;

  for (const letter of letters) {
    index = index * 26 + (letter.charCodeAt(0) - 64);
  }

  return Math.max(0, index - 1);
}

function parseXlsxFile(bytes: Uint8Array): ParsedImportFile {
  let archive: Record<string, Uint8Array>;

  try {
    archive = unzipSync(bytes);
  } catch {
    throw new AppError('File XLSX tidak dapat dibuka. Pastikan file tidak rusak.');
  }

  const shared: string[] = [];
  const sharedFile = archive['xl/sharedStrings.xml'];

  if (sharedFile) {
    const document = xmlDocument(strFromU8(sharedFile));

    for (const item of Array.from(document.getElementsByTagName('si'))) {
      shared.push(xmlText(item));
    }
  }

  const sheetName =
    Object.keys(archive)
      .filter((name) => /^xl\/worksheets\/sheet\d+\.xml$/.test(name))
      .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))[0] ?? null;

  if (!sheetName || !archive[sheetName]) {
    throw new AppError('Worksheet pertama tidak ditemukan di file XLSX.');
  }

  const sheet = xmlDocument(strFromU8(archive[sheetName]));
  const rows: Array<{ index: number; values: string[] }> = [];

  for (const rowNode of Array.from(sheet.getElementsByTagName('row'))) {
    const rowIndex = Number(rowNode.getAttribute('r') ?? rows.length + 1) - 1;
    const cells = new Map<number, string>();

    for (const cell of Array.from(rowNode.getElementsByTagName('c'))) {
      const reference = cell.getAttribute('r') ?? 'A1';
      const type = cell.getAttribute('t') ?? '';
      const valueNode = cell.getElementsByTagName('v')[0] ?? null;
      let value = '';

      if (type === 's') {
        const sharedIndex = Number(valueNode?.textContent ?? -1);
        value = shared[sharedIndex] ?? '';
      } else if (type === 'inlineStr') {
        const inline = cell.getElementsByTagName('is')[0] ?? null;
        value = inline ? xmlText(inline) : '';
      } else {
        value = valueNode?.textContent ?? '';
      }

      cells.set(columnIndex(reference), value.trim());
    }

    if (cells.size > 0) {
      const max = Math.max(...cells.keys());
      rows.push({
        index: rowIndex,
        values: Array.from({ length: max + 1 }, (_, index) => cells.get(index) ?? ''),
      });
    }
  }

  rows.sort((a, b) => a.index - b.index);

  if (rows.length === 0) {
    return { headers: [], rows: [] };
  }

  const headers = rows[0].values.map((header) => header.trim());
  const dataRows = rows
    .slice(1)
    .map((row) => row.values)
    .filter((row) => row.some((value) => value.trim() !== ''));

  return { headers, rows: dataRows };
}

export function parseImportFile(fileName: string, bytes: Uint8Array): ParsedImportFile {
  if (bytes.byteLength > MAX_IMPORT_BYTES) {
    throw new AppError('Ukuran file melebihi batas 10 MB.');
  }

  const extension = fileName.split('.').pop()?.toLowerCase() ?? '';

  if (extension === 'xlsx') {
    return parseXlsxFile(bytes);
  }

  if (!['csv', 'txt'].includes(extension)) {
    throw new AppError('Format file harus CSV atau XLSX.');
  }

  return parseCsvFile(bytes);
}

function parseInteger(value: string): number | null {
  const clean = value.replace(/\s/g, '');

  if (clean === '' || !/^-?\d+$/.test(clean)) {
    return null;
  }

  return Number.parseInt(clean, 10);
}

function parseImportMoney(value: string): number | null {
  if (value.trim() === '') {
    return null;
  }

  if (!/^-?[\d.,\sRp]+$/i.test(value)) {
    return null;
  }

  return parseRupiah(value);
}

export function parseImportDate(value: string): string | null {
  const clean = value.trim();

  if (clean === '') {
    return null;
  }

  if (/^\d{5}(\.\d+)?$/.test(clean)) {
    return excelDate(Number(clean));
  }

  const formats = ['YYYY-MM-DD', 'DD/MM/YYYY', 'DD-MM-YYYY', 'YYYY/MM/DD', 'D MMM YYYY', 'D MMMM YYYY'];
  const normalized = clean.replace(/\s+/g, ' ');

  for (const format of formats) {
    const parsed = dayjs(normalized, format, true);

    if (parsed.isValid() && parsed.format(format).toLowerCase() === normalized.toLowerCase()) {
      return parsed.format('YYYY-MM-DD');
    }
  }

  const parsed = dayjs(normalized);

  return parsed.isValid() && /\d{4}/.test(normalized) ? parsed.format('YYYY-MM-DD') : null;
}

const STATUS_ALIASES: Record<string, OrderStatus> = {
  pending: 'pending',
  menunggu: 'pending',
  processing: 'processing',
  diproses: 'processing',
  proses: 'processing',
  shipped: 'shipped',
  dikirim: 'shipped',
  delivered: 'delivered',
  terkirim: 'delivered',
  completed: 'completed',
  selesai: 'completed',
  cancelled: 'cancelled',
  canceled: 'cancelled',
  batal: 'cancelled',
  dibatalkan: 'cancelled',
  returned: 'returned',
  retur: 'returned',
  refunded: 'refunded',
  refund: 'refunded',
  dikembalikan: 'refunded',
};

export function normalizeImportStatus(value: string): OrderStatus | null {
  return STATUS_ALIASES[value.trim().toLowerCase()] ?? null;
}

function rowValue(row: string[], mapping: ImportMapping, field: ImportField): string {
  const index = mapping[field];

  return index === undefined ? '' : (row[index] ?? '').trim();
}

function costOn(costs: ProductCost[], date: string): number | null {
  let match: ProductCost | null = null;

  for (const cost of costs) {
    if (cost.effective_from <= date && (cost.effective_to === null || cost.effective_to >= date)) {
      if (!match || cost.effective_from > match.effective_from) {
        match = cost;
      }
    }
  }

  return match?.hpp_unit ?? null;
}

async function productsForImport(db: Database, storeId: string, skus: string[]): Promise<Map<string, Product & { costs: ProductCost[] }>> {
  const result = new Map<string, Product & { costs: ProductCost[] }>();
  const unique = [...new Set(skus.filter((sku) => sku !== ''))];

  if (unique.length === 0) {
    return result;
  }

  const products = await db.query<Product>(
    `SELECT * FROM products WHERE store_id = ? AND sku IN (${unique.map(() => '?').join(', ')})`,
    [storeId, ...unique],
  );

  for (const product of products) {
    const costs = await db.query<ProductCost>(
      'SELECT * FROM product_costs WHERE product_id = ? ORDER BY effective_from',
      [product.id],
    );
    result.set(product.sku, { ...product, costs });
  }

  return result;
}

function validateRow(
  row: string[],
  mapping: ImportMapping,
  products: Map<string, Product & { costs: ProductCost[] }>,
): [Record<string, unknown>, string[]] {
  const messages: string[] = [];
  const orderId = rowValue(row, mapping, 'marketplace_order_id');
  const orderedAtRaw = rowValue(row, mapping, 'ordered_at');
  const statusRaw = rowValue(row, mapping, 'status');
  const sku = rowValue(row, mapping, 'sku');
  const productName = rowValue(row, mapping, 'product_name');
  const qtyRaw = rowValue(row, mapping, 'qty');
  const unitPriceRaw = rowValue(row, mapping, 'unit_price');

  if (orderId === '') {
    messages.push('Order ID wajib diisi.');
  } else if (orderId.length > 120) {
    messages.push('Order ID maksimal 120 karakter.');
  }

  const orderedAt = parseImportDate(orderedAtRaw);

  if (orderedAt === null) {
    messages.push('Tanggal pesanan tidak valid. Gunakan format YYYY-MM-DD atau DD/MM/YYYY.');
  }

  const status = normalizeImportStatus(statusRaw);

  if (status === null) {
    messages.push('Status pesanan tidak dikenal.');
  }

  if (sku === '' || sku.length > 80) {
    messages.push('SKU wajib diisi, maksimal 80 karakter.');
  }

  if (productName === '' || productName.length > 160) {
    messages.push('Nama produk wajib diisi, maksimal 160 karakter.');
  }

  let qty = parseInteger(qtyRaw);

  if (qty === null || qty <= 0) {
    messages.push('Jumlah harus bilangan bulat lebih dari nol.');
    qty = 0;
  }

  let unitPrice = parseImportMoney(unitPriceRaw);

  if (unitPrice === null || unitPrice < 0) {
    messages.push('Harga satuan harus nominal tidak negatif.');
    unitPrice = 0;
  }

  const completedRaw = rowValue(row, mapping, 'completed_at');
  const completedAt = completedRaw === '' ? null : parseImportDate(completedRaw);

  if (completedRaw !== '' && completedAt === null) {
    messages.push('Tanggal selesai tidak valid.');
  }

  if (orderedAt && completedAt && completedAt < orderedAt) {
    messages.push('Tanggal selesai tidak boleh sebelum tanggal pesanan.');
  }

  const sellerDiscount = parseImportMoney(rowValue(row, mapping, 'seller_discount')) ?? 0;
  const marketplaceDiscount = parseImportMoney(rowValue(row, mapping, 'marketplace_discount')) ?? 0;

  if (sellerDiscount < 0 || marketplaceDiscount < 0) {
    messages.push('Diskon tidak boleh negatif.');
  }

  const hppRaw = rowValue(row, mapping, 'hpp_unit_snapshot');
  let hpp = hppRaw === '' ? null : parseImportMoney(hppRaw);

  if (hppRaw !== '' && (hpp === null || hpp < 0)) {
    messages.push('HPP satuan tidak valid.');
  }

  const product = products.get(sku) ?? null;

  if (hpp === null && product && orderedAt) {
    hpp = costOn(product.costs, orderedAt);
  }

  if (hpp === null) {
    messages.push(`HPP untuk SKU ${sku} belum diatur pada tanggal pesanan. Tambahkan riwayat HPP atau isi kolom HPP.`);
  }

  const feeAmountRaw = rowValue(row, mapping, 'fee_amount');
  const feeAmount = feeAmountRaw === '' ? null : parseImportMoney(feeAmountRaw);

  if (feeAmountRaw !== '' && (feeAmount === null || feeAmount < 0)) {
    messages.push('Nominal fee tidak valid.');
  }

  const feeRateRaw = rowValue(row, mapping, 'fee_rate_bp');
  const feeRate = feeRateRaw === '' ? null : parseInteger(feeRateRaw);

  if (feeRateRaw !== '' && (feeRate === null || feeRate < 0 || feeRate > 10000)) {
    messages.push('Tarif fee (basis poin) harus antara 0 dan 10000.');
  }

  let feeBasis = rowValue(row, mapping, 'fee_basis').toLowerCase();

  if (feeBasis === '') {
    feeBasis = feeAmount !== null ? 'fixed' : 'gross';
  }

  if (!['gross', 'net', 'hpp', 'fixed'].includes(feeBasis)) {
    messages.push('Dasar fee harus gross, net, hpp, atau fixed.');
  }

  const refundRaw = rowValue(row, mapping, 'refund_amount');
  const refundAmount = refundRaw === '' ? null : parseImportMoney(refundRaw);

  if (refundRaw !== '' && (refundAmount === null || refundAmount < 0)) {
    messages.push('Nominal refund tidak valid.');
  }

  const refundedRaw = rowValue(row, mapping, 'refunded_at');
  const refundedAt = refundedRaw === '' ? null : parseImportDate(refundedRaw);

  if (refundedRaw !== '' && refundedAt === null) {
    messages.push('Tanggal refund tidak valid.');
  }

  return [
    {
      marketplace_order_id: orderId,
      ordered_at: orderedAt,
      completed_at: completedAt,
      status,
      seller_discount: sellerDiscount,
      marketplace_discount: marketplaceDiscount,
      notes: rowValue(row, mapping, 'notes') || null,
      product_id: product?.id ?? null,
      sku,
      product_name: productName,
      qty,
      unit_price: unitPrice,
      hpp_unit_snapshot: hpp,
      fee_description: rowValue(row, mapping, 'fee_description') || null,
      fee_amount: feeAmount,
      fee_basis: feeBasis,
      fee_rate_bp: feeRate,
      refund_amount: refundAmount,
      refunded_at: refundedAt,
    },
    messages,
  ];
}

function failGroup(valid: Map<number, ValidRow>, errors: Map<number, ImportRowError>, indexes: number[], message: string): void {
  for (const index of indexes) {
    const row = valid.get(index);

    if (!row) {
      continue;
    }

    errors.set(index, { row: row.row, messages: [message] });
    valid.delete(index);
  }
}

function enforceCompleteOrders(
  valid: Map<number, ValidRow>,
  errors: Map<number, ImportRowError>,
  rows: string[][],
  mapping: ImportMapping,
): void {
  const groups = new Map<string, number[]>();

  for (const [index, row] of rows.entries()) {
    const orderId = rowValue(row, mapping, 'marketplace_order_id');

    if (orderId !== '') {
      const list = groups.get(orderId) ?? [];
      list.push(index);
      groups.set(orderId, list);
    }
  }

  for (const [orderId, indexes] of groups) {
    if (!indexes.some((index) => errors.has(index))) {
      continue;
    }

    for (const index of indexes) {
      const row = valid.get(index);

      if (!row) {
        continue;
      }

      errors.set(index, {
        row: row.row,
        messages: [`Order ${orderId} tidak diimpor karena ada baris lain pada order ini yang gagal.`],
      });
      valid.delete(index);
    }
  }
}

function enforceConsistentOrderData(valid: Map<number, ValidRow>, errors: Map<number, ImportRowError>): void {
  const groups = new Map<string, number[]>();

  for (const [index, row] of valid) {
    const orderId = String(row.data.marketplace_order_id);
    const list = groups.get(orderId) ?? [];
    list.push(index);
    groups.set(orderId, list);
  }

  const fields = [
    'ordered_at',
    'completed_at',
    'status',
    'seller_discount',
    'marketplace_discount',
    'fee_description',
    'fee_amount',
    'fee_basis',
    'fee_rate_bp',
    'refund_amount',
    'refunded_at',
    'notes',
  ];

  for (const [orderId, indexes] of groups) {
    const conflict = fields.some((field) => {
      const values = new Set(indexes.map((index) => String(valid.get(index)?.data[field] ?? '')));

      return values.size > 1;
    });

    if (!conflict) {
      continue;
    }

    for (const index of indexes) {
      const row = valid.get(index);

      if (!row) {
        continue;
      }

      errors.set(index, {
        row: row.row,
        messages: [`Data order ${orderId} berbeda antar baris (tanggal/status/diskon/fee/refund). Samakan nilainya.`],
      });
      valid.delete(index);
    }
  }
}

function enforceOrderTotals(valid: Map<number, ValidRow>, errors: Map<number, ImportRowError>): void {
  const groups = new Map<string, number[]>();

  for (const [index, row] of valid) {
    const orderId = String(row.data.marketplace_order_id);
    const list = groups.get(orderId) ?? [];
    list.push(index);
    groups.set(orderId, list);
  }

  for (const [orderId, indexes] of groups) {
    const first = valid.get(indexes[0])?.data;

    if (!first) {
      continue;
    }

    const gross = indexes.reduce(
      (sum, index) => sum + Number(valid.get(index)?.data.qty ?? 0) * Number(valid.get(index)?.data.unit_price ?? 0),
      0,
    );
    const net = gross - Number(first.seller_discount ?? 0);
    const refund = first.refund_amount === null ? null : Number(first.refund_amount);

    if (net < 0) {
      failGroup(valid, errors, indexes, `Diskon penjual order ${orderId} melebihi omzet bruto.`);
    } else if (refund !== null && refund > net) {
      failGroup(valid, errors, indexes, `Refund order ${orderId} melebihi nilai pesanan setelah diskon.`);
    }
  }
}

async function inspect(
  db: Database,
  storeId: string,
  parsed: ParsedImportFile,
  mappingInput: ImportMapping,
): Promise<Inspection> {
  const { headers, rows } = parsed;

  if (rows.length > MAX_IMPORT_ROWS) {
    throw new AppError('Jumlah baris melebihi batas 10.000 baris.');
  }

  if (headers.length === 0) {
    throw new AppError('File tidak memiliki baris judul kolom.');
  }

  const mapping =
    Object.keys(mappingInput).length === 0 ? autoMapImportHeaders(headers) : normalizeImportMapping(headers, mappingInput);
  const missing = REQUIRED_IMPORT_FIELDS.filter((field) => mapping[field] === undefined).map(
    (field) => IMPORT_FIELD_LABELS[field],
  );
  const products = await productsForImport(
    db,
    storeId,
    rows.map((row) => rowValue(row, mapping, 'sku')),
  );

  const valid = new Map<number, ValidRow>();
  const errors = new Map<number, ImportRowError>();
  const orderIds = new Set<string>();

  for (const [index, row] of rows.entries()) {
    const orderId = rowValue(row, mapping, 'marketplace_order_id');

    if (orderId !== '') {
      orderIds.add(orderId);
    }

    const [data, messages] = validateRow(row, mapping, products);

    if (messages.length > 0) {
      errors.set(index, { row: index + 2, messages });

      continue;
    }

    valid.set(index, { row: index + 2, data });
  }

  enforceCompleteOrders(valid, errors, rows, mapping);
  enforceConsistentOrderData(valid, errors);
  enforceOrderTotals(valid, errors);

  return {
    headers,
    rows,
    mapping,
    valid: [...valid.values()].sort((a, b) => a.row - b.row),
    errors: [...errors.values()].sort((a, b) => a.row - b.row),
    orderIds: [...orderIds],
    missing,
  };
}

export async function analyzeImport(
  db: Database,
  storeId: string,
  fileName: string,
  parsed: ParsedImportFile,
  mapping: ImportMapping = {},
): Promise<ImportPreview> {
  const result = await inspect(db, storeId, parsed, mapping);
  const groups = new Map<string, ValidRow[]>();

  for (const row of result.valid) {
    const orderId = String(row.data.marketplace_order_id);
    const list = groups.get(orderId) ?? [];
    list.push(row);
    groups.set(orderId, list);
  }

  const previewRows: ImportPreviewRow[] = [];

  for (const [orderId, rows] of [...groups.entries()].slice(0, 10)) {
    previewRows.push({
      orderId,
      orderedAt: String(rows[0].data.ordered_at ?? ''),
      status: rows[0].data.status as OrderStatus,
      items: rows.length,
      gross: rows.reduce(
        (sum, row) => sum + Number(row.data.qty ?? 0) * Number(row.data.unit_price ?? 0),
        0,
      ),
    });
  }

  return {
    fileName,
    headers: result.headers,
    mapping: result.mapping,
    rows: previewRows,
    totalRows: result.rows.length,
    orderCount: result.orderIds.length,
    validRows: result.valid.length,
    invalidRows: result.rows.length - result.valid.length,
    errors: result.errors,
  };
}

function rowData(headers: string[], row: string[] | undefined): Record<string, string> {
  const data: Record<string, string> = {};

  for (const [index, header] of headers.entries()) {
    data[header !== '' ? header : `kolom_${index}`] = row?.[index] ?? '';
  }

  return data;
}

async function existingOrders(db: Database, storeId: string, orderIds: string[]): Promise<Set<string>> {
  if (orderIds.length === 0) {
    return new Set();
  }

  const rows = await db.query<{ marketplace_order_id: string }>(
    `SELECT marketplace_order_id FROM orders
     WHERE store_id = ? AND marketplace_order_id IN (${orderIds.map(() => '?').join(', ')})`,
    [storeId, ...orderIds],
  );

  return new Set(rows.map((row) => row.marketplace_order_id));
}

async function importOrderGroup(db: Database, storeId: string, rows: ValidRow[]): Promise<void> {
  const data = rows[0].data;
  const items: OrderItemInput[] = rows.map((row) => ({
    product_id: (row.data.product_id as string | null) ?? null,
    sku: String(row.data.sku),
    product_name: String(row.data.product_name),
    qty: Number(row.data.qty),
    unit_price: Number(row.data.unit_price),
    hpp_unit_snapshot: Number(row.data.hpp_unit_snapshot),
  }));

  const fees: FeeInput[] = [];

  if (data.fee_amount !== null || data.fee_rate_bp !== null) {
    fees.push({
      description: (data.fee_description as string | null) || 'Fee marketplace (import)',
      basis: (data.fee_basis as FeeInput['basis']) ?? 'gross',
      basis_amount: 0,
      rate_bp: data.fee_rate_bp === null ? null : Number(data.fee_rate_bp),
      amount: data.fee_amount === null ? null : Number(data.fee_amount),
      borne_by: 'seller',
      is_actual: data.fee_amount !== null,
    });
  }

  const order = await createOrder(
    db,
    storeId,
    {
      marketplace_order_id: String(data.marketplace_order_id),
      ordered_at: String(data.ordered_at),
      completed_at: (data.completed_at as string | null) ?? null,
      status: data.status as OrderStatus,
      seller_discount: Number(data.seller_discount ?? 0),
      marketplace_discount: Number(data.marketplace_discount ?? 0),
      notes: (data.notes as string | null) ?? null,
    },
    items,
    fees,
  );

  if (data.refund_amount !== null && Number(data.refund_amount) > 0) {
    await addRefund(db, order.id, {
      refunded_at: (data.refunded_at as string | null) ?? String(data.ordered_at),
      amount: Number(data.refund_amount),
      reason: 'Import marketplace',
    });
  }
}

export async function commitImport(
  db: Database,
  storeId: string,
  fileName: string,
  bytes: Uint8Array,
  parsed: ParsedImportFile,
  mapping: ImportMapping,
): Promise<ImportResult> {
  const inspection = await inspect(db, storeId, parsed, mapping);

  if (inspection.missing.length > 0) {
    throw new AppError(`Kolom wajib belum dipetakan: ${inspection.missing.join(', ')}.`);
  }

  const hash = await sha256Hex(bytes);
  const existingBatch = (
    await db.query<ImportBatch>('SELECT * FROM import_batches WHERE store_id = ? AND file_hash = ?', [storeId, hash])
  )[0];

  if (existingBatch && ['completed', 'completed_with_errors'].includes(existingBatch.status)) {
    return {
      batchId: existingBatch.id,
      status: existingBatch.status,
      rowsTotal: existingBatch.rows_total,
      rowsImported: existingBatch.rows_imported,
      rowsFailed: existingBatch.rows_failed,
      rowsSkipped: existingBatch.rows_skipped,
      ordersImported: 0,
      duplicateFile: true,
      hadErrors: existingBatch.rows_failed > 0,
    };
  }

  const groups = new Map<string, ValidRow[]>();

  for (const row of inspection.valid) {
    const orderId = String(row.data.marketplace_order_id);
    const list = groups.get(orderId) ?? [];
    list.push(row);
    groups.set(orderId, list);
  }

  try {
    return await db.transaction(async () => {
      const now = nowIso();
      let batchId = existingBatch?.id ?? newId();

      if (existingBatch) {
        await db.run(
          `UPDATE import_batches SET file_name = ?, status = 'processing', column_mapping = ?,
             rows_total = ?, rows_imported = 0, rows_failed = 0, rows_skipped = 0, updated_at = ?
           WHERE id = ?`,
          [fileName, JSON.stringify(inspection.mapping), inspection.rows.length, now, batchId],
        );
      } else {
        await db.run(
          `INSERT INTO import_batches
            (id, store_id, file_name, file_hash, status, column_mapping, rows_total, rows_imported,
             rows_failed, rows_skipped, created_at, updated_at)
           VALUES (?, ?, ?, ?, 'processing', ?, ?, 0, 0, 0, ?, ?)`,
          [batchId, storeId, fileName, hash, JSON.stringify(inspection.mapping), inspection.rows.length, now, now],
        );
      }

      await db.run('DELETE FROM import_errors WHERE import_batch_id = ?', [batchId]);

      const knownOrders = await existingOrders(
        db,
        storeId,
        [...groups.keys()],
      );
      let failedRows = inspection.rows.length - inspection.valid.length;
      let importedRows = 0;
      let skippedRows = 0;
      let ordersImported = 0;
      const extraErrors: Array<{ row: number; messages: string[]; rowData: Record<string, string> }> = [];

      for (const [orderId, rows] of groups) {
        if (knownOrders.has(orderId)) {
          skippedRows += rows.length;

          continue;
        }

        try {
          await db.transaction(() => importOrderGroup(db, storeId, rows));
          importedRows += rows.length;
          ordersImported += 1;
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Pesanan gagal divalidasi.';

          for (const row of rows) {
            extraErrors.push({
              row: row.row,
              messages: [message],
              rowData: rowData(inspection.headers, inspection.rows[row.row - 2]),
            });
          }

          failedRows += rows.length;
        }
      }

      for (const error of inspection.errors) {
        await db.run(
          `INSERT INTO import_errors (id, import_batch_id, row_number, message, row_data, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [
            newId(),
            batchId,
            error.row,
            error.messages.join(' '),
            JSON.stringify(rowData(inspection.headers, inspection.rows[error.row - 2])),
            now,
            now,
          ],
        );
      }

      for (const error of extraErrors) {
        await db.run(
          `INSERT INTO import_errors (id, import_batch_id, row_number, message, row_data, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [newId(), batchId, error.row, error.messages.join(' '), JSON.stringify(error.rowData), now, now],
        );
      }

      const status = importedRows === 0 ? 'failed' : failedRows > 0 ? 'completed_with_errors' : 'completed';

      await db.run(
        `UPDATE import_batches SET status = ?, rows_imported = ?, rows_failed = ?, rows_skipped = ?, updated_at = ?
         WHERE id = ?`,
        [status, importedRows, failedRows, skippedRows, nowIso(), batchId],
      );

      return {
        batchId,
        status,
        rowsTotal: inspection.rows.length,
        rowsImported: importedRows,
        rowsFailed: failedRows,
        rowsSkipped: skippedRows,
        ordersImported,
        duplicateFile: false,
        hadErrors: failedRows > 0,
      };
    });
  } catch (error) {
    const failedAt = nowIso();

    if (existingBatch) {
      await db.run(
        `UPDATE import_batches SET status = 'failed', file_name = ?, column_mapping = ?, rows_total = ?, updated_at = ?
         WHERE id = ?`,
        [fileName, JSON.stringify(inspection.mapping), inspection.rows.length, failedAt, existingBatch.id],
      );
    } else {
      const leftover = (
        await db.query<{ id: string }>('SELECT id FROM import_batches WHERE store_id = ? AND file_hash = ?', [
          storeId,
          hash,
        ])
      )[0];

      if (leftover) {
        await db.run("UPDATE import_batches SET status = 'failed', updated_at = ? WHERE id = ?", [
          failedAt,
          leftover.id,
        ]);
      } else {
        await db.run(
          `INSERT INTO import_batches
            (id, store_id, file_name, file_hash, status, column_mapping, rows_total, rows_imported,
             rows_failed, rows_skipped, created_at, updated_at)
           VALUES (?, ?, ?, ?, 'failed', ?, ?, 0, 0, 0, ?, ?)`,
          [
            newId(),
            storeId,
            fileName,
            hash,
            JSON.stringify(inspection.mapping),
            inspection.rows.length,
            failedAt,
            failedAt,
          ],
        );
      }
    }

    throw error;
  }
}

export async function importFailuresCsv(db: Database, batchId: string): Promise<{ path: string; name: string; rows: number }> {
  const errors = await db.query<{ row_number: number; message: string; row_data: string | null }>(
    'SELECT row_number, message, row_data FROM import_errors WHERE import_batch_id = ? ORDER BY row_number',
    [batchId],
  );

  const csvCell = (value: string): string =>
    /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
  const lines = [
    ['Baris', 'Pesan', 'Data baris'].map(csvCell).join(','),
    ...errors.map((error) =>
      [String(error.row_number), error.message, error.row_data ?? '{}'].map(csvCell).join(','),
    ),
  ];
  const text = `\uFEFF${lines.join('\r\n')}\r\n`;
  const path = `exports/penca-import-gagal-${batchId}.csv`;

  await writeTextFile(path, text);

  return { path, name: path.split('/').pop() ?? path, rows: errors.length };
}

export async function importBatchErrors(
  db: Database,
  batchId: string,
): Promise<Array<{ row_number: number; message: string }>> {
  return db.query('SELECT row_number, message FROM import_errors WHERE import_batch_id = ? ORDER BY row_number', [
    batchId,
  ]);
}

export type ImportOrderRow = Order;
