import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { AlertTriangle, Plus, Receipt, Save, Trash2 } from 'lucide-react';
import {
  Button,
  Card,
  Feedback,
  Field,
  LoadingCard,
  Select,
  TextArea,
  TextInput,
  useToast,
} from '../components/ui';
import { queryKeys, useDbQuery, useInvalidateAll } from '../hooks/queries';
import { getDb } from '../lib/db';
import { listStores } from '../services/stores';
import { listActiveProductsForStore, type ProductListItem } from '../services/products';
import { addOrderFee, createOrder, getOrderDetail, updateOrder, type OrderItemInput } from '../services/orders';
import { ORDER_STATUSES, ORDER_STATUS_LABELS, type OrderStatus, type FeeBorne } from '../lib/constants';
import { errorMessage } from '../lib/errors';
import { parseRupiah, rupiah } from '../lib/money';
import { today } from '../lib/date';

interface ItemDraft {
  key: string;
  product_id: string | null;
  sku: string;
  product_name: string;
  qty: string;
  unit_price: string;
  hpp_unit_snapshot: string;
}

interface FeeDraft {
  key: string;
  description: string;
  amount: string;
  borne_by: FeeBorne;
}

interface OrderFormState {
  store_id: string;
  marketplace_order_id: string;
  ordered_at: string;
  completed_at: string;
  status: OrderStatus;
  seller_discount: string;
  marketplace_discount: string;
  notes: string;
}

const NEW_ITEM = {
  productId: '',
  sku: '',
  name: '',
  qty: '1',
  price: '',
  hpp: '',
};

