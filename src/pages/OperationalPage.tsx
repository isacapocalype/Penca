import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Pencil, Trash2, Wallet } from 'lucide-react';
import {
  Button,
  Card,
  ConfirmDialog,
  EmptyState,
  Feedback,
  Field,
  LoadingCard,
  SectionTitle,
  Select,
  StatCard,
  useToast,
} from '../components/ui';
import { queryKeys, useDbQuery, useInvalidateAll } from '../hooks/queries';
import { getDb } from '../lib/db';
import { listStores } from '../services/stores';
import { deleteOperationalExpense, listOperationalExpenses } from '../services/operational';
import {
  OPERATIONAL_CATEGORIES,
  OPERATIONAL_CATEGORY_LABELS,
  type OperationalCategory,
} from '../lib/constants';
import { currentPeriod, formatDate, monthLabel, monthOptions } from '../lib/date';
import { compactRupiah, rupiah } from '../lib/money';
import { errorMessage } from '../lib/errors';

export default function OperationalPage() {
  const navigate = useNavigate();
  const invalidateAll = useInvalidateAll();
  const { showToast } = useToast();
  const [period, setPeriod] = useState(currentPeriod());
  const [storeId, setStoreId] = useState('');
  const [generalOnly, setGeneralOnly] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const storesQuery = useDbQuery(queryKeys.stores(), (db) => listStores(db));
  const expensesQuery = useDbQuery(
    queryKeys.operational(period, storeId, generalOnly),
    (db) =>
      listOperationalExpenses(db, period, {
        storeId: generalOnly ? null : storeId || null,
        generalOnly,
      }),
  );

  const stores = storesQuery.data ?? [];
  const expenses = expensesQuery.data ?? [];
  const total = expenses.reduce((sum, expense) => sum + expense.amount, 0);
  const byCategory = new Map<OperationalCategory, number>();

  for (const expense of expenses) {
    byCategory.set(expense.category, (byCategory.get(expense.category) ?? 0) + expense.amount);
  }

  const runAction = async (action: () => Promise<void>, success: string) => {
    setError(null);
    setBusy(true);

    try {
      await action();
      await invalidateAll();
      showToast(success);
    } catch (caught) {
      setError(errorMessage(caught, 'Tindakan biaya operasional gagal diproses.'));
    } finally {
      setBusy(false);
    }
  };

  if (storesQuery.isLoading || expensesQuery.isLoading) {
    return (
      <div className="space-y-3">
        <LoadingCard rows={3} />
        <LoadingCard rows={6} />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Feedback error={error} onDismiss={() => setError(null)} />

      <Card className="space-y-2 p-4">
        <div className="grid grid-cols-2 gap-2.5">
          <Field label="Periode">
            <Select value={period} onChange={(event) => setPeriod(event.target.value)}>
              {monthOptions(24).map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Catatan untuk">
            <Select
              value={generalOnly ? '__general__' : storeId}
              onChange={(event) => {
                if (event.target.value === '__general__') {
                  setGeneralOnly(true);
                  setStoreId('');
                } else {
                  setGeneralOnly(false);
                  setStoreId(event.target.value);
                }
              }}
            >
              <option value="">Semua catatan</option>
              <option value="__general__">Umum saja (tanpa toko)</option>
              {stores.map((store) => (
                <option key={store.id} value={store.id}>
                  {store.name} · {store.marketplace_name}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        <Button size="sm" icon={Plus} onClick={() => navigate('/operational/create')}>
          Catat biaya
        </Button>
      </Card>

      <Card className="overflow-hidden border-primary/30 bg-gradient-to-br from-primary-soft via-surface to-surface p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-primary-text">
              Total biaya {monthLabel(period)}
            </p>
            <p className="mt-1 font-heading text-[1.9rem] font-bold leading-none tabular-nums text-on-surface">
              {rupiah(total)}
            </p>
            <p className="mt-2 text-[0.7rem] text-secondary">
              {expenses.length} catatan. Biaya tanpa toko hanya masuk rekap semua toko.
            </p>
          </div>
          <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary text-on-surface shadow-soft">
            <Wallet className="h-5 w-5" aria-hidden />
          </span>
        </div>
      </Card>

      <div className="grid grid-cols-2 gap-2.5">
        <StatCard label="Total periode" value={compactRupiah(total)} hint={`${expenses.length} catatan`} />
        <StatCard
          label="Kategori terbesar"
          value={
            byCategory.size === 0
              ? '—'
              : OPERATIONAL_CATEGORY_LABELS[
                  [...byCategory.entries()].sort((a, b) => b[1] - a[1])[0][0]
                ]
          }
          hint="Berdasarkan nominal"
        />
      </div>

      {byCategory.size > 0 ? (
        <Card className="p-4">
          <SectionTitle title="Per kategori" hint="Akumulasi pada filter periode ini" />
          <div className="divide-y divide-outline/70">
            {[...byCategory.entries()]
              .sort((a, b) => b[1] - a[1])
              .map(([category, amount]) => (
                <div key={category} className="flex items-center justify-between gap-3 py-2.5">
                  <p className="text-xs text-secondary">{OPERATIONAL_CATEGORY_LABELS[category]}</p>
                  <p className="text-xs font-semibold tabular-nums text-on-surface">{rupiah(amount)}</p>
                </div>
              ))}
          </div>
        </Card>
      ) : null}

      <Card className="p-4">
        <SectionTitle title="Catatan" hint="Urut dari yang paling baru" />
        {expenses.length === 0 ? (
          <EmptyState
            icon={Wallet}
            title="Belum ada biaya operasional"
            description="Catat gaji, packing, listrik, dan biaya nyata lain agar laba bersih tidak dilebihkan."
            action={
              <Button size="sm" variant="secondary" icon={Plus} onClick={() => navigate('/operational/create')}>
                Catat biaya
              </Button>
            }
          />
        ) : (
          <div className="space-y-2">
            {expenses.map((expense) => (
              <div key={expense.id} className="rounded-2xl border border-outline/70 bg-surface p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-on-surface">
                      {OPERATIONAL_CATEGORY_LABELS[expense.category]}
                    </p>
                    <p className="mt-0.5 text-[0.65rem] text-secondary">
                      {formatDate(expense.spent_at)} · {expense.store_name ?? 'Umum (tanpa toko)'}
                    </p>
                    {expense.notes ? (
                      <p className="mt-1 text-[0.65rem] leading-relaxed text-muted">{expense.notes}</p>
                    ) : null}
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-sm font-heading font-bold tabular-nums text-on-surface">
                      {rupiah(expense.amount)}
                    </p>
                    <div className="mt-2 flex justify-end gap-1.5">
                      <button
                        type="button"
                        aria-label="Ubah biaya operasional"
                        onClick={() => navigate(`/operational/${expense.id}/edit`)}
                        className="rounded-full bg-surface-muted p-2 text-secondary"
                      >
                        <Pencil className="h-3.5 w-3.5" aria-hidden />
                      </button>
                      <button
                        type="button"
                        aria-label="Hapus biaya operasional"
                        onClick={() => setConfirmDeleteId(expense.id)}
                        className="rounded-full bg-danger-soft p-2 text-danger"
                      >
                        <Trash2 className="h-3.5 w-3.5" aria-hidden />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <p className="px-1 text-center text-[0.65rem] leading-relaxed text-muted">
        Biaya operasional mengurangi laba operasional, bukan omzet. Semua nominal disimpan sebagai rupiah penuh tanpa
        pembulatan tersembunyi.
      </p>

      <ConfirmDialog
        open={confirmDeleteId !== null}
        title="Hapus biaya operasional?"
        description="Catatan biaya dihapus dari laba periode. Tindakan ini tercatat di audit log."
        confirmLabel="Hapus biaya"
        busy={busy}
        onCancel={() => setConfirmDeleteId(null)}
        onConfirm={() =>
          void runAction(async () => {
            if (confirmDeleteId) {
              await deleteOperationalExpense(getDb(), confirmDeleteId);
            }
            setConfirmDeleteId(null);
          }, 'Biaya operasional dihapus.')
        }
      />
    </div>
  );
}
