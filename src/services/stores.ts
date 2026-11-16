import type { Database } from '../lib/db/types';
import type { Store, StoreWithMarketplace } from '../lib/types';
import type { StoreStatus } from '../lib/constants';
import { AppError } from '../lib/errors';
import { newId } from '../lib/id';
import { nowIso } from '../lib/db/helpers';
import { today } from '../lib/date';
import { getSettingInt } from './settings';
import { changedFields, recordAudit } from '../lib/audit';

export interface StoreInput {
  marketplace_id: string;
  name: string;
  code: string;
  username?: string | null;
  url?: string | null;
  status: StoreStatus;
  notes?: string | null;
}

export interface StoreListItem extends StoreWithMarketplace {
  product_count: number;
  order_count: number;
}

export function storeLabel(store: Pick<Store, 'name' | 'code'> & { marketplace_name?: string; marketplaceName?: string }): string {
  const marketplace = store.marketplace_name ?? store.marketplaceName ?? 'Marketplace';

  return `${store.name} · ${marketplace} (${store.code})`;
}

export async function listStores(db: Database, options: { includeArchived?: boolean } = {}): Promise<StoreWithMarketplace[]> {
  const where = options.includeArchived ? 's.deleted_at IS NULL' : "s.deleted_at IS NULL AND s.status IN ('active', 'inactive')";

  return db.query<StoreWithMarketplace>(
    `SELECT s.*, m.name AS marketplace_name, m.code AS marketplace_code
     FROM stores s
     JOIN marketplaces m ON m.id = s.marketplace_id
     WHERE ${where}
     ORDER BY s.name COLLATE NOCASE`,
  );
}

export async function listStoreItems(db: Database, search = '', status: StoreStatus | null = null): Promise<StoreListItem[]> {
  const clauses = ['s.deleted_at IS NULL'];
  const params: Array<string> = [];

  if (status) {
    clauses.push('s.status = ?');
    params.push(status);
  }

  if (search.trim() !== '') {
    clauses.push('(lower(s.name) LIKE ? OR lower(s.code) LIKE ? OR lower(COALESCE(s.username, \'\')) LIKE ?)');
    const like = `%${search.trim().toLowerCase()}%`;
    params.push(like, like, like);
  }

  return db.query<StoreListItem>(
    `SELECT s.*, m.name AS marketplace_name, m.code AS marketplace_code,
       (SELECT COUNT(*) FROM products p WHERE p.store_id = s.id AND p.deleted_at IS NULL) AS product_count,
       (SELECT COUNT(*) FROM orders o WHERE o.store_id = s.id AND o.deleted_at IS NULL) AS order_count
     FROM stores s
     JOIN marketplaces m ON m.id = s.marketplace_id
     WHERE ${clauses.join(' AND ')}
     ORDER BY s.name COLLATE NOCASE`,
    params,
  );
}

export async function getStore(db: Database, id: string): Promise<StoreWithMarketplace | null> {
  const rows = await db.query<StoreWithMarketplace>(
    `SELECT s.*, m.name AS marketplace_name, m.code AS marketplace_code
     FROM stores s
     JOIN marketplaces m ON m.id = s.marketplace_id
     WHERE s.id = ? AND s.deleted_at IS NULL`,
    [id],
  );

  return rows[0] ?? null;
}

function validateUrl(value: string | null | undefined): string | null {
  const trimmed = (value ?? '').trim();

  if (trimmed === '') {
    return null;
  }

  try {
    const url = new URL(trimmed);

    if (!['http:', 'https:'].includes(url.protocol)) {
      throw new Error('protocol');
    }
  } catch {
    throw new AppError('URL toko harus berupa alamat lengkap, misalnya https://shopee.co.id/toko.');
  }

  return trimmed;
}

