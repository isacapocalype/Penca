import type { Database } from '../lib/db/types';
import type { AdCampaign, AdvertisingExpense, AdvertisingExpenseWithStore } from '../lib/types';
import { AppError } from '../lib/errors';
import { newId } from '../lib/id';
import { nowIso } from '../lib/db/helpers';
import { AD_PLATFORMS, type AdPlatform } from '../lib/constants';
import { normalizeDate, periodEnd, periodStart } from '../lib/date';
import { assertDateUnlocked, assertPeriodsUnlocked } from './period-locks';
import { recordAudit } from '../lib/audit';
import { parseRupiah } from '../lib/money';

export interface AdExpenseInput {
  store_id: string;
  ad_campaign_id?: string | null;
  spent_at: string;
  amount: number | string;
  clicks?: number | string | null;
  impressions?: number | string | null;
  attributed_orders?: number | string | null;
  attributed_revenue?: number | string | null;
  notes?: string | null;
}

export async function listAdExpenses(
  db: Database,
  period: string,
  storeId: string | null = null,
): Promise<AdvertisingExpenseWithStore[]> {
  const params: string[] = [periodStart(period), periodEnd(period)];
  let clause = '';

  if (storeId) {
    clause = ' AND ae.store_id = ?';
    params.push(storeId);
  }

  return db.query<AdvertisingExpenseWithStore>(
    `SELECT ae.*, s.name AS store_name, m.name AS marketplace_name,
       ac.name AS campaign_name, ac.platform AS campaign_platform
     FROM advertising_expenses ae
     JOIN stores s ON s.id = ae.store_id
     JOIN marketplaces m ON m.id = s.marketplace_id
     LEFT JOIN ad_campaigns ac ON ac.id = ae.ad_campaign_id
     WHERE ae.deleted_at IS NULL AND ae.spent_at BETWEEN ? AND ?${clause}
     ORDER BY ae.spent_at DESC, ae.created_at DESC
     LIMIT 200`,
    params,
  );
}

export async function listAdCampaigns(db: Database, storeId: string | null = null): Promise<AdCampaign[]> {
  if (storeId) {
    return db.query<AdCampaign>(
      'SELECT * FROM ad_campaigns WHERE store_id = ? AND deleted_at IS NULL ORDER BY name COLLATE NOCASE',
      [storeId],
    );
  }

  return db.query<AdCampaign>('SELECT * FROM ad_campaigns WHERE deleted_at IS NULL ORDER BY name COLLATE NOCASE');
}

export async function createAdCampaign(
  db: Database,
  input: { store_id: string; name: string; platform: AdPlatform },
): Promise<AdCampaign> {
  if (!input.store_id) {
    throw new AppError('Pilih toko untuk kampanye iklan.');
  }

  const name = input.name.trim();

  if (name === '') {
    throw new AppError('Nama kampanye wajib diisi.');
  }

  if (!AD_PLATFORMS.includes(input.platform)) {
    throw new AppError('Platform iklan tidak dikenal.');
  }

  const id = newId();
  const now = nowIso();

  await db.transaction(async () => {
    await db.run(
      `INSERT INTO ad_campaigns (id, store_id, name, platform, active, created_at, updated_at)
       VALUES (?, ?, ?, ?, 1, ?, ?)`,
      [id, input.store_id, name, input.platform, now, now],
    );
    await recordAudit(db, {
      type: 'ad_campaign',
      id,
      storeId: input.store_id,
      event: 'created',
      summary: `Kampanye iklan ${name} dibuat`,
      after: { name, platform: input.platform, active: true },
    });
  });

  return (await db.query<AdCampaign>('SELECT * FROM ad_campaigns WHERE id = ?', [id]))[0];
}

export async function toggleAdCampaign(db: Database, campaignId: string): Promise<AdCampaign> {
  const campaign = (
    await db.query<AdCampaign>('SELECT * FROM ad_campaigns WHERE id = ? AND deleted_at IS NULL', [campaignId])
  )[0];

  if (!campaign) {
    throw new AppError('Kampanye tidak ditemukan.');
  }

  const active = campaign.active ? 0 : 1;

  await db.transaction(async () => {
    await db.run('UPDATE ad_campaigns SET active = ?, updated_at = ? WHERE id = ?', [active, nowIso(), campaignId]);
    await recordAudit(db, {
      type: 'ad_campaign',
      id: campaignId,
      storeId: campaign.store_id,
      event: 'updated',
      summary: active ? `Kampanye ${campaign.name} diaktifkan` : `Kampanye ${campaign.name} dinonaktifkan`,
      before: { active: campaign.active },
      after: { active },
    });
  });

  return (await db.query<AdCampaign>('SELECT * FROM ad_campaigns WHERE id = ?', [campaignId]))[0];
}

