import type { Database } from '../lib/db/types';
import type { Order, Refund, StoreWithMarketplace, TaxEntry, TaxEntryWithStore, TaxProfile, TaxRecap, TaxRecapStore } from '../lib/types';
import { TAX_TYPE_LABELS, TAX_STATUSES, PPN_MODES, PPH_BASIS, type TaxStatus, type TaxType } from '../lib/constants';
import { AppError } from '../lib/errors';
import { newId } from '../lib/id';
import { nowIso } from '../lib/db/helpers';
import { assertPeriod, monthLabel, normalizeDate, periodEnd, periodStart, today } from '../lib/date';
import { assertPeriodsUnlocked } from './period-locks';
import { changedFields, recordAudit } from '../lib/audit';
import { netRevenue as calcNetRevenue } from '../lib/financial';
import { outputPpn, pphForOrder, taxProfileOn } from './summary';
import { getSettingInt } from './settings';
import { parseRupiah } from '../lib/money';

export async function listTaxProfiles(db: Database, storeId: string): Promise<TaxProfile[]> {
  return db.query<TaxProfile>(
    'SELECT * FROM tax_profiles WHERE store_id = ? ORDER BY effective_from DESC',
    [storeId],
  );
}

export async function listStoresWithTaxProfile(
  db: Database,
): Promise<Array<StoreWithMarketplace & { latest_profile: TaxProfile | null }>> {
  const stores = await db.query<StoreWithMarketplace>(
    `SELECT s.*, m.name AS marketplace_name, m.code AS marketplace_code
     FROM stores s JOIN marketplaces m ON m.id = s.marketplace_id
     WHERE s.deleted_at IS NULL AND s.status IN ('active', 'inactive')
     ORDER BY s.name COLLATE NOCASE`,
  );

  const result: Array<StoreWithMarketplace & { latest_profile: TaxProfile | null }> = [];

  for (const store of stores) {
    const profiles = await listTaxProfiles(db, store.id);
    result.push({ ...store, latest_profile: profiles[0] ?? null });
  }

  return result;
}

