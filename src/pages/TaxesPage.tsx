import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Calculator, Percent, Plus, Receipt, Settings2, Trash2 } from 'lucide-react';
import {
  Badge,
  Button,
  Card,
  ConfirmDialog,
  EmptyState,
  Feedback,
  Field,
  LoadingCard,
  MetricRow,
  SectionTitle,
  Select,
  StatCard,
  TaxStatusBadge,
  TextArea,
  TextInput,
  useToast,
} from '../components/ui';
import { queryKeys, useDbQuery, useInvalidateAll } from '../hooks/queries';
import { getDb } from '../lib/db';
import { listStores } from '../services/stores';
import {
  addTaxEntry,
  deleteTaxEntry,
  generateTaxEntries,
  setTaxEntryStatus,
  taxRecap,
} from '../services/taxes';
import {
  TAX_STATUSES,
  TAX_STATUS_LABELS,
  TAX_TYPES,
  TAX_TYPE_LABELS,
  PPN_MODE_LABELS,
  PPH_BASIS_LABELS,
  type TaxStatus,
  type TaxType,
} from '../lib/constants';
import { currentPeriod, monthLabel, monthOptions } from '../lib/date';
import { compactRupiah, divideHalfUp, parseRupiah, percentToBasisPoints, rupiah } from '../lib/money';
import { errorMessage } from '../lib/errors';

