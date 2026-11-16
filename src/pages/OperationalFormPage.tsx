import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Save, Wallet } from 'lucide-react';
import {
  Button,
  Card,
  Feedback,
  Field,
  LoadingCard,
  SectionTitle,
  Select,
  TextArea,
  TextInput,
  useToast,
} from '../components/ui';
import { queryKeys, useDbQuery, useInvalidateAll } from '../hooks/queries';
import { getDb } from '../lib/db';
import { listStores } from '../services/stores';
import { getOperationalExpense, saveOperationalExpense } from '../services/operational';
import {
  OPERATIONAL_CATEGORIES,
  OPERATIONAL_CATEGORY_LABELS,
  type OperationalCategory,
} from '../lib/constants';
import { today } from '../lib/date';
import { errorMessage } from '../lib/errors';

interface OperationalFormState {
  storeId: string;
  spentAt: string;
  category: OperationalCategory;
  amount: string;
  notes: string;
}

function emptyForm(): OperationalFormState {
  return {
    storeId: '',
    spentAt: today(),
    category: 'packing',
    amount: '',
    notes: '',
  };
}

export default function OperationalFormPage() {
  const { id = '' } = useParams<{ id: string }>();
  const editing = Boolean(id);
  const navigate = useNavigate();
  const invalidateAll = useInvalidateAll();
  const { showToast } = useToast();
  const initialized = useRef(false);

  const [form, setForm] = useState<OperationalFormState>(emptyForm);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const storesQuery = useDbQuery(queryKeys.stores(), (db) => listStores(db));
  const expenseQuery = useDbQuery(queryKeys.operationalExpense(id), (db) => getOperationalExpense(db, id), {
    enabled: editing,
  });

  useEffect(() => {
    if (initialized.current || !editing || !expenseQuery.data) {
      return;
    }

    const expense = expenseQuery.data;

    setForm({
      storeId: expense.store_id ?? '',
      spentAt: expense.spent_at,
      category: expense.category,
      amount: String(expense.amount),
      notes: expense.notes ?? '',
    });
    initialized.current = true;
  }, [editing, expenseQuery.data]);

  const update = <Key extends keyof OperationalFormState>(
    key: Key,
    value: OperationalFormState[Key],
  ) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const submit = async () => {
    setError(null);

    if (!/^\d{4}-\d{2}-\d{2}$/.test(form.spentAt)) {
      setError('Tanggal biaya wajib diisi.');
      return;
    }

    setSaving(true);

    try {
      await saveOperationalExpense(
        getDb(),
        {
          store_id: form.storeId || null,
          spent_at: form.spentAt,
          category: form.category,
          amount: form.amount,
          notes: form.notes,
        },
        editing ? id : null,
      );
      await invalidateAll();
      showToast(editing ? 'Biaya operasional diperbarui.' : 'Biaya operasional dicatat.');
      navigate('/operational', { replace: true });
    } catch (caught) {
      setError(errorMessage(caught, 'Biaya operasional gagal disimpan.'));
    } finally {
      setSaving(false);
    }
  };

  if (storesQuery.isLoading || (editing && expenseQuery.isLoading)) {
    return <LoadingCard rows={6} />;
  }

  if (editing && expenseQuery.data === null) {
    return (
      <Card className="space-y-3 p-6 text-center">
        <Wallet className="mx-auto h-8 w-8 text-muted" aria-hidden />
        <p className="font-heading text-base font-bold text-on-surface">Biaya tidak ditemukan</p>
        <p className="text-xs text-secondary">Catatan mungkin sudah dihapus.</p>
        <Button variant="secondary" onClick={() => navigate('/operational')}>
          Kembali ke biaya operasional
        </Button>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Feedback error={error} onDismiss={() => setError(null)} />

      <Card className="space-y-3 p-4">
        <SectionTitle
          title="Rincian biaya operasional"
          hint="Biaya nyata di luar iklan dan fee marketplace"
        />

        <Field
          label="Dibebankan ke"
          hint='Pilih "Tanpa toko (umum)" untuk biaya bersama seperti gaji admin atau sewa gudang.'
        >
          <Select value={form.storeId} onChange={(event) => update('storeId', event.target.value)}>
            <option value="">Tanpa toko (umum)</option>
            {(storesQuery.data ?? []).map((store) => (
              <option key={store.id} value={store.id}>
                {store.name} · {store.marketplace_name}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Kategori" required>
          <Select
            value={form.category}
            onChange={(event) => update('category', event.target.value as OperationalCategory)}
          >
            {OPERATIONAL_CATEGORIES.map((category) => (
              <option key={category} value={category}>
                {OPERATIONAL_CATEGORY_LABELS[category]}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Tanggal" required>
          <TextInput
            type="date"
            value={form.spentAt}
            onChange={(event) => update('spentAt', event.target.value)}
          />
        </Field>

        <Field label="Nominal" required>
          <TextInput
            value={form.amount}
            onChange={(event) => update('amount', event.target.value)}
            placeholder="0"
            inputMode="numeric"
          />
        </Field>

        <Field label="Catatan" hint="Opsional">
          <TextArea
            value={form.notes}
            onChange={(event) => update('notes', event.target.value)}
            placeholder="Contoh: gaji admin bulan ini"
          />
        </Field>
      </Card>

      <Button fullWidth size="lg" icon={Save} loading={saving} onClick={() => void submit()}>
        {editing ? 'Simpan perubahan' : 'Simpan biaya'}
      </Button>

      <p className="px-1 text-center text-[0.65rem] leading-relaxed text-muted">
        Biaya operasional mengurangi laba operasional. Biaya umum tanpa toko hanya masuk rekap semua toko, bukan laporan
        satu toko tertentu.
      </p>
    </div>
  );
}
