import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { closeDatabase, createTestDatabase } from '../lib/db';
import type { Database } from '../lib/db/types';
import { makeOrder, makeStore } from '../test/fixtures';
import { fillDailyGaps, financialSummary, topProducts } from './summary';
import { addOrderFee, addRefund } from './orders';
import { saveAdExpense } from './ads';
import { saveOperationalExpense } from './operational';
import { addTaxEntry, saveTaxProfile } from './taxes';

let db: Database;

beforeEach(async () => {
  db = await createTestDatabase();
});

afterEach(async () => {
  await db.close();
  await closeDatabase();
});

describe('financial summary', () => {
  it('counts only delivered or completed orders and applies the profit stack in order', async () => {
    const store = await makeStore(db);
    const completed = await makeOrder(db, store.id, {
      marketplaceOrderId: 'INV-SUM-1',
      orderedAt: '2026-03-05',
      status: 'completed',
      qty: 2,
      unitPrice: 100_000,
      sellerDiscount: 20_000,
      marketplaceDiscount: 15_000,
      hppSnapshot: 40_000,
    });

    await addOrderFee(db, completed.id, {
      description: 'Biaya admin',
      amount: 10_000,
      borne_by: 'seller',
    });
    await addOrderFee(db, completed.id, {
      description: 'Subsidi marketplace',
      amount: 5_000,
      borne_by: 'marketplace',
    });

    await makeOrder(db, store.id, {
      marketplaceOrderId: 'INV-SUM-2',
      orderedAt: '2026-03-06',
      status: 'delivered',
      qty: 1,
      unitPrice: 100_000,
      hppSnapshot: 40_000,
    });
    await makeOrder(db, store.id, {
      marketplaceOrderId: 'INV-SUM-3',
      orderedAt: '2026-03-07',
      status: 'pending',
      qty: 5,
      unitPrice: 100_000,
      hppSnapshot: 40_000,
    });
    await makeOrder(db, store.id, {
      marketplaceOrderId: 'INV-SUM-4',
      orderedAt: '2026-03-08',
      status: 'cancelled',
      qty: 5,
      unitPrice: 100_000,
      hppSnapshot: 40_000,
    });

    await saveAdExpense(db, {
      store_id: store.id,
      spent_at: '2026-03-05',
      amount: 15_000,
    });
    await saveOperationalExpense(db, {
      store_id: null,
      spent_at: '2026-03-06',
      category: 'packing',
      amount: 5_000,
    });

    const summary = await financialSummary(db, '2026-03-01', '2026-03-31');

    expect(summary.grossRevenue).toBe(300_000);
    expect(summary.sellerDiscount).toBe(20_000);
    expect(summary.refunds).toBe(0);
    expect(summary.netRevenue).toBe(280_000);
    expect(summary.hpp).toBe(120_000);
    expect(summary.grossProfit).toBe(160_000);
    expect(summary.marketplaceFees).toBe(10_000);
    expect(summary.advertising).toBe(15_000);
    expect(summary.operational).toBe(5_000);
    expect(summary.operatingProfit).toBe(130_000);
    expect(summary.pphFinal).toBe(1_500);
    expect(summary.netProfit).toBe(128_500);
    expect(summary.ppnOutput).toBe(0);
    expect(summary.orderCount).toBe(2);
    expect(summary.itemsSold).toBe(3);

    const day = summary.daily.find((row) => row.date === '2026-03-05');
    expect(day).toMatchObject({
      gross: 200_000,
      operating_profit: 75_000,
      net_profit: 74_000,
      orders: 1,
    });

    expect(summary.stores).toHaveLength(1);
    expect(summary.stores[0]).toMatchObject({
      name: 'Konveksi Amanah',
      gross: 300_000,
      orders: 2,
      fees: 10_000,
      hpp: 120_000,
      ads: 15_000,
      refunds: 0,
      operating_profit: 135_000,
      net_profit: 133_500,
    });

    const storeOnly = await financialSummary(db, '2026-03-01', '2026-03-31', store.id);
    expect(storeOnly.storeName).toBe('Konveksi Amanah');
    expect(storeOnly.operational).toBe(0);
    expect(storeOnly.operatingProfit).toBe(135_000);
    expect(storeOnly.netProfit).toBe(133_500);

    const top = await topProducts(db, '2026-03-01', '2026-03-31');
    expect(top[0]).toMatchObject({
      sku: 'KA-01',
      qty: 3,
      revenue: 300_000,
      hpp: 120_000,
    });
  });

  it('subtracts refunds from net revenue and profit without changing gross revenue', async () => {
    const store = await makeStore(db);
    const order = await makeOrder(db, store.id, {
      marketplaceOrderId: 'INV-SUM-REFUND',
      orderedAt: '2026-03-10',
      status: 'completed',
      hppSnapshot: 40_000,
    });

    await addRefund(db, order.id, {
      refunded_at: '2026-03-12',
      amount: 30_000,
      reason: 'Barang rusak',
    });

    const summary = await financialSummary(db, '2026-03-01', '2026-03-31');

    expect(summary.grossRevenue).toBe(100_000);
    expect(summary.refunds).toBe(30_000);
    expect(summary.netRevenue).toBe(70_000);
    expect(summary.grossProfit).toBe(30_000);
    expect(summary.operatingProfit).toBe(30_000);
    expect(summary.pphFinal).toBe(500);
    expect(summary.netProfit).toBe(29_500);
  });

  it('applies the tax profile that covers the order date and keeps PPN separate from profit', async () => {
    const store = await makeStore(db);

    await saveTaxProfile(db, store.id, {
      pkp: true,
      ppn_mode: 'included',
      ppn_rate_bp: 1_100,
      pph_rate_bp: 50,
      pph_basis: 'gross',
      effective_from: '2026-01-01',
    });

    await makeOrder(db, store.id, {
      marketplaceOrderId: 'INV-SUM-TAX',
      orderedAt: '2026-03-10',
      status: 'completed',
      unitPrice: 111_000,
      hppSnapshot: 40_000,
    });

    const summary = await financialSummary(db, '2026-03-01', '2026-03-31');

    expect(summary.grossRevenue).toBe(111_000);
    expect(summary.ppnOutput).toBe(11_000);
    expect(summary.ppnInput).toBe(0);
    expect(summary.ppnPayable).toBe(11_000);
    expect(summary.operatingProfit).toBe(71_000);
    expect(summary.pphFinal).toBe(555);
    expect(summary.netProfit).toBe(70_445);

    await addTaxEntry(db, {
      store_id: store.id,
      period: '2026-03',
      type: 'ppn_masukan',
      base_amount: 30_000,
      rate_bp: 1_100,
      amount: 3_000,
      status: 'draft',
      reference: 'Faktur masukan',
    });

    const withInput = await financialSummary(db, '2026-03-01', '2026-03-31');
    expect(withInput.ppnInput).toBe(3_000);
    expect(withInput.ppnPayable).toBe(8_000);
  });

  it('uses the profile version effective on each order date after a profile change', async () => {
    const store = await makeStore(db);

    await saveTaxProfile(db, store.id, {
      pkp: true,
      ppn_mode: 'included',
      ppn_rate_bp: 1_100,
      pph_rate_bp: 50,
      pph_basis: 'gross',
      effective_from: '2026-01-01',
    });
    await saveTaxProfile(db, store.id, {
      pkp: false,
      ppn_mode: 'none',
      ppn_rate_bp: 0,
      pph_rate_bp: 50,
      pph_basis: 'gross',
      effective_from: '2026-04-01',
    });

    await makeOrder(db, store.id, {
      marketplaceOrderId: 'INV-SUM-MAR',
      orderedAt: '2026-03-15',
      status: 'completed',
      unitPrice: 111_000,
      hppSnapshot: 0,
    });
    await makeOrder(db, store.id, {
      marketplaceOrderId: 'INV-SUM-APR',
      orderedAt: '2026-04-10',
      status: 'completed',
      unitPrice: 100_000,
      hppSnapshot: 0,
    });

    const summary = await financialSummary(db, '2026-03-01', '2026-04-30');

    expect(summary.ppnOutput).toBe(11_000);
    expect(summary.pphFinal).toBe(555 + 500);
  });

  it('fills missing days with zero rows for charts', async () => {
    const summary = await financialSummary(db, '2026-02-01', '2026-02-04');

    expect(summary.daily).toHaveLength(0);

    const filled = fillDailyGaps(summary);
    expect(filled.map((row) => row.date)).toEqual([
      '2026-02-01',
      '2026-02-02',
      '2026-02-03',
      '2026-02-04',
    ]);
    expect(filled.every((row) => row.gross === 0 && row.orders === 0)).toBe(true);
  });
});
