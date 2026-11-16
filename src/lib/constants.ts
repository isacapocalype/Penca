export const ORDER_STATUSES = [
  'pending',
  'processing',
  'shipped',
  'delivered',
  'completed',
  'cancelled',
  'returned',
  'refunded',
] as const;

export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  pending: 'Pending',
  processing: 'Diproses',
  shipped: 'Dikirim',
  delivered: 'Terkirim',
  completed: 'Selesai',
  cancelled: 'Batal',
  returned: 'Retur',
  refunded: 'Refund',
};

export const REALIZED_STATUSES: OrderStatus[] = ['delivered', 'completed'];

export const STORE_STATUSES = ['active', 'inactive', 'archived'] as const;
export type StoreStatus = (typeof STORE_STATUSES)[number];

export const STORE_STATUS_LABELS: Record<StoreStatus, string> = {
  active: 'Aktif',
  inactive: 'Nonaktif',
  archived: 'Diarsipkan',
};

export const TAX_TYPES = ['ppn_keluaran', 'ppn_masukan', 'pph_final'] as const;
export type TaxType = (typeof TAX_TYPES)[number];

export const TAX_TYPE_LABELS: Record<TaxType, string> = {
  ppn_keluaran: 'PPN Keluaran',
  ppn_masukan: 'PPN Masukan',
  pph_final: 'PPh Final',
};

export const TAX_STATUSES = ['draft', 'reported', 'paid'] as const;
export type TaxStatus = (typeof TAX_STATUSES)[number];

export const TAX_STATUS_LABELS: Record<TaxStatus, string> = {
  draft: 'Draft',
  reported: 'Dilaporkan',
  paid: 'Dibayar',
};

export const PPN_MODES = ['none', 'included', 'added'] as const;
export type PpnMode = (typeof PPN_MODES)[number];

export const PPN_MODE_LABELS: Record<PpnMode, string> = {
  none: 'Tidak memungut PPN',
  included: 'PPN termasuk harga',
  added: 'PPN ditambah di atas harga',
};

export const PPH_BASIS = ['gross', 'net'] as const;
export type PphBasis = (typeof PPH_BASIS)[number];

export const PPH_BASIS_LABELS: Record<PphBasis, string> = {
  gross: 'Omzet bruto',
  net: 'Pendapatan neto',
};

export const AD_PLATFORMS = ['shopee', 'tiktok'] as const;
export type AdPlatform = (typeof AD_PLATFORMS)[number];

export const AD_PLATFORM_LABELS: Record<AdPlatform, string> = {
  shopee: 'Shopee',
  tiktok: 'TikTok Shop',
};

export const FEE_BASES = ['gross', 'net', 'hpp', 'fixed'] as const;
export type FeeBasis = (typeof FEE_BASES)[number];

export const FEE_BASIS_LABELS: Record<FeeBasis, string> = {
  gross: 'Omzet bruto',
  net: 'Pendapatan neto',
  hpp: 'HPP',
  fixed: 'Nominal tetap',
};

export const FEE_BORNE = ['seller', 'marketplace'] as const;
export type FeeBorne = (typeof FEE_BORNE)[number];

export const FEE_BORNE_LABELS: Record<FeeBorne, string> = {
  seller: 'Ditanggung penjual',
  marketplace: 'Ditanggung marketplace',
};

export const OPERATIONAL_CATEGORIES = [
  'salary',
  'packing',
  'transport',
  'electricity',
  'warehouse',
  'other',
] as const;

export type OperationalCategory = (typeof OPERATIONAL_CATEGORIES)[number];

export const OPERATIONAL_CATEGORY_LABELS: Record<OperationalCategory, string> = {
  salary: 'Gaji karyawan',
  packing: 'Packing tambahan',
  transport: 'Transportasi',
  electricity: 'Listrik',
  warehouse: 'Gudang',
  other: 'Lain-lain',
};

export const AUDIT_EVENTS = ['created', 'updated', 'deleted', 'restored', 'locked', 'unlocked'] as const;
export type AuditEvent = (typeof AUDIT_EVENTS)[number];

export const AUDIT_EVENT_LABELS: Record<AuditEvent, string> = {
  created: 'Dibuat',
  updated: 'Diubah',
  deleted: 'Dihapus',
  restored: 'Restore',
  locked: 'Dikunci',
  unlocked: 'Dibuka',
};

export const ENTITY_TYPES = {
  store: 'Toko',
  tax_profile: 'Profil pajak',
  product: 'Produk',
  product_cost: 'HPP',
  order: 'Pesanan',
  order_item: 'Item pesanan',
  marketplace_fee: 'Fee marketplace',
  settlement: 'Pencairan',
  ad_campaign: 'Kampanye iklan',
  advertising_expense: 'Biaya iklan',
  operational_expense: 'Biaya operasional',
  refund: 'Refund',
  tax_entry: 'Entri pajak',
  period_lock: 'Kunci periode',
  import_batch: 'Batch import',
  backup: 'Backup',
  system: 'Sistem',
} as const;

export type EntityType = keyof typeof ENTITY_TYPES;

export const APP_VERSION = '2.0.0';
