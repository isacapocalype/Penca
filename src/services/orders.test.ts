import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { closeDatabase, createTestDatabase } from '../lib/db';
import type { Database } from '../lib/db/types';
import {
  addRefund,
  addSettlement,
  createOrder,
  deleteOrder,
  getOrderDetail,
  orderNetRevenue,
  updateOrder,
} from './orders';
import { setProductHpp } from './products';
import { lockPeriod, unlockPeriod } from './period-locks';
import { currentPeriod, today } from '../lib/date';
import { makeOrder, makeProduct, makeStore } from '../test/fixtures';

let db: Database;

beforeEach(async () => {
  db = await createTestDatabase();
});

afterEach(async () => {
  await db.close();
  await closeDatabase();
});

describe('order integrity', () => {
  it('snapshots HPP at order time and keeps history after HPP changes', async () => {
    const store = await makeStore(db);
    const product = await makeProduct(db, store.id, {
      hpp: 40_000,
      hppFrom: '2026-01-01',
    });

    const january = await createOrder(
      db,
      store.id,
      {
        marketplace_order_id: 'INV-HPP-JAN',
        ordered_at: '2026-01-15',
        status: 'completed',
      },
      [
        {
          product_id: product.id,
          sku: 'KA-01',
          product_name: 'Kaos Custom',
          qty: 2,
          unit_price: 100_000,
        },
      ],
    );

    expect(january.hpp_total).toBe(80_000);

    await setProductHpp(db, product.id, {
      hpp_unit: 50_000,
      effective_from: '2026-02-01',
    });

    const januaryDetail = await getOrderDetail(db, january.id);
    expect(januaryDetail?.items[0].hpp_unit_snapshot).toBe(40_000);
    expect(januaryDetail?.order.hpp_total).toBe(80_000);

    const february = await createOrder(
      db,
      store.id,
      {
        marketplace_order_id: 'INV-HPP-FEB',
        ordered_at: '2026-02-15',
        status: 'completed',
      },
      [
        {
          product_id: product.id,
          sku: 'KA-01',
          product_name: 'Kaos Custom',
          qty: 2,
          unit_price: 100_000,
        },
      ],
    );

    expect(february.hpp_total).toBe(100_000);
  });

  it('enforces unique marketplace order IDs per store but allows the same ID in another store', async () => {
    const first = await makeStore(db, 'Toko Pertama');
    const second = await makeStore(db, 'Toko Kedua');

    await makeOrder(db, first.id, { marketplaceOrderId: 'INV-DUP-1' });

    await expect(makeOrder(db, first.id, { marketplaceOrderId: 'INV-DUP-1' })).rejects.toThrow(
      /sudah ada di toko yang sama/,
    );

    const other = await makeOrder(db, second.id, { marketplaceOrderId: 'INV-DUP-1' });
    expect(other.store_id).toBe(second.id);
  });

  it('separates seller discount from marketplace discount and limits one refund per order', async () => {
    const store = await makeStore(db);
    const order = await makeOrder(db, store.id, {
      marketplaceOrderId: 'INV-DISCOUNT-1',
      qty: 2,
      unitPrice: 100_000,
      sellerDiscount: 20_000,
      marketplaceDiscount: 15_000,
    });

    expect(order.gross_revenue).toBe(200_000);
    expect(order.seller_discount).toBe(20_000);
    expect(order.marketplace_discount).toBe(15_000);
    expect(orderNetRevenue(order)).toBe(180_000);

    const refund = await addRefund(db, order.id, {
      refunded_at: today(),
      amount: 50_000,
      reason: 'Barang rusak',
    });

    expect(orderNetRevenue(order, refund.amount)).toBe(130_000);
    await expect(
      addRefund(db, order.id, { refunded_at: today(), amount: 10_000 }),
    ).rejects.toThrow(/sudah memiliki refund/);

    const cleanOrder = await makeOrder(db, store.id, {
      marketplaceOrderId: 'INV-DISCOUNT-2',
    });

    await expect(
      addRefund(db, cleanOrder.id, { refunded_at: today(), amount: 100_001 }),
    ).rejects.toThrow(/tidak boleh melebihi/);
  });

  it('records settlements only for realized orders and never above net revenue', async () => {
    const store = await makeStore(db);
    const pending = await makeOrder(db, store.id, {
      marketplaceOrderId: 'INV-SET-PENDING',
      status: 'pending',
    });
    const completed = await makeOrder(db, store.id, {
      marketplaceOrderId: 'INV-SET-DONE',
      status: 'completed',
    });

    await expect(
      addSettlement(db, pending.id, { settled_at: today(), amount: 10_000 }),
    ).rejects.toThrow(/Terkirim atau Selesai/);

    await addSettlement(db, completed.id, {
      settled_at: today(),
      amount: 60_000,
      reference: 'TRX-1',
    });

    await expect(
      addSettlement(db, completed.id, { settled_at: today(), amount: 50_000 }),
    ).rejects.toThrow(/tidak boleh melebihi/);

    const detail = await getOrderDetail(db, completed.id);
    expect(detail?.settlements).toHaveLength(1);
    expect(detail?.settlements[0].reference).toBe('TRX-1');
  });

  it('blocks edits, refunds, and deletion in a locked period until unlocked', async () => {
    const store = await makeStore(db);
    const order = await makeOrder(db, store.id, {
      marketplaceOrderId: 'INV-LOCK-1',
      status: 'completed',
    });
    const period = currentPeriod();

    await lockPeriod(db, period, 'Sari');

    await expect(
      addRefund(db, order.id, { refunded_at: today(), amount: 10_000 }),
    ).rejects.toThrow(/terkunci/);
    await expect(
      updateOrder(
        db,
        order.id,
        {
          marketplace_order_id: 'INV-LOCK-1',
          ordered_at: today(),
          status: 'cancelled',
        },
        [
          {
            sku: 'KA-01',
            product_name: 'Kaos Custom',
            qty: 1,
            unit_price: 100_000,
            hpp_unit_snapshot: 40_000,
          },
        ],
      ),
    ).rejects.toThrow(/terkunci/);
    await expect(deleteOrder(db, order.id)).rejects.toThrow(/terkunci/);

    await unlockPeriod(db, period, 'Sari');

    await expect(
      addRefund(db, order.id, { refunded_at: today(), amount: 10_000 }),
    ).resolves.toBeTruthy();
  });
});
