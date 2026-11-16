import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Package, Plus, Search } from 'lucide-react';
import { Button, Card, EmptyState, LoadingCard, SearchInput, Select } from '../components/ui';
import { queryKeys, useDbQuery } from '../hooks/queries';
import { listStores } from '../services/stores';
import { listProducts } from '../services/products';
import { rupiah } from '../lib/money';

export default function ProductsPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [search, setSearch] = useState('');
  const [storeId, setStoreId] = useState(params.get('store') ?? '');
  const [active, setActive] = useState<'' | '1' | '0'>('');

  const storesQuery = useDbQuery(queryKeys.stores(), (db) => listStores(db));
  const productsQuery = useDbQuery(
    ['products', storeId, search, active] as const,
    (db) =>
      listProducts(db, {
        storeId: storeId || null,
        search,
        active: active === '' ? null : active === '1',
        limit: 300,
      }),
  );

  const products = productsQuery.data ?? [];

  return (
    <div className="space-y-4">
      <Card className="flex items-start justify-between gap-3 p-4">
        <div>
          <p className="text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-primary-text">Katalog</p>
          <p className="mt-1 font-heading text-2xl font-bold tabular-nums text-on-surface">{products.length}</p>
          <p className="text-[0.7rem] text-secondary">produk pada filter ini</p>
        </div>
        <Button icon={Plus} onClick={() => navigate(`/products/create${storeId ? `?store=${storeId}` : ''}`)}>
          Tambah
        </Button>
      </Card>

      <div className="space-y-2.5">
        <SearchInput value={search} onChange={setSearch} placeholder="Cari SKU atau nama produk…" />
        <div className="grid grid-cols-2 gap-2.5">
          <Select value={storeId} onChange={(event) => setStoreId(event.target.value)} aria-label="Filter toko">
            <option value="">Semua toko</option>
            {(storesQuery.data ?? []).map((store) => (
              <option key={store.id} value={store.id}>
                {store.name} · {store.marketplace_name}
              </option>
            ))}
          </Select>
          <Select
            value={active}
            onChange={(event) => setActive(event.target.value as '' | '1' | '0')}
            aria-label="Filter status produk"
          >
            <option value="">Semua status</option>
            <option value="1">Aktif</option>
            <option value="0">Nonaktif</option>
          </Select>
        </div>
      </div>

      {productsQuery.isLoading ? <LoadingCard rows={5} /> : null}

      {!productsQuery.isLoading && products.length === 0 ? (
        <EmptyState
          icon={search || storeId || active ? Search : Package}
          title={search || storeId || active ? 'Tidak ada produk yang cocok' : 'Belum ada produk'}
          description={
            search || storeId || active
              ? 'Ubah kata kunci atau filter toko/status.'
              : 'Tambahkan produk beserta HPP agar setiap pesanan punya modal yang tercatat.'
          }
          action={
            <Button
              variant="secondary"
              icon={Plus}
              onClick={() => navigate(`/products/create${storeId ? `?store=${storeId}` : ''}`)}
            >
              Tambah produk
            </Button>
          }
        />
      ) : null}

      <div className="space-y-2">
        {products.map((product) => (
          <button
            key={product.id}
            type="button"
            onClick={() => navigate(`/products/${product.id}`)}
            className="card flex w-full items-start gap-3 p-4 text-left transition active:scale-[0.995]"
          >
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary-soft text-primary-text">
              <Package className="h-5 w-5" aria-hidden />
            </span>
            <span className="min-w-0 flex-1">
              <span className="flex items-center justify-between gap-2">
                <span className="truncate text-sm font-semibold text-on-surface">{product.name}</span>
                {!product.active ? (
                  <span className="shrink-0 text-[0.62rem] font-semibold text-muted">Nonaktif</span>
                ) : null}
              </span>
              <span className="mt-0.5 block truncate text-[0.68rem] text-secondary">
                {product.sku} · {product.store_name}
              </span>
              <span className="mt-1 flex items-center justify-between gap-2 text-[0.65rem]">
                <span className="text-secondary">Jual {rupiah(product.selling_price)}</span>
                <span className={product.active_hpp === null ? 'font-medium text-danger' : 'text-secondary'}>
                  {product.active_hpp === null ? 'HPP belum ada' : `HPP ${rupiah(product.active_hpp)}`}
                </span>
              </span>
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
