import type { Database } from '../lib/db/types';
import type {
  AdvertisingExpenseWithStore,
  FinancialSummary,
  MarketplaceFee,
  OperationalExpenseWithStore,
  Order,
  OrderItem,
  Refund,
  StoreSummary,
  StoreWithMarketplace,
  TaxProfile,
  TopProduct,
} from '../lib/types';
import { getSettingInt } from './settings';
import {
  grossProfit as calcGrossProfit,
  marginBasisPoints,
  netProfit as calcNetProfit,
  netRevenue as calcNetRevenue,
  operatingProfit as calcOperatingProfit,
  ppnAdded,
  ppnIncluded,
  pphFinal,
} from '../lib/financial';
import { datesBetween, periodFromDate, periodLabel } from '../lib/date';
import { REALIZED_STATUSES } from '../lib/constants';

interface RealizedOrder extends Order {
  store_name: string;
  marketplace_name: string;
}

interface TaxProfileRow extends TaxProfile {
  store_name: string;
}

export function taxProfileOn(profiles: TaxProfile[], date: string): TaxProfile | null {
  let match: TaxProfile | null = null;

  for (const profile of profiles) {
    if (profile.effective_from <= date && (profile.effective_to === null || profile.effective_to >= date)) {
      if (!match || profile.effective_from > match.effective_from) {
        match = profile;
      }
    }
  }

  return match;
}

export function outputPpn(profile: TaxProfile | null, net: number): number {
  if (!profile || !profile.pkp || profile.ppn_mode === 'none') {
    return 0;
  }

  return profile.ppn_mode === 'included'
    ? ppnIncluded(net, profile.ppn_rate_bp)
    : ppnAdded(net, profile.ppn_rate_bp);
}

export function pphForOrder(
  profile: TaxProfile | null,
  gross: number,
  net: number,
  defaultRateBp: number,
): number {
  const rate = profile?.pph_rate_bp ?? defaultRateBp;
  const basis = (profile?.pph_basis ?? 'gross') === 'net' ? net : gross;

  return pphFinal(Math.max(0, basis), rate);
}

async function loadProfiles(db: Database, storeIds: string[]): Promise<Map<string, TaxProfile[]>> {
  if (storeIds.length === 0) {
    return new Map();
  }

  const placeholders = storeIds.map(() => '?').join(', ');
  const rows = await db.query<TaxProfile>(
    `SELECT * FROM tax_profiles WHERE store_id IN (${placeholders}) ORDER BY effective_from`,
    storeIds,
  );
  const map = new Map<string, TaxProfile[]>();

  for (const row of rows) {
    const existing = map.get(row.store_id) ?? [];
    existing.push(row);
    map.set(row.store_id, existing);
  }

  return map;
}

