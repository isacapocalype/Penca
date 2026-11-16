import type { Database } from '../lib/db/types';
import type {
  MarketplaceFee,
  Order,
  OrderDetailData,
  OrderItem,
  OrderWithStore,
  Product,
  ProductCost,
  Refund,
  Settlement,
} from '../lib/types';
import type { OrderStatus } from '../lib/constants';
import { AppError } from '../lib/errors';
import { newId } from '../lib/id';
import { nowIso } from '../lib/db/helpers';
import { assertPeriodsUnlocked } from './period-locks';
import { changedFields, recordAudit } from '../lib/audit';
import { ORDER_STATUSES, REALIZED_STATUSES, type FeeBasis, type FeeBorne } from '../lib/constants';
import { normalizeDate, periodFromDate, today } from '../lib/date';
import { divideHalfUp, parseRupiah, rupiah } from '../lib/money';
import { netRevenue as calculateNetRevenue } from '../lib/financial';

export interface OrderInput {
  marketplace_order_id: string;
  ordered_at: string;
  completed_at?: string | null;
  status: OrderStatus;
  seller_discount?: number | string;
  marketplace_discount?: number | string;
  notes?: string | null;
}

export interface OrderItemInput {
  product_id?: string | null;
  sku: string;
  product_name: string;
  qty: number | string;
  unit_price: number | string;
  hpp_unit_snapshot?: number | string | null;
}

export interface FeeInput {
  category_id?: string | null;
  description: string;
  basis?: FeeBasis;
  basis_amount?: number | string;
  rate_bp?: number | string | null;
  amount?: number | string | null;
  borne_by?: FeeBorne;
  is_actual?: boolean;
}

export interface OrderListItem extends OrderWithStore {
  refund_total: number;
}

interface ResolvedItem {
  product_id: string | null;
  sku: string;
  product_name: string;
  qty: number;
  unit_price: number;
  hpp_unit_snapshot: number;
}

function validateInput(input: OrderInput): void {
  if (!input.marketplace_order_id.trim()) {
    throw new AppError('Order ID marketplace wajib diisi.');
  }

  if (input.marketplace_order_id.trim().length > 120) {
    throw new AppError('Order ID marketplace maksimal 120 karakter.');
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalizeDate(input.ordered_at))) {
    throw new AppError('Tanggal pesanan wajib diisi dengan format yang valid.');
  }

  if (!ORDER_STATUSES.includes(input.status)) {
    throw new AppError('Status pesanan tidak dikenal.');
  }

  const completed = input.completed_at ? normalizeDate(input.completed_at) : null;

  if (completed && completed < normalizeDate(input.ordered_at)) {
    throw new AppError('Tanggal selesai tidak boleh sebelum tanggal pesanan.');
  }

  if (parseRupiah(input.seller_discount ?? 0) < 0) {
    throw new AppError('Diskon penjual tidak boleh negatif.');
  }

  if (parseRupiah(input.marketplace_discount ?? 0) < 0) {
    throw new AppError('Diskon marketplace tidak boleh negatif.');
  }
}

