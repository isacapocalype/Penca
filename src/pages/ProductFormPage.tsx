import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Package, Save } from 'lucide-react';
import {
  Button,
  Card,
  Feedback,
  Field,
  LoadingCard,
  Select,
  Switch,
  TextArea,
  TextInput,
  useToast,
} from '../components/ui';
import { queryKeys, useDbQuery, useInvalidateAll } from '../hooks/queries';
import { getDb } from '../lib/db';
import { getProduct, saveProduct, setProductHpp } from '../services/products';
import { listStores } from '../services/stores';
import { errorMessage } from '../lib/errors';
import { parseRupiah, rupiah } from '../lib/money';
import { today } from '../lib/date';

interface ProductFormState {
  store_id: string;
  sku: string;
  name: string;
  sellingPrice: string;
  active: boolean;
  notes: string;
  initialHpp: string;
  hppEffectiveFrom: string;
}

export default function ProductFormPage() {
  const { id } = useParams<{ id: string }>();
  const editing = Boolean(id);
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const invalidateAll = useInvalidateAll();
  const { showToast } = useToast();
  const initialized = useRef(false);
  const [form, setForm] = useState<ProductFormState>({
    store_id: params.get('store') ?? '',
    sku: '',
    name: '',
    sellingPrice: '',
    active: true,
    notes: '',
    initialHpp: '',
    hppEffectiveFrom: today(),
  });
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const storesQuery = useDbQuery(queryKeys.stores(), (db) => listStores(db));
  const productQuery = useDbQuery(queryKeys.product(id ?? 'new'), (db) => (id ? getProduct(db, id) : Promise.resolve(null)), {
    enabled: editing,
  });

  useEffect(() => {
    if (initialized.current) {
      return;
    }

    if (editing) {
      if (productQuery.data) {
        setForm((current) => ({
          ...current,
          store_id: productQuery.data!.product.store_id,
          sku: productQuery.data!.product.sku,
          name: productQuery.data!.product.name,
          sellingPrice: String(productQuery.data!.product.selling_price),
          active: Boolean(productQuery.data!.product.active),
          notes: productQuery.data!.product.notes ?? '',
        }));
        initialized.current = true;
      }

      return;
    }

    if (storesQuery.data) {
      setForm((current) => ({
        ...current,
        store_id: current.store_id || (storesQuery.data![0]?.id ?? ''),
      }));
      initialized.current = true;
    }
  }, [editing, productQuery.data, storesQuery.data]);

  if (editing && productQuery.isLoading) {
    return <LoadingCard rows={6} />;
  }

  if (editing && !productQuery.isLoading && !productQuery.data) {
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

  const stores = storesQuery.data ?? [];
  const product = productQuery.data?.product;
  const currentHpp = productQuery.data?.currentHpp ?? null;

  const update = <Key extends keyof ProductFormState>(key: Key, value: ProductFormState[Key]) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const submit = async () => {
    setError(null);

    if (!form.store_id) {
      setError('Pilih toko terlebih dahulu.');
      return;
    }

    if (!form.sku.trim()) {
      setError('SKU wajib diisi.');
      return;
    }

    if (!form.name.trim()) {
      setError('Nama produk wajib diisi.');
      return;
    }

    const sellingPrice = parseRupiah(form.sellingPrice);

    if (sellingPrice < 0) {
      setError('Harga jual tidak boleh negatif.');
      return;
    }

    const initialHpp = form.initialHpp.trim() === '' ? null : parseRupiah(form.initialHpp);

    if (initialHpp !== null && initialHpp < 0) {
      setError('HPP tidak boleh negatif.');
      return;
    }

    setSaving(true);

    try {
      const saved = await saveProduct(
        getDb(),
        {
          store_id: form.store_id,
          sku: form.sku,
          name: form.name,
          selling_price: sellingPrice,
          active: form.active,
          notes: form.notes,
        },
        id ?? null,
      );

      if (!editing && initialHpp !== null) {
        await setProductHpp(getDb(), saved.id, {
          hpp_unit: initialHpp,
          effective_from: form.hppEffectiveFrom,
          notes: 'HPP awal saat produk dibuat',
        });
      }

      await invalidateAll();
      showToast(editing ? 'Perubahan produk disimpan.' : 'Produk baru dibuat.');
      navigate(`/products/${saved.id}`, { replace: true });
    } catch (caught) {
      setError(errorMessage(caught, 'Produk gagal disimpan.'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <Feedback error={error} onDismiss={() => setError(null)} />

      <Card className="space-y-3 p-4">
        <p className="font-heading text-base font-bold text-on-surface">Identitas produk</p>

        <Field label="Toko" required>
          <Select
            value={form.store_id}
            onChange={(event) => update('store_id', event.target.value)}
            disabled={editing}
          >
            <option value="">Pilih toko</option>
            {stores.map((store) => (
              <option key={store.id} value={store.id}>
                {store.name} · {store.marketplace_name}
              </option>
            ))}
          </Select>
        </Field>
        {editing ? (
          <p className="text-[0.68rem] text-secondary">
            Toko tidak dapat diubah agar SKU dan histori penjualan tetap konsisten.
          </p>
        ) : null}

        <Field label="SKU" required hint="SKU harus unik per toko, termasuk produk yang sudah dihapus.">
          <TextInput
            value={form.sku}
            onChange={(event) => update('sku', event.target.value.toUpperCase())}
            placeholder="KA-01"
            autoCapitalize="characters"
          />
        </Field>

        <Field label="Nama produk" required>
          <TextInput
            value={form.name}
            onChange={(event) => update('name', event.target.value)}
            placeholder="Kaos custom"
          />
        </Field>

        <Field label="Harga jual">
          <TextInput
            value={form.sellingPrice}
            onChange={(event) => update('sellingPrice', event.target.value)}
            placeholder="0"
            inputMode="numeric"
          />
        </Field>
        {form.sellingPrice ? (
          <p className="text-[0.68rem] text-muted">Terbaca sebagai {rupiah(parseRupiah(form.sellingPrice))}.</p>
        ) : null}

        <Field label="Catatan">
          <TextArea value={form.notes} onChange={(event) => update('notes', event.target.value)} placeholder="Opsional" />
        </Field>
      </Card>

      <Card className="p-4">
        <Switch
          checked={form.active}
          onChange={(checked) => update('active', checked)}
          label="Produk aktif"
          description="Produk nonaktif tidak muncul saat membuat pesanan baru."
        />
      </Card>

      {!editing ? (
        <Card className="space-y-3 p-4">
          <p className="font-heading text-base font-bold text-on-surface">HPP awal</p>
          <p className="text-[0.68rem] leading-relaxed text-secondary">
            Opsional. HPP disimpan sebagai riwayat; HPP dapat diubah kapan saja dari detail produk tanpa mengubah pesanan
            lama.
          </p>
          <Field label="HPP per unit">
            <TextInput
              value={form.initialHpp}
              onChange={(event) => update('initialHpp', event.target.value)}
              placeholder="0"
              inputMode="numeric"
            />
          </Field>
          <Field label="Berlaku sejak">
            <TextInput
              type="date"
              value={form.hppEffectiveFrom}
              onChange={(event) => update('hppEffectiveFrom', event.target.value)}
            />
          </Field>
        </Card>
      ) : (
        <Card className="space-y-1 p-4">
          <p className="text-sm font-semibold text-on-surface">HPP aktif</p>
          <p className="text-xs text-secondary">
            {currentHpp === null ? 'Belum ada HPP aktif. Tambahkan dari detail produk.' : rupiah(currentHpp)}
          </p>
          <p className="text-[0.65rem] text-muted">
            Mengubah HPP dilakukan di detail produk agar riwayat per tanggal tetap utuh.
          </p>
        </Card>
      )}

      <Button fullWidth size="lg" icon={Save} loading={saving} onClick={() => void submit()}>
        {editing ? 'Simpan perubahan' : 'Simpan produk'}
      </Button>
    </div>
  );
}