export async function financialSummary(
  db: Database,
  start: string,
  end: string,
  storeId: string | null = null,
): Promise<FinancialSummary> {
  const store = storeId
    ? (await db.query<StoreWithMarketplace>(
        `SELECT s.*, m.name AS marketplace_name, m.code AS marketplace_code
         FROM stores s JOIN marketplaces m ON m.id = s.marketplace_id WHERE s.id = ?`,
        [storeId],
      ))[0]
    : null;

  const params: string[] = [start, end];
  let storeClause = '';

  if (storeId) {
    storeClause = ' AND o.store_id = ?';
    params.push(storeId);
  }

  const orders = await db.query<RealizedOrder>(
    `SELECT o.*, s.name AS store_name, m.name AS marketplace_name
     FROM orders o
     JOIN stores s ON s.id = o.store_id
     JOIN marketplaces m ON m.id = s.marketplace_id
     WHERE o.deleted_at IS NULL
       AND o.status IN ('delivered', 'completed')
       AND o.ordered_at BETWEEN ? AND ?${storeClause}
     ORDER BY o.ordered_at`,
    params,
  );

  const orderIds = orders.map((order) => order.id);

  const items = orderIds.length
    ? await db.query<OrderItem>(
        `SELECT * FROM order_items WHERE deleted_at IS NULL AND order_id IN (${orderIds.map(() => '?').join(', ')})`,
        orderIds,
      )
    : [];

  const fees = orderIds.length
    ? await db.query<MarketplaceFee>(
        `SELECT * FROM marketplace_fees WHERE deleted_at IS NULL AND order_id IN (${orderIds.map(() => '?').join(', ')})`,
        orderIds,
      )
    : [];

  const refunds = orderIds.length
    ? await db.query<Refund>(
        `SELECT * FROM refunds WHERE deleted_at IS NULL AND order_id IN (${orderIds.map(() => '?').join(', ')})`,
        orderIds,
      )
    : [];

  const itemsByOrder = new Map<string, OrderItem[]>();
  const feesByOrder = new Map<string, MarketplaceFee[]>();
  const refundByOrder = new Map<string, Refund>();

  for (const item of items) {
    const list = itemsByOrder.get(item.order_id) ?? [];
    list.push(item);
    itemsByOrder.set(item.order_id, list);
  }

  for (const fee of fees) {
    const list = feesByOrder.get(fee.order_id) ?? [];
    list.push(fee);
    feesByOrder.set(fee.order_id, list);
  }

  for (const refund of refunds) {
    refundByOrder.set(refund.order_id, refund);
  }

  const storeIds = [...new Set(orders.map((order) => order.store_id))];
  const profiles = await loadProfiles(db, storeIds);
  const defaultPph = await getSettingInt(db, 'pph_default_bp', 50);

  const adsParams: string[] = [start, end];
  let adsClause = '';

  if (storeId) {
    adsClause = ' AND ae.store_id = ?';
    adsParams.push(storeId);
  }

  const ads = await db.query<AdvertisingExpenseWithStore>(
    `SELECT ae.*, s.name AS store_name, m.name AS marketplace_name,
       ac.name AS campaign_name, ac.platform AS campaign_platform
     FROM advertising_expenses ae
     JOIN stores s ON s.id = ae.store_id
     JOIN marketplaces m ON m.id = s.marketplace_id
     LEFT JOIN ad_campaigns ac ON ac.id = ae.ad_campaign_id
     WHERE ae.deleted_at IS NULL AND ae.spent_at BETWEEN ? AND ?${adsClause}`,
    adsParams,
  );

  const opParams: string[] = [start, end];
  let opClause = '';

  if (storeId) {
    opClause = ' AND oe.store_id = ?';
    opParams.push(storeId);
  }

  const operational = await db.query<OperationalExpenseWithStore>(
    `SELECT oe.*, s.name AS store_name
     FROM operational_expenses oe
     LEFT JOIN stores s ON s.id = oe.store_id
     WHERE oe.deleted_at IS NULL AND oe.spent_at BETWEEN ? AND ?${opClause}`,
    opParams,
  );

  const totals = {
    gross: 0,
    seller_discount: 0,
    refunds: 0,
    hpp: 0,
    fees: 0,
    pph: 0,
    ppn_output: 0,
    items: 0,
  };

  const daily = new Map<string, { date: string; gross: number; operating_profit: number; net_profit: number; orders: number }>();
  const stores = new Map<string, StoreSummary>();

  const dailyRow = (date: string) => {
    let row = daily.get(date);

    if (!row) {
      row = { date, gross: 0, operating_profit: 0, net_profit: 0, orders: 0 };
      daily.set(date, row);
    }

    return row;
  };

  const storeRow = (key: string, name: string, marketplace: string) => {
    let row = stores.get(key);

    if (!row) {
      row = {
        store_id: key,
        name,
        marketplace,
        gross: 0,
        orders: 0,
        ads: 0,
        fees: 0,
        hpp: 0,
        refunds: 0,
        operating_profit: 0,
        net_profit: 0,
      };
      stores.set(key, row);
    }

    return row;
  };

  for (const order of orders) {
    const gross = order.gross_revenue;
    const discount = order.seller_discount;
    const hpp = order.hpp_total;
    const refund = refundByOrder.get(order.id)?.amount ?? 0;
    const feeRows = feesByOrder.get(order.id) ?? [];
    const sellerFees = feeRows
      .filter((fee) => fee.borne_by === 'seller')
      .reduce((sum, fee) => sum + fee.amount, 0);
    const net = calcNetRevenue(gross, discount, refund);
    const profile = taxProfileOn(profiles.get(order.store_id) ?? [], order.ordered_at);
    const ppnOutput = outputPpn(profile, net);
    const pph = pphForOrder(profile, gross, net, defaultPph);
    const operating = calcOperatingProfit(calcGrossProfit(net, hpp), sellerFees, 0, 0);

    totals.gross += gross;
    totals.seller_discount += discount;
    totals.refunds += refund;
    totals.hpp += hpp;
    totals.fees += sellerFees;
    totals.pph += pph;
    totals.ppn_output += ppnOutput;
    totals.items += (itemsByOrder.get(order.id) ?? []).reduce((sum, item) => sum + item.qty, 0);

    const day = dailyRow(order.ordered_at);
    day.gross += gross;
    day.operating_profit += operating;
    day.net_profit += operating - pph;
    day.orders += 1;

    const summary = storeRow(order.store_id, order.store_name, order.marketplace_name);
    summary.gross += gross;
    summary.orders += 1;
    summary.fees += sellerFees;
    summary.hpp += hpp;
    summary.refunds += refund;
    summary.operating_profit += operating;
    summary.net_profit += operating - pph;
  }

  for (const expense of ads) {
    const day = dailyRow(expense.spent_at);
    day.operating_profit -= expense.amount;
    day.net_profit -= expense.amount;

    const summary = storeRow(expense.store_id, expense.store_name, expense.marketplace_name);
    summary.ads += expense.amount;
    summary.operating_profit -= expense.amount;
    summary.net_profit -= expense.amount;
  }

  for (const expense of operational) {
    const day = dailyRow(expense.spent_at);
    day.operating_profit -= expense.amount;
    day.net_profit -= expense.amount;

    if (expense.store_id && stores.has(expense.store_id)) {
      const summary = stores.get(expense.store_id)!;
      summary.operating_profit -= expense.amount;
      summary.net_profit -= expense.amount;
    }
  }

  const startPeriod = start.slice(0, 7);
  const endPeriod = end.slice(0, 7);
  const ppnParams: string[] = [startPeriod, endPeriod];
  let ppnClause = '';

  if (storeId) {
    ppnClause = ' AND store_id = ?';
    ppnParams.push(storeId);
  }

  const ppnInputRows = await db.query<{ total: number }>(
    `SELECT COALESCE(SUM(amount), 0) AS total FROM tax_entries
     WHERE deleted_at IS NULL AND type = 'ppn_masukan' AND period BETWEEN ? AND ?${ppnClause}`,
    ppnParams,
  );

  const settlementParams: string[] = [start, end];
  let settlementClause = '';

  if (storeId) {
    settlementClause = ' AND store_id = ?';
    settlementParams.push(storeId);
  }

  const settlementRows = await db.query<{ total: number }>(
    `SELECT COALESCE(SUM(amount), 0) AS total FROM settlements
     WHERE deleted_at IS NULL AND settled_at BETWEEN ? AND ?${settlementClause}`,
    settlementParams,
  );

  const netRevenue = calcNetRevenue(totals.gross, totals.seller_discount, totals.refunds);
  const grossProfit = calcGrossProfit(netRevenue, totals.hpp);
  const advertising = ads.reduce((sum, expense) => sum + expense.amount, 0);
  const operationalTotal = operational.reduce((sum, expense) => sum + expense.amount, 0);
  const operatingProfit = calcOperatingProfit(grossProfit, totals.fees, advertising, operationalTotal);
  const netProfit = calcNetProfit(operatingProfit, totals.pph);
  const ppnInput = Number(ppnInputRows[0]?.total ?? 0);

  return {
    start,
    end,
    storeId,
    storeName: store?.name ?? 'Semua Toko',
    grossRevenue: totals.gross,
    sellerDiscount: totals.seller_discount,
    refunds: totals.refunds,
    netRevenue,
    hpp: totals.hpp,
    grossProfit,
    marketplaceFees: totals.fees,
    advertising,
    operational: operationalTotal,
    operatingProfit,
    pphFinal: totals.pph,
    netProfit,
    marginBp: marginBasisPoints(netProfit, netRevenue),
    ppnOutput: totals.ppn_output,
    ppnInput,
    ppnPayable: totals.ppn_output - ppnInput,
    orderCount: orders.length,
    itemsSold: totals.items,
    settlementTotal: Number(settlementRows[0]?.total ?? 0),
    daily: [...daily.values()].sort((a, b) => a.date.localeCompare(b.date)),
    stores: [...stores.values()].sort((a, b) => a.name.localeCompare(b.name)),
  };
}