export async function taxRecap(db: Database, period: string, storeId: string | null = null): Promise<TaxRecap> {
  assertPeriod(period);
  const start = periodStart(period);
  const end = periodEnd(period);
  const params: string[] = [start, end];
  let storeClause = '';

  if (storeId) {
    storeClause = ' AND o.store_id = ?';
    params.push(storeId);
  }

  const orders = await db.query<Order & { store_name: string }>(
    `SELECT o.*, s.name AS store_name
     FROM orders o JOIN stores s ON s.id = o.store_id
     WHERE o.deleted_at IS NULL AND o.status IN ('delivered', 'completed')
       AND o.ordered_at BETWEEN ? AND ?${storeClause}
     ORDER BY o.ordered_at`,
    params,
  );

  const orderIds = orders.map((order) => order.id);
  const refunds = orderIds.length
    ? await db.query<Refund>(
        `SELECT * FROM refunds WHERE deleted_at IS NULL AND order_id IN (${orderIds.map(() => '?').join(', ')})`,
        orderIds,
      )
    : [];
  const refundMap = new Map(refunds.map((refund) => [refund.order_id, refund]));

  const storeIds = [...new Set(orders.map((order) => order.store_id))];
  const profiles = storeIds.length
    ? await db.query<TaxProfile>(
        `SELECT * FROM tax_profiles WHERE store_id IN (${storeIds.map(() => '?').join(', ')}) ORDER BY effective_from`,
        storeIds,
      )
    : [];
  const profilesByStore = new Map<string, TaxProfile[]>();

  for (const profile of profiles) {
    const list = profilesByStore.get(profile.store_id) ?? [];
    list.push(profile);
    profilesByStore.set(profile.store_id, list);
  }

  const defaultPph = await getSettingInt(db, 'pph_default_bp', 50);
  const stores = new Map<string, TaxRecapStore>();

  const ensureStore = (id: string, name: string, profile: TaxProfile | null): TaxRecapStore => {
    let row = stores.get(id);

    if (!row) {
      row = {
        store_id: id,
        store_name: name,
        pkp: Boolean(profile?.pkp),
        ppn_mode: profile?.ppn_mode ?? 'none',
        ppn_rate_bp: profile?.ppn_rate_bp ?? 0,
        pph_rate_bp: profile?.pph_rate_bp ?? 0,
        pph_basis: profile?.pph_basis ?? 'gross',
        gross: 0,
        net: 0,
        ppn_output: 0,
        ppn_input: 0,
        ppn_payable: 0,
        pph_final: 0,
        orders: 0,
      };
      stores.set(id, row);
    }

    return row;
  };

  for (const order of orders) {
    const profile = taxProfileOn(profilesByStore.get(order.store_id) ?? [], order.ordered_at);
    const row = ensureStore(order.store_id, order.store_name, profile);
    const refund = refundMap.get(order.id)?.amount ?? 0;
    const net = calcNetRevenue(order.gross_revenue, order.seller_discount, refund);
    const ppn = outputPpn(profile, net);
    const pph = pphForOrder(profile, order.gross_revenue, net, defaultPph);

    row.gross += order.gross_revenue;
    row.net += net;
    row.ppn_output += ppn;
    row.pph_final += pph;
    row.orders += 1;

    if (profile) {
      row.pkp = Boolean(profile.pkp);
      row.ppn_mode = profile.ppn_mode;
      row.ppn_rate_bp = profile.ppn_rate_bp;
      row.pph_rate_bp = profile.pph_rate_bp;
      row.pph_basis = profile.pph_basis;
    }
  }

  if (storeId && !stores.has(storeId)) {
    const store = (
      await db.query<StoreWithMarketplace>(
        `SELECT s.*, m.name AS marketplace_name, m.code AS marketplace_code
         FROM stores s JOIN marketplaces m ON m.id = s.marketplace_id WHERE s.id = ?`,
        [storeId],
      )
    )[0];

    if (store) {
      const profilesForStore = await listTaxProfiles(db, storeId);
      ensureStore(storeId, store.name, taxProfileOn(profilesForStore, today()));
    }
  }

  const entryParams: string[] = [period];
  let entryClause = '';

  if (storeId) {
    entryClause = ' AND te.store_id = ?';
    entryParams.push(storeId);
  }

  const entries = await db.query<TaxEntryWithStore>(
    `SELECT te.*, s.name AS store_name
     FROM tax_entries te JOIN stores s ON s.id = te.store_id
     WHERE te.deleted_at IS NULL AND te.period = ?${entryClause}
     ORDER BY te.type, te.created_at`,
    entryParams,
  );

  for (const entry of entries) {
    const row = ensureStore(entry.store_id, entry.store_name, null);

    if (entry.type === 'ppn_masukan') {
      row.ppn_input += entry.amount;
    }
  }

  const recapStores = [...stores.values()];

  for (const row of recapStores) {
    row.ppn_payable = row.ppn_output - row.ppn_input;
  }

  recapStores.sort((a, b) => a.store_name.localeCompare(b.store_name));

  return {
    period,
    periodLabel: monthLabel(period),
    storeId,
    grossRevenue: recapStores.reduce((sum, row) => sum + row.gross, 0),
    netRevenue: recapStores.reduce((sum, row) => sum + row.net, 0),
    ppnOutput: recapStores.reduce((sum, row) => sum + row.ppn_output, 0),
    ppnInput: recapStores.reduce((sum, row) => sum + row.ppn_input, 0),
    ppnPayable: recapStores.reduce((sum, row) => sum + row.ppn_payable, 0),
    pphFinal: recapStores.reduce((sum, row) => sum + row.pph_final, 0),
    stores: recapStores,
    entries: entries.map((entry) => ({
      ...entry,
      type_label: TAX_TYPE_LABELS[entry.type] ?? entry.type,
    })),
  };
}

/**
 * Menyimpan rekap PPN keluaran dan PPh Final dari transaksi. Entri PPN masukan
 * manual tidak dihapus.
 */
