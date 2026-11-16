import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Plus, Receipt, Search } from 'lucide-react';
import { Button, Card, EmptyState, LoadingCard, SearchInput, Select, StatusBadge } from '../components/ui';
import { queryKeys, useDbQuery } from '../hooks/queries';
import { listStores } from '../services/stores';
import { listOrders } from '../services/orders';
import { ORDER_STATUSES, ORDER_STATUS_LABELS, type OrderStatus } from '../lib/constants';
import { formatDate } from '../lib/date';
import { compactRupiah, formatInteger } from '../lib/money';

export default function OrdersPage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<OrderStatus | ''>('');
  const [storeId, setStoreId] = useState('');

  const storesQuery = useDbQuery(queryKeys.stores(), (db) => listStores(db));
  const ordersQuery = useDbQuery(
    queryKeys.orders(search, status, storeId),
    (db) =>
      listOrders(db, {
        search,
        status: status || null,
        storeId: storeId || null,
        limit: 300,
      }),
  );

  const orders = ordersQuery.data ?? [];
  const totalGross = useMemo(() => orders.reduce((sum, order) => sum + order.gross_revenue, 0), [orders]);

  return (
    <div className="space-y-4">
      <Card className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-primary-text">Transaksi</p>
            <p className="mt-1 font-heading text-2xl font-bold tabular-nums text-on-surface">{formatInteger(orders.length)}</p>
            <p className="text-[0.7rem] text-secondary">pesanan pada filter ini · {compactRupiah(totalGross)} omzet bruto</p>
          </div>
          <Button icon={Plus} onClick={() => navigate('/orders/create')}>
            Baru
          </Button>
        </div>
      </Card>

      <div className="space-y-2.5">
        <SearchInput value={search} onChange={setSearch} placeholder="Cari order ID atau nama toko…" />
        <div className="grid grid-cols-2 gap-2.5">
          <Select value={status} onChange={(event) => setStatus(event.target.value as OrderStatus | '')} aria-label="Filter status">
            <option value="">Semua status</option>
            {ORDER_STATUSES.map((value) => (
              <option key={value} value={value}>
                {ORDER_STATUS_LABELS[value]}
              </option>
            ))}
          </Select>
          <Select value={storeId} onChange={(event) => setStoreId(event.target.value)} aria-label="Filter toko">
            <option value="">Semua toko</option>
            {(storesQuery.data ?? []).map((store) => (
              <option key={store.id} value={store.id}>
                {store.name} · {store.marketplace_name}
              </option>
            ))}
          </Select>
        </div>
      </div>

      {ordersQuery.isLoading ? <LoadingCard rows={5} /> : null}

      {!ordersQuery.isLoading && orders.length === 0 ? (
        <EmptyState
          icon={search || status || storeId ? Search : Receipt}
          title={search || status || storeId ? 'Tidak ada pesanan yang cocok' : 'Belum ada pesanan'}
          description={
            search || status || storeId
              ? 'Ubah kata kunci atau filter status/toko.'
              : 'Catat pesanan manual atau impor file CSV/XLSX dari marketplace. Pesanan yang belum terkirim tetap tersimpan tetapi belum dihitung sebagai realisasi.'
          }
          action={
            <Button variant="secondary" icon={ArrowRight} onClick={() => navigate('/orders/create')}>
              Catat pesanan pertama
            </Button>
          }
        />
      ) : null}

      {orders.length > 0 ? (
        <div className="space-y-2">
          {orders.map((order) => {
            const net = order.gross_revenue - order.seller_discount - order.refund_total;

            return (
              <button
                key={order.id}
                type="button"
                onClick={() => navigate(`/orders/${order.id}`)}
                className="card flex w-full items-center gap-3 p-3.5 text-left transition active:scale-[0.995]"
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-primary-soft text-primary-text">
                  <Receipt className="h-5 w-5" aria-hidden />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2">
                    <span className="truncate text-xs font-semibold text-on-surface">{order.marketplace_order_id}</span>
                    <StatusBadge status={order.status} />
                  </span>
                  <span className="mt-1 block truncate text-[0.66rem] text-secondary">
                    {order.store_name} · {order.marketplace_name} · {formatDate(order.ordered_at)}
                  </span>
                </span>
                <span className="shrink-0 text-right">
                  <span className="block text-xs font-semibold tabular-nums text-on-surface">{compactRupiah(order.gross_revenue)}</span>
                  <span className="mt-0.5 block text-[0.62rem] tabular-nums text-secondary">neto {compactRupiah(net)}</span>
                </span>
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
