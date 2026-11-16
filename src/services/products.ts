import type { Database } from '../lib/db/types';
import type { Product, ProductCost, ProductDetailData, ProductWithStore } from '../lib/types';
import { AppError } from '../lib/errors';
import { newId } from '../lib/id';
import { nowIso } from '../lib/db/helpers';
import { assertDateUnlocked } from './period-locks';
import { changedFields, recordAudit } from '../lib/audit';
import { today } from '../lib/date';
import { parseRupiah } from '../lib/money';

export interface ProductInput {
  store_id?: string;
  sku: string;
  name: string;
  selling_price: number | string;
  active: boolean;
  notes?: string | null;
}

export interface ProductListItem extends ProductWithStore {
  active_hpp: number | null;
}

export function hppOn(costs: ProductCost[], date: string): number | null {
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

export async function listProducts(
  db: Database,
  options: { storeId?: string | null; search?: string; active?: boolean | null; limit?: number } = {},
): Promise<ProductListItem[]> {
  const clauses = ['p.deleted_at IS NULL'];
  const params: Array<string | number> = [];

  if (options.storeId) {
    clauses.push('p.store_id = ?');
    params.push(options.storeId);
  }

  if (options.active !== null && options.active !== undefined) {
    clauses.push('p.active = ?');
    params.push(options.active ? 1 : 0);
  }

  if (options.search?.trim()) {
    clauses.push('(lower(p.sku) LIKE ? OR lower(p.name) LIKE ?)');
    const like = `%${options.search.trim().toLowerCase()}%`;
    params.push(like, like);
  }

  params.push(options.limit ?? 200);

  const rows = await db.query<ProductWithStore>(
    `SELECT p.*, s.name AS store_name, m.name AS marketplace_name
     FROM products p
     JOIN stores s ON s.id = p.store_id
     JOIN marketplaces m ON m.id = s.marketplace_id
     WHERE ${clauses.join(' AND ')}
     ORDER BY p.name COLLATE NOCASE
     LIMIT ?`,
    params,
  );

  const activeDate = today();
  const products: ProductListItem[] = [];

  for (const row of rows) {
    const costs = await db.query<ProductCost>(
      'SELECT * FROM product_costs WHERE product_id = ? ORDER BY effective_from',
      [row.id],
    );
    products.push({ ...row, active_hpp: hppOn(costs, activeDate) });
  }

  return products;
}

export async function getProduct(db: Database, id: string): Promise<ProductDetailData | null> {
  const rows = await db.query<ProductWithStore>(
    `SELECT p.*, s.name AS store_name, m.name AS marketplace_name
     FROM products p
     JOIN stores s ON s.id = p.store_id
     JOIN marketplaces m ON m.id = s.marketplace_id
     WHERE p.id = ? AND p.deleted_at IS NULL`,
    [id],
  );

  if (!rows[0]) {
    return null;
  }

  const costs = await db.query<ProductCost>(
    'SELECT * FROM product_costs WHERE product_id = ? ORDER BY effective_from DESC',
    [id],
  );

  const salesRows = await db.query<{ qty: number; revenue: number; hpp: number }>(
    `SELECT COALESCE(SUM(oi.qty), 0) AS qty,
            COALESCE(SUM(oi.qty * oi.unit_price), 0) AS revenue,
            COALESCE(SUM(oi.qty * oi.hpp_unit_snapshot), 0) AS hpp
     FROM order_items oi
     JOIN orders o ON o.id = oi.order_id
     WHERE o.deleted_at IS NULL AND oi.deleted_at IS NULL
       AND o.status IN ('delivered', 'completed')
       AND oi.product_id = ?`,
    [id],
  );

  return {
    product: rows[0],
    costs,
    currentHpp: hppOn(costs, today()),
    sales: {
      qty: Number(salesRows[0]?.qty ?? 0),
      revenue: Number(salesRows[0]?.revenue ?? 0),
      hpp: Number(salesRows[0]?.hpp ?? 0),
    },
  };
}

export async function saveProduct(
  db: Database,
  input: ProductInput,
  productId: string | null = null,
): Promise<Product> {
  const storeId = productId
    ? (await db.query<{ store_id: string }>('SELECT store_id FROM products WHERE id = ?', [productId]))[0]?.store_id
    : input.store_id;

  if (!storeId) {
    throw new AppError('Pilih toko terlebih dahulu.');
  }

  const store = await db.query<{ id: string }>('SELECT id FROM stores WHERE id = ? AND deleted_at IS NULL', [storeId]);

  if (store.length === 0) {
    throw new AppError('Toko tidak ditemukan.');
  }

  const sku = input.sku.trim();
  const name = input.name.trim();
  const sellingPrice = parseRupiah(input.selling_price);

  if (sku === '') {
    throw new AppError('SKU wajib diisi.');
  }

  if (name === '') {
    throw new AppError('Nama produk wajib diisi.');
  }

  if (sellingPrice < 0) {
    throw new AppError('Harga jual tidak boleh negatif.');
  }

  const duplicate = await db.query<{ id: string }>(
    'SELECT id FROM products WHERE store_id = ? AND lower(sku) = ? AND id <> ?',
    [storeId, sku.toLowerCase(), productId ?? ''],
  );

  if (duplicate.length > 0) {
    throw new AppError('SKU ini sudah dipakai di toko yang sama, termasuk produk yang sudah dihapus.');
  }

  const now = nowIso();
  const notes = input.notes?.trim() || null;

  if (productId) {
    const before = (await db.query<Product>('SELECT * FROM products WHERE id = ?', [productId]))[0];

    if (!before) {
      throw new AppError('Produk tidak ditemukan.');
    }

    await db.transaction(async () => {
      await db.run(
        `UPDATE products SET sku = ?, name = ?, selling_price = ?, active = ?, notes = ?, updated_at = ?
         WHERE id = ?`,
        [sku, name, sellingPrice, input.active ? 1 : 0, notes, now, productId],
      );

      await recordAudit(db, {
        type: 'product',
        id: productId,
        storeId,
        event: 'updated',
        summary: `Produk ${sku} diubah`,
        before: changedFields(before as unknown as Record<string, unknown>, {
          sku,
          name,
          selling_price: sellingPrice,
          active: input.active ? 1 : 0,
          notes,
          updated_at: now,
        }),
        after: { sku, name, selling_price: sellingPrice, active: input.active, notes },
      });
    });

    return (await db.query<Product>('SELECT * FROM products WHERE id = ?', [productId]))[0];
  }

  const id = newId();

  await db.transaction(async () => {
    await db.run(
      `INSERT INTO products
        (id, store_id, sku, name, selling_price, active, notes, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, storeId, sku, name, sellingPrice, input.active ? 1 : 0, notes, now, now],
    );

    await recordAudit(db, {
      type: 'product',
      id,
      storeId,
      event: 'created',
      summary: `Produk ${sku} dibuat`,
      after: { sku, name, selling_price: sellingPrice, active: input.active, notes },
    });
  });

  return (await db.query<Product>('SELECT * FROM products WHERE id = ?', [id]))[0];
}

export async function setProductHpp(
  db: Database,
  productId: string,
  input: { hpp_unit: number | string; effective_from: string; notes?: string | null },
): Promise<ProductCost> {
  const product = (await db.query<Product>('SELECT * FROM products WHERE id = ?', [productId]))[0];

  if (!product) {
    throw new AppError('Produk tidak ditemukan.');
  }

  const hpp = parseRupiah(input.hpp_unit);

  if (hpp < 0) {
    throw new AppError('HPP tidak boleh negatif.');
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.effective_from)) {
    throw new AppError('Tanggal berlaku HPP wajib diisi.');
  }

  await assertDateUnlocked(db, input.effective_from);

  const date = input.effective_from;
  const notes = input.notes?.trim() || null;
  let costId = '';

  await db.transaction(async () => {
    const sameDay = (
      await db.query<ProductCost>('SELECT * FROM product_costs WHERE product_id = ? AND effective_from = ?', [
        productId,
        date,
      ])
    )[0];

    if (sameDay) {
      await db.run(
        'UPDATE product_costs SET hpp_unit = ?, notes = ?, updated_at = ? WHERE id = ?',
        [hpp, notes, nowIso(), sameDay.id],
      );
      costId = sameDay.id;
      await recordAudit(db, {
        type: 'product_cost',
        id: sameDay.id,
        storeId: product.store_id,
        event: 'updated',
        summary: `HPP ${product.sku} pada ${date} diubah`,
        before: { hpp_unit: sameDay.hpp_unit, notes: sameDay.notes },
        after: { hpp_unit: hpp, notes },
      });

      return;
    }

    const next = (
      await db.query<ProductCost>(
        'SELECT * FROM product_costs WHERE product_id = ? AND effective_from > ? ORDER BY effective_from LIMIT 1',
        [productId, date],
      )
    )[0];

    const previous = (
      await db.query<ProductCost>(
        'SELECT * FROM product_costs WHERE product_id = ? AND effective_from < ? ORDER BY effective_from DESC LIMIT 1',
        [productId, date],
      )
    )[0];

    if (previous && (previous.effective_to === null || previous.effective_to >= date)) {
      const closed = new Date(`${date}T00:00:00Z`);
      closed.setUTCDate(closed.getUTCDate() - 1);
      const effectiveTo = closed.toISOString().slice(0, 10);

      await db.run('UPDATE product_costs SET effective_to = ?, updated_at = ? WHERE id = ?', [
        effectiveTo,
        nowIso(),
        previous.id,
      ]);
      await recordAudit(db, {
        type: 'product_cost',
        id: previous.id,
        storeId: product.store_id,
        event: 'updated',
        summary: `Masa berlaku HPP ${product.sku} ditutup pada ${effectiveTo}`,
        before: { effective_to: previous.effective_to },
        after: { effective_to: effectiveTo },
      });
    }

    let effectiveTo: string | null = null;

    if (next) {
      const closed = new Date(`${next.effective_from}T00:00:00Z`);
      closed.setUTCDate(closed.getUTCDate() - 1);
      effectiveTo = closed.toISOString().slice(0, 10);
    }

    const id = newId();
    const now = nowIso();

    await db.run(
      `INSERT INTO product_costs
        (id, product_id, hpp_unit, effective_from, effective_to, notes, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, productId, hpp, date, effectiveTo, notes, now, now],
    );

    costId = id;
    await recordAudit(db, {
      type: 'product_cost',
      id,
      storeId: product.store_id,
      event: 'created',
      summary: `HPP ${product.sku} dicatat ${hpp} mulai ${date}`,
      after: { hpp_unit: hpp, effective_from: date, effective_to: effectiveTo, notes },
    });
  });

  return (await db.query<ProductCost>('SELECT * FROM product_costs WHERE id = ?', [costId]))[0];
}

export async function toggleProductActive(db: Database, productId: string): Promise<Product> {
  const product = (await db.query<Product>('SELECT * FROM products WHERE id = ?', [productId]))[0];

  if (!product) {
    throw new AppError('Produk tidak ditemukan.');
  }

  const active = product.active ? 0 : 1;

  await db.transaction(async () => {
    await db.run('UPDATE products SET active = ?, updated_at = ? WHERE id = ?', [active, nowIso(), productId]);
    await recordAudit(db, {
      type: 'product',
      id: productId,
      storeId: product.store_id,
      event: 'updated',
      summary: active ? `Produk ${product.sku} diaktifkan` : `Produk ${product.sku} dinonaktifkan`,
      before: { active: product.active },
      after: { active },
    });
  });

  return (await db.query<Product>('SELECT * FROM products WHERE id = ?', [productId]))[0];
}

export async function listActiveProductsForStore(db: Database, storeId: string): Promise<Array<Product & { costs: ProductCost[]; active_hpp: number | null }>> {
  const products = await db.query<Product>(
    'SELECT * FROM products WHERE store_id = ? AND active = 1 AND deleted_at IS NULL ORDER BY name COLLATE NOCASE',
    [storeId],
  );

  const result: Array<Product & { costs: ProductCost[]; active_hpp: number | null }> = [];

  for (const product of products) {
    const costs = await db.query<ProductCost>(
      'SELECT * FROM product_costs WHERE product_id = ? ORDER BY effective_from',
      [product.id],
    );
    result.push({ ...product, costs, active_hpp: hppOn(costs, today()) });
  }

  return result;
}