export async function generateTaxEntries(
  db: Database,
  period: string,
  storeId: string | null = null,
): Promise<number> {
  assertPeriod(period);
  await assertPeriodsUnlocked(db, [period]);

  const recap = await taxRecap(db, period, storeId);
  let written = 0;
  const now = nowIso();

  await db.transaction(async () => {
    for (const store of recap.stores) {
      for (const type of ['ppn_keluaran', 'pph_final'] as TaxType[]) {
        const amount = type === 'ppn_keluaran' ? store.ppn_output : store.pph_final;
        const base = type === 'ppn_keluaran' ? store.net : store.gross;
        const rate = type === 'ppn_keluaran' ? (store.pkp ? store.ppn_rate_bp : 0) : store.pph_rate_bp;

        const existing = await db.query<TaxEntry>(
          `SELECT * FROM tax_entries
           WHERE store_id = ? AND period = ? AND type = ? AND reference = 'auto' AND deleted_at IS NULL`,
          [store.store_id, period, type],
        );

        if (existing.length === 0 && amount === 0) {
          continue;
        }

        if (existing[0]) {
          await db.run(
            `UPDATE tax_entries SET base_amount = ?, rate_bp = ?, amount = ?,
               notes = 'Dihitung otomatis dari pesanan terkirim/selesai.', updated_at = ?
             WHERE id = ?`,
            [base, rate, amount, now, existing[0].id],
          );
          await recordAudit(db, {
            type: 'tax_entry',
            id: existing[0].id,
            storeId: store.store_id,
            event: 'updated',
            summary: `Entri ${TAX_TYPE_LABELS[type]} ${monthLabel(period)} dihitung ulang`,
            before: {
              base_amount: existing[0].base_amount,
              rate_bp: existing[0].rate_bp,
              amount: existing[0].amount,
            },
            after: { base_amount: base, rate_bp: rate, amount },
          });
        } else {
          const id = newId();
          await db.run(
            `INSERT INTO tax_entries
              (id, store_id, period, type, base_amount, rate_bp, amount, status, reference, notes, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, 'draft', 'auto', 'Dihitung otomatis dari pesanan terkirim/selesai.', ?, ?)`,
            [id, store.store_id, period, type, base, rate, amount, now, now],
          );
          await recordAudit(db, {
            type: 'tax_entry',
            id,
            storeId: store.store_id,
            event: 'created',
            summary: `Entri ${TAX_TYPE_LABELS[type]} ${monthLabel(period)} dihitung otomatis`,
            after: { base_amount: base, rate_bp: rate, amount, reference: 'auto' },
          });
        }

        written += 1;
      }
    }
  });

  return written;
}

export interface TaxEntryInput {
  store_id: string;
  period: string;
  type: TaxType;
  base_amount: number | string;
  rate_bp: number | string;
  amount: number | string;
  status: TaxStatus;
  reference?: string | null;
  notes?: string | null;
}