export async function saveAdExpense(
  db: Database,
  input: AdExpenseInput,
  expenseId: string | null = null,
): Promise<AdvertisingExpense> {
  if (!input.store_id) {
    throw new AppError('Pilih toko terlebih dahulu.');
  }

  const amount = parseRupiah(input.amount);

  if (amount <= 0) {
    throw new AppError('Nominal belanja iklan harus lebih dari nol.');
  }

  const spentAt = normalizeDate(input.spent_at);

  if (!/^\d{4}-\d{2}-\d{2}$/.test(spentAt)) {
    throw new AppError('Tanggal belanja iklan wajib diisi.');
  }

  await assertDateUnlocked(db, spentAt);

  if (input.ad_campaign_id) {
    const campaign = await db.query<{ id: string; store_id: string }>(
      'SELECT id, store_id FROM ad_campaigns WHERE id = ? AND deleted_at IS NULL',
      [input.ad_campaign_id],
    );

    if (campaign.length === 0 || campaign[0].store_id !== input.store_id) {
      throw new AppError('Kampanye tidak ditemukan pada toko ini.');
    }
  }

  const optionalInt = (value: number | string | null | undefined): number | null => {
    if (value === null || value === undefined || value === '') {
      return null;
    }

    const parsed = Number.parseInt(String(value), 10);

    return Number.isFinite(parsed) ? parsed : null;
  };

  const clicks = optionalInt(input.clicks);
  const impressions = optionalInt(input.impressions);
  const attributedOrders = optionalInt(input.attributed_orders);
  const attributedRevenue =
    input.attributed_revenue === null || input.attributed_revenue === undefined || input.attributed_revenue === ''
      ? null
      : parseRupiah(input.attributed_revenue);

  for (const [label, value] of [
    ['Klik', clicks],
    ['Impresi', impressions],
    ['Pesanan atribusi', attributedOrders],
    ['Omzet atribusi', attributedRevenue],
  ] as const) {
    if (value !== null && value < 0) {
      throw new AppError(`${label} tidak boleh negatif.`);
    }
  }

  const now = nowIso();
  const payload = [
    input.store_id,
    input.ad_campaign_id || null,
    spentAt,
    amount,
    clicks,
    impressions,
    attributedOrders,
    attributedRevenue,
    input.notes?.trim() || null,
  ];

  if (expenseId) {
    const before = (
      await db.query<AdvertisingExpense>(
        'SELECT * FROM advertising_expenses WHERE id = ? AND deleted_at IS NULL',
        [expenseId],
      )
    )[0];

    if (!before) {
      throw new AppError('Biaya iklan tidak ditemukan.');
    }

    await assertDateUnlocked(db, before.spent_at);

    await db.transaction(async () => {
      await db.run(
        `UPDATE advertising_expenses SET store_id = ?, ad_campaign_id = ?, spent_at = ?, amount = ?,
           clicks = ?, impressions = ?, attributed_orders = ?, attributed_revenue = ?, notes = ?, updated_at = ?
         WHERE id = ?`,
        [...payload, now, expenseId],
      );
      await recordAudit(db, {
        type: 'advertising_expense',
        id: expenseId,
        storeId: input.store_id,
        event: 'updated',
        summary: `Biaya iklan ${spentAt} diubah`,
        before: {
          spent_at: before.spent_at,
          amount: before.amount,
          clicks: before.clicks,
          impressions: before.impressions,
          attributed_orders: before.attributed_orders,
          attributed_revenue: before.attributed_revenue,
          notes: before.notes,
        },
        after: {
          spent_at: spentAt,
          amount,
          clicks,
          impressions,
          attributed_orders: attributedOrders,
          attributed_revenue: attributedRevenue,
          notes: input.notes ?? null,
        },
      });
    });

    return (await db.query<AdvertisingExpense>('SELECT * FROM advertising_expenses WHERE id = ?', [expenseId]))[0];
  }

  const id = newId();

  await db.transaction(async () => {
    await db.run(
      `INSERT INTO advertising_expenses
        (id, store_id, ad_campaign_id, spent_at, amount, clicks, impressions, attributed_orders,
         attributed_revenue, notes, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, ...payload, now, now],
    );
    await recordAudit(db, {
      type: 'advertising_expense',
      id,
      storeId: input.store_id,
      event: 'created',
      summary: `Biaya iklan ${spentAt} dicatat`,
      after: { spent_at: spentAt, amount, clicks, impressions, attributed_orders: attributedOrders, attributed_revenue: attributedRevenue },
    });
  });

  return (await db.query<AdvertisingExpense>('SELECT * FROM advertising_expenses WHERE id = ?', [id]))[0];
}

export async function getAdExpense(db: Database, expenseId: string): Promise<AdvertisingExpense | null> {
  const rows = await db.query<AdvertisingExpense>(
    'SELECT * FROM advertising_expenses WHERE id = ? AND deleted_at IS NULL',
    [expenseId],
  );

  return rows[0] ?? null;
}

export async function deleteAdExpense(db: Database, expenseId: string): Promise<void> {
  const expense = await getAdExpense(db, expenseId);

  if (!expense) {
    throw new AppError('Biaya iklan tidak ditemukan.');
  }

  await assertDateUnlocked(db, expense.spent_at);
  const now = nowIso();

  await db.transaction(async () => {
    await db.run('UPDATE advertising_expenses SET deleted_at = ?, updated_at = ? WHERE id = ?', [now, now, expenseId]);
    await recordAudit(db, {
      type: 'advertising_expense',
      id: expenseId,
      storeId: expense.store_id,
      event: 'deleted',
      summary: `Biaya iklan ${expense.spent_at} dihapus`,
      before: { spent_at: expense.spent_at, amount: expense.amount },
    });
  });
}
