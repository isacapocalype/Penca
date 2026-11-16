import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Package, Pencil, Plus, TrendingUp } from 'lucide-react';
import {
  Button,
  Card,
  EmptyState,
  Field,
  Feedback,
  LoadingCard,
  SectionTitle,
  StatCard,
  TextArea,
  TextInput,
  useToast,
} from '../components/ui';
import { queryKeys, useDbQuery, useInvalidateAll } from '../hooks/queries';
import { getDb } from '../lib/db';
import { getProduct, setProductHpp, toggleProductActive } from '../services/products';
import { errorMessage } from '../lib/errors';
import { formatDate, today } from '../lib/date';
import { parseRupiah, rupiah } from '../lib/money';

export default function ProductDetailPage() {
  const { id = '' } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const invalidateAll = useInvalidateAll();
  const { showToast } = useToast();
  const [showHppForm, setShowHppForm] = useState(false);
  const [hppUnit, setHppUnit] = useState('');
  const [hppDate, setHppDate] = useState(today());
  const [hppNotes, setHppNotes] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const productQuery = useDbQuery(queryKeys.product(id), (db) => getProduct(db, id));

  if (productQuery.isLoading) {
    return <LoadingCard rows={6} />;
  }

  const data = productQuery.data;

  if (!data) {
    return (
      <Card className="space-y-3 p-6 text-center">
        <Package className="mx-auto h-8 w-8 text-muted" aria-hidden />
        <p className="font-heading text-base font-bold text-on-surface">Produk tidak ditemukan</p>
        <p className="text-xs text-secondary">Produk mungkin sudah dihapus atau tautan tidak valid.</p>
        <Button variant="secondary" onClick={() => navigate('/products')}>
          Kembali ke daftar produk
        </Button>
      </Card>
    );
  }

  const { product, costs, currentHpp, sales } = data;

  const saveHpp = async () => {
    setError(null);

    if (hppUnit.trim() === '') {
      setError('HPP per unit wajib diisi.');
      return;
    }

    setBusy(true);

    try {
      await setProductHpp(getDb(), product.id, {
        hpp_unit: parseRupiah(hppUnit),
        effective_from: hppDate,
        notes: hppNotes,
      });
      await invalidateAll();
      setShowHppForm(false);
      setHppUnit('');
      setHppNotes('');
      showToast('Riwayat HPP disimpan.');
    } catch (caught) {
      setError(errorMessage(caught, 'HPP gagal disimpan.'));
    } finally {
      setBusy(false);
    }
  };

  const toggleActive = async () => {
    setBusy(true);

    try {
      await toggleProductActive(getDb(), product.id);
      await invalidateAll();
      showToast(product.active ? 'Produk dinonaktifkan.' : 'Produk diaktifkan.');
    } catch (caught) {
      showToast(errorMessage(caught, 'Status produk gagal diubah.'), 'danger');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <Feedback error={error} onDismiss={() => setError(null)} />

      <Card className="space-y-2 overflow-hidden border-primary/30 bg-gradient-to-br from-primary-soft via-surface to-surface p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="truncate font-heading text-2xl font-bold text-on-surface">{product.name}</h2>
            <p className="mt-0.5 text-sm text-secondary">
              {product.sku} · {product.store_name}
            </p>
            <p className="text-xs text-secondary">{product.marketplace_name}</p>
          </div>
          <span
            className={`shrink-0 rounded-full border px-2 py-0.5 text-[0.68rem] font-semibold ${
              product.active
                ? 'border-success/20 bg-success-soft text-success'
                : 'border-outline bg-surface-muted text-secondary'
            }`}
          >
            {product.active ? 'Aktif' : 'Nonaktif'}
          </span>
        </div>

        <div className="mt-2 grid grid-cols-2 gap-2">
          <div className="rounded-2xl bg-surface/80 p-3">
            <p className="text-[0.65rem] text-secondary">Harga jual</p>
            <p className="mt-0.5 font-heading text-lg font-bold tabular-nums text-on-surface">
              {rupiah(product.selling_price)}
            </p>
          </div>
          <div className="rounded-2xl bg-surface/80 p-3">
            <p className="text-[0.65rem] text-secondary">HPP aktif</p>
            <p
              className={`mt-0.5 font-heading text-lg font-bold tabular-nums ${
                currentHpp === null ? 'text-danger' : 'text-on-surface'
              }`}
            >
              {currentHpp === null ? 'Belum ada' : rupiah(currentHpp)}
            </p>
          </div>
        </div>

        {currentHpp !== null ? (
          <p className="text-[0.68rem] text-secondary">
            Laba kotor per unit {rupiah(product.selling_price - currentHpp)} sebelum diskon dan fee.
          </p>
        ) : null}
      </Card>

      <Card className="p-4">
        <SectionTitle title="Penjualan tercatat" hint="Dari snapshot HPP pada masing-masing pesanan" />
        {sales.qty === 0 ? (
          <p className="py-3 text-xs text-secondary">
            Produk ini belum muncul pada pesanan berstatus Terkirim atau Selesai.
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-2.5">
            <StatCard label="Unit terjual" value={String(sales.qty)} icon={Package} />
            <StatCard label="Omzet" value={rupiah(sales.revenue)} icon={TrendingUp} />
            <StatCard label="HPP tersnapshot" value={rupiah(sales.hpp)} />
            <StatCard label="Laba kotor" value={rupiah(sales.revenue - sales.hpp)} tone="success" />
          </div>
        )}
      </Card>

      <Card className="space-y-3 p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="font-heading text-base font-bold text-on-surface">Riwayat HPP</p>
            <p className="text-[0.68rem] text-secondary">Satu harga aktif per tanggal, tanpa tumpang tindih.</p>
          </div>
          <Button size="sm" variant="soft" onClick={() => setShowHppForm((value) => !value)}>
            {showHppForm ? 'Tutup' : 'Ubah HPP'}
          </Button>
        </div>

        {showHppForm ? (
          <div className="space-y-3 rounded-2xl bg-surface-muted p-3">
            <Field label="HPP per unit" required>
              <TextInput
                value={hppUnit}
                onChange={(event) => setHppUnit(event.target.value)}
                placeholder="0"
                inputMode="numeric"
              />
            </Field>
            <Field label="Berlaku sejak">
              <TextInput type="date" value={hppDate} onChange={(event) => setHppDate(event.target.value)} />
            </Field>
            <Field label="Catatan">
              <TextArea
                value={hppNotes}
                onChange={(event) => setHppNotes(event.target.value)}
                placeholder="Contoh: kenaikan harga kain"
              />
            </Field>
            <Button fullWidth icon={Plus} loading={busy} onClick={() => void saveHpp()}>
              Simpan HPP
            </Button>
          </div>
        ) : null}

        {costs.length === 0 ? (
          <p className="py-2 text-xs text-secondary">
            Belum ada riwayat HPP. Tambahkan HPP agar pesanan baru punya modal yang benar.
          </p>
        ) : (
          <div className="divide-y divide-outline/70">
            {costs.map((cost) => (
              <div key={cost.id} className="flex items-start justify-between gap-3 py-2.5">
                <div className="min-w-0">
                  <p className="text-sm font-semibold tabular-nums text-on-surface">{rupiah(cost.hpp_unit)}/unit</p>
                  <p className="mt-0.5 text-[0.65rem] text-secondary">
                    {formatDate(cost.effective_from)} – {cost.effective_to ? formatDate(cost.effective_to) : 'sekarang'}
                  </p>
                  {cost.notes ? <p className="text-[0.65rem] text-muted">{cost.notes}</p> : null}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {product.notes ? (
        <Card className="space-y-1 p-4">
          <p className="text-sm font-semibold text-on-surface">Catatan</p>
          <p className="text-xs leading-relaxed text-secondary">{product.notes}</p>
        </Card>
      ) : null}

      <EmptyState
        icon={Package}
        title="Riwayat pembelian bukan stok"
        description="Penca mencatat HPP dan penjualan, bukan jumlah stok fisik. Gunakan catatan terpisah bila perlu menghitung persediaan."
      />

      <div className="grid grid-cols-2 gap-2">
        <Button variant="secondary" loading={busy} onClick={() => void toggleActive()}>
          {product.active ? 'Nonaktifkan' : 'Aktifkan'}
        </Button>
        <Button icon={Pencil} onClick={() => navigate(`/products/${product.id}/edit`)}>
          Ubah produk
        </Button>
      </div>
    </div>
  );
}