async function resolveItems(
  db: Database,
  storeId: string,
  orderedAt: string,
  items: OrderItemInput[],
): Promise<ResolvedItem[]> {
  if (items.length === 0) {
    throw new AppError('Pesanan harus memiliki minimal satu item.');
  }

  const resolved: ResolvedItem[] = [];

  for (const [index, item] of items.entries()) {
    const line = index + 1;
    const sku = item.sku.trim();
    const name = item.product_name.trim();
    const qty = Number.parseInt(String(item.qty), 10) || 0;
    const unitPrice = parseRupiah(item.unit_price);

    if (sku === '') {
      throw new AppError(`SKU item ${line} wajib diisi.`);
    }

    if (name === '') {
      throw new AppError(`Nama produk item ${line} wajib diisi.`);
    }

    if (qty <= 0) {
      throw new AppError(`Jumlah item ${line} harus lebih dari nol.`);
    }

    if (unitPrice < 0) {
      throw new AppError(`Harga item ${line} tidak boleh negatif.`);
    }

    let product: Product | null = null;

    if (item.product_id) {
      const rows = await db.query<Product>(
        'SELECT * FROM products WHERE id = ? AND store_id = ? AND deleted_at IS NULL',
        [item.product_id, storeId],
      );
      product = rows[0] ?? null;

      if (!product) {
        throw new AppError(`Produk item ${line} tidak ditemukan pada toko ini.`);
      }
    }

    let snapshot: number | null =
      item.hpp_unit_snapshot === null || item.hpp_unit_snapshot === undefined || item.hpp_unit_snapshot === ''
        ? null
        : parseRupiah(item.hpp_unit_snapshot);

    if (snapshot === null && product) {
      const costs = await db.query<ProductCost>(
        'SELECT * FROM product_costs WHERE product_id = ? ORDER BY effective_from',
        [product.id],
      );
      const date = normalizeDate(orderedAt);
      const match = [...costs]
        .reverse()
        .find(
          (cost) => cost.effective_from <= date && (cost.effective_to === null || cost.effective_to >= date),
        );
      snapshot = match?.hpp_unit ?? null;
    }

    if (snapshot === null) {
      throw new AppError(
        'HPP item belum diisi dan produk belum memiliki riwayat HPP pada tanggal pesanan.',
      );
    }

    if (snapshot < 0) {
      throw new AppError('HPP item tidak boleh negatif.');
    }

    resolved.push({
      product_id: product?.id ?? null,
      sku,
      product_name: name,
      qty,
      unit_price: unitPrice,
      hpp_unit_snapshot: snapshot,
    });
  }

  return resolved;
}

function totals(items: ResolvedItem[]): { gross: number; hpp: number } {
  return items.reduce(
    (carry, item) => ({
      gross: carry.gross + item.qty * item.unit_price,
      hpp: carry.hpp + item.qty * item.hpp_unit_snapshot,
    }),
    { gross: 0, hpp: 0 },
  );
}

export async function createOrder(
  db: Database,
  storeId: string,
  input: OrderInput,
  items: OrderItemInput[],
  fees: FeeInput[] = [],
): Promise<Order> {
  validateInput(input);

  const store = await db.query<{ id: string }>('SELECT id FROM stores WHERE id = ? AND deleted_at IS NULL', [storeId]);

  if (store.length === 0) {
    throw new AppError('Toko tidak ditemukan.');
  }

  const orderedAt = normalizeDate(input.ordered_at);
  const completedAt = input.completed_at ? normalizeDate(input.completed_at) : null;
  const sellerDiscount = parseRupiah(input.seller_discount ?? 0);
  const marketplaceDiscount = parseRupiah(input.marketplace_discount ?? 0);
  const orderId = input.marketplace_order_id.trim();

  const duplicate = await db.query<{ id: string }>(
    'SELECT id FROM orders WHERE store_id = ? AND marketplace_order_id = ?',
    [storeId, orderId],
  );

  if (duplicate.length > 0) {
    throw new AppError('Order ID ini sudah ada di toko yang sama. Gunakan ID marketplace yang unik.');
  }

  await assertPeriodsUnlocked(db, [periodFromDate(orderedAt), completedAt ? periodFromDate(completedAt) : null]);

  const resolved = await resolveItems(db, storeId, orderedAt, items);
  const sum = totals(resolved);

  if (sellerDiscount > sum.gross) {
    throw new AppError('Diskon penjual tidak boleh melebihi omzet bruto pesanan.');
  }

  const id = newId();
  const now = nowIso();

  await db.transaction(async () => {
    await db.run(
      `INSERT INTO orders
        (id, store_id, marketplace_order_id, ordered_at, completed_at, status, gross_revenue,
         seller_discount, marketplace_discount, hpp_total, notes, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        storeId,
        orderId,
        orderedAt,
        completedAt,
        input.status,
        sum.gross,
        sellerDiscount,
        marketplaceDiscount,
        sum.hpp,
        input.notes?.trim() || null,
        now,
        now,
      ],
    );

    for (const item of resolved) {
      await db.run(
        `INSERT INTO order_items
          (id, order_id, product_id, sku, product_name, qty, unit_price, hpp_unit_snapshot, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [newId(), id, item.product_id, item.sku, item.product_name, item.qty, item.unit_price, item.hpp_unit_snapshot, now, now],
      );
    }

    const order = (await db.query<Order>('SELECT * FROM orders WHERE id = ?', [id]))[0];

    for (const fee of fees) {
      await insertFee(db, order, fee);
    }

    await recordAudit(db, {
      type: 'order',
      id,
      storeId,
      event: 'created',
      summary: `Pesanan ${orderId} dibuat`,
      after: {
        marketplace_order_id: orderId,
        ordered_at: orderedAt,
        status: input.status,
        gross_revenue: sum.gross,
        seller_discount: sellerDiscount,
        marketplace_discount: marketplaceDiscount,
        hpp_total: sum.hpp,
      },
    });
  });

  return (await db.query<Order>('SELECT * FROM orders WHERE id = ?', [id]))[0];
}

