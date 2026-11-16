import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowRight,
  Landmark,
  Package,
  Pencil,
  Percent,
  Plus,
  Receipt,
  Store as StoreIcon,
  Wallet,
} from 'lucide-react';
import {
  Button,
  Card,
  ConfirmDialog,
  EmptyState,
  LoadingCard,
  MetricRow,
  SectionTitle,
  StatCard,
  StoreStatusBadge,
  useToast,
} from '../components/ui';
import { queryKeys, useDbQuery, useInvalidateAll } from '../hooks/queries';
import { getDb } from '../lib/db';
import { getStore, setStoreStatus } from '../services/stores';
import { listProducts } from '../services/products';
import { listTaxProfiles } from '../services/taxes';
import { financialSummary } from '../services/summary';
import { formatDate, today } from '../lib/date';
import { compactRupiah, rupiah } from '../lib/money';
import { PPN_MODE_LABELS, PPH_BASIS_LABELS } from '../lib/constants';
import { errorMessage } from '../lib/errors';

export default function StoreDetailPage() {
  const { id = '' } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const invalidateAll = useInvalidateAll();
  const { showToast } = useToast();
  const [confirmArchive, setConfirmArchive] = useState(false);
  const [busy, setBusy] = useState(false);

  const storeQuery = useDbQuery(queryKeys.store(id), (db) => getStore(db, id));
  const profilesQuery = useDbQuery(queryKeys.taxProfiles(id), (db) => listTaxProfiles(db, id));
  const productsQuery = useDbQuery(
    ['stores', 'products', id] as const,
    (db) => listProducts(db, { storeId: id, limit: 8 }),
  );
  const lifetimeQuery = useDbQuery(['stores', 'lifetime', id] as const, async (db) => {
    const range = await db.query<{ start: string | null; end: string | null }>(
      'SELECT MIN(ordered_at) AS start, MAX(ordered_at) AS end FROM orders WHERE store_id = ? AND deleted_at IS NULL',
      [id],
    );

    if (!range[0]?.start) {
      return null;
    }

    return financialSummary(db, range[0].start, range[0].end ?? today(), id);
  });

  if (storeQuery.isLoading) {
    return <LoadingCard rows={6} />;
  }

  const store = storeQuery.data;

  if (!store) {
    return (
      <Card className="space-y-3 p-6 text-center">
        <StoreIcon className="mx-auto h-8 w-8 text-muted" aria-hidden />
        <p className="font-heading text-base font-bold text-on-surface">Toko tidak ditemukan</p>
        <p className="text-xs text-secondary">Toko mungkin sudah dihapus atau tautan tidak valid.</p>
        <Button variant="secondary" onClick={() => navigate('/stores')}>
          Kembali ke daftar toko
        </Button>
      </Card>
    );
  }

  const profile = profilesQuery.data?.[0] ?? null;
  const lifetime = lifetimeQuery.data;
  const products = productsQuery.data ?? [];

  const toggleStatus = async () => {
    setBusy(true);

    try {
      const next = store.status === 'archived' ? 'active' : 'archived';
      await setStoreStatus(getDb(), store.id, next);
      await invalidateAll();
      setConfirmArchive(false);
      showToast(next === 'archived' ? 'Toko diarsipkan.' : 'Toko diaktifkan kembali.');
    } catch (error) {
      showToast(errorMessage(error, 'Status toko gagal diubah.'), 'danger');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <Card className="space-y-2 overflow-hidden border-primary/30 bg-gradient-to-br from-primary-soft via-surface to-surface p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="truncate font-heading text-2xl font-bold text-on-surface">{store.name}</h2>
            <p className="mt-0.5 text-sm text-secondary">
              {store.marketplace_name} · {store.code}
            </p>
            {store.username ? <p className="text-xs text-secondary">@{store.username}</p> : null}
          </div>
          <StoreStatusBadge status={store.status} />
        </div>
        <p className="text-[0.68rem] text-secondary">
          {products.length} produk ditampilkan
          {lifetime ? ` · ${lifetime.orderCount} pesanan terkirim/selesai` : ''}
        </p>
        {store.url ? (
          <a
            href={store.url}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-[0.68rem] font-medium text-primary-text underline underline-offset-2"
          >
            Buka halaman toko <ArrowRight className="h-3 w-3" aria-hidden />
          </a>
        ) : null}
      </Card>

      {lifetime ? (
        <section>
          <SectionTitle title="Kinerja seluruh periode tercatat" hint="Hanya pesanan Terkirim/Selesai" />
          <div className="grid grid-cols-2 gap-2.5">
            <StatCard
              label="Omzet bruto"
              value={compactRupiah(lifetime.grossRevenue)}
              hint={`${lifetime.orderCount} pesanan`}
              icon={Receipt}
            />
            <StatCard
              label="Laba bersih"
              value={compactRupiah(lifetime.netProfit)}
              hint={`Margin ${(lifetime.marginBp / 100).toFixed(2)}%`}
              tone={lifetime.netProfit < 0 ? 'danger' : 'success'}
            />
            <StatCard label="HPP" value={compactRupiah(lifetime.hpp)} icon={Package} />
            <StatCard label="Fee marketplace" value={compactRupiah(lifetime.marketplaceFees)} icon={Landmark} />
            <StatCard label="Biaya iklan" value={compactRupiah(lifetime.advertising)} icon={Percent} />
            <StatCard label="Operasional" value={compactRupiah(lifetime.operational)} icon={Wallet} />
          </div>
        </section>
      ) : (
        <EmptyState
          icon={Receipt}
          title="Belum ada pesanan"
          description="Pesanan yang dicatat atau diimpor untuk toko ini akan muncul di sini."
          action={
            <Button size="sm" variant="secondary" icon={Plus} onClick={() => navigate('/orders/create')}>
              Catat pesanan
            </Button>
          }
        />
      )}

      <Card className="space-y-3 p-4">
        <div className="flex items-center justify-between gap-2">
          <div>
            <p className="font-heading text-base font-bold text-on-surface">Profil pajak aktif</p>
            <p className="text-[0.68rem] text-secondary">Berlaku per tanggal, bukan menimpa histori.</p>
          </div>
          <Button size="sm" variant="soft" onClick={() => navigate(`/taxes/profile/${store.id}`)}>
            Kelola
          </Button>
        </div>

        {profile ? (
          <div className="space-y-0.5">
            <MetricRow label="Status PKP" value={profile.pkp ? 'PKP' : 'Non-PKP'} />
            <MetricRow label="Mode PPN" value={PPN_MODE_LABELS[profile.ppn_mode]} />
            <MetricRow
              label="Tarif PPN / PPh Final"
              value={`${(profile.ppn_rate_bp / 100).toFixed(2)}% / ${(profile.pph_rate_bp / 100).toFixed(2)}%`}
            />
            <MetricRow label="Dasar PPh" value={PPH_BASIS_LABELS[profile.pph_basis]} />
            <p className="pt-1 text-[0.65rem] text-muted">Berlaku sejak {formatDate(profile.effective_from)}</p>
          </div>
        ) : (
          <p className="text-xs text-secondary">
            Belum ada profil pajak. Rekap pajak akan memakai tarif default pengaturan.
          </p>
        )}
      </Card>

      <Card className="space-y-3 p-4">
        <div className="flex items-center justify-between gap-2">
          <div>
            <p className="font-heading text-base font-bold text-on-surface">Produk</p>
            <p className="text-[0.68rem] text-secondary">HPP ditampilkan bila tersedia pada hari ini.</p>
          </div>
          <Button size="sm" variant="ghost" onClick={() => navigate(`/products?store=${store.id}`)}>
            Semua produk
          </Button>
        </div>

        {products.length === 0 ? (
          <p className="text-xs text-secondary">Belum ada produk untuk toko ini.</p>
        ) : (
          <div className="divide-y divide-outline/70">
            {products.map((product) => (
              <button
                key={product.id}
                type="button"
                onClick={() => navigate(`/products/${product.id}`)}
                className="flex w-full items-center justify-between gap-3 py-2.5 text-left"
              >
                <span className="min-w-0">
                  <span className="block truncate text-xs font-medium text-on-surface">
                    {product.sku} · {product.name}
                  </span>
                  <span className="mt-0.5 block text-[0.65rem] text-secondary">
                    Jual {rupiah(product.selling_price)} · HPP{' '}
                    {product.active_hpp === null ? 'belum ada' : rupiah(product.active_hpp)}
                  </span>
                </span>
                {!product.active ? <span className="text-[0.62rem] font-semibold text-muted">Nonaktif</span> : null}
              </button>
            ))}
          </div>
        )}
      </Card>

      {store.notes ? (
        <Card className="space-y-1 p-4">
          <p className="text-sm font-semibold text-on-surface">Catatan</p>
          <p className="text-xs leading-relaxed text-secondary">{store.notes}</p>
        </Card>
      ) : null}

      <div className="grid grid-cols-2 gap-2">
        <Button variant="secondary" icon={Receipt} onClick={() => navigate(`/orders?store=${store.id}`)}>
          Lihat pesanan
        </Button>
        <Button icon={Pencil} onClick={() => navigate(`/stores/${store.id}/edit`)}>
          Ubah toko
        </Button>
      </div>

      <Button
        fullWidth
        variant={store.status === 'archived' ? 'soft' : 'secondary'}
        onClick={() => setConfirmArchive(true)}
      >
        {store.status === 'archived' ? 'Aktifkan kembali toko' : 'Arsipkan toko'}
      </Button>

      <ConfirmDialog
        open={confirmArchive}
        title={store.status === 'archived' ? 'Aktifkan kembali toko ini?' : 'Arsipkan toko ini?'}
        description={
          store.status === 'archived'
            ? 'Toko akan muncul lagi di pilihan pesanan baru.'
            : 'Data historis tetap tersimpan. Toko arsip tidak muncul di pilihan pesanan baru.'
        }
        confirmLabel={store.status === 'archived' ? 'Aktifkan' : 'Arsipkan'}
        tone={store.status === 'archived' ? 'primary' : 'danger'}
        busy={busy}
        onConfirm={() => void toggleStatus()}
        onCancel={() => setConfirmArchive(false)}
      />
    </div>
  );
}