export default function TaxesPage() {
  const navigate = useNavigate();
  const invalidateAll = useInvalidateAll();
  const { showToast } = useToast();
  const [period, setPeriod] = useState(currentPeriod());
  const [storeId, setStoreId] = useState('');
  const [showEntryForm, setShowEntryForm] = useState(false);
  const [entryStoreId, setEntryStoreId] = useState('');
  const [entryType, setEntryType] = useState<TaxType>('ppn_masukan');
  const [entryBase, setEntryBase] = useState('');
  const [entryRate, setEntryRate] = useState('');
  const [entryAmount, setEntryAmount] = useState('');
  const [entryStatus, setEntryStatus] = useState<TaxStatus>('draft');
  const [entryReference, setEntryReference] = useState('');
  const [entryNotes, setEntryNotes] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const storesQuery = useDbQuery(queryKeys.stores(), (db) => listStores(db));
  const recapQuery = useDbQuery(queryKeys.taxes(period, storeId), (db) =>
    taxRecap(db, period, storeId || null),
  );

  const stores = storesQuery.data ?? [];
  const recap = recapQuery.data;
  const periods = monthOptions(24);

  const runAction = async (action: () => Promise<string | void>, success?: string) => {
    setError(null);
    setBusy(true);

    try {
      const message = await action();
      await invalidateAll();

      if (typeof message === 'string' && message) {
        showToast(message);
      } else if (success) {
        showToast(success);
      }
    } catch (caught) {
      setError(errorMessage(caught, 'Tindakan pajak gagal diproses.'));
    } finally {
      setBusy(false);
    }
  };

  const generate = () => {
    void runAction(async () => {
      const written = await generateTaxEntries(getDb(), period, storeId || null);

      return written === 0
        ? 'Tidak ada entri pajak baru. Nilainya nol atau periode belum punya transaksi.'
        : `${written} entri pajak dihitung ulang dari pesanan ${monthLabel(period)}.`;
    });
  };

  const resetEntryForm = () => {
    setEntryStoreId('');
    setEntryType('ppn_masukan');
    setEntryBase('');
    setEntryRate('');
    setEntryAmount('');
    setEntryStatus('draft');
    setEntryReference('');
    setEntryNotes('');
    setShowEntryForm(false);
  };

  const submitEntry = () => {
    const targetStore = entryStoreId || storeId || stores[0]?.id || '';
    const base = parseRupiah(entryBase);
    const rateBp = percentToBasisPoints(entryRate);
    let amount = parseRupiah(entryAmount);

    if (!targetStore) {
      setError('Pilih toko untuk entri pajak.');
      return;
    }

    if (base < 0 || amount < 0 || rateBp < 0 || rateBp > 10000) {
      setError('Nominal dan tarif pajak harus bernilai wajar.');
      return;
    }

    if (amount === 0 && base > 0 && rateBp > 0) {
      amount = divideHalfUp(base * rateBp, 10000);
    }

    if (amount <= 0) {
      setError('Nominal pajak harus lebih dari nol.');
      return;
    }

    void runAction(async () => {
      await addTaxEntry(getDb(), {
        store_id: targetStore,
        period,
        type: entryType,
        base_amount: base,
        rate_bp: rateBp,
        amount,
        status: entryStatus,
        reference: entryReference,
        notes: entryNotes,
      });
      resetEntryForm();
    }, 'Entri pajak manual ditambahkan.');
  };

  if (recapQuery.isLoading || storesQuery.isLoading) {
    return (
      <div className="space-y-3">
        <LoadingCard rows={3} />
        <LoadingCard rows={6} />
      </div>
    );
  }

  if (!recap) {
    return <LoadingCard rows={5} />;
  }

  return (
    <div className="space-y-4">
      <Feedback error={error} onDismiss={() => setError(null)} />

      <Card className="space-y-2 p-4">
        <div className="grid grid-cols-2 gap-2.5">
          <Field label="Periode pajak">
            <Select value={period} onChange={(event) => setPeriod(event.target.value)}>
              {periods.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Toko">
            <Select value={storeId} onChange={(event) => setStoreId(event.target.value)}>
              <option value="">Semua toko</option>
              {stores.map((store) => (
                <option key={store.id} value={store.id}>
                  {store.name} · {store.marketplace_name}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="secondary" icon={Calculator} loading={busy} onClick={generate}>
            Hitung ulang dari pesanan
          </Button>
          <Button size="sm" variant="soft" icon={Plus} onClick={() => setShowEntryForm((value) => !value)}>
            {showEntryForm ? 'Tutup form' : 'Entri manual'}
          </Button>
        </div>
        <p className="text-[0.68rem] leading-relaxed text-secondary">
          PPN Keluaran dan PPh Final dihitung dari pesanan Terkirim/Selesai. PPN Masukan hanya berasal dari entri manual.
          PPN tidak mengurangi laba; PPh Final mengurangi laba.
        </p>
      </Card>

      <Card className="overflow-hidden border-primary/30 bg-gradient-to-br from-primary-soft via-surface to-surface p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-primary-text">
              Rekap {recap.periodLabel}
            </p>
            <p className="mt-1 font-heading text-[1.9rem] font-bold leading-none tabular-nums text-on-surface">
              {rupiah(recap.ppnPayable)}
            </p>
            <p className="mt-2 text-[0.7rem] text-secondary">PPN kurang bayar · PPh Final {rupiah(recap.pphFinal)}</p>
          </div>
          <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary text-on-surface shadow-soft">
            <Percent className="h-5 w-5" aria-hidden />
          </span>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-2">
          <div className="rounded-2xl bg-surface/80 p-3">
            <p className="text-[0.65rem] text-secondary">Omzet bruto</p>
            <p className="mt-0.5 text-sm font-semibold tabular-nums text-on-surface">{compactRupiah(recap.grossRevenue)}</p>
          </div>
          <div className="rounded-2xl bg-surface/80 p-3">
            <p className="text-[0.65rem] text-secondary">Pendapatan neto</p>
            <p className="mt-0.5 text-sm font-semibold tabular-nums text-on-surface">{compactRupiah(recap.netRevenue)}</p>
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-2 gap-2.5">
        <StatCard label="PPN keluaran" value={compactRupiah(recap.ppnOutput)} hint="Dari penjualan PKP" />
        <StatCard label="PPN masukan" value={compactRupiah(recap.ppnInput)} hint="Entri manual" />
        <StatCard
          label="PPN kurang bayar"
          value={compactRupiah(recap.ppnPayable)}
          tone={recap.ppnPayable > 0 ? 'warning' : 'success'}
        />
        <StatCard label="PPh Final" value={compactRupiah(recap.pphFinal)} tone="danger" hint="Mengurangi laba" />
      </div>

      {showEntryForm ? (
        <Card className="space-y-3 p-4">
          <SectionTitle title="Entri pajak manual" hint="Gunakan untuk PPN masukan atau koreksi yang tidak berasal dari pesanan" />
          <Field label="Toko" required>
            <Select value={entryStoreId} onChange={(event) => setEntryStoreId(event.target.value)}>
              <option value="">{storeId ? stores.find((store) => store.id === storeId)?.name ?? 'Pilih toko' : 'Pilih toko'}</option>
              {stores.map((store) => (
                <option key={store.id} value={store.id}>
                  {store.name} · {store.marketplace_name}
                </option>
              ))}
            </Select>
          </Field>
          <div className="grid grid-cols-2 gap-2.5">
            <Field label="Jenis pajak">
              <Select value={entryType} onChange={(event) => setEntryType(event.target.value as TaxType)}>
                {TAX_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {TAX_TYPE_LABELS[type]}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Status">
              <Select value={entryStatus} onChange={(event) => setEntryStatus(event.target.value as TaxStatus)}>
                {TAX_STATUSES.map((status) => (
                  <option key={status} value={status}>
                    {TAX_STATUS_LABELS[status]}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-2.5">
            <Field label="Dasar pajak">
              <TextInput
                value={entryBase}
                onChange={(event) => setEntryBase(event.target.value)}
                placeholder="0"
                inputMode="numeric"
              />
            </Field>
            <Field label="Tarif (%)">
              <TextInput
                value={entryRate}
                onChange={(event) => setEntryRate(event.target.value)}
                placeholder="11"
                inputMode="decimal"
              />
            </Field>
          </div>
          <Field label="Nominal pajak" hint="Kosongkan agar dihitung dari dasar × tarif.">
            <TextInput
              value={entryAmount}
              onChange={(event) => setEntryAmount(event.target.value)}
              placeholder="0"
              inputMode="numeric"
            />
          </Field>
          <Field label="Referensi">
            <TextInput
              value={entryReference}
              onChange={(event) => setEntryReference(event.target.value)}
              placeholder="Nomor faktur atau bukti setor"
            />
          </Field>
          <Field label="Catatan">
            <TextArea
              value={entryNotes}
              onChange={(event) => setEntryNotes(event.target.value)}
              placeholder="Opsional"
            />
          </Field>
          <div className="flex gap-2">
            <Button variant="secondary" fullWidth onClick={resetEntryForm}>
              Batal
            </Button>
            <Button fullWidth icon={Plus} loading={busy} onClick={submitEntry}>
              Simpan entri
            </Button>
          </div>
        </Card>
      ) : null}

      <Card className="p-4">
        <SectionTitle title="Rincian per toko" hint="Tarif mengikuti profil pajak yang berlaku pada tanggal pesanan" />
        {recap.stores.length === 0 ? (
          <EmptyState
            icon={Receipt}
            title="Belum ada data pajak"
            description="Belum ada pesanan realisasi atau entri pada periode ini. Tambahkan entri manual bila diperlukan."
          />
        ) : (
          <div className="space-y-2">
            {recap.stores.map((store) => (
              <div key={store.store_id} className="rounded-2xl bg-surface-muted p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-xs font-semibold text-on-surface">{store.store_name}</p>
                    <p className="mt-0.5 text-[0.65rem] text-secondary">
                      {store.pkp ? 'PKP' : 'Non-PKP'} · {PPN_MODE_LABELS[store.ppn_mode]} ·{' '}
                      {(store.ppn_rate_bp / 100).toFixed(2)}% / {(store.pph_rate_bp / 100).toFixed(2)}%
                    </p>
                    <p className="text-[0.65rem] text-secondary">
                      Dasar PPh {PPH_BASIS_LABELS[store.pph_basis]} · {store.orders} pesanan
                    </p>
                  </div>
                  <Button size="sm" variant="ghost" icon={Settings2} onClick={() => navigate(`/taxes/profile/${store.store_id}`)}>
                    Profil
                  </Button>
                </div>
                <div className="mt-2 grid grid-cols-2 gap-x-3">
                  <MetricRow label="Omzet" value={rupiah(store.gross)} />
                  <MetricRow label="Neto" value={rupiah(store.net)} />
                  <MetricRow label="PPN keluaran" value={rupiah(store.ppn_output)} />
                  <MetricRow label="PPN masukan" value={rupiah(store.ppn_input)} />
                  <MetricRow label="PPN kurang bayar" value={rupiah(store.ppn_payable)} />
                  <MetricRow label="PPh Final" value={rupiah(store.pph_final)} tone="danger" />
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card className="p-4">
        <SectionTitle
          title="Entri pajak periode ini"
          hint="Entri otomatis ditandai referensi auto. Perubahan status tetap tercatat."
          action={<Badge tone="neutral">{recap.entries.length} entri</Badge>}
        />
        {recap.entries.length === 0 ? (
          <p className="py-3 text-xs text-secondary">Belum ada entri pajak pada periode dan filter ini.</p>
        ) : (
          <div className="divide-y divide-outline/70">
            {recap.entries.map((entry) => (
              <div key={entry.id} className="space-y-2 py-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-on-surface">
                      {entry.type_label} · {entry.store_name}
                    </p>
                    <p className="mt-0.5 text-[0.65rem] text-secondary">
                      Dasar {rupiah(entry.base_amount)} · tarif {(entry.rate_bp / 100).toFixed(2)}% ·{' '}
                      {entry.reference === 'auto' ? 'otomatis' : entry.reference || 'manual'}
                    </p>
                    {entry.notes ? <p className="text-[0.65rem] text-muted">{entry.notes}</p> : null}
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-xs font-semibold tabular-nums text-on-surface">{rupiah(entry.amount)}</p>
                    <TaxStatusBadge status={entry.status} />
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Select
                    aria-label="Ubah status pajak"
                    value={entry.status}
                    onChange={(event) =>
                      void runAction(
                        async () => setTaxEntryStatus(getDb(), entry.id, event.target.value as TaxStatus),
                        'Status entri pajak diubah.',
                      )
                    }
                    className="h-9 min-h-0 text-xs"
                  >
                    {TAX_STATUSES.map((status) => (
                      <option key={status} value={status}>
                        {TAX_STATUS_LABELS[status]}
                      </option>
                    ))}
                  </Select>
                  <Button size="sm" variant="secondary" icon={Trash2} onClick={() => setConfirmDeleteId(entry.id)}>
                    Hapus
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <ConfirmDialog
        open={confirmDeleteId !== null}
        title="Hapus entri pajak?"
        description="Entri dihapus dari rekap periode ini. Data pesanan tidak berubah dan tindakan tercatat di audit log."
        confirmLabel="Hapus entri"
        busy={busy}
        onCancel={() => setConfirmDeleteId(null)}
        onConfirm={() =>
          void runAction(async () => {
            if (confirmDeleteId) {
              await deleteTaxEntry(getDb(), confirmDeleteId);
            }
            setConfirmDeleteId(null);
          }, 'Entri pajak dihapus.')
        }
      />
    </div>
  );
}
