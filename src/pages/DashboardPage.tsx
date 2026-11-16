import { useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  BarChart3,
  CircleDollarSign,
  Landmark,
  Package,
  Plus,
  Receipt,
  Store,
  TrendingUp,
} from 'lucide-react';
import { PeriodControls, usePeriodFilter } from '../components/filters';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  LoadingCard,
  MetricRow,
  SectionTitle,
  StatCard,
  StatusBadge,
  useToast,
} from '../components/ui';
import { useDbQuery, queryKeys, useInvalidateAll } from '../hooks/queries';
import { getDb } from '../lib/db';
import { listStores } from '../services/stores';
import { financialSummary, fillDailyGaps, summaryPeriodLabel } from '../services/summary';
import { listOrders } from '../services/orders';
import { autoBackupIfDue } from '../services/backup';
import { formatDate, TIMEZONE } from '../lib/date';
import { compactRupiah, formatDecimal, formatInteger, rupiah } from '../lib/money';
import dayjs from 'dayjs';

export default function DashboardPage() {
  const navigate = useNavigate();
  const filter = usePeriodFilter('this_month');
  const { showToast } = useToast();
  const invalidateAll = useInvalidateAll();
  const backupTried = useRef(false);

  const storesQuery = useDbQuery(queryKeys.stores(), (db) => listStores(db));
  const summaryQuery = useDbQuery(
    queryKeys.summary(filter.start, filter.end, filter.storeId),
    (db) => financialSummary(db, filter.start, filter.end, filter.storeId || null),
  );
  const recentQuery = useDbQuery(
    [...queryKeys.orders('', '', filter.storeId), 'recent'] as const,
    (db) => listOrders(db, { storeId: filter.storeId || null, limit: 5 }),
  );

  useEffect(() => {
    if (backupTried.current) {
      return;
    }

    backupTried.current = true;
    autoBackupIfDue(getDb())
      .then((backup) => {
        if (backup) {
          showToast('Backup otomatis harian dibuat.');
          void invalidateAll();
        }
      })
      .catch(() => {
        // Dashboard tetap dapat dipakai; pengguna bisa membuat backup manual.
      });
  }, [invalidateAll, showToast]);

  const summary = summaryQuery.data;
  const stores = storesQuery.data ?? [];
  const daily = useMemo(() => (summary ? fillDailyGaps(summary).slice(-31) : []), [summary]);
  const peak = Math.max(1, ...daily.map((day) => Math.max(0, day.gross)));
  const todayLabel = dayjs().tz(TIMEZONE).locale('id').format('dddd, D MMMM YYYY');

  if (storesQuery.isLoading || summaryQuery.isLoading) {
    return (
      <div className="space-y-3">
        <LoadingCard rows={4} />
        <LoadingCard rows={3} />
      </div>
    );
  }

  if (stores.length === 0) {
    return (
      <div className="space-y-4">
        <Card className="bg-gradient-to-br from-primary-soft via-surface to-surface p-5">
          <p className="text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-primary-text">Mulai dari sini</p>
          <h2 className="mt-1 font-heading text-2xl font-bold text-on-surface">Belum ada toko</h2>
          <p className="mt-1 max-w-sm text-xs leading-relaxed text-secondary">
            Tambahkan toko Shopee atau TikTok Shop terlebih dahulu. Setelah itu pesanan, HPP, pajak, dan laporan dapat
            dicatat tanpa koneksi internet.
          </p>
          <Button className="mt-4" icon={Store} onClick={() => navigate('/stores/create')}>
            Tambah toko pertama
          </Button>
        </Card>
        <EmptyState
          icon={Receipt}
          title="Data dimulai dari kosong"
          description="Penca tidak membuat angka contoh. Semua nominal yang tampil nanti berasal dari data yang Anda masukkan."
        />
      </div>
    );
  }

  if (!summary) {
    return <LoadingCard rows={4} />;
  }

  const marginTone = summary.netProfit < 0 ? 'danger' : 'success';

  return (
    <div className="space-y-4">
      <PeriodControls
        preset={filter.preset}
        onPresetChange={filter.setPreset}
        customStart={filter.customStart}
        customEnd={filter.customEnd}
        onCustomStartChange={filter.setCustomStart}
        onCustomEndChange={filter.setCustomEnd}
        storeId={filter.storeId}
        onStoreChange={filter.setStoreId}
        stores={stores}
      />

      <section className="overflow-hidden rounded-[1.75rem] border border-primary/30 bg-gradient-to-br from-primary-soft via-surface to-surface p-5 shadow-soft">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-primary-text">Laba bersih</p>
            <p className="mt-1 font-heading text-[2rem] font-bold leading-none tracking-tight tabular-nums text-on-surface">
              {rupiah(summary.netProfit)}
            </p>
            <p className="mt-2 text-[0.7rem] text-secondary">
              {summaryPeriodLabel(summary)} · {formatInteger(summary.orderCount)} pesanan
            </p>
          </div>
          <Badge tone={marginTone}>
            <TrendingUp className="h-3 w-3" aria-hidden />
            {formatDecimal(summary.marginBp / 100, 2)}%
          </Badge>
        </div>

        <div className="mt-4 grid grid-cols-3 gap-2">
          <div className="rounded-2xl bg-surface/80 p-2.5">
            <p className="text-[0.62rem] text-secondary">Omzet</p>
            <p className="mt-0.5 text-xs font-semibold tabular-nums text-on-surface">{compactRupiah(summary.grossRevenue)}</p>
          </div>
          <div className="rounded-2xl bg-surface/80 p-2.5">
            <p className="text-[0.62rem] text-secondary">Laba kotor</p>
            <p className="mt-0.5 text-xs font-semibold tabular-nums text-on-surface">{compactRupiah(summary.grossProfit)}</p>
          </div>
          <div className="rounded-2xl bg-surface/80 p-2.5">
            <p className="text-[0.62rem] text-secondary">Laba operasional</p>
            <p className="mt-0.5 text-xs font-semibold tabular-nums text-on-surface">{compactRupiah(summary.operatingProfit)}</p>
          </div>
        </div>
      </section>

      <div className="grid grid-cols-2 gap-2.5">
        <StatCard label="Omzet bruto" value={compactRupiah(summary.grossRevenue)} hint={`${formatInteger(summary.itemsSold)} produk terjual`} icon={CircleDollarSign} />
        <StatCard label="HPP" value={compactRupiah(summary.hpp)} hint="Snapshot HPP per item" icon={Package} />
        <StatCard label="Fee marketplace" value={compactRupiah(summary.marketplaceFees)} hint="Ditanggung penjual" icon={Landmark} />
        <StatCard
          label="PPN kurang bayar"
          value={compactRupiah(summary.ppnPayable)}
          hint={`Keluaran ${compactRupiah(summary.ppnOutput)}`}
          tone={summary.ppnPayable > 0 ? 'warning' : 'neutral'}
        />
      </div>

      <Card className="p-4">
        <SectionTitle
          title="Omzet harian"
          hint={daily.length > 0 ? `${formatDate(daily[0].date)} – ${formatDate(daily[daily.length - 1].date)}` : 'Belum ada data'}
          action={
            <Button size="sm" variant="ghost" icon={BarChart3} onClick={() => navigate('/reports')}>
              Laporan
            </Button>
          }
        />

        {daily.length === 0 ? (
          <p className="py-6 text-center text-xs text-secondary">Belum ada hari untuk ditampilkan.</p>
        ) : (
          <>
            <div className="flex h-28 items-end gap-1 pt-2">
              {daily.map((day) => (
                <div
                  key={day.date}
                  className="group relative flex h-full flex-1 items-end"
                  title={`${formatDate(day.date)} · ${rupiah(day.gross)}`}
                >
                  <div
                    className={day.gross > 0 ? 'w-full rounded-t bg-primary' : 'w-full rounded-t bg-outline'}
                    style={{ height: `${Math.max(day.gross > 0 ? 8 : 3, Math.round((Math.max(0, day.gross) / peak) * 100))}%` }}
                  />
                </div>
              ))}
            </div>
            <div className="mt-2 flex justify-between text-[0.62rem] text-muted">
              <span>{formatDate(daily[0].date)}</span>
              <span>{formatDate(daily[daily.length - 1].date)}</span>
            </div>
          </>
        )}

        <div className="mt-3 grid grid-cols-2 gap-2">
          <Button variant="soft" icon={Plus} onClick={() => navigate('/orders/create')}>
            Catat pesanan
          </Button>
          <Button variant="secondary" icon={ArrowRight} onClick={() => navigate('/orders')}>
            Semua pesanan
          </Button>
        </div>
      </Card>

      {summary.stores.length > 1 && !filter.storeId ? (
        <Card className="p-4">
          <SectionTitle title="Performa toko" hint="Laba bersih setelah PPh Final" />
          <div className="divide-y divide-outline/70">
            {summary.stores.slice(0, 4).map((store) => (
              <button
                key={store.store_id}
                type="button"
                onClick={() => navigate(`/stores/${store.store_id}`)}
                className="flex w-full items-center justify-between gap-3 py-2.5 text-left"
              >
                <div className="min-w-0">
                  <p className="truncate text-xs font-semibold text-on-surface">{store.name}</p>
                  <p className="text-[0.65rem] text-secondary">
                    {store.marketplace} · {formatInteger(store.orders)} pesanan
                  </p>
                </div>
                <p className={`shrink-0 text-xs font-semibold tabular-nums ${store.net_profit < 0 ? 'text-danger' : 'text-on-surface'}`}>
                  {compactRupiah(store.net_profit)}
                </p>
              </button>
            ))}
          </div>
        </Card>
      ) : null}

      <Card className="p-4">
        <SectionTitle
          title="Pesanan terbaru"
          action={
            <Button size="sm" variant="ghost" onClick={() => navigate('/orders')}>
              Lihat semua
            </Button>
          }
        />
        {recentQuery.data && recentQuery.data.length > 0 ? (
          <div className="divide-y divide-outline/70">
            {recentQuery.data.map((order) => (
              <button
                key={order.id}
                type="button"
                onClick={() => navigate(`/orders/${order.id}`)}
                className="flex w-full items-center justify-between gap-3 py-2.5 text-left"
              >
                <div className="min-w-0">
                  <p className="truncate text-xs font-semibold text-on-surface">{order.marketplace_order_id}</p>
                  <p className="mt-0.5 truncate text-[0.65rem] text-secondary">
                    {order.store_name} · {formatDate(order.ordered_at)}
                  </p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  <StatusBadge status={order.status} />
                  <span className="text-[0.68rem] font-medium tabular-nums text-secondary">{compactRupiah(order.gross_revenue)}</span>
                </div>
              </button>
            ))}
          </div>
        ) : (
          <EmptyState
            icon={Receipt}
            title="Belum ada pesanan"
            description="Pesanan yang dicatat atau diimpor akan muncul di sini."
            action={
              <Button size="sm" variant="secondary" onClick={() => navigate('/orders/create')}>
                Catat pesanan
              </Button>
            }
          />
        )}
      </Card>

      <Card className="p-4">
        <SectionTitle title="Ringkasan penting" hint="PPN tidak mengurangi laba; PPh Final mengurangi laba" />
        <MetricRow label="Pendapatan neto" value={rupiah(summary.netRevenue)} />
        <MetricRow label="Laba kotor" value={rupiah(summary.grossProfit)} />
        <MetricRow label="Laba operasional" value={rupiah(summary.operatingProfit)} />
        <MetricRow label="PPh Final" value={`− ${rupiah(summary.pphFinal)}`} tone="danger" />
        <MetricRow label="Laba bersih" value={rupiah(summary.netProfit)} strong />
      </Card>
    </div>
  );
}