export async function updateOrder(
  db: Database,
  orderId: string,
  input: OrderInput,
  items: OrderItemInput[],
): Promise<Order> {
  validateInput(input);

  const before = (await db.query<Order>('SELECT * FROM orders WHERE id = ? AND deleted_at IS NULL', [orderId]))[0];

  if (!before) {
    throw new AppError('Pesanan tidak ditemukan.');
  }

  const orderedAt = normalizeDate(input.ordered_at);
  const completedAt = input.completed_at ? normalizeDate(input.completed_at) : null;
  const sellerDiscount = parseRupiah(input.seller_discount ?? 0);
  const marketplaceDiscount = parseRupiah(input.marketplace_discount ?? 0);
  const orderMarketplaceId = input.marketplace_order_id.trim();

  const duplicate = await db.query<{ id: string }>(
    'SELECT id FROM orders WHERE store_id = ? AND marketplace_order_id = ? AND id <> ?',
    [before.store_id, orderMarketplaceId, orderId],
  );

  if (duplicate.length > 0) {
    throw new AppError('Order ID ini sudah ada di toko yang sama. Gunakan ID marketplace yang unik.');
  }

  await assertPeriodsUnlocked(db, [
    periodFromDate(before.ordered_at),
    periodFromDate(orderedAt),
    completedAt ? periodFromDate(completedAt) : null,
  ]);

  const resolved = await resolveItems(db, before.store_id, orderedAt, items);
  const sum = totals(resolved);

  if (sellerDiscount > sum.gross) {
    throw new AppError('Diskon penjual tidak boleh melebihi omzet bruto pesanan.');
  }

  const refund = (
    await db.query<Refund>('SELECT * FROM refunds WHERE order_id = ? AND deleted_at IS NULL', [orderId])
  )[0];

  if (refund && refund.amount > sum.gross - sellerDiscount) {
    throw new AppError('Perubahan ini membuat nilai pesanan lebih kecil dari refund yang sudah tercatat.');
  }

  const now = nowIso();

  await db.transaction(async () => {
    await db.run(
      `UPDATE orders SET marketplace_order_id = ?, ordered_at = ?, completed_at = ?, status = ?,
        seller_discount = ?, marketplace_discount = ?, gross_revenue = ?, hpp_total = ?, notes = ?, updated_at = ?
       WHERE id = ?`,
      [
        orderMarketplaceId,
        orderedAt,
        completedAt,
        input.status,
        sellerDiscount,
        marketplaceDiscount,
        sum.gross,
        sum.hpp,
        input.notes?.trim() || null,
        now,
        orderId,
      ],
    );

    await db.run('UPDATE order_items SET deleted_at = ?, updated_at = ? WHERE order_id = ? AND deleted_at IS NULL', [
      now,
      now,
      orderId,
    ]);

    for (const item of resolved) {
      await db.run(
        `INSERT INTO order_items
          (id, order_id, product_id, sku, product_name, qty, unit_price, hpp_unit_snapshot, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [newId(), orderId, item.product_id, item.sku, item.product_name, item.qty, item.unit_price, item.hpp_unit_snapshot, now, now],
      );
    }

    await recordAudit(db, {
      type: 'order',
      id: orderId,
      storeId: before.store_id,
      event: 'updated',
      summary: `Pesanan ${orderMarketplaceId} diubah`,
      before: changedFields(before as unknown as Record<string, unknown>, {
        marketplace_order_id: orderMarketplaceId,
        ordered_at: orderedAt,
        completed_at: completedAt,
        status: input.status,
        seller_discount: sellerDiscount,
        marketplace_discount: marketplaceDiscount,
        gross_revenue: sum.gross,
        hpp_total: sum.hpp,
        notes: input.notes ?? null,
        updated_at: now,
      }),
      after: {
        marketplace_order_id: orderMarketplaceId,
        ordered_at: orderedAt,
        completed_at: completedAt,
        status: input.status,
        seller_discount: sellerDiscount,
        marketplace_discount: marketplaceDiscount,
        gross_revenue: sum.gross,
        hpp_total: sum.hpp,
        notes: input.notes ?? null,
      },
    });
  });

  return (await db.query<Order>('SELECT * FROM orders WHERE id = ?', [orderId]))[0];
}

export async function deleteOrder(db: Database, orderId: string): Promise<void> {
  const order = (await db.query<Order>('SELECT * FROM orders WHERE id = ? AND deleted_at IS NULL', [orderId]))[0];

  if (!order) {
    throw new AppError('Pesanan tidak ditemukan.');
  }

  await assertPeriodsUnlocked(db, [periodFromDate(order.ordered_at)]);
  const now = nowIso();

  await db.transaction(async () => {
    await db.run('UPDATE orders SET deleted_at = ?, updated_at = ? WHERE id = ?', [now, now, orderId]);
    await recordAudit(db, {
      type: 'order',
      id: orderId,
      storeId: order.store_id,
      event: 'deleted',
      summary: `Pesanan ${order.marketplace_order_id} dihapus`,
      before: {
        marketplace_order_id: order.marketplace_order_id,
        ordered_at: order.ordered_at,
        status: order.status,
        gross_revenue: order.gross_revenue,
        hpp_total: order.hpp_total,
      },
    });
  });
}

async function insertFee(db: Database, order: Order, input: FeeInput): Promise<MarketplaceFee> {
  const basis = input.basis ?? 'gross';
  let basisAmount = parseRupiah(input.basis_amount ?? 0);
  const rate =
    input.rate_bp !== null && input.rate_bp !== undefined && input.rate_bp !== ''
      ? Number.parseInt(String(input.rate_bp), 10)
      : null;
  let amount =
    input.amount !== null && input.amount !== undefined && input.amount !== ''
      ? parseRupiah(input.amount)
      : null;

  if (basisAmount === 0) {
    if (basis === 'gross') {
      basisAmount = order.gross_revenue;
    } else if (basis === 'net') {
      const refund = (
        await db.query<{ amount: number }>(
          'SELECT amount FROM refunds WHERE order_id = ? AND deleted_at IS NULL',
          [order.id],
        )
      )[0];
      basisAmount = calculateNetRevenue(order.gross_revenue, order.seller_discount, refund?.amount ?? 0);
    } else if (basis === 'hpp') {
      basisAmount = order.hpp_total;
    }
  }

  if (amount === null && rate !== null && basis !== 'fixed') {
    amount = divideHalfUp(basisAmount * rate, 10000);
  }

  const description = input.description.trim() || 'Biaya marketplace';

  if (basisAmount < 0) {
    throw new AppError('Dasar fee tidak boleh negatif.');
  }

  if (rate !== null && (rate < 0 || rate > 10000)) {
    throw new AppError('Persentase fee maksimal 100%.');
  }

  const finalAmount = amount ?? 0;

  if (finalAmount < 0) {
    throw new AppError('Nominal fee tidak boleh negatif.');
  }

  if (!['gross', 'net', 'hpp', 'fixed'].includes(basis)) {
    throw new AppError('Dasar fee tidak dikenal.');
  }

  if (!['seller', 'marketplace'].includes(input.borne_by ?? 'seller')) {
    throw new AppError('Penanggung fee tidak dikenal.');
  }

  if (input.category_id) {
    const category = await db.query<{ id: string }>(
      'SELECT id FROM marketplace_fee_categories WHERE id = ?',
      [input.category_id],
    );

    if (category.length === 0) {
      throw new AppError('Kategori fee tidak ditemukan.');
    }
  }

  const id = newId();
  const now = nowIso();

  await db.run(
    `INSERT INTO marketplace_fees
      (id, order_id, category_id, description, basis, basis_amount, rate_bp, amount, borne_by, is_actual, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      order.id,
      input.category_id ?? null,
      description,
      basis,
      basisAmount,
      rate,
      finalAmount,
      input.borne_by ?? 'seller',
      input.is_actual === false ? 0 : 1,
      now,
      now,
    ],
  );

  await recordAudit(db, {
    type: 'marketplace_fee',
    id,
    storeId: order.store_id,
    event: 'created',
    summary: `Fee marketplace ${description} ditambahkan ke pesanan ${order.marketplace_order_id}`,
    after: { description, basis, basis_amount: basisAmount, rate_bp: rate, amount: finalAmount, borne_by: input.borne_by ?? 'seller' },
  });

  return (await db.query<MarketplaceFee>('SELECT * FROM marketplace_fees WHERE id = ?', [id]))[0];
}

export async function addOrderFee(db: Database, orderId: string, input: FeeInput): Promise<MarketplaceFee> {
  const order = (await db.query<Order>('SELECT * FROM orders WHERE id = ? AND deleted_at IS NULL', [orderId]))[0];

  if (!order) {
    throw new AppError('Pesanan tidak ditemukan.');
  }

  await assertPeriodsUnlocked(db, [periodFromDate(order.ordered_at)]);

  return db.transaction(() => insertFee(db, order, input));
}

export async function deleteOrderFee(db: Database, feeId: string): Promise<void> {
  const fee = (
    await db.query<MarketplaceFee>('SELECT * FROM marketplace_fees WHERE id = ? AND deleted_at IS NULL', [feeId])
  )[0];

  if (!fee) {
    throw new AppError('Fee tidak ditemukan.');
  }

  const order = (await db.query<Order>('SELECT * FROM orders WHERE id = ?', [fee.order_id]))[0];
  await assertPeriodsUnlocked(db, [order ? periodFromDate(order.ordered_at) : null]);

  await db.transaction(async () => {
    await db.run('UPDATE marketplace_fees SET deleted_at = ?, updated_at = ? WHERE id = ?', [nowIso(), nowIso(), feeId]);
    await recordAudit(db, {
      type: 'marketplace_fee',
      id: feeId,
      storeId: order?.store_id ?? null,
      event: 'deleted',
      summary: `Fee marketplace ${fee.description} dihapus`,
      before: { description: fee.description, amount: fee.amount, borne_by: fee.borne_by },
    });
  });
}

export async function addRefund(
  db: Database,
  orderId: string,
  input: { refunded_at: string; amount: number | string; reason?: string | null },
): Promise<Refund> {
  const order = (await db.query<Order>('SELECT * FROM orders WHERE id = ? AND deleted_at IS NULL', [orderId]))[0];

  if (!order) {
    throw new AppError('Pesanan tidak ditemukan.');
  }

  const amount = parseRupiah(input.amount);
  const net = calculateNetRevenue(order.gross_revenue, order.seller_discount, 0);

  if (amount <= 0) {
    throw new AppError('Refund harus lebih dari nol.');
  }

  if (amount > net) {
    throw new AppError(`Refund tidak boleh melebihi pendapatan neto pesanan (${rupiah(net)}).`);
  }

  const existing = await db.query<Refund>(
    'SELECT * FROM refunds WHERE order_id = ? AND deleted_at IS NULL',
    [orderId],
  );

  if (existing.length > 0) {
    throw new AppError('Pesanan ini sudah memiliki refund. Satu pesanan hanya boleh direfund satu kali.');
  }

  const refundedAt = normalizeDate(input.refunded_at);
  await assertPeriodsUnlocked(db, [periodFromDate(refundedAt), periodFromDate(order.ordered_at)]);

  const id = newId();
  const now = nowIso();

  await db.transaction(async () => {
    await db.run(
      `INSERT INTO refunds (id, order_id, refunded_at, amount, reason, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [id, orderId, refundedAt, amount, input.reason?.trim() || null, now, now],
    );

    await recordAudit(db, {
      type: 'refund',
      id,
      storeId: order.store_id,
      event: 'created',
      summary: `Refund pesanan ${order.marketplace_order_id} dicatat`,
      after: { refunded_at: refundedAt, amount, reason: input.reason ?? null },
    });
  });

  return (await db.query<Refund>('SELECT * FROM refunds WHERE id = ?', [id]))[0];
}

export async function deleteRefund(db: Database, refundId: string): Promise<void> {
  const refund = (
    await db.query<Refund>('SELECT * FROM refunds WHERE id = ? AND deleted_at IS NULL', [refundId])
  )[0];

  if (!refund) {
    throw new AppError('Refund tidak ditemukan.');
  }

  const order = (await db.query<Order>('SELECT * FROM orders WHERE id = ?', [refund.order_id]))[0];
  await assertPeriodsUnlocked(db, [
    periodFromDate(refund.refunded_at),
    order ? periodFromDate(order.ordered_at) : null,
  ]);

  const now = nowIso();

  await db.transaction(async () => {
    await db.run('UPDATE refunds SET deleted_at = ?, updated_at = ? WHERE id = ?', [now, now, refundId]);
    await recordAudit(db, {
      type: 'refund',
      id: refundId,
      storeId: order?.store_id ?? null,
      event: 'deleted',
      summary: `Refund pesanan ${order?.marketplace_order_id ?? ''} dihapus`,
      before: { refunded_at: refund.refunded_at, amount: refund.amount, reason: refund.reason },
    });
  });
}

export async function addSettlement(
  db: Database,
  orderId: string,
  input: { settled_at: string; amount: number | string; reference?: string | null; notes?: string | null },
): Promise<Settlement> {
  const order = (await db.query<Order>('SELECT * FROM orders WHERE id = ? AND deleted_at IS NULL', [orderId]))[0];

  if (!order) {
    throw new AppError('Pesanan tidak ditemukan.');
  }

  if (!REALIZED_STATUSES.includes(order.status)) {
    throw new AppError('Pencairan hanya dapat dicatat untuk pesanan berstatus Terkirim atau Selesai.');
  }

  const amount = parseRupiah(input.amount);

  if (amount <= 0) {
    throw new AppError('Nominal pencairan harus lebih dari nol.');
  }

  const refund = (
    await db.query<{ amount: number }>('SELECT amount FROM refunds WHERE order_id = ? AND deleted_at IS NULL', [
      orderId,
    ])
  )[0];
  const net = calculateNetRevenue(order.gross_revenue, order.seller_discount, refund?.amount ?? 0);
  const already = await db.query<{ total: number }>(
    'SELECT COALESCE(SUM(amount), 0) AS total FROM settlements WHERE order_id = ? AND deleted_at IS NULL',
    [orderId],
  );
  const settled = Number(already[0]?.total ?? 0);

  if (settled + amount > net) {
    throw new AppError(`Total pencairan tidak boleh melebihi pendapatan neto pesanan (${rupiah(net)}).`);
  }

  const settledAt = normalizeDate(input.settled_at);
  await assertPeriodsUnlocked(db, [periodFromDate(settledAt), periodFromDate(order.ordered_at)]);

  const id = newId();
  const now = nowIso();

  await db.transaction(async () => {
    await db.run(
      `INSERT INTO settlements
        (id, store_id, order_id, amount, settled_at, reference, notes, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, order.store_id, orderId, amount, settledAt, input.reference?.trim() || null, input.notes?.trim() || null, now, now],
    );

    await recordAudit(db, {
      type: 'settlement',
      id,
      storeId: order.store_id,
      event: 'created',
      summary: `Pencairan pesanan ${order.marketplace_order_id} dicatat`,
      after: { settled_at: settledAt, amount, reference: input.reference ?? null },
    });
  });

  return (await db.query<Settlement>('SELECT * FROM settlements WHERE id = ?', [id]))[0];
}

export async function deleteSettlement(db: Database, settlementId: string): Promise<void> {
  const settlement = (
    await db.query<Settlement>('SELECT * FROM settlements WHERE id = ? AND deleted_at IS NULL', [settlementId])
  )[0];

  if (!settlement) {
    throw new AppError('Pencairan tidak ditemukan.');
  }

  const order = settlement.order_id
    ? (await db.query<Order>('SELECT * FROM orders WHERE id = ?', [settlement.order_id]))[0]
    : null;

  await assertPeriodsUnlocked(db, [
    periodFromDate(settlement.settled_at),
    order ? periodFromDate(order.ordered_at) : null,
  ]);

  const now = nowIso();

  await db.transaction(async () => {
    await db.run('UPDATE settlements SET deleted_at = ?, updated_at = ? WHERE id = ?', [now, now, settlementId]);
    await recordAudit(db, {
      type: 'settlement',
      id: settlementId,
      storeId: settlement.store_id,
      event: 'deleted',
      summary: 'Pencairan marketplace dihapus',
      before: { settled_at: settlement.settled_at, amount: settlement.amount, reference: settlement.reference },
    });
  });
}

export async function listOrders(
  db: Database,
  options: { search?: string; status?: OrderStatus | null; storeId?: string | null; limit?: number } = {},
): Promise<OrderListItem[]> {
  const clauses = ['o.deleted_at IS NULL'];
  const params: Array<string | number> = [];

  if (options.status) {
    clauses.push('o.status = ?');
    params.push(options.status);
  }

  if (options.storeId) {
    clauses.push('o.store_id = ?');
    params.push(options.storeId);
  }

  if (options.search?.trim()) {
    clauses.push('(lower(o.marketplace_order_id) LIKE ? OR lower(s.name) LIKE ?)');
    const like = `%${options.search.trim().toLowerCase()}%`;
    params.push(like, like);
  }

  params.push(options.limit ?? 200);

  return db.query<OrderListItem>(
    `SELECT o.*, s.name AS store_name, m.name AS marketplace_name,
       (SELECT COALESCE(SUM(r.amount), 0) FROM refunds r WHERE r.order_id = o.id AND r.deleted_at IS NULL) AS refund_total
     FROM orders o
     JOIN stores s ON s.id = o.store_id
     JOIN marketplaces m ON m.id = s.marketplace_id
     WHERE ${clauses.join(' AND ')}
     ORDER BY o.ordered_at DESC, o.created_at DESC
     LIMIT ?`,
    params,
  );
}

export async function getOrderDetail(db: Database, orderId: string): Promise<OrderDetailData | null> {
  const order = (
    await db.query<OrderWithStore>(
      `SELECT o.*, s.name AS store_name, m.name AS marketplace_name
       FROM orders o
       JOIN stores s ON s.id = o.store_id
       JOIN marketplaces m ON m.id = s.marketplace_id
       WHERE o.id = ? AND o.deleted_at IS NULL`,
      [orderId],
    )
  )[0];

  if (!order) {
    return null;
  }

  const items = await db.query<OrderItem>(
    'SELECT * FROM order_items WHERE order_id = ? AND deleted_at IS NULL ORDER BY created_at',
    [orderId],
  );

  const fees = await db.query<MarketplaceFee>(
    'SELECT * FROM marketplace_fees WHERE order_id = ? AND deleted_at IS NULL ORDER BY created_at',
    [orderId],
  );

  const refund = (
    await db.query<Refund>('SELECT * FROM refunds WHERE order_id = ? AND deleted_at IS NULL', [orderId])
  )[0] ?? null;

  const settlements = await db.query<Settlement>(
    'SELECT * FROM settlements WHERE order_id = ? AND deleted_at IS NULL ORDER BY settled_at DESC, created_at DESC',
    [orderId],
  );

  return { order, items, fees, refund, settlements };
}

export async function listAuditForOrder(db: Database, orderId: string, limit = 8): Promise<Array<{ id: string; summary: string; created_at: string }>> {
  return db.query(
    `SELECT id, summary, created_at FROM audit_logs
     WHERE auditable_id = ? AND auditable_type = 'order'
     ORDER BY created_at DESC LIMIT ?`,
    [orderId, limit],
  );
}

export async function currentOrderCount(db: Database): Promise<number> {
  const rows = await db.query<{ count: number }>('SELECT COUNT(*) AS count FROM orders WHERE deleted_at IS NULL');

  return Number(rows[0]?.count ?? 0);
}

export function orderNetRevenue(order: Order, refundTotal = 0): number {
  return calculateNetRevenue(order.gross_revenue, order.seller_discount, refundTotal);
}

export function defaultOrderDate(): string {
  return today();
}