export async function saveStore(db: Database, input: StoreInput, storeId: string | null = null): Promise<Store> {
  const marketplace = await db.query<{ id: string }>('SELECT id FROM marketplaces WHERE id = ? AND active = 1', [
    input.marketplace_id,
  ]);

  if (marketplace.length === 0) {
    throw new AppError('Pilih marketplace terlebih dahulu.');
  }

  const name = input.name.trim();
  const code = input.code.trim().toUpperCase();

  if (name === '') {
    throw new AppError('Nama toko wajib diisi.');
  }

  if (code === '') {
    throw new AppError('Kode toko wajib diisi.');
  }

  const duplicate = await db.query<{ id: string }>(
    `SELECT id FROM stores
     WHERE marketplace_id = ? AND lower(code) = ? AND id <> ?`,
    [input.marketplace_id, code.toLowerCase(), storeId ?? ''],
  );

  if (duplicate.length > 0) {
    throw new AppError('Kode toko ini sudah dipakai pada marketplace yang sama, termasuk toko yang sudah dihapus.');
  }

  const now = nowIso();
  const url = validateUrl(input.url);
  const username = input.username?.trim() || null;
  const notes = input.notes?.trim() || null;

  if (storeId) {
    const before = await db.query<Store>('SELECT * FROM stores WHERE id = ?', [storeId]);

    if (!before[0]) {
      throw new AppError('Toko tidak ditemukan.');
    }

    await db.transaction(async () => {
      await db.run(
        `UPDATE stores SET marketplace_id = ?, name = ?, code = ?, username = ?, url = ?, status = ?, notes = ?, updated_at = ?
         WHERE id = ?`,
        [input.marketplace_id, name, code, username, url, input.status, notes, now, storeId],
      );

      await recordAudit(db, {
        type: 'store',
        id: storeId,
        storeId,
        event: 'updated',
        summary: `Toko ${name} diubah`,
        before: changedFields(before[0] as unknown as Record<string, unknown>, {
          marketplace_id: input.marketplace_id,
          name,
          code,
          username,
          url,
          status: input.status,
          notes,
          updated_at: now,
        }),
        after: { name, code, username, url, status: input.status, notes },
      });
    });

    return (await db.query<Store>('SELECT * FROM stores WHERE id = ?', [storeId]))[0];
  }

  const id = newId();

  await db.transaction(async () => {
    await db.run(
      `INSERT INTO stores
        (id, marketplace_id, name, username, url, code, status, notes, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, input.marketplace_id, name, username, url, code, input.status, notes, now, now],
    );

    const ppn = await getSettingInt(db, 'ppn_default_bp', 1100);
    const pph = await getSettingInt(db, 'pph_default_bp', 50);
    const profileId = newId();

    await db.run(
      `INSERT INTO tax_profiles
        (id, store_id, pkp, ppn_mode, ppn_rate_bp, pph_rate_bp, pph_basis, effective_from, effective_to, created_at, updated_at)
       VALUES (?, ?, 0, 'none', ?, ?, 'gross', ?, NULL, ?, ?)`,
      [profileId, id, ppn, pph, today(), now, now],
    );

    await recordAudit(db, {
      type: 'store',
      id,
      storeId: id,
      event: 'created',
      summary: `Toko ${name} dibuat`,
      after: { marketplace_id: input.marketplace_id, name, code, username, url, status: input.status, notes },
    });
  });

  return (await db.query<Store>('SELECT * FROM stores WHERE id = ?', [id]))[0];
}

export async function setStoreStatus(db: Database, storeId: string, status: StoreStatus): Promise<void> {
  const before = await db.query<Store>('SELECT * FROM stores WHERE id = ?', [storeId]);

  if (!before[0]) {
    throw new AppError('Toko tidak ditemukan.');
  }

  await db.transaction(async () => {
    await db.run('UPDATE stores SET status = ?, updated_at = ? WHERE id = ?', [status, nowIso(), storeId]);
    await recordAudit(db, {
      type: 'store',
      id: storeId,
      storeId,
      event: 'updated',
      summary: status === 'archived' ? `Toko ${before[0].name} diarsipkan` : `Toko ${before[0].name} diaktifkan kembali`,
      before: { status: before[0].status },
      after: { status },
    });
  });
}
