import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { closeDatabase, createTestDatabase } from '../lib/db';
import type { Database } from '../lib/db/types';
import type { TaxEntry } from '../lib/types';
import { makeOrder, makeStore } from '../test/fixtures';
import { lockPeriod, unlockPeriod } from './period-locks';
import {
  addTaxEntry,
  deleteTaxEntry,
  generateTaxEntries,
  listTaxProfiles,
  saveTaxProfile,
  setTaxEntryStatus,
  taxRecap,
} from './taxes';

let db: Database;

beforeEach(async () => {
  db = await createTestDatabase();
});

afterEach(async () => {
  await db.close();
  await closeDatabase();
});

async function taxStore() {
  const store = await makeStore(db);

  await saveTaxProfile(db, store.id, {
    pkp: true,
    ppn_mode: 'included',
    ppn_rate_bp: 1_100,
    pph_rate_bp: 50,
    pph_basis: 'gross',
    effective_from: '2026-01-01',
  });

  return store;
}

describe('tax recap and entries', () => {
  it('recalculates from realized orders and reuses automatic entries instead of duplicating them', async () => {
    const store = await taxStore();

    await makeOrder(db, store.id, {
      marketplaceOrderId: 'INV-TAX-1',
      orderedAt: '2026-03-10',
      status: 'completed',
      unitPrice: 111_000,
      hppSnapshot: 40_000,
    });
    await makeOrder(db, store.id, {
      marketplaceOrderId: 'INV-TAX-2',
      orderedAt: '2026-03-11',
      status: 'pending',
      unitPrice: 111_000,
      hppSnapshot: 40_000,
    });

    const recap = await taxRecap(db, '2026-03');

    expect(recap.grossRevenue).toBe(111_000);
    expect(recap.netRevenue).toBe(111_000);
    expect(recap.ppnOutput).toBe(11_000);
    expect(recap.pphFinal).toBe(555);
    expect(recap.stores[0]).toMatchObject({
      store_name: 'Konveksi Amanah',
      pkp: true,
      ppn_mode: 'included',
      ppn_rate_bp: 1_100,
      pph_rate_bp: 50,
      pph_basis: 'gross',
      orders: 1,
    });

    await expect(generateTaxEntries(db, '2026-03')).resolves.toBe(2);

    const entries = await db.query<TaxEntry>(
      "SELECT * FROM tax_entries WHERE period = '2026-03' ORDER BY type",
    );

    expect(entries).toHaveLength(2);
    expect(entries[0]).toMatchObject({
      type: 'pph_final',
      base_amount: 111_000,
      rate_bp: 50,
      amount: 555,
      status: 'draft',
      reference: 'auto',
    });
    expect(entries[1]).toMatchObject({
      type: 'ppn_keluaran',
      base_amount: 111_000,
      rate_bp: 1_100,
      amount: 11_000,
      status: 'draft',
      reference: 'auto',
    });

    await expect(generateTaxEntries(db, '2026-03')).resolves.toBe(2);

    const count = await db.query<{ count: number }>(
      "SELECT COUNT(*) AS count FROM tax_entries WHERE period = '2026-03'",
    );
    expect(Number(count[0].count)).toBe(2);

    const updated = await db.query<{ count: number }>(
      "SELECT COUNT(*) AS count FROM audit_logs WHERE auditable_type = 'tax_entry' AND event = 'updated'",
    );
    expect(Number(updated[0].count)).toBe(2);
  });

  it('uses net revenue after refund as the PPN basis', async () => {
    const store = await taxStore();
    const order = await makeOrder(db, store.id, {
      marketplaceOrderId: 'INV-TAX-REFUND',
      orderedAt: '2026-03-10',
      status: 'completed',
      unitPrice: 111_000,
      hppSnapshot: 40_000,
    });

    await db.run(
      `INSERT INTO refunds (id, order_id, amount, reason, refunded_at, created_at, updated_at)
       VALUES ('refund-test-1', ?, 11000, 'Retur', '2026-03-12', '2026-03-12 10:00:00', '2026-03-12 10:00:00')`,
      [order.id],
    );

    const recap = await taxRecap(db, '2026-03');

    expect(recap.netRevenue).toBe(100_000);
    expect(recap.ppnOutput).toBe(9_910);
    expect(recap.pphFinal).toBe(555);
  });

  it('tracks manual entries, status changes, and blocks locked periods until unlocked', async () => {
    const store = await makeStore(db);
    const entry = await addTaxEntry(db, {
      store_id: store.id,
      period: '2026-03',
      type: 'ppn_masukan',
      base_amount: 10_000,
      rate_bp: 1_100,
      amount: 1_100,
      status: 'draft',
      reference: 'Faktur A',
    });

    expect(entry.status).toBe('draft');

    await setTaxEntryStatus(db, entry.id, 'reported');

    const stored = await db.query<TaxEntry>('SELECT * FROM tax_entries WHERE id = ?', [entry.id]);
    expect(stored[0].status).toBe('reported');

    const recap = await taxRecap(db, '2026-03');
    expect(recap.ppnInput).toBe(1_100);
    expect(recap.ppnPayable).toBe(-1_100);

    await lockPeriod(db, '2026-03', 'Sari');

    await expect(
      addTaxEntry(db, {
        store_id: store.id,
        period: '2026-03',
        type: 'ppn_masukan',
        base_amount: 5_000,
        rate_bp: 1_100,
        amount: 550,
        status: 'draft',
      }),
    ).rejects.toThrow(/terkunci/);
    await expect(setTaxEntryStatus(db, entry.id, 'paid')).rejects.toThrow(/terkunci/);
    await expect(deleteTaxEntry(db, entry.id)).rejects.toThrow(/terkunci/);
    await expect(generateTaxEntries(db, '2026-03')).rejects.toThrow(/terkunci/);

    await unlockPeriod(db, '2026-03', 'Sari');

    await expect(setTaxEntryStatus(db, entry.id, 'paid')).resolves.toBeUndefined();
    await expect(deleteTaxEntry(db, entry.id)).resolves.toBeUndefined();

    const deleted = await db.query<{ deleted_at: string | null }>(
      'SELECT deleted_at FROM tax_entries WHERE id = ?',
      [entry.id],
    );
    expect(deleted[0].deleted_at).not.toBeNull();
  });

  it('validates manual amounts and closes the previous tax profile on a new effective date', async () => {
    const store = await makeStore(db);

    const first = await saveTaxProfile(db, store.id, {
      pkp: true,
      ppn_mode: 'included',
      ppn_rate_bp: 1_100,
      pph_rate_bp: 50,
      pph_basis: 'gross',
      effective_from: '2026-01-01',
    });
    const second = await saveTaxProfile(db, store.id, {
      pkp: false,
      ppn_mode: 'none',
      ppn_rate_bp: 0,
      pph_rate_bp: 50,
      pph_basis: 'gross',
      effective_from: '2026-04-01',
    });

    const profiles = await listTaxProfiles(db, store.id);
    // Creating the store also created its default profile effective today.
    expect(profiles).toHaveLength(3);
    expect(profiles.find((profile) => profile.id === first.id)?.effective_to).toBe('2026-03-31');
    expect(profiles.find((profile) => profile.id === second.id)?.effective_to).toBeNull();

    await expect(
      saveTaxProfile(db, store.id, {
        pkp: true,
        ppn_mode: 'included',
        ppn_rate_bp: 1_100,
        pph_rate_bp: 50,
        pph_basis: 'gross',
        effective_from: '2026-05-01',
        effective_to: '2026-04-01',
      }),
    ).rejects.toThrow(/sebelum/);

    await expect(
      addTaxEntry(db, {
        store_id: store.id,
        period: '2026-05',
        type: 'ppn_masukan',
        base_amount: 10_000,
        rate_bp: 1_100,
        amount: -1,
        status: 'draft',
      }),
    ).rejects.toThrow(/negatif/);

    await expect(
      addTaxEntry(db, {
        store_id: store.id,
        period: '2026-05',
        type: 'ppn_masukan',
        base_amount: 10_000,
        rate_bp: 10_001,
        amount: 1_000,
        status: 'draft',
      }),
    ).rejects.toThrow(/Tarif pajak/);
  });
});
