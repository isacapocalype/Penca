/**
 * Skema SQLite Penca versi 1.
 *
 * Seluruh nominal disimpan sebagai INTEGER rupiah penuh. Persentase disimpan
 * sebagai basis poin (1100 = 11,00%). Tanggal disimpan sebagai YYYY-MM-DD dan
 * timestamp sebagai YYYY-MM-DD HH:MM:SS pada zona Asia/Jakarta.
 */
export const SCHEMA_VERSION = 1;

export const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS schema_migrations (
  version INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  applied_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS marketplaces (
  id TEXT PRIMARY KEY NOT NULL,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  color TEXT,
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS stores (
  id TEXT PRIMARY KEY NOT NULL,
  marketplace_id TEXT NOT NULL REFERENCES marketplaces(id) ON DELETE RESTRICT,
  name TEXT NOT NULL,
  username TEXT,
  url TEXT,
  code TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  notes TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT
);

CREATE UNIQUE INDEX IF NOT EXISTS stores_marketplace_code_unique
  ON stores(marketplace_id, lower(code));
CREATE INDEX IF NOT EXISTS stores_status_name_index ON stores(status, name);

CREATE TABLE IF NOT EXISTS tax_profiles (
  id TEXT PRIMARY KEY NOT NULL,
  store_id TEXT NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  pkp INTEGER NOT NULL DEFAULT 0,
  ppn_mode TEXT NOT NULL DEFAULT 'none',
  ppn_rate_bp INTEGER NOT NULL DEFAULT 1100,
  pph_rate_bp INTEGER NOT NULL DEFAULT 50,
  pph_basis TEXT NOT NULL DEFAULT 'gross',
  effective_from TEXT NOT NULL,
  effective_to TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (store_id, effective_from)
);

CREATE INDEX IF NOT EXISTS tax_profiles_store_date_index
  ON tax_profiles(store_id, effective_from, effective_to);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY NOT NULL,
  value TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS period_locks (
  id TEXT PRIMARY KEY NOT NULL,
  period TEXT NOT NULL UNIQUE,
  locked_at TEXT NOT NULL,
  locked_by TEXT,
  notes TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS products (
  id TEXT PRIMARY KEY NOT NULL,
  store_id TEXT NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  sku TEXT NOT NULL,
  name TEXT NOT NULL,
  selling_price INTEGER NOT NULL DEFAULT 0,
  active INTEGER NOT NULL DEFAULT 1,
  notes TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT
);

CREATE UNIQUE INDEX IF NOT EXISTS products_store_sku_unique
  ON products(store_id, lower(sku));
CREATE INDEX IF NOT EXISTS products_store_active_index ON products(store_id, active);

CREATE TABLE IF NOT EXISTS product_costs (
  id TEXT PRIMARY KEY NOT NULL,
  product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  hpp_unit INTEGER NOT NULL,
  effective_from TEXT NOT NULL,
  effective_to TEXT,
  notes TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (product_id, effective_from)
);

CREATE INDEX IF NOT EXISTS product_costs_product_date_index
  ON product_costs(product_id, effective_from, effective_to);

CREATE TABLE IF NOT EXISTS orders (
  id TEXT PRIMARY KEY NOT NULL,
  store_id TEXT NOT NULL REFERENCES stores(id) ON DELETE RESTRICT,
  marketplace_order_id TEXT NOT NULL,
  ordered_at TEXT NOT NULL,
  completed_at TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  gross_revenue INTEGER NOT NULL DEFAULT 0,
  seller_discount INTEGER NOT NULL DEFAULT 0,
  marketplace_discount INTEGER NOT NULL DEFAULT 0,
  hpp_total INTEGER NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT,
  UNIQUE (store_id, marketplace_order_id)
);

CREATE INDEX IF NOT EXISTS orders_store_ordered_index ON orders(store_id, ordered_at);
CREATE INDEX IF NOT EXISTS orders_status_ordered_index ON orders(status, ordered_at);

CREATE TABLE IF NOT EXISTS order_items (
  id TEXT PRIMARY KEY NOT NULL,
  order_id TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id TEXT REFERENCES products(id) ON DELETE SET NULL,
  sku TEXT NOT NULL,
  product_name TEXT NOT NULL,
  qty INTEGER NOT NULL,
  unit_price INTEGER NOT NULL,
  hpp_unit_snapshot INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT
);

CREATE INDEX IF NOT EXISTS order_items_order_index ON order_items(order_id);

CREATE TABLE IF NOT EXISTS marketplace_fee_categories (
  id TEXT PRIMARY KEY NOT NULL,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  default_basis TEXT NOT NULL DEFAULT 'gross',
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS marketplace_fees (
  id TEXT PRIMARY KEY NOT NULL,
  order_id TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  category_id TEXT REFERENCES marketplace_fee_categories(id) ON DELETE SET NULL,
  description TEXT NOT NULL,
  basis TEXT NOT NULL DEFAULT 'gross',
  basis_amount INTEGER NOT NULL DEFAULT 0,
  rate_bp INTEGER,
  amount INTEGER NOT NULL,
  borne_by TEXT NOT NULL DEFAULT 'seller',
  is_actual INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT
);

CREATE INDEX IF NOT EXISTS marketplace_fees_order_index ON marketplace_fees(order_id);

CREATE TABLE IF NOT EXISTS settlements (
  id TEXT PRIMARY KEY NOT NULL,
  store_id TEXT NOT NULL REFERENCES stores(id) ON DELETE RESTRICT,
  order_id TEXT REFERENCES orders(id) ON DELETE SET NULL,
  amount INTEGER NOT NULL,
  settled_at TEXT NOT NULL,
  reference TEXT,
  notes TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT
);

CREATE INDEX IF NOT EXISTS settlements_store_settled_index ON settlements(store_id, settled_at);

CREATE TABLE IF NOT EXISTS ad_campaigns (
  id TEXT PRIMARY KEY NOT NULL,
  store_id TEXT NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  platform TEXT NOT NULL DEFAULT 'shopee',
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT
);

CREATE INDEX IF NOT EXISTS ad_campaigns_store_platform_index ON ad_campaigns(store_id, platform);

CREATE TABLE IF NOT EXISTS advertising_expenses (
  id TEXT PRIMARY KEY NOT NULL,
  store_id TEXT NOT NULL REFERENCES stores(id) ON DELETE RESTRICT,
  ad_campaign_id TEXT REFERENCES ad_campaigns(id) ON DELETE SET NULL,
  spent_at TEXT NOT NULL,
  amount INTEGER NOT NULL,
  clicks INTEGER,
  impressions INTEGER,
  attributed_orders INTEGER,
  attributed_revenue INTEGER,
  notes TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT
);

CREATE INDEX IF NOT EXISTS advertising_expenses_store_spent_index
  ON advertising_expenses(store_id, spent_at);

CREATE TABLE IF NOT EXISTS operational_expenses (
  id TEXT PRIMARY KEY NOT NULL,
  store_id TEXT REFERENCES stores(id) ON DELETE SET NULL,
  spent_at TEXT NOT NULL,
  category TEXT NOT NULL,
  amount INTEGER NOT NULL,
  notes TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT
);

CREATE INDEX IF NOT EXISTS operational_expenses_store_spent_index ON operational_expenses(store_id, spent_at);
CREATE INDEX IF NOT EXISTS operational_expenses_spent_index ON operational_expenses(spent_at);

CREATE TABLE IF NOT EXISTS refunds (
  id TEXT PRIMARY KEY NOT NULL,
  order_id TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  refunded_at TEXT NOT NULL,
  amount INTEGER NOT NULL,
  reason TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT
);

CREATE UNIQUE INDEX IF NOT EXISTS refunds_order_unique
  ON refunds(order_id) WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS tax_entries (
  id TEXT PRIMARY KEY NOT NULL,
  store_id TEXT NOT NULL REFERENCES stores(id) ON DELETE RESTRICT,
  period TEXT NOT NULL,
  type TEXT NOT NULL,
  base_amount INTEGER NOT NULL DEFAULT 0,
  rate_bp INTEGER NOT NULL DEFAULT 0,
  amount INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'draft',
  reference TEXT,
  notes TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT
);

CREATE INDEX IF NOT EXISTS tax_entries_store_period_type_index
  ON tax_entries(store_id, period, type);

CREATE TABLE IF NOT EXISTS import_batches (
  id TEXT PRIMARY KEY NOT NULL,
  store_id TEXT NOT NULL REFERENCES stores(id) ON DELETE RESTRICT,
  file_name TEXT NOT NULL,
  file_hash TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'preview',
  column_mapping TEXT,
  rows_total INTEGER NOT NULL DEFAULT 0,
  rows_imported INTEGER NOT NULL DEFAULT 0,
  rows_failed INTEGER NOT NULL DEFAULT 0,
  rows_skipped INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (store_id, file_hash)
);

CREATE INDEX IF NOT EXISTS import_batches_store_created_index ON import_batches(store_id, created_at);

CREATE TABLE IF NOT EXISTS import_errors (
  id TEXT PRIMARY KEY NOT NULL,
  import_batch_id TEXT NOT NULL REFERENCES import_batches(id) ON DELETE CASCADE,
  row_number INTEGER NOT NULL,
  message TEXT NOT NULL,
  row_data TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS import_errors_batch_index ON import_errors(import_batch_id);

CREATE TABLE IF NOT EXISTS audit_logs (
  id TEXT PRIMARY KEY NOT NULL,
  auditable_type TEXT,
  auditable_id TEXT,
  store_id TEXT REFERENCES stores(id) ON DELETE SET NULL,
  event TEXT NOT NULL,
  summary TEXT NOT NULL,
  before_json TEXT,
  after_json TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS audit_logs_auditable_index ON audit_logs(auditable_type, auditable_id);
CREATE INDEX IF NOT EXISTS audit_logs_store_created_index ON audit_logs(store_id, created_at);

CREATE TABLE IF NOT EXISTS backups (
  id TEXT PRIMARY KEY NOT NULL,
  file_name TEXT NOT NULL,
  json_path TEXT NOT NULL,
  db_path TEXT,
  size INTEGER NOT NULL DEFAULT 0,
  schema_version INTEGER NOT NULL DEFAULT 1,
  checksum TEXT NOT NULL,
  reason TEXT NOT NULL DEFAULT 'manual',
  created_at TEXT NOT NULL,
  restored_at TEXT
);

CREATE INDEX IF NOT EXISTS backups_created_index ON backups(created_at);

CREATE TRIGGER IF NOT EXISTS order_items_qty_positive_insert BEFORE INSERT ON order_items
  WHEN NEW.qty <= 0 OR NEW.unit_price < 0 OR NEW.hpp_unit_snapshot < 0
  BEGIN SELECT RAISE(ABORT, 'qty dan nominal item pesanan tidak valid'); END;

CREATE TRIGGER IF NOT EXISTS order_items_qty_positive_update BEFORE UPDATE ON order_items
  WHEN NEW.qty <= 0 OR NEW.unit_price < 0 OR NEW.hpp_unit_snapshot < 0
  BEGIN SELECT RAISE(ABORT, 'qty dan nominal item pesanan tidak valid'); END;

CREATE TRIGGER IF NOT EXISTS orders_money_nonnegative_insert BEFORE INSERT ON orders
  WHEN NEW.gross_revenue < 0 OR NEW.seller_discount < 0 OR NEW.marketplace_discount < 0 OR NEW.hpp_total < 0
  BEGIN SELECT RAISE(ABORT, 'nominal pesanan tidak boleh negatif'); END;

CREATE TRIGGER IF NOT EXISTS orders_money_nonnegative_update BEFORE UPDATE ON orders
  WHEN NEW.gross_revenue < 0 OR NEW.seller_discount < 0 OR NEW.marketplace_discount < 0 OR NEW.hpp_total < 0
  BEGIN SELECT RAISE(ABORT, 'nominal pesanan tidak boleh negatif'); END;

CREATE TRIGGER IF NOT EXISTS fees_money_nonnegative_insert BEFORE INSERT ON marketplace_fees
  WHEN NEW.amount < 0 OR NEW.basis_amount < 0 OR (NEW.rate_bp IS NOT NULL AND (NEW.rate_bp < 0 OR NEW.rate_bp > 10000))
  BEGIN SELECT RAISE(ABORT, 'nominal atau tarif fee marketplace tidak valid'); END;

CREATE TRIGGER IF NOT EXISTS fees_money_nonnegative_update BEFORE UPDATE ON marketplace_fees
  WHEN NEW.amount < 0 OR NEW.basis_amount < 0 OR (NEW.rate_bp IS NOT NULL AND (NEW.rate_bp < 0 OR NEW.rate_bp > 10000))
  BEGIN SELECT RAISE(ABORT, 'nominal atau tarif fee marketplace tidak valid'); END;

CREATE TRIGGER IF NOT EXISTS ads_money_nonnegative_insert BEFORE INSERT ON advertising_expenses
  WHEN NEW.amount < 0
  BEGIN SELECT RAISE(ABORT, 'biaya iklan tidak boleh negatif'); END;

CREATE TRIGGER IF NOT EXISTS ads_money_nonnegative_update BEFORE UPDATE ON advertising_expenses
  WHEN NEW.amount < 0
  BEGIN SELECT RAISE(ABORT, 'biaya iklan tidak boleh negatif'); END;

CREATE TRIGGER IF NOT EXISTS operational_money_positive_insert BEFORE INSERT ON operational_expenses
  WHEN NEW.amount <= 0
  BEGIN SELECT RAISE(ABORT, 'biaya operasional harus lebih dari nol'); END;

CREATE TRIGGER IF NOT EXISTS operational_money_positive_update BEFORE UPDATE ON operational_expenses
  WHEN NEW.amount <= 0
  BEGIN SELECT RAISE(ABORT, 'biaya operasional harus lebih dari nol'); END;

CREATE TRIGGER IF NOT EXISTS refunds_amount_valid_insert BEFORE INSERT ON refunds
  WHEN NEW.amount <= 0 OR NEW.amount > (
    SELECT MAX(0, gross_revenue - seller_discount) FROM orders WHERE id = NEW.order_id
  )
  BEGIN SELECT RAISE(ABORT, 'refund harus lebih dari nol dan tidak melebihi nilai pesanan'); END;

CREATE TRIGGER IF NOT EXISTS refunds_amount_valid_update BEFORE UPDATE ON refunds
  WHEN NEW.amount <= 0 OR NEW.amount > (
    SELECT MAX(0, gross_revenue - seller_discount) FROM orders WHERE id = NEW.order_id
  )
  BEGIN SELECT RAISE(ABORT, 'refund harus lebih dari nol dan tidak melebihi nilai pesanan'); END;

CREATE TRIGGER IF NOT EXISTS product_costs_nonnegative_insert BEFORE INSERT ON product_costs
  WHEN NEW.hpp_unit < 0
  BEGIN SELECT RAISE(ABORT, 'HPP tidak boleh negatif'); END;

CREATE TRIGGER IF NOT EXISTS product_costs_nonnegative_update BEFORE UPDATE ON product_costs
  WHEN NEW.hpp_unit < 0
  BEGIN SELECT RAISE(ABORT, 'HPP tidak boleh negatif'); END;
`;

export const REFERENCE_IDS = {
  shopee: '01900000-0000-7000-8000-000000000001',
  tiktok: '01900000-0000-7000-8000-000000000002',
  feeAdmin: '01900000-0000-7000-8000-000000000101',
  feeService: '01900000-0000-7000-8000-000000000102',
  feeTransaction: '01900000-0000-7000-8000-000000000103',
  feePromotion: '01900000-0000-7000-8000-000000000104',
  feeCommission: '01900000-0000-7000-8000-000000000105',
  feeAffiliate: '01900000-0000-7000-8000-000000000106',
  feeOther: '01900000-0000-7000-8000-000000000107',
} as const;

export const SEED_SQL = `
INSERT OR IGNORE INTO marketplaces (id, code, name, color, active, created_at, updated_at) VALUES
  ('${REFERENCE_IDS.shopee}', 'shopee', 'Shopee', '#EE4D2D', 1, datetime('now', 'localtime'), datetime('now', 'localtime')),
  ('${REFERENCE_IDS.tiktok}', 'tiktok', 'TikTok Shop', '#1C1C1E', 1, datetime('now', 'localtime'), datetime('now', 'localtime'));

INSERT OR IGNORE INTO marketplace_fee_categories (id, code, name, default_basis, active, created_at, updated_at) VALUES
  ('${REFERENCE_IDS.feeAdmin}', 'admin', 'Biaya administrasi', 'gross', 1, datetime('now', 'localtime'), datetime('now', 'localtime')),
  ('${REFERENCE_IDS.feeService}', 'service', 'Biaya layanan', 'gross', 1, datetime('now', 'localtime'), datetime('now', 'localtime')),
  ('${REFERENCE_IDS.feeTransaction}', 'transaction', 'Biaya transaksi', 'gross', 1, datetime('now', 'localtime'), datetime('now', 'localtime')),
  ('${REFERENCE_IDS.feePromotion}', 'promotion', 'Biaya program promosi', 'gross', 1, datetime('now', 'localtime'), datetime('now', 'localtime')),
  ('${REFERENCE_IDS.feeCommission}', 'commission', 'Komisi marketplace', 'gross', 1, datetime('now', 'localtime'), datetime('now', 'localtime')),
  ('${REFERENCE_IDS.feeAffiliate}', 'affiliate', 'Komisi afiliasi', 'gross', 1, datetime('now', 'localtime'), datetime('now', 'localtime')),
  ('${REFERENCE_IDS.feeOther}', 'other', 'Biaya lain-lain', 'fixed', 1, datetime('now', 'localtime'), datetime('now', 'localtime'));

INSERT OR IGNORE INTO settings (key, value, created_at, updated_at) VALUES
  ('schema_version', '1', datetime('now', 'localtime'), datetime('now', 'localtime')),
  ('operator_name', '', datetime('now', 'localtime'), datetime('now', 'localtime')),
  ('ppn_default_bp', '1100', datetime('now', 'localtime'), datetime('now', 'localtime')),
  ('pph_default_bp', '50', datetime('now', 'localtime'), datetime('now', 'localtime')),
  ('auto_backup_enabled', '1', datetime('now', 'localtime'), datetime('now', 'localtime')),
  ('backup_retention', '10', datetime('now', 'localtime'), datetime('now', 'localtime')),
  ('last_auto_backup_at', '', datetime('now', 'localtime'), datetime('now', 'localtime'));
`;

export const ALL_TABLES = [
  'marketplaces',
  'marketplace_fee_categories',
  'stores',
  'tax_profiles',
  'settings',
  'period_locks',
  'products',
  'product_costs',
  'orders',
  'order_items',
  'marketplace_fees',
  'settlements',
  'ad_campaigns',
  'advertising_expenses',
  'operational_expenses',
  'refunds',
  'tax_entries',
  'import_batches',
  'import_errors',
  'audit_logs',
  'backups',
] as const;

export type TableName = (typeof ALL_TABLES)[number];
