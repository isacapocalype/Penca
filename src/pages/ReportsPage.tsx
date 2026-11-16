import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  BarChart3,
  CircleDollarSign,
  Download,
  FileSpreadsheet,
  FileText,
  Landmark,
  Megaphone,
  Package,
  Percent,
  Share2,
  TrendingDown,
  TrendingUp,
  Wallet,
} from 'lucide-react';
import { PeriodControls, usePeriodFilter } from '../components/filters';
import {
  Badge,
  Button,
  Card,
  InfoNote,
  LoadingCard,
  MetricRow,
  SectionTitle,
  StatCard,
  useToast,
} from '../components/ui';
import { queryKeys, useDbQuery } from '../hooks/queries';
import { listStores } from '../services/stores';
import { fillDailyGaps, financialSummary, summaryPeriodLabel, topProducts } from '../services/summary';
import { exportReport, type ReportFormat } from '../services/reports';
import { shareStoredFile } from '../lib/files';
import { previousRange, formatDate, today, monthLabel } from '../lib/date';
import { compactRupiah, formatDecimal, formatInteger, rupiah } from '../lib/money';

export default function ReportsPage() {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const filter = usePeriodFilter('this_month');
  const [exporting, setExporting] = useState<ReportFormat | null>(null);

  const storesQuery = useDbQuery(queryKeys.stores(), (db) => listStores(db));
  const summaryQuery = useDbQuery(
    queryKeys.summary(filter.start, filter.end, filter.storeId),
    (db) => financialSummary(db, filter.start, filter.end, filter.storeId || null),
  );
  const previous = previousRange(filter.preset, filter.start, filter.end);
  const previousQuery = useDbQuery(
    [...queryKeys.summary(previous.start, previous.end, filter.storeId), 'previous'] as const,
    (db) => financialSummary(db, previous.start, previous.end, filter.storeId || null),
  );
  const topQuery = useDbQuery(
    queryKeys.topProducts(filter.start, filter.end, filter.storeId),
    (db) => topProducts(db, filter.start, filter.end, filter.storeId || null, 8),
  );

  const summary = summaryQuery.data;
  const daily = summary ? fillDailyGaps(summary) : [];
  const peak = Math.max(1, ...daily.map((day) => Math.max(0, day.gross)));
  const stores = storesQuery.data ?? [];
  const previousProfit = previousQuery.data?.netProfit ?? null;
  const profitDelta =
    summary && previousProfit !== null && previousProfit !== 0
      ? ((summary.netProfit - previousProfit) / Math.abs(previousProfit)) * 100
      : null;

  const runExport = async (format: ReportFormat) => {
    if (!summary) {
      return;
    }

    setExporting(format);

    try {
      const file = await exportReport(summary, format);
      const outcome = await shareStoredFile(file.path, `Laporan Penca ${summaryPeriodLabel(summary)}`, file.mime);

      if (outcome === 'cancelled') {
        showToast('Ekspor dibatalkan. File tetap tersimpan di penyimpanan aplikasi.', 'info');
      } else if (outcome === 'shared') {
        showToast(`File ${file.name} dibagikan.`);
      } else {
        showToast(`File ${file.name} diunduh.`);
      }
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Ekspor gagal.', 'danger');
    } finally {
      setExporting(null);
    }
  };

  if (summaryQuery.isLoading || storesQuery.isLoading) {
    return (
      <div className="space-y-3">
        <LoadingCard rows={3} />
        <LoadingCard rows={5} />
      </div>
    );
  }

  if (!summary) {
    return <LoadingCard rows={5} />;
  }

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

      <Card className="overflow-hidden border-primary/30 bg-gradient-to-br from-primary-soft via-surface to-surface p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-primary-text">Laba bersih</p>
            <p className="mt-1 font-heading text-[2rem] font-bold leading-none tracking-tight tabular-nums text-on-surface">
              {rupiah(summary.netProfit)}
            </p>
            <p className="mt-2 text-[0.7rem] text-secondary">
              {summaryPeriodLabel(summary)} · margin {formatDecimal(summary.marginBp / 100, 2)}%
            </p>
          </div>
          {profitDelta !== null ? (
            <Badge tone={profitDelta >= 0 ? 'success' : 'danger'}>
              {profitDelta >= 0 ? (
                <TrendingUp className="h-3 w-3" aria-hidden />
              ) : (
                <TrendingDown className="h-3 w-3" aria-hidden />
              )}
              {formatDecimal(Math.abs(profitDelta), 1)}%
            </Badge>
          ) : (
            <Badge tone="neutral">Tanpa pembanding</Badge>
          )}
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2">
          <div className="rounded-2xl bg-surface/80 p-3">
            <p className="text-[0.65rem] text-secondary">Pendapatan neto</p>
            <p className="mt-0.5 text-sm font-semibold tabular-nums text-on-surface">{compactRupiah(summary.netRevenue)}</p>
            <p className="text-[0.62rem] text-secondary">{formatInteger(summary.orderCount)} pesanan</p>
          </div>
          <div className="rounded-2xl bg-surface/80 p-3">
            <p className="text-[0.65rem] text-secondary">Omzet bruto</p>
            <p className="mt-0.5 text-sm font-semibold tabular-nums text-on-surface">{compactRupiah(summary.grossRevenue)}</p>
            <p className="text-[0.62rem] text-secondary">{formatInteger(summary.itemsSold)} produk terjual</p>
          </div>
        </div>

        {profitDelta === null ? (
          <p className="mt-3 text-[0.65rem] text-muted">
            Pembanding {formatDate(previous.start)} – {formatDate(previous.end)} belum punya laba, jadi persentase
            perubahan tidak dihitung.
          </p>
        ) : (
          <p className="mt-3 text-[0.65rem] text-muted">
            Dibanding {formatDate(previous.start)} – {formatDate(previous.end)} · laba sebelumnya{' '}
            {rupiah(previousProfit ?? 0)}
          </p>
        )}
      </Card>

      <div className="grid grid-cols-2 gap-2.5">
        <StatCard label="Diskon penjual" value={compactRupiah(summary.sellerDiscount)} icon={Landmark} />
        <StatCard label="Refund" value={compactRupiah(summary.refunds)} tone={summary.refunds > 0 ? 'danger' : 'neutral'} />
        <StatCard label="HPP" value={compactRupiah(summary.hpp)} hint="Snapshot per item" icon={Package} />
        <StatCard label="Laba kotor" value={compactRupiah(summary.grossProfit)} icon={CircleDollarSign} />
        <StatCard label="Fee marketplace" value={compactRupiah(summary.marketplaceFees)} icon={Landmark} />
        <StatCard label="Biaya iklan" value={compactRupiah(summary.advertising)} icon={Megaphone} />
        <StatCard label="Operasional" value={compactRupiah(summary.operational)} icon={Wallet} />
        <StatCard
          label="Laba operasional"
          value={compactRupiah(summary.operatingProfit)}
          tone={summary.operatingProfit < 0 ? 'danger' : 'success'}
        />
      </div>

      <Card className="p-4">
        <SectionTitle title="Pajak periode ini" hint="PPN bukan pengurang laba; PPh Final mengurangi laba" />
        <MetricRow label="PPN keluaran" value={rupiah(summary.ppnOutput)} />
        <MetricRow label="PPN masukan" value={rupiah(summary.ppnInput)} />
        <MetricRow label="PPN kurang bayar" value={rupiah(summary.ppnPayable)} />
        <MetricRow label="PPh Final" value={`− ${rupiah(summary.pphFinal)}`} tone="danger" />
        <Button className="mt-2" size="sm" variant="secondary" icon={Percent} onClick={() => navigate('/taxes')}>
          Buka rekap pajak
        </Button>
      </Card>

      <Card className="p-4">
        <SectionTitle
          title="Omzet per hari"
          hint={`${formatDate(summary.start)} – ${formatDate(summary.end)}`}
          action={<BarChart3 className="h-5 w-5 text-primary" aria-hidden />}
        />

        {daily.length === 0 || summary.orderCount === 0 ? (
          <p className="py-6 text-center text-xs text-secondary">Belum ada transaksi pada periode ini.</p>
        ) : (
          <div className="space-y-2.5">
            {daily.map((day) => (
              <div key={day.date} className="space-y-1">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-[0.68rem] text-secondary">{formatDate(day.date)}</span>
                  <span className="text-[0.68rem] text-on-surface">
                    {compactRupiah(day.gross)} · laba {compactRupiah(day.net_profit)}
                  </span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-surface-muted">
                  <div
                    className="h-2 rounded-full bg-primary"
                    style={{ width: `${Math.max(day.gross > 0 ? 2 : 0, Math.round((day.gross / peak) * 100))}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card className="p-4">
        <SectionTitle title="Performa toko" hint="Laba bersih setelah PPh Final" />
        {summary.stores.length === 0 ? (
          <p className="py-4 text-center text-xs text-secondary">Belum ada toko dengan transaksi pada periode ini.</p>
        ) : (
          <div className="space-y-2">
            {summary.stores.map((store) => (
              <button
                key={store.store_id}
                type="button"
                onClick={() => navigate(`/stores/${store.store_id}`)}
                className="w-full rounded-2xl bg-surface-muted p-3 text-left"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate text-xs font-semibold text-on-surface">{store.name}</span>
                  <span className="shrink-0 text-xs font-semibold tabular-nums text-on-surface">
                    {rupiah(store.net_profit)}
                  </span>
                </div>
                <p className="mt-0.5 text-[0.65rem] text-secondary">
                  {store.marketplace} · {formatInteger(store.orders)} pesanan · omzet {compactRupiah(store.gross)}
                </p>
              </button>
            ))}
          </div>
        )}
      </Card>

      <Card className="p-4">
        <SectionTitle title="Produk terlaris" hint="Berdasarkan omzet pesanan terkirim/selesai" />
        {(topQuery.data ?? []).length === 0 ? (
          <p className="py-4 text-center text-xs text-secondary">Belum ada produk terjual pada periode ini.</p>
        ) : (
          <div className="divide-y divide-outline/70">
            {topQuery.data!.map((product) => (
              <div key={`${product.sku}-${product.product_name}`} className="flex items-start justify-between gap-3 py-2.5">
                <div className="min-w-0">
                  <p className="truncate text-xs font-medium text-on-surface">
                    {product.sku} · {product.product_name}
                  </p>
                  <p className="mt-0.5 text-[0.65rem] text-secondary">
                    {formatInteger(product.qty)} unit · laba kotor {rupiah(product.revenue - product.hpp)}
                  </p>
                </div>
                <p className="shrink-0 text-xs font-semibold tabular-nums text-on-surface">{rupiah(product.revenue)}</p>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card className="space-y-3 p-4">
        <SectionTitle title="Ekspor laporan" hint="File dibuat dari data periode dan toko yang dipilih" />
        <div className="grid grid-cols-3 gap-2">
          <Button
            variant="secondary"
            icon={FileText}
            loading={exporting === 'csv'}
            disabled={exporting !== null}
            onClick={() => void runExport('csv')}
          >
            CSV
          </Button>
          <Button
            variant="secondary"
            icon={FileSpreadsheet}
            loading={exporting === 'xlsx'}
            disabled={exporting !== null}
            onClick={() => void runExport('xlsx')}
          >
            XLSX
          </Button>
          <Button
            variant="secondary"
            icon={Download}
            loading={exporting === 'pdf'}
            disabled={exporting !== null}
            onClick={() => void runExport('pdf')}
          >
            PDF
          </Button>
        </div>
        <div className="flex items-start gap-2 text-[0.68rem] leading-relaxed text-secondary">
          <Share2 className="mt-0.5 h-4 w-4 shrink-0 text-muted" aria-hidden />
          <span>
            Di perangkat, lembar berbagi sistem akan terbuka. Di browser, file diunduh atau dibagikan bila didukung.
            Semua file dibuat lokal dari database perangkat.
          </span>
        </div>
        <InfoNote>
          Pencairan marketplace ({rupiah(summary.settlementTotal)}) adalah kas aktual pada periode ini, bukan tambahan
          laba. Omzet hanya dihitung dari pesanan berstatus Terkirim atau Selesai.
        </InfoNote>
      </Card>

      <p className="px-1 text-center text-[0.65rem] text-muted">
        Data per {formatDate(today())} · {monthLabel(summary.start.slice(0, 7))} · zona waktu Asia/Jakarta
      </p>
    </div>
  );
}
