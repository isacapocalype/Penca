import type { Database } from '../lib/db/types';
import { REFERENCE_IDS } from '../lib/db/schema';
import { saveStore } from '../services/stores';
import { saveProduct, setProductHpp } from '../services/products';
import { createOrder, type OrderInput } from '../services/orders';
import { today } from '../lib/date';

let codeCounter = 0;

export async function makeStore(db: Database, name = 'Konveksi Amanah'): Promise<Awaited<ReturnType<typeof saveStore>>> {
  codeCounter += 1;

  return saveStore(db, {
    marketplace_id: REFERENCE_IDS.shopee,
    name,
    code: `T${codeCounter}`,
    status: 'active',
  });
}

export async function makeProduct(
  db: Database,
  storeId: string,
  options: {
    sku?: string;
    name?: string;
    sellingPrice?: number;
    hpp?: number;
    hppFrom?: string;
  } = {},
) {
  const product = await saveProduct(db, {
    store_id: storeId,
    sku: options.sku ?? 'KA-01',
    name: options.name ?? 'Kaos Custom',
    selling_price: options.sellingPrice ?? 100_000,
    active: true,
  });

  if (options.hpp !== undefined) {
    await setProductHpp(db, product.id, {
      hpp_unit: options.hpp,
      effective_from: options.hppFrom ?? today(),
    });
  }

  return product;
}

export async function makeOrder(
  db: Database,
  storeId: string,
  options: {
    marketplaceOrderId?: string;
    orderedAt?: string;
    completedAt?: string | null;
    status?: OrderInput['status'];
    sellerDiscount?: number;
    marketplaceDiscount?: number;
    qty?: number;
    unitPrice?: number;
    hppSnapshot?: number;
    sku?: string;
    productName?: string;
  } = {},
) {
  return createOrder(
    db,
    storeId,
    {
      marketplace_order_id: options.marketplaceOrderId ?? 'INV-001',
      ordered_at: options.orderedAt ?? today(),
      completed_at: options.completedAt ?? null,
      status: options.status ?? 'completed',
      seller_discount: options.sellerDiscount ?? 0,
      marketplace_discount: options.marketplaceDiscount ?? 0,
    },
    [
      {
        sku: options.sku ?? 'KA-01',
        product_name: options.productName ?? 'Kaos Custom',
        qty: options.qty ?? 1,
        unit_price: options.unitPrice ?? 100_000,
        hpp_unit_snapshot: options.hppSnapshot ?? 40_000,
      },
    ],
  );
}
