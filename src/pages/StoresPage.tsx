import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Search, Store as StoreIcon } from 'lucide-react';
import { Button, Card, EmptyState, LoadingCard, SearchInput, Select, StoreStatusBadge } from '../components/ui';
import { queryKeys, useDbQuery } from '../hooks/queries';
import { listStoreItems } from '../services/stores';
import { STORE_STATUSES, STORE_STATUS_LABELS, type StoreStatus } from '../lib/constants';
import { formatInteger } from '../lib/money';

export default function StoresPage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<StoreStatus | ''>('');

  const storesQuery = useDbQuery(queryKeys.storeItems(search, status), (db) =>
    listStoreItems(db, search, status || null),
  );

  const stores = storesQuery.data ?? [];
  const activeCount = stores.filter((store) => store.status === 'active').length;

  return (
    <div className="space-y-4">
      <Card className="flex items-start justify-between gap-3 p-4">
        <div>
          <p className="text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-primary-text">Marketplace</p>
          <p className="mt-1 font-heading text-2xl font-bold tabular-nums text-on-surface">{formatInteger(stores.length)}</p>
          <p className="text-[0.7rem] text-secondary">
            toko pada filter ini · {formatInteger(activeCount)} aktif
          </p>
        </div>
        <Button icon={Plus} onClick={() => navigate('/stores/create')}>
          Tambah
        </Button>
      </Card>

      <div className="space-y-2.5">
        <SearchInput value={search} onChange={setSearch} placeholder="Cari nama, kode, atau username…" />
        <Select
          value={status}
          onChange={(event) => setStatus(event.target.value as StoreStatus | '')}
          aria-label="Filter status toko"
        >
          <option value="">Semua status</option>
          {STORE_STATUSES.map((value) => (
            <option key={value} value={value}>
              {STORE_STATUS_LABELS[value]}
            </option>
          ))}
        </Select>
      </div>

      {storesQuery.isLoading ? <LoadingCard rows={5} /> : null}

      {!storesQuery.isLoading && stores.length === 0 ? (
        <EmptyState
          icon={search || status ? Search : StoreIcon}
          title={search || status ? 'Tidak ada toko yang cocok' : 'Belum ada toko'}
          description={
            search || status
              ? 'Ubah kata kunci atau filter status.'
              : 'Tambahkan toko Shopee atau TikTok Shop untuk mulai mencatat pesanan, HPP, dan biaya.'
          }
          action={
            <Button variant="secondary" icon={Plus} onClick={() => navigate('/stores/create')}>
              Tambah toko
            </Button>
          }
        />
      ) : null}

      <div className="space-y-2">
        {stores.map((store) => (
          <button
            key={store.id}
            type="button"
            onClick={() => navigate(`/stores/${store.id}`)}
            className="card flex w-full items-start gap-3 p-4 text-left transition active:scale-[0.995]"
          >
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary-soft text-primary-text">
              <StoreIcon className="h-5 w-5" aria-hidden />
            </span>
            <span className="min-w-0 flex-1">
              <span className="flex items-center justify-between gap-2">
                <span className="truncate text-sm font-semibold text-on-surface">{store.name}</span>
                <StoreStatusBadge status={store.status} />
              </span>
              <span className="mt-0.5 block truncate text-[0.68rem] text-secondary">
                {store.marketplace_name} · {store.code}
                {store.username ? ` · @${store.username}` : ''}
              </span>
              <span className="mt-1 block text-[0.65rem] text-muted">
                {formatInteger(Number(store.product_count))} produk · {formatInteger(Number(store.order_count))} pesanan
              </span>
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
