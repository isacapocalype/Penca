import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { closeDatabase, createTestDatabase } from '../lib/db';
import type { Database } from '../lib/db/types';
import { sha256Hex } from '../lib/hash';
import { readTextFile } from '../lib/files';
import { makeOrder, makeProduct, makeStore } from '../test/fixtures';
import {
  autoBackupIfDue,
  backupHistory,
  backupTables,
  createBackup,
  restoreBackupText,
} from './backup';
import { putSetting } from './settings';

let db: Database;

beforeEach(async () => {
  db = await createTestDatabase();
});

afterEach(async () => {
  await db.close();
  await closeDatabase();
});

async function seededStore() {
  const store = await makeStore(db);
  await makeProduct(db, store.id, { hpp: 40_000 });
  await makeOrder(db, store.id, { marketplaceOrderId: 'INV-BACKUP-1' });

  return store;
}

describe('JSON backup and restore', () => {
  it('writes a complete JSON payload with a verifiable checksum', async () => {
    const store = await seededStore();

    const backup = await createBackup(db);

    expect(backup.reason).toBe('manual');
    expect(backup.file_name).toContain('manual');
    expect(backup.size).toBeGreaterThan(0);
    expect(backup.schema_version).toBe(1);
    expect(backup.checksum).toMatch(/^[a-f0-9]{64}$/);

    const text = await readTextFile(backup.json_path);
    expect(await sha256Hex(text)).toBe(backup.checksum);

    const payload = JSON.parse(text) as {
      app: string;
      schema_version: number;
      checksum: string;
      tables: Record<string, Array<Record<string, unknown>>>;
    };

    expect(payload.app).toBe('Penca');
    expect(payload.schema_version).toBe(1);
    expect(payload.checksum).toBe(await sha256Hex(JSON.stringify(payload.tables)));
    expect(payload.tables.stores).toHaveLength(1);
    expect(payload.tables.stores[0].id).toBe(store.id);
    expect(payload.tables.orders).toHaveLength(1);
    expect(payload.tables.products).toHaveLength(1);
    expect(payload.tables.settings.length).toBeGreaterThan(0);
  });

  it('creates a safety backup and replaces later changes with the backed-up data', async () => {
    const store = await seededStore();
    const backup = await createBackup(db);
    const text = await readTextFile(backup.json_path);

    await makeStore(db, 'Toko Sementara');
    await makeOrder(db, store.id, { marketplaceOrderId: 'INV-AFTER-BACKUP' });

    const safety = await restoreBackupText(db, text, backup.file_name);
    expect(safety.reason).toBe('pre_restore');

    const stores = await db.query<{ name: string }>(
      "SELECT name FROM stores WHERE name = 'Toko Sementara'",
    );
    expect(stores).toHaveLength(0);

    const original = await db.query<{ id: string }>(
      "SELECT id FROM stores WHERE id = ?",
      [store.id],
    );
    expect(original).toHaveLength(1);

    const restoredOrders = await db.query<{ marketplace_order_id: string }>(
      'SELECT marketplace_order_id FROM orders ORDER BY marketplace_order_id',
    );
    expect(restoredOrders.map((order) => order.marketplace_order_id)).toEqual(['INV-BACKUP-1']);

    const history = await backupHistory(db);
    expect(history).toHaveLength(1);
    expect(history[0].reason).toBe('pre_restore');

    const audit = await db.query<{ summary: string }>(
      "SELECT summary FROM audit_logs WHERE event = 'restored'",
    );
    expect(audit).toHaveLength(1);
    expect(audit[0].summary).toContain(backup.file_name);
  });

  it('rejects a backup whose tables were modified after the checksum was written', async () => {
    await seededStore();
    const backup = await createBackup(db);
    const text = await readTextFile(backup.json_path);
    const payload = JSON.parse(text) as {
      tables: { stores: Array<Record<string, unknown>> };
    };

    payload.tables.stores[0].name = 'Nama yang diubah';

    await expect(restoreBackupText(db, JSON.stringify(payload))).rejects.toThrow(/Checksum/);

    const stores = await db.query<{ name: string }>('SELECT name FROM stores');
    expect(stores.map((store) => store.name)).toEqual(['Konveksi Amanah']);

    const history = await backupHistory(db);
    expect(history).toHaveLength(1);
    expect(history[0].reason).toBe('manual');
  });

  it('rejects files that are not Penca JSON backups', async () => {
    await expect(restoreBackupText(db, 'bukan json')).rejects.toThrow(/valid/);
    await expect(restoreBackupText(db, '{"app":"Lain"}')).rejects.toThrow(/bukan backup Penca/);
    await expect(
      restoreBackupText(
        db,
        JSON.stringify({ app: 'Penca', schema_version: 99, checksum: 'x', tables: {} }),
      ),
    ).rejects.toThrow(/lebih baru/);
  });

  it('creates at most one automatic backup per day and honors the retention limit', async () => {
    await seededStore();

    const first = await autoBackupIfDue(db);
    expect(first?.reason).toBe('auto');

    const second = await autoBackupIfDue(db);
    expect(second).toBeNull();

    const lastAuto = await db.query<{ value: string }>(
      "SELECT value FROM settings WHERE key = 'last_auto_backup_at'",
    );
    expect(lastAuto[0].value).toMatch(/^\d{4}-\d{2}-\d{2} /);

    await putSetting(db, 'backup_retention', 2);
    await createBackup(db);
    await createBackup(db);
    await createBackup(db);

    const history = await backupHistory(db);
    expect(history).toHaveLength(2);
  });

  it('exposes raw table rows for snapshot inspection', async () => {
    await seededStore();

    const tables = await backupTables(db);

    expect(Object.keys(tables)).toContain('orders');
    expect(Object.keys(tables)).toContain('order_items');
    expect(tables.orders).toHaveLength(1);
    expect(tables.marketplaces.length).toBe(2);
  });
});
