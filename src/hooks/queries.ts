import { useQuery, useQueryClient, type QueryKey } from '@tanstack/react-query';
import { getDb } from '../lib/db';
import type { Database } from '../lib/db/types';

export function useDbQuery<T>(
  queryKey: QueryKey,
  queryFn: (db: Database) => Promise<T>,
  options: { enabled?: boolean } = {},
) {
  return useQuery({
    queryKey,
    queryFn: () => queryFn(getDb()),
    enabled: options.enabled ?? true,
  });
}

export function useInvalidateAll(): () => Promise<void> {
  const queryClient = useQueryClient();

  return async () => {
    await queryClient.invalidateQueries();
  };
}

export const queryKeys = {
  stores: (includeArchived = false) => ['stores', includeArchived] as const,
  storeItems: (search: string, status: string) => ['stores', 'items', search, status] as const,
  store: (id: string) => ['stores', 'detail', id] as const,
  products: (storeId: string, search: string, status: string) =>
    ['products', storeId, search, status] as const,
  product: (id: string) => ['products', 'detail', id] as const,
  orders: (search: string, status: string, storeId: string) =>
    ['orders', search, status, storeId] as const,
  order: (id: string) => ['orders', 'detail', id] as const,
  summary: (start: string, end: string, storeId: string) => ['summary', start, end, storeId] as const,
  topProducts: (start: string, end: string, storeId: string) =>
    ['summary', 'top-products', start, end, storeId] as const,
  taxes: (period: string, storeId: string) => ['taxes', period, storeId] as const,
  taxProfiles: (storeId: string) => ['taxes', 'profiles', storeId] as const,
  ads: (period: string, storeId: string) => ['ads', period, storeId] as const,
  adCampaigns: (storeId: string) => ['ads', 'campaigns', storeId] as const,
  adExpense: (id: string) => ['ads', 'expense', id] as const,
  operational: (period: string, storeId: string, general: boolean) =>
    ['operational', period, storeId, general] as const,
  operationalExpense: (id: string) => ['operational', 'detail', id] as const,
  backupHistory: () => ['backup', 'history'] as const,
  audit: (filter: string) => ['audit', filter] as const,
  settings: () => ['settings'] as const,
  periodLocks: () => ['period-locks'] as const,
  importErrors: (batchId: string) => ['import', 'errors', batchId] as const,
};