function draftKey(): string {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export default function OrderFormPage() {
  const { id } = useParams<{ id: string }>();
  const editing = Boolean(id);
  const navigate = useNavigate();
  const invalidateAll = useInvalidateAll();
  const { showToast } = useToast();
  const initialized = useRef(false);
  const [form, setForm] = useState<OrderFormState>({
    store_id: '',
    marketplace_order_id: '',
    ordered_at: today(),
    completed_at: '',
    status: 'completed',
    seller_discount: '',
    marketplace_discount: '',
    notes: '',
  });
  const [items, setItems] = useState<ItemDraft[]>([]);
  const [fees, setFees] = useState<FeeDraft[]>([]);
  const [feeForm, setFeeForm] = useState({ description: '', amount: '', borne_by: 'seller' as FeeBorne });
  const [showFeeForm, setShowFeeForm] = useState(false);
  const [draft, setDraft] = useState(NEW_ITEM);
  const [error, setError] = useState<string | null>(null);
  const [itemError, setItemError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const storesQuery = useDbQuery(queryKeys.stores(), (db) => listStores(db));
  const orderQuery = useDbQuery(queryKeys.order(id ?? 'new'), (db) => (id ? getOrderDetail(db, id) : Promise.resolve(null)), {
    enabled: editing,
  });
  const productsQuery = useDbQuery(
    ['order-form-products', form.store_id] as const,
    (db) => (form.store_id ? listActiveProductsForStore(db, form.store_id) : Promise.resolve([])),
    { enabled: Boolean(form.store_id) },
  );

  useEffect(() => {
    if (initialized.current) {
      return;
    }

    if (editing) {
      if (orderQuery.data) {
        const { order, items: orderItems } = orderQuery.data;
        setForm({
          store_id: order.store_id,
          marketplace_order_id: order.marketplace_order_id,
          ordered_at: order.ordered_at,
          completed_at: order.completed_at ?? '',
          status: order.status,
          seller_discount: String(order.seller_discount || ''),
          marketplace_discount: String(order.marketplace_discount || ''),
          notes: order.notes ?? '',
        });
        setItems(
          orderItems.map((item) => ({
            key: item.id,
            product_id: item.product_id,
            sku: item.sku,
            product_name: item.product_name,
            qty: String(item.qty),
            unit_price: String(item.unit_price),
            hpp_unit_snapshot: String(item.hpp_unit_snapshot),
          })),
        );
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
  }, [editing, orderQuery.data, storesQuery.data]);

  if (editing && orderQuery.isLoading) {
    return <LoadingCard rows={7} />;
  }

  if (editing && !orderQuery.isLoading && !orderQuery.data) {
    return (
      <Card className="space-y-3 p-6 text-center">
        <Receipt className="mx-auto h-8 w-8 text-muted" aria-hidden />
        <p className="font-heading text-base font-bold text-on-surface">Pesanan tidak ditemukan</p>
        <p className="text-xs text-secondary">Pesanan mungkin sudah dihapus atau tautan tidak valid.</p>
        <Button variant="secondary" onClick={() => navigate('/orders')}>
          Kembali ke daftar pesanan
        </Button>
      </Card>
    );
  }

  const stores = storesQuery.data ?? [];
  const products = productsQuery.data ?? [];

  const update = <Key extends keyof OrderFormState>(key: Key, value: OrderFormState[Key]) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const changeStore = (storeId: string) => {
    update('store_id', storeId);

    if (!editing) {
      setItems([]);
      setDraft(NEW_ITEM);
      setFees([]);
      setItemError(null);
    }
  };

  const pickProduct = (productId: string) => {
    const product = products.find((row) => row.id === productId);

    if (!product) {
      setDraft({ ...NEW_ITEM, qty: draft.qty });
      return;
    }

    setDraft({
      productId: product.id,
      sku: product.sku,
      name: product.name,
      qty: draft.qty || '1',
      price: String(product.selling_price),
      hpp: '',
    });
  };

  const addItem = () => {
    setItemError(null);

    if (!draft.sku.trim()) {
      setItemError('SKU item wajib diisi.');
      return;
    }

    if (!draft.name.trim()) {
      setItemError('Nama produk item wajib diisi.');
      return;
    }

    const qty = Number.parseInt(draft.qty, 10);

    if (!Number.isFinite(qty) || qty <= 0) {
      setItemError('Jumlah item harus lebih dari nol.');
      return;
    }

    const unitPrice = parseRupiah(draft.price);

    if (unitPrice < 0) {
      setItemError('Harga satuan tidak boleh negatif.');
      return;
    }

    const hpp = draft.hpp.trim() === '' ? '' : String(parseRupiah(draft.hpp));

    if (hpp !== '' && Number(hpp) < 0) {
      setItemError('HPP satuan tidak boleh negatif.');
      return;
    }

    setItems((current) => [
      ...current,
      {
        key: draftKey(),
        product_id: draft.productId || null,
        sku: draft.sku.trim(),
        product_name: draft.name.trim(),
        qty: String(qty),
        unit_price: String(unitPrice),
        hpp_unit_snapshot: hpp,
      },
    ]);
    setDraft({ ...NEW_ITEM, qty: '1' });
  };

  const addPendingFee = () => {
    setItemError(null);

    if (!feeForm.description.trim()) {
      setItemError('Keterangan fee wajib diisi.');
      return;
    }

    const amount = parseRupiah(feeForm.amount);

    if (amount <= 0) {
      setItemError('Nominal fee harus lebih dari nol.');
      return;
    }

    setFees((current) => [
      ...current,
      {
        key: draftKey(),
        description: feeForm.description.trim(),
        amount: String(amount),
        borne_by: feeForm.borne_by,
      },
    ]);
    setFeeForm({ description: '', amount: '', borne_by: 'seller' });
    setShowFeeForm(false);
  };

  const draftGross = items.reduce(
    (sum, item) => sum + (Number.parseInt(item.qty, 10) || 0) * parseRupiah(item.unit_price),
    0,
  );
  const draftHpp = items.reduce((sum, item) => {
    if (item.hpp_unit_snapshot !== '') {
      return sum + (Number.parseInt(item.qty, 10) || 0) * parseRupiah(item.hpp_unit_snapshot);
    }

    const product = products.find((row) => row.id === item.product_id);

    return sum + (Number.parseInt(item.qty, 10) || 0) * (product?.active_hpp ?? 0);
  }, 0);
  const draftSellerFees = fees
    .filter((fee) => fee.borne_by === 'seller')
    .reduce((sum, fee) => sum + parseRupiah(fee.amount), 0);

  const submit = async () => {
    setError(null);

    if (!form.store_id) {
      setError('Pilih toko terlebih dahulu.');
      return;
    }

    if (!form.marketplace_order_id.trim()) {
      setError('Order ID marketplace wajib diisi.');
      return;
    }

    if (items.length === 0) {
      setError('Tambahkan minimal satu item sebelum menyimpan pesanan.');
      return;
    }

    if (!/^\d{4}-\d{2}-\d{2}$/.test(form.ordered_at)) {
      setError('Tanggal pesanan wajib diisi.');
      return;
    }

    if (form.completed_at && form.completed_at < form.ordered_at) {
      setError('Tanggal selesai tidak boleh sebelum tanggal pesanan.');
      return;
    }

    const payloadItems: OrderItemInput[] = items.map((item) => ({
      product_id: item.product_id,
      sku: item.sku,
      product_name: item.product_name,
      qty: item.qty,
      unit_price: item.unit_price,
      hpp_unit_snapshot: item.hpp_unit_snapshot === '' ? null : item.hpp_unit_snapshot,
    }));

    setSaving(true);

    try {
      const db = getDb();

      if (editing && id) {
        await updateOrder(
          db,
          id,
          {
            marketplace_order_id: form.marketplace_order_id,
            ordered_at: form.ordered_at,
            completed_at: form.completed_at || null,
            status: form.status,
            seller_discount: form.seller_discount,
            marketplace_discount: form.marketplace_discount,
            notes: form.notes,
          },
          payloadItems,
        );
        await invalidateAll();
        showToast('Perubahan pesanan disimpan.');
        navigate(`/orders/${id}`, { replace: true });
      } else {
        const order = await createOrder(
          db,
          form.store_id,
          {
            marketplace_order_id: form.marketplace_order_id,
            ordered_at: form.ordered_at,
            completed_at: form.completed_at || null,
            status: form.status,
            seller_discount: form.seller_discount,
            marketplace_discount: form.marketplace_discount,
            notes: form.notes,
          },
          payloadItems,
        );

        for (const fee of fees) {
          await addOrderFee(db, order.id, {
            description: fee.description,
            basis: 'fixed',
            amount: fee.amount,
            borne_by: fee.borne_by,
            is_actual: true,
          });
        }

        await invalidateAll();
        showToast('Pesanan baru disimpan.');
        navigate(`/orders/${order.id}`, { replace: true });
      }
    } catch (caught) {
      setError(errorMessage(caught, 'Pesanan gagal disimpan.'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <Feedback error={error} onDismiss={() => setError(null)} />

      {!editing && stores.length === 0 ? (
        <Card className="space-y-3 p-5">
          <p className="font-heading text-base font-bold text-on-surface">Belum ada toko aktif</p>
          <p className="text-xs text-secondary">
            Tambahkan toko terlebih dahulu agar pesanan punya pemilik dan tarif pajak yang jelas.
          </p>
          <Button onClick={() => navigate('/stores/create')}>Tambah toko</Button>
        </Card>
      ) : null}

      <Card className="space-y-3 p-4">
        <p className="font-heading text-base font-bold text-on-surface">Identitas pesanan</p>

        <Field label="Toko" required>
          <Select value={form.store_id} onChange={(event) => changeStore(event.target.value)} disabled={editing}>
            <option value="">Pilih toko</option>
            {stores.map((store) => (
              <option key={store.id} value={store.id}>
                {store.name} · {store.marketplace_name}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Order ID marketplace" required>
          <TextInput
            value={form.marketplace_order_id}
            onChange={(event) => update('marketplace_order_id', event.target.value)}
            placeholder="Contoh: 240812ABCDEFGH"
            autoCapitalize="characters"
          />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Tanggal pesanan" required>
            <TextInput type="date" value={form.ordered_at} onChange={(event) => update('ordered_at', event.target.value)} />
          </Field>
          <Field label="Tanggal selesai">
            <TextInput
              type="date"
              value={form.completed_at}
              onChange={(event) => update('completed_at', event.target.value)}
            />
          </Field>
        </div>

        <Field label="Status">
          <Select value={form.status} onChange={(event) => update('status', event.target.value as OrderStatus)}>
            {ORDER_STATUSES.map((status) => (
              <option key={status} value={status}>
                {ORDER_STATUS_LABELS[status]}
              </option>
            ))}
          </Select>
        </Field>
        <p className="text-[0.68rem] leading-relaxed text-secondary">
          Hanya status Terkirim dan Selesai yang dihitung sebagai omzet. Refund dicatat terpisah di detail pesanan.
        </p>
      </Card>

      <Card className="space-y-3 p-4">
        <div className="flex items-center justify-between gap-2">
          <p className="font-heading text-base font-bold text-on-surface">Diskon</p>
          <p className="text-[0.65rem] text-muted">Rupiah penuh</p>
        </div>

        <Field label="Diskon dari penjual">
          <TextInput
            value={form.seller_discount}
            onChange={(event) => update('seller_discount', event.target.value)}
            placeholder="0"
            inputMode="numeric"
          />
        </Field>
        <Field label="Diskon dari marketplace">
          <TextInput
            value={form.marketplace_discount}
            onChange={(event) => update('marketplace_discount', event.target.value)}
            placeholder="0"
            inputMode="numeric"
          />
        </Field>
        <p className="text-[0.68rem] leading-relaxed text-secondary">
          Diskon marketplace tidak mengurangi omzet penjual. Diskon penjual mengurangi omzet dan laba.
        </p>
      </Card>

      <Card className="space-y-3 p-4">
        <div className="flex items-center justify-between gap-2">
          <p className="font-heading text-base font-bold text-on-surface">Item pesanan</p>
          <p className="text-[0.65rem] text-muted">{items.length} item</p>
        </div>

        {items.length > 0 ? (
          <div className="space-y-2">
            {items.map((item) => (
              <div key={item.key} className="flex items-start justify-between gap-3 rounded-2xl bg-surface-muted p-3">
                <div className="min-w-0">
                  <p className="truncate text-xs font-semibold text-on-surface">
                    {item.sku} · {item.product_name}
                  </p>
                  <p className="mt-0.5 text-[0.65rem] text-secondary">
                    {item.qty} × {rupiah(parseRupiah(item.unit_price))} · HPP{' '}
                    {item.hpp_unit_snapshot === ''
                      ? 'otomatis dari riwayat'
                      : `${rupiah(parseRupiah(item.hpp_unit_snapshot))}/unit`}
                  </p>
                </div>
                <button
                  type="button"
                  aria-label="Hapus item"
                  onClick={() => setItems((current) => current.filter((row) => row.key !== item.key))}
                  className="rounded-full bg-danger-soft p-2 text-danger"
                >
                  <Trash2 className="h-3.5 w-3.5" aria-hidden />
                </button>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-secondary">Belum ada item. Tambahkan minimal satu item sebelum menyimpan.</p>
        )}

        <div className="space-y-3 border-t border-outline/70 pt-3">
          <p className="text-sm font-semibold text-on-surface">Tambah item</p>

          {products.length > 0 ? (
            <Field label="Produk dari master">
              <Select value={draft.productId} onChange={(event) => pickProduct(event.target.value)}>
                <option value="">Pilih produk (opsional)</option>
                {products.map((product) => (
                  <option key={product.id} value={product.id}>
                    {product.sku} · {product.name} · {rupiah(product.selling_price)}
                  </option>
                ))}
              </Select>
            </Field>
          ) : (
            <p className="text-[0.68rem] text-secondary">
              Toko ini belum punya produk aktif. Isi SKU dan nama secara manual, atau tambahkan produk di menu Produk &
              HPP.
            </p>
          )}

          <Feedback error={itemError} onDismiss={() => setItemError(null)} />

          <div className="grid grid-cols-2 gap-3">
            <Field label="SKU">
              <TextInput
                value={draft.sku}
                onChange={(event) => setDraft((current) => ({ ...current, sku: event.target.value.toUpperCase() }))}
                placeholder="KA-01"
              />
            </Field>
            <Field label="Nama produk">
              <TextInput
                value={draft.name}
                onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))}
                placeholder="Kaos custom"
              />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Jumlah">
              <TextInput
                value={draft.qty}
                onChange={(event) => setDraft((current) => ({ ...current, qty: event.target.value }))}
                placeholder="1"
                inputMode="numeric"
              />
            </Field>
            <Field label="Harga satuan">
              <TextInput
                value={draft.price}
                onChange={(event) => setDraft((current) => ({ ...current, price: event.target.value }))}
                placeholder="0"
                inputMode="numeric"
              />
            </Field>
          </div>

          <Field label="HPP satuan (snapshot)" hint="Kosongkan agar diambil dari riwayat HPP pada tanggal pesanan.">
            <TextInput
              value={draft.hpp}
              onChange={(event) => setDraft((current) => ({ ...current, hpp: event.target.value }))}
              placeholder="Opsional"
              inputMode="numeric"
            />
          </Field>

          <Button fullWidth variant="secondary" icon={Plus} onClick={addItem}>
            Tambah item
          </Button>
        </div>
      </Card>

      {!editing ? (
        <Card className="space-y-3 p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="font-heading text-base font-bold text-on-surface">Fee marketplace</p>
              <p className="text-[0.68rem] text-secondary">Hanya fee ditanggung penjual yang mengurangi laba.</p>
            </div>
            <Button size="sm" variant="soft" onClick={() => setShowFeeForm((value) => !value)}>
              {showFeeForm ? 'Tutup' : 'Tambah fee'}
            </Button>
          </div>

          {fees.length > 0 ? (
            <div className="space-y-2">
              {fees.map((fee) => (
                <div key={fee.key} className="flex items-center justify-between gap-3 rounded-2xl bg-surface-muted p-3">
                  <div className="min-w-0">
                    <p className="truncate text-xs font-medium text-on-surface">{fee.description}</p>
                    <p className="text-[0.65rem] text-secondary">
                      {fee.borne_by === 'seller' ? 'Ditanggung penjual' : 'Ditanggung marketplace'} ·{' '}
                      {rupiah(parseRupiah(fee.amount))}
                    </p>
                  </div>
                  <button
                    type="button"
                    aria-label="Hapus fee"
                    onClick={() => setFees((current) => current.filter((row) => row.key !== fee.key))}
                    className="rounded-full bg-danger-soft p-2 text-danger"
                  >
                    <Trash2 className="h-3.5 w-3.5" aria-hidden />
                  </button>
                </div>
              ))}
            </div>
          ) : null}

          {showFeeForm ? (
            <div className="space-y-3 rounded-2xl bg-surface-muted p-3">
              <Field label="Keterangan fee">
                <TextInput
                  value={feeForm.description}
                  onChange={(event) => setFeeForm((current) => ({ ...current, description: event.target.value }))}
                  placeholder="Biaya administrasi"
                />
              </Field>
              <Field label="Nominal fee">
                <TextInput
                  value={feeForm.amount}
                  onChange={(event) => setFeeForm((current) => ({ ...current, amount: event.target.value }))}
                  placeholder="0"
                  inputMode="numeric"
                />
              </Field>
              <Field label="Ditanggung oleh">
                <Select
                  value={feeForm.borne_by}
                  onChange={(event) =>
                    setFeeForm((current) => ({ ...current, borne_by: event.target.value as FeeBorne }))
                  }
                >
                  <option value="seller">Ditanggung penjual</option>
                  <option value="marketplace">Ditanggung marketplace</option>
                </Select>
              </Field>
              <Button fullWidth onClick={addPendingFee}>
                Simpan fee
              </Button>
            </div>
          ) : null}
        </Card>
      ) : (
        <Card className="flex items-start gap-2 p-4">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" aria-hidden />
          <p className="text-[0.68rem] leading-relaxed text-secondary">
            Fee marketplace pada pesanan yang sudah tersimpan diubah dari halaman detail pesanan agar tercatat di audit
            log.
          </p>
        </Card>
      )}

      <Card className="space-y-1 p-4">
        <p className="font-heading text-base font-bold text-on-surface">Ringkasan draft</p>
        <div className="flex items-center justify-between py-1">
          <span className="text-xs text-secondary">Omzet bruto item</span>
          <span className="text-sm font-semibold tabular-nums text-on-surface">{rupiah(draftGross)}</span>
        </div>
        <div className="flex items-center justify-between py-1">
          <span className="text-xs text-secondary">Total HPP</span>
          <span className="text-sm font-semibold tabular-nums text-on-surface">{rupiah(draftHpp)}</span>
        </div>
        {fees.length > 0 ? (
          <div className="flex items-center justify-between py-1">
            <span className="text-xs text-secondary">Fee penjual</span>
            <span className="text-sm font-semibold tabular-nums text-on-surface">{rupiah(draftSellerFees)}</span>
          </div>
        ) : null}
        <p className="pt-1 text-[0.65rem] leading-relaxed text-secondary">
          Angka final dihitung ulang saat disimpan, termasuk diskon, HPP dari riwayat, dan pembulatan rupiah.
        </p>
      </Card>

      <Field label="Catatan">
        <TextArea value={form.notes} onChange={(event) => update('notes', event.target.value)} placeholder="Opsional" />
      </Field>

      <Button fullWidth size="lg" icon={Save} loading={saving} onClick={() => void submit()}>
        {editing ? 'Simpan perubahan' : 'Simpan pesanan'}
      </Button>
    </div>
  );
}