export async function topProducts(
  db: Database,
  start: string,
  end: string,
  storeId: string | null = null,
  limit = 8,
): Promise<TopProduct[]> {
  const params: Array<string | number> = [start, end];
  let storeClause = '';

  if (storeId) {
    storeClause = ' AND o.store_id = ?';
    params.push(storeId);
  }

  params.push(limit);

  const rows = await db.query<{ sku: string; product_name: string; qty: number; revenue: number; hpp: number }>(
    `SELECT oi.sku, oi.product_name,
       COALESCE(SUM(oi.qty), 0) AS qty,
       COALESCE(SUM(oi.qty * oi.unit_price), 0) AS revenue,
       COALESCE(SUM(oi.qty * oi.hpp_unit_snapshot), 0) AS hpp
     FROM order_items oi
     JOIN orders o ON o.id = oi.order_id
     WHERE o.deleted_at IS NULL AND oi.deleted_at IS NULL
       AND o.status IN ('delivered', 'completed')
       AND o.ordered_at BETWEEN ? AND ?${storeClause}
     GROUP BY oi.sku, oi.product_name
     ORDER BY revenue DESC
     LIMIT ?`,
    params,
  );

  return rows.map((row) => ({
    sku: row.sku,
    product_name: row.product_name,
    qty: Number(row.qty),
    revenue: Number(row.revenue),
    hpp: Number(row.hpp),
  }));
}

export function summaryPeriodLabel(summary: Pick<FinancialSummary, 'start' | 'end'>): string {
  return periodLabel(summary.start, summary.end);
}

export function fillDailyGaps(summary: FinancialSummary): FinancialSummary['daily'] {
  const existing = new Map(summary.daily.map((row) => [row.date, row]));

  return datesBetween(summary.start, summary.end).map(
    (date) => existing.get(date) ?? { date, gross: 0, operating_profit: 0, net_profit: 0, orders: 0 },
  );
}

export function realizedStatusesSql(): string {
  return REALIZED_STATUSES.map((status) => `'${status}'`).join(', ');
}
