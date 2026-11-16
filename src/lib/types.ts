import type {
  AdPlatform,
  FeeBasis,
  FeeBorne,
  OperationalCategory,
  OrderStatus,
  PphBasis,
  PpnMode,
  StoreStatus,
  TaxStatus,
  TaxType,
} from './constants';

export interface BaseRow {
  id: string;
  created_at: string;
  updated_at: string;
}

export interface Marketplace extends BaseRow {
  code: string;
  name: string;
  color: string | null;
  active: number;
}

export interface Store extends BaseRow {
  marketplace_id: string;
  name: string;
  username: string | null;
  url: string | null;
  code: string;
  status: StoreStatus;
  notes: string | null;
  deleted_at: string | null;
}

export interface StoreWithMarketplace extends Store {
  marketplace_name: string;
  marketplace_code: string;
}

export interface TaxProfile extends BaseRow {
  store_id: string;
  pkp: number;
  ppn_mode: PpnMode;
  ppn_rate_bp: number;
  pph_rate_bp: number;
  pph_basis: PphBasis;
  effective_from: string;
  effective_to: string | null;
}

export interface Setting {
  key: string;
  value: string | null;
  created_at: string;
  updated_at: string;
}

export interface PeriodLock extends BaseRow {
  period: string;
  locked_at: string;
  locked_by: string | null;
  notes: string | null;
}

export interface Product extends BaseRow {
  store_id: string;
  sku: string;
  name: string;
  selling_price: number;
  active: number;
  notes: string | null;
  deleted_at: string | null;
}

export interface ProductWithStore extends Product {
  store_name: string;
  marketplace_name: string;
}

export interface ProductCost extends BaseRow {
  product_id: string;
  hpp_unit: number;
  effective_from: string;
  effective_to: string | null;
  notes: string | null;
}

export interface Order extends BaseRow {
  store_id: string;
  marketplace_order_id: string;
  ordered_at: string;
  completed_at: string | null;
  status: OrderStatus;
  gross_revenue: number;
  seller_discount: number;
  marketplace_discount: number;
  hpp_total: number;
  notes: string | null;
  deleted_at: string | null;
}

export interface OrderWithStore extends Order {
  store_name: string;
  marketplace_name: string;
}

export interface OrderItem extends BaseRow {
  order_id: string;
  product_id: string | null;
  sku: string;
  product_name: string;
  qty: number;
  unit_price: number;
  hpp_unit_snapshot: number;
  deleted_at: string | null;
}

export interface MarketplaceFeeCategory extends BaseRow {
  code: string;
  name: string;
  default_basis: FeeBasis;
  active: number;
}

export interface MarketplaceFee extends BaseRow {
  order_id: string;
  category_id: string | null;
  description: string;
  basis: FeeBasis;
  basis_amount: number;
  rate_bp: number | null;
  amount: number;
  borne_by: FeeBorne;
  is_actual: number;
  deleted_at: string | null;
}

export interface Settlement extends BaseRow {
  store_id: string;
  order_id: string | null;
  amount: number;
  settled_at: string;
  reference: string | null;
  notes: string | null;
  deleted_at: string | null;
}

export interface AdCampaign extends BaseRow {
  store_id: string;
  name: string;
  platform: AdPlatform;
  active: number;
  deleted_at: string | null;
}

export interface AdvertisingExpense extends BaseRow {
  store_id: string;
  ad_campaign_id: string | null;
  spent_at: string;
  amount: number;
  clicks: number | null;
  impressions: number | null;
  attributed_orders: number | null;
  attributed_revenue: number | null;
  notes: string | null;
  deleted_at: string | null;
}

export interface AdvertisingExpenseWithStore extends AdvertisingExpense {
  store_name: string;
  marketplace_name: string;
  campaign_name: string | null;
  campaign_platform: AdPlatform | null;
}

export interface OperationalExpense extends BaseRow {
  store_id: string | null;
  spent_at: string;
  category: OperationalCategory;
  amount: number;
  notes: string | null;
  deleted_at: string | null;
}