export async function addTaxEntry(db: Database, input: TaxEntryInput): Promise<TaxEntry> {
  const store = await db.query<{ id: string }>('SELECT id FROM stores WHERE id = ? AND deleted_at IS NULL', [
    input.store_id,
  ]);

  if (store.length === 0) {
    throw new AppError('Pilih toko terlebih dahulu.');
  }

  assertPeriod(input.period);

  if (!(input.type in TAX_TYPE_LABELS)) {
    throw new AppError('Jenis pajak tidak dikenal.');
  }

  if (!TAX_STATUSES.includes(input.status)) {
    throw new AppError('Status pajak tidak dikenal.');
  }

  const base = parseRupiah(input.base_amount);
  const rate = Number.parseInt(String(input.rate_bp), 10);
  const amount = parseRupiah(input.amount);

  if (base < 0 || amount < 0) {
    throw new AppError('Nominal pajak tidak boleh negatif.');
  }

  if (!Number.isFinite(rate) || rate < 0 || rate > 10000) {
    throw new AppError('Tarif pajak harus antara 0% dan 100%.');
  }

  await assertPeriodsUnlocked(db, [input.period]);

  const id = newId();
  const now = nowIso();

  await db.transaction(async () => {
    await db.run(
      `INSERT INTO tax_entries
        (id, store_id, period, type, base_amount, rate_bp, amount, status, reference, notes, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        input.store_id,
        input.period,
        input.type,
        base,
        rate,
        amount,
        input.status,
        input.reference?.trim() || null,
        input.notes?.trim() || null,
        now,
        now,
      ],
    );

    await recordAudit(db, {
      type: 'tax_entry',
      id,
      storeId: input.store_id,
      event: 'created',
      summary: `Entri ${TAX_TYPE_LABELS[input.type]} ${monthLabel(input.period)} ditambahkan manual`,
      after: { type: input.type, base_amount: base, rate_bp: rate, amount, status: input.status },
    });
  });

  return (await db.query<TaxEntry>('SELECT * FROM tax_entries WHERE id = ?', [id]))[0];
}

export async function setTaxEntryStatus(db: Database, entryId: string, status: TaxStatus): Promise<void> {
  const entry = (
    await db.query<TaxEntry>('SELECT * FROM tax_entries WHERE id = ? AND deleted_at IS NULL', [entryId])
  )[0];

  if (!entry) {
    throw new AppError('Entri pajak tidak ditemukan.');
  }

  if (!TAX_STATUSES.includes(status)) {
    throw new AppError('Status pajak tidak dikenal.');
  }

  await assertPeriodsUnlocked(db, [entry.period]);

  await db.transaction(async () => {
    await db.run('UPDATE tax_entries SET status = ?, updated_at = ? WHERE id = ?', [status, nowIso(), entryId]);
    await recordAudit(db, {
      type: 'tax_entry',
      id: entryId,
      storeId: entry.store_id,
      event: 'updated',
      summary: `Status ${TAX_TYPE_LABELS[entry.type]} ${monthLabel(entry.period)} diubah`,
      before: { status: entry.status },
      after: { status },
    });
  });
}

export async function deleteTaxEntry(db: Database, entryId: string): Promise<void> {
  const entry = (
    await db.query<TaxEntry>('SELECT * FROM tax_entries WHERE id = ? AND deleted_at IS NULL', [entryId])
  )[0];

  if (!entry) {
    throw new AppError('Entri pajak tidak ditemukan.');
  }

  await assertPeriodsUnlocked(db, [entry.period]);
  const now = nowIso();

  await db.transaction(async () => {
    await db.run('UPDATE tax_entries SET deleted_at = ?, updated_at = ? WHERE id = ?', [now, now, entryId]);
    await recordAudit(db, {
      type: 'tax_entry',
      id: entryId,
      storeId: entry.store_id,
      event: 'deleted',
      summary: `Entri ${TAX_TYPE_LABELS[entry.type]} ${monthLabel(entry.period)} dihapus`,
      before: { type: entry.type, amount: entry.amount, status: entry.status },
    });
  });
}

export interface TaxProfileInput {
  pkp: boolean;
  ppn_mode: 'none' | 'included' | 'added';
  ppn_rate_bp: number | string;
  pph_rate_bp: number | string;
  pph_basis: 'gross' | 'net';
  effective_from: string;
  effective_to?: string | null;
}

function dayBefore(date: string): string {
  const parsed = new Date(`${date}T00:00:00Z`);
  parsed.setUTCDate(parsed.getUTCDate() - 1);

  return parsed.toISOString().slice(0, 10);
}

export async function saveTaxProfile(
  db: Database,
  storeId: string,
  input: TaxProfileInput,
): Promise<TaxProfile> {
  const store = await db.query<{ id: string }>('SELECT id FROM stores WHERE id = ? AND deleted_at IS NULL', [storeId]);

  if (store.length === 0) {
    throw new AppError('Toko tidak ditemukan.');
  }

  if (!PPN_MODES.includes(input.ppn_mode)) {
    throw new AppError('Mode PPN tidak dikenal.');
  }

  if (!PPH_BASIS.includes(input.pph_basis)) {
    throw new AppError('Dasar PPh tidak dikenal.');
  }

  const ppnRate = Number.parseInt(String(input.ppn_rate_bp), 10);
  const pphRate = Number.parseInt(String(input.pph_rate_bp), 10);

  if (!Number.isFinite(ppnRate) || ppnRate < 0 || ppnRate > 10000) {
    throw new AppError('Tarif PPN maksimal 100%.');
  }

  if (!Number.isFinite(pphRate) || pphRate < 0 || pphRate > 10000) {
    throw new AppError('Tarif PPh maksimal 100%.');
  }

  const effectiveFrom = normalizeDate(input.effective_from);
  const effectiveTo = input.effective_to ? normalizeDate(input.effective_to) : null;

  if (!/^\d{4}-\d{2}-\d{2}$/.test(effectiveFrom)) {
    throw new AppError('Tanggal berlaku wajib diisi.');
  }

  if (effectiveTo && effectiveTo < effectiveFrom) {
    throw new AppError('Tanggal berakhir tidak boleh sebelum tanggal berlaku.');
  }

  await assertPeriodsUnlocked(db, [effectiveFrom.slice(0, 7)]);

  let profileId = '';
  const now = nowIso();

  await db.transaction(async () => {
    const existing = (
      await db.query<TaxProfile>('SELECT * FROM tax_profiles WHERE store_id = ? AND effective_from = ?', [
        storeId,
        effectiveFrom,
      ])
    )[0];

    if (existing) {
      await db.run(
        `UPDATE tax_profiles SET pkp = ?, ppn_mode = ?, ppn_rate_bp = ?, pph_rate_bp = ?, pph_basis = ?,
           effective_to = ?, updated_at = ?
         WHERE id = ?`,
        [input.pkp ? 1 : 0, input.ppn_mode, ppnRate, pphRate, input.pph_basis, effectiveTo, now, existing.id],
      );
      profileId = existing.id;
      await recordAudit(db, {
        type: 'tax_profile',
        id: existing.id,
        storeId,
        event: 'updated',
        summary: `Profil pajak toko diubah mulai ${effectiveFrom}`,
        before: {
          pkp: existing.pkp,
          ppn_mode: existing.ppn_mode,
          ppn_rate_bp: existing.ppn_rate_bp,
          pph_rate_bp: existing.pph_rate_bp,
          pph_basis: existing.pph_basis,
          effective_to: existing.effective_to,
        },
        after: {
          pkp: input.pkp,
          ppn_mode: input.ppn_mode,
          ppn_rate_bp: ppnRate,
          pph_rate_bp: pphRate,
          pph_basis: input.pph_basis,
          effective_to: effectiveTo,
        },
      });

      return;
    }

    const previous = (
      await db.query<TaxProfile>(
        `SELECT * FROM tax_profiles
         WHERE store_id = ? AND effective_from < ?
           AND (effective_to IS NULL OR effective_to >= ?)
         ORDER BY effective_from DESC LIMIT 1`,
        [storeId, effectiveFrom, effectiveFrom],
      )
    )[0];

    if (previous) {
      const closedTo = dayBefore(effectiveFrom);
      await db.run('UPDATE tax_profiles SET effective_to = ?, updated_at = ? WHERE id = ?', [
        closedTo,
        now,
        previous.id,
      ]);
      await recordAudit(db, {
        type: 'tax_profile',
        id: previous.id,
        storeId,
        event: 'updated',
        summary: `Masa berlaku profil pajak ditutup pada ${closedTo}`,
        before: { effective_to: previous.effective_to },
        after: { effective_to: closedTo },
      });
    }

    const id = newId();
    await db.run(
      `INSERT INTO tax_profiles
        (id, store_id, pkp, ppn_mode, ppn_rate_bp, pph_rate_bp, pph_basis, effective_from, effective_to, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, storeId, input.pkp ? 1 : 0, input.ppn_mode, ppnRate, pphRate, input.pph_basis, effectiveFrom, effectiveTo, now, now],
    );
    profileId = id;
    await recordAudit(db, {
      type: 'tax_profile',
      id,
      storeId,
      event: 'created',
      summary: `Profil pajak baru berlaku mulai ${effectiveFrom}`,
      after: {
        pkp: input.pkp,
        ppn_mode: input.ppn_mode,
        ppn_rate_bp: ppnRate,
        pph_rate_bp: pphRate,
        pph_basis: input.pph_basis,
        effective_from: effectiveFrom,
        effective_to: effectiveTo,
      },
    });
  });

  return (await db.query<TaxProfile>('SELECT * FROM tax_profiles WHERE id = ?', [profileId]))[0];
}