export interface OperationalExpenseWithStore extends OperationalExpense {
  store_name: string | null;
}

export interface Refund extends BaseRow {
  order_id: string;
  refunded_at: string;
  amount: number;
  reason: string | null;
  deleted_at: string | null;
}

export interface TaxEntry extends BaseRow {
  store_id: string;
  period: string;
  type: TaxType;
  base_amount: number;
  rate_bp: number;
  amount: number;
  status: TaxStatus;
  reference: string | null;
  notes: string | null;
  deleted_at: string | null;
}

export interface TaxEntryWithStore extends TaxEntry {
  store_name: string;
}

export interface ImportBatch extends BaseRow {
  store_id: string;
  file_name: string;
  file_hash: string;
  status: string;
  column_mapping: string | null;
  rows_total: number;
  rows_imported: number;
  rows_failed: number;
  rows_skipped: number;
}

export interface ImportError extends BaseRow {
  import_batch_id: string;
  row_number: number;
  message: string;
  row_data: string | null;
}

export interface AuditLog {
  id: string;
  auditable_type: string | null;
  auditable_id: string | null;
  store_id: string | null;
  event: string;
  summary: string;
  before_json: string | null;
  after_json: string | null;
  created_at: string;
}

export interface AuditLogWithStore extends AuditLog {
  store_name: string | null;
}

export interface Backup {
  id: string;
  file_name: string;
  json_path: string;
  db_path: string | null;
  size: number;
  schema_version: number;
  checksum: string;
  reason: string;
  created_at: string;
  restored_at: string | null;
}

export interface DailySummary {
  date: string;
  gross: number;
  operating_profit: number;
  net_profit: number;
  orders: number;
}

export interface StoreSummary {
  store_id: string;
  name: string;
  marketplace: string;
  gross: number;
  orders: number;
  ads: number;
  fees: number;
  hpp: number;
  refunds: number;
  operating_profit: number;
  net_profit: number;
}

export interface FinancialSummary {
  start: string;
  end: string;
  storeId: string | null;
  storeName: string;
  grossRevenue: number;
  sellerDiscount: number;
  refunds: number;
  netRevenue: number;
  hpp: number;
  grossProfit: number;
  marketplaceFees: number;
  advertising: number;
  operational: number;
  operatingProfit: number;
  pphFinal: number;
  netProfit: number;
  marginBp: number;
  ppnOutput: number;
  ppnInput: number;
  ppnPayable: number;
  orderCount: number;
  itemsSold: number;
  settlementTotal: number;
  daily: DailySummary[];
  stores: StoreSummary[];
}

export interface TaxRecapStore {
  store_id: string;
  store_name: string;
  pkp: boolean;
  ppn_mode: PpnMode;
  ppn_rate_bp: number;
  pph_rate_bp: number;
  pph_basis: PphBasis;
  gross: number;
  net: number;
  ppn_output: number;
  ppn_input: number;
  ppn_payable: number;
  pph_final: number;
  orders: number;
}

export interface TaxRecap {
  period: string;
  periodLabel: string;
  storeId: string | null;
  grossRevenue: number;
  netRevenue: number;
  ppnOutput: number;
  ppnInput: number;
  ppnPayable: number;
  pphFinal: number;
  stores: TaxRecapStore[];
  entries: Array<TaxEntry & { store_name: string; type_label: string }>;
}

export interface TopProduct {
  sku: string;
  product_name: string;
  qty: number;
  revenue: number;
  hpp: number;
}

export interface OrderDetailData {
  order: OrderWithStore;
  items: OrderItem[];
  fees: MarketplaceFee[];
  refund: Refund | null;
  settlements: Settlement[];
}

export interface ProductDetailData {
  product: ProductWithStore;
  costs: ProductCost[];
  currentHpp: number | null;
  sales: { qty: number; revenue: number; hpp: number };
}