export async function deleteTaxProfile(db: Database, profileId: string): Promise<void> {
  const profile = (await db.query<TaxProfile>('SELECT * FROM tax_profiles WHERE id = ?', [profileId]))[0];

  if (!profile) {
    throw new AppError('Profil pajak tidak ditemukan.');
  }

  await db.transaction(async () => {
    await db.run('DELETE FROM tax_profiles WHERE id = ?', [profileId]);
    await recordAudit(db, {
      type: 'tax_profile',
      id: profileId,
      storeId: profile.store_id,
      event: 'deleted',
      summary: `Profil pajak mulai ${profile.effective_from} dihapus`,
      before: {
        pkp: profile.pkp,
        ppn_mode: profile.ppn_mode,
        ppn_rate_bp: profile.ppn_rate_bp,
        pph_rate_bp: profile.pph_rate_bp,
        pph_basis: profile.pph_basis,
        effective_from: profile.effective_from,
        effective_to: profile.effective_to,
      },
    });
  });
}

export async function listImportedTaxProfileOptions(db: Database): Promise<Array<{ storeId: string; profile: TaxProfile | null }>> {
  const stores = await listStoresWithTaxProfile(db);

  return stores.map((store) => ({ storeId: store.id, profile: store.latest_profile }));
}

export function taxProfileChanged(
  before: Record<string, unknown>,
  after: Record<string, unknown>,
): Record<string, unknown> {
  return changedFields(before, after);
}
