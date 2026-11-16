import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  AlertTriangle,
  CalendarDays,
  CircleDollarSign,
  Landmark,
  Package,
  Pencil,
  Plus,
  Receipt,
  RotateCcw,
  Trash2,
  Truck,
  Wallet,
} from 'lucide-react';
import {
  Badge,
  Button,
  Card,
  ConfirmDialog,
  Feedback,
  Field,
  LoadingCard,
  MetricRow,
  SectionTitle,
  Select,
  StatCard,
  StatusBadge,
  TextArea,
  TextInput,
  useToast,
} from '../components/ui';
import { queryKeys, useDbQuery, useInvalidateAll } from '../hooks/queries';
import { getDb } from '../lib/db';
import {
  addOrderFee,
  addRefund,
  addSettlement,
  deleteOrder,
  deleteOrderFee,
  deleteRefund,
  deleteSettlement,
  getOrderDetail,
  listAuditForOrder,
  orderNetRevenue,
} from '../services/orders';
import { isPeriodLocked } from '../services/period-locks';
import type { MarketplaceFeeCategory } from '../lib/types';
import { formatDate, formatDateTime, periodFromDate, today } from '../lib/date';
import { compactRupiah, parseRupiah, rupiah } from '../lib/money';
import { FEE_BORNE_LABELS, type FeeBorne } from '../lib/constants';
import { errorMessage } from '../lib/errors';

export default function OrderDetailPage() {
  const { id = '' } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const invalidateAll = useInvalidateAll();
  const { showToast } = useToast();

  const [showFeeForm, setShowFeeForm] = useState(false);
  const [feeCategory, setFeeCategory] = useState('');
  const [feeDescription, setFeeDescription] = useState('');
  const [feeAmount, setFeeAmount] = useState('');
  const [feeBorne, setFeeBorne] = useState<FeeBorne>('seller');

  const [showRefundForm, setShowRefundForm] = useState(false);
  const [refundDate, setRefundDate] = useState(today());
  const [refundAmount, setRefundAmount] = useState('');
  const [refundReason, setRefundReason] = useState('');

  const [showSettlementForm, setShowSettlementForm] = useState(false);
  const [settlementDate, setSettlementDate] = useState(today());
  const [settlementAmount, setSettlementAmount] = useState('');
  const [settlementReference, setSettlementReference] = useState('');
  const [settlementNotes, setSettlementNotes] = useState('');

  const [confirmDeleteOrder, setConfirmDeleteOrder] = useState(false);
  const [confirmDeleteRefund, setConfirmDeleteRefund] = useState(false);
  const [confirmDeleteFee, setConfirmDeleteFee] = useState<string | null>(null);
  const [confirmDeleteSettlement, setConfirmDeleteSettlement] = useState<string | null>(null);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const detailQuery = useDbQuery(queryKeys.order(id), async (db) => {
    const detail = await getOrderDetail(db, id);

    if (!detail) {
      return null;
    }

    const [audit, categories, locked] = await Promise.all([
      listAuditForOrder(db, id),
      db.query<MarketplaceFeeCategory>(
        'SELECT * FROM marketplace_fee_categories WHERE active = 1 ORDER BY name COLLATE NOCASE',
      ),
      isPeriodLocked(db, periodFromDate(detail.order.ordered_at)),
    ]);

    return { ...detail, audit, categories, locked };
  });

  if (detailQuery.isLoading) {
    return <LoadingCard rows={7} />;
  }

  const data = detailQuery.data;

  if (!data) {
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

  const { order, items, fees, refund, settlements, audit, categories, locked } = data;
  const sellerFees = fees.filter((fee) => fee.borne_by === 'seller').reduce((sum, fee) => sum + fee.amount, 0);
  const refundTotal = refund?.amount ?? 0;
  const netRevenue = orderNetRevenue(order, refundTotal);
  const grossProfit = netRevenue - order.hpp_total;
  const operatingProfit = grossProfit - sellerFees;
  const settledTotal = settlements.reduce((sum, settlement) => sum + settlement.amount, 0);
  const remainingToSettle = Math.max(0, netRevenue - settledTotal);

  const runAction = async (action: () => Promise<void>, success: string) => {
    setError(null);
    setBusy(true);

    try {
      await action();
      await invalidateAll();
      showToast(success);
    } catch (caught) {
      setError(errorMessage(caught, 'Tindakan gagal diproses.'));
    } finally {
      setBusy(false);
    }
  };

  const submitFee = () => {
    const amount = parseRupiah(feeAmount);
    const category = categories.find((row) => row.id === feeCategory) ?? null;
    const description = feeDescription.trim() || category?.name || '';

    if (!description) {
      setError('Keterangan fee wajib diisi.');
      return;
    }

    if (amount <= 0) {
      setError('Nominal fee harus lebih dari nol.');
      return;
    }

    void runAction(async () => {
      await addOrderFee(getDb(), order.id, {
        category_id: category?.id ?? null,
        description,
        basis: 'fixed',
        amount,
        borne_by: feeBorne,
        is_actual: true,
      });
      setFeeCategory('');
      setFeeDescription('');
      setFeeAmount('');
      setShowFeeForm(false);
    }, 'Fee marketplace ditambahkan.');
  };

  const submitRefund = () => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(refundDate)) {
      setError('Tanggal refund wajib diisi.');
      return;
    }

    if (parseRupiah(refundAmount) <= 0) {
      setError('Nominal refund harus lebih dari nol.');
      return;
    }

    if (refundDate < order.ordered_at) {
      setError('Tanggal refund tidak boleh sebelum tanggal pesanan.');
      return;
    }

    void runAction(async () => {
      await addRefund(getDb(), order.id, {
        refunded_at: refundDate,
        amount: refundAmount,
        reason: refundReason,
      });
      setRefundAmount('');
      setRefundReason('');
      setShowRefundForm(false);
    }, 'Refund dicatat. Satu pesanan hanya boleh memiliki satu refund aktif.');
  };

  const submitSettlement = () => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(settlementDate)) {
      setError('Tanggal pencairan wajib diisi.');
      return;
    }

    if (parseRupiah(settlementAmount) <= 0) {
      setError('Nominal pencairan harus lebih dari nol.');
      return;
    }

    void runAction(async () => {
      await addSettlement(getDb(), order.id, {
        settled_at: settlementDate,
        amount: settlementAmount,
        reference: settlementReference,
        notes: settlementNotes,
      });
      setSettlementAmount('');
      setSettlementReference('');
      setSettlementNotes('');
      setShowSettlementForm(false);
    }, 'Pencairan marketplace dicatat.');
  };

  return (
    <div className="space-y-4">
      <Feedback error={error} onDismiss={() => setError(null)} />

      {locked ? (
        <div className="flex items-start gap-2 rounded-2xl border border-warning/30 bg-warning-soft p-4 text-warning">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          <div>
            <p className="text-sm font-semibold">Periode terkunci</p>
            <p className="mt-0.5 text-[0.7rem] leading-relaxed">
              Pesanan ini berada pada periode yang dikunci. Buka kunci periode di Pengaturan bila memang diperlukan;
              setiap perubahan tetap tercatat di audit log.
            </p>
          </div>
        </div>
      ) : null}

      <Card className="space-y-3 overflow-hidden border-primary/30 bg-gradient-to-br from-primary-soft via-surface to-surface p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-primary-text">
                {order.marketplace_name}
              </p>
              <StatusBadge status={order.status} />
            </div>
            <h2 className="mt-1 break-all font-heading text-xl font-bold text-on-surface">
              {order.marketplace_order_id}
            </h2>
            <p className="mt-1 text-xs text-secondary">
              {order.store_name} · {formatDate(order.ordered_at)}
              {order.completed_at ? ` · selesai ${formatDate(order.completed_at)}` : ''}
            </p>
          </div>
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary text-on-surface shadow-soft">
            <Receipt className="h-5 w-5" aria-hidden />
          </span>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-2xl bg-surface/80 p-3">
            <p className="text-[0.65rem] text-secondary">Omzet bruto</p>
            <p className="mt-0.5 font-heading text-lg font-bold tabular-nums text-on-surface">
              {rupiah(order.gross_revenue)}
            </p>
          </div>
          <div className="rounded-2xl bg-surface/80 p-3">
            <p className="text-[0.65rem] text-secondary">Pendapatan neto</p>
            <p className="mt-0.5 font-heading text-lg font-bold tabular-nums text-on-surface">{rupiah(netRevenue)}</p>
          </div>
        </div>

        <div className="flex flex-wrap gap-1.5">
          <Badge tone="neutral">
            <CalendarDays className="h-3 w-3" aria-hidden /> Dicatat {formatDateTime(order.created_at)}
          </Badge>
          <Badge tone="neutral">Diskon penjual {compactRupiah(order.seller_discount)}</Badge>
          <Badge tone="neutral">Diskon marketplace {compactRupiah(order.marketplace_discount)}</Badge>
        </div>
      </Card>

      <div className="grid grid-cols-2 gap-2.5">
        <StatCard label="HPP tersnapshot" value={compactRupiah(order.hpp_total)} icon={Package} />
        <StatCard label="Laba kotor" value={compactRupiah(grossProfit)} icon={CircleDollarSign} />
        <StatCard label="Fee penjual" value={compactRupiah(sellerFees)} icon={Landmark} />
        <StatCard
          label="Laba operasional"
          value={compactRupiah(operatingProfit)}
          tone={operatingProfit < 0 ? 'danger' : 'success'}
          icon={Wallet}
        />
        <StatCard
          label="Refund"
          value={compactRupiah(refundTotal)}
          tone={refundTotal > 0 ? 'danger' : 'neutral'}
          icon={RotateCcw}
        />
        <StatCard
          label="Sudah dicairkan"
          value={compactRupiah(settledTotal)}
          hint={`Sisa ${rupiah(remainingToSettle)}`}
          tone={settledTotal > 0 ? 'success' : 'neutral'}
          icon={Truck}
        />
      </div>

      <Card className="p-4">
        <SectionTitle title="Item pesanan" hint={`${items.length} baris · HPP per item adalah snapshot saat pesanan dicatat`} />
        {items.length === 0 ? (
          <p className="py-3 text-xs text-secondary">Tidak ada item aktif pada pesanan ini.</p>
        ) : (
          <div className="divide-y divide-outline/70">
            {items.map((item) => (
              <div key={item.id} className="flex items-start justify-between gap-3 py-2.5">
                <div className="min-w-0">
                  <p className="truncate text-xs font-semibold text-on-surface">
                    {item.sku} · {item.product_name}
                  </p>
                  <p className="mt-0.5 text-[0.65rem] text-secondary">
                    {item.qty} × {rupiah(item.unit_price)} · HPP {rupiah(item.hpp_unit_snapshot)}/unit
                  </p>
                </div>
                <p className="shrink-0 text-xs font-semibold tabular-nums text-on-surface">
                  {rupiah(item.qty * item.unit_price)}
                </p>
              </div>
            ))}
          </div>
        )}
        <div className="mt-2 border-t border-outline/70 pt-2">
          <MetricRow label="Omzet bruto item" value={rupiah(order.gross_revenue)} />
          <MetricRow label="Total HPP snapshot" value={rupiah(order.hpp_total)} />
        </div>
      </Card>

      <Card className="space-y-3 p-4">
        <div className="flex items-start justify-between gap-2">
          <SectionTitle title="Fee marketplace" hint="Hanya fee ditanggung penjual yang mengurangi laba" className="mb-0" />
          <Button size="sm" variant="soft" onClick={() => setShowFeeForm((value) => !value)}>
            {showFeeForm ? 'Tutup' : 'Tambah fee'}
          </Button>
        </div>

        {showFeeForm ? (
          <div className="space-y-3 rounded-2xl bg-surface-muted p-3">
            <Field label="Kategori fee">
              <Select value={feeCategory} onChange={(event) => setFeeCategory(event.target.value)}>
                <option value="">Tanpa kategori</option>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Keterangan" hint="Bila kosong, nama kategori dipakai sebagai keterangan.">
              <TextInput
                value={feeDescription}
                onChange={(event) => setFeeDescription(event.target.value)}
                placeholder="Biaya administrasi"
              />
            </Field>
            <Field label="Nominal fee" required>
              <TextInput
                value={feeAmount}
                onChange={(event) => setFeeAmount(event.target.value)}
                placeholder="0"
                inputMode="numeric"
              />
            </Field>
            <Field label="Ditanggung oleh">
              <Select value={feeBorne} onChange={(event) => setFeeBorne(event.target.value as FeeBorne)}>
                <option value="seller">{FEE_BORNE_LABELS.seller}</option>
                <option value="marketplace">{FEE_BORNE_LABELS.marketplace}</option>
              </Select>
            </Field>
            <Button fullWidth icon={Plus} loading={busy} onClick={submitFee}>
              Simpan fee
            </Button>
          </div>
        ) : null}

        {fees.length === 0 ? (
          <p className="py-2 text-xs text-secondary">Belum ada fee marketplace pada pesanan ini.</p>
        ) : (
          <div className="divide-y divide-outline/70">
            {fees.map((fee) => (
              <div key={fee.id} className="flex items-start justify-between gap-3 py-2.5">
                <div className="min-w-0">
                  <p className="truncate text-xs font-medium text-on-surface">{fee.description}</p>
                  <p className="mt-0.5 text-[0.65rem] text-secondary">
                    {FEE_BORNE_LABELS[fee.borne_by]} · {fee.is_actual ? 'nominal aktual' : 'estimasi'}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <span className="text-xs font-semibold tabular-nums text-on-surface">{rupiah(fee.amount)}</span>
                  <button
                    type="button"
                    aria-label="Hapus fee"
                    onClick={() => setConfirmDeleteFee(fee.id)}
                    className="rounded-full bg-danger-soft p-2 text-danger"
                  >
                    <Trash2 className="h-3.5 w-3.5" aria-hidden />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card className="space-y-3 p-4">
        <div className="flex items-start justify-between gap-2">
          <SectionTitle title="Refund" hint="Satu pesanan hanya boleh memiliki satu refund aktif" className="mb-0" />
          {!refund ? (
            <Button size="sm" variant="soft" onClick={() => setShowRefundForm((value) => !value)}>
              {showRefundForm ? 'Tutup' : 'Catat refund'}
            </Button>
          ) : null}
        </div>

        {refund ? (
          <div className="space-y-2 rounded-2xl bg-danger-soft p-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-danger">{rupiah(refund.amount)}</p>
                <p className="text-[0.68rem] text-secondary">{formatDate(refund.refunded_at)}</p>
                {refund.reason ? <p className="mt-1 text-[0.68rem] text-secondary">{refund.reason}</p> : null}
              </div>
              <Button size="sm" variant="secondary" icon={Trash2} onClick={() => setConfirmDeleteRefund(true)}>
                Hapus
              </Button>
            </div>
            <p className="text-[0.65rem] text-secondary">
              Refund mengurangi pendapatan neto. Hapus hanya bila refund benar-benar dicatat keliru.
            </p>
          </div>
        ) : showRefundForm ? (
          <div className="space-y-3 rounded-2xl bg-surface-muted p-3">
            <Field label="Tanggal refund" required>
              <TextInput type="date" value={refundDate} onChange={(event) => setRefundDate(event.target.value)} />
            </Field>
            <Field label="Nominal refund" required>
              <TextInput
                value={refundAmount}
                onChange={(event) => setRefundAmount(event.target.value)}
                placeholder="0"
                inputMode="numeric"
              />
            </Field>
            <Field label="Alasan">
              <TextArea
                value={refundReason}
                onChange={(event) => setRefundReason(event.target.value)}
                placeholder="Contoh: barang rusak"
              />
            </Field>
            <Button fullWidth loading={busy} onClick={submitRefund}>
              Simpan refund
            </Button>
          </div>
        ) : (
          <p className="text-xs text-secondary">Belum ada refund pada pesanan ini.</p>
        )}
      </Card>

      <Card className="space-y-3 p-4">
        <div className="flex items-start justify-between gap-2">
          <SectionTitle
            title="Pencairan marketplace"
            hint="Kas aktual yang diterima, bukan tambahan laba"
            className="mb-0"
          />
          <Button size="sm" variant="soft" onClick={() => setShowSettlementForm((value) => !value)}>
            {showSettlementForm ? 'Tutup' : 'Catat cair'}
          </Button>
        </div>

        <div className="rounded-2xl bg-surface-muted p-3">
          <MetricRow label="Pendapatan neto" value={rupiah(netRevenue)} />
          <MetricRow label="Sudah dicairkan" value={rupiah(settledTotal)} />
          <MetricRow label="Sisa belum cair" value={rupiah(remainingToSettle)} strong />
        </div>

        {showSettlementForm ? (
          <div className="space-y-3 rounded-2xl bg-surface-muted p-3">
            <Field label="Tanggal pencairan" required>
              <TextInput
                type="date"
                value={settlementDate}
                onChange={(event) => setSettlementDate(event.target.value)}
              />
            </Field>
            <Field label="Nominal" required>
              <TextInput
                value={settlementAmount}
                onChange={(event) => setSettlementAmount(event.target.value)}
                placeholder="0"
                inputMode="numeric"
              />
            </Field>
            <Field label="Referensi">
              <TextInput
                value={settlementReference}
                onChange={(event) => setSettlementReference(event.target.value)}
                placeholder="ID pencairan marketplace"
              />
            </Field>
            <Field label="Catatan">
              <TextArea
                value={settlementNotes}
                onChange={(event) => setSettlementNotes(event.target.value)}
                placeholder="Opsional"
              />
            </Field>
            <Button fullWidth loading={busy} onClick={submitSettlement}>
              Simpan pencairan
            </Button>
          </div>
        ) : null}

        {settlements.length === 0 ? (
          <p className="text-xs text-secondary">Belum ada pencairan yang dicatat.</p>
        ) : (
          <div className="divide-y divide-outline/70">
            {settlements.map((settlement) => (
              <div key={settlement.id} className="flex items-start justify-between gap-3 py-2.5">
                <div className="min-w-0">
                  <p className="text-xs font-semibold tabular-nums text-on-surface">{rupiah(settlement.amount)}</p>
                  <p className="mt-0.5 text-[0.65rem] text-secondary">
                    {formatDate(settlement.settled_at)}
                    {settlement.reference ? ` · ${settlement.reference}` : ''}
                  </p>
                  {settlement.notes ? <p className="text-[0.65rem] text-muted">{settlement.notes}</p> : null}
                </div>
                <button
                  type="button"
                  aria-label="Hapus pencairan"
                  onClick={() => setConfirmDeleteSettlement(settlement.id)}
                  className="rounded-full bg-danger-soft p-2 text-danger"
                >
                  <Trash2 className="h-3.5 w-3.5" aria-hidden />
                </button>
              </div>
            ))}
          </div>
        )}
      </Card>

      {order.notes ? (
        <Card className="space-y-1 p-4">
          <p className="text-sm font-semibold text-on-surface">Catatan</p>
          <p className="text-xs leading-relaxed text-secondary">{order.notes}</p>
        </Card>
      ) : null}

      <Card className="p-4">
        <SectionTitle title="Riwayat audit pesanan" hint="Perubahan fee, refund, dan pencairan juga tercatat terpisah" />
        {audit.length === 0 ? (
          <p className="text-xs text-secondary">Belum ada catatan audit untuk pesanan ini.</p>
        ) : (
          <div className="divide-y divide-outline/70">
            {audit.map((log) => (
              <div key={log.id} className="py-2.5">
                <p className="text-xs font-medium text-on-surface">{log.summary}</p>
                <p className="mt-0.5 text-[0.65rem] text-secondary">{formatDateTime(log.created_at)}</p>
              </div>
            ))}
          </div>
        )}
      </Card>

      <div className="grid grid-cols-2 gap-2">
        <Button variant="secondary" icon={Pencil} onClick={() => navigate(`/orders/${order.id}/edit`)}>
          Ubah pesanan
        </Button>
        <Button variant="secondary" icon={Trash2} onClick={() => setConfirmDeleteOrder(true)}>
          Hapus pesanan
        </Button>
      </div>

      <p className="px-1 text-center text-[0.65rem] leading-relaxed text-muted">
        Omzet hanya dihitung dari status Terkirim atau Selesai. Diskon marketplace tidak mengurangi omzet penjual. PPN
        tidak mengurangi laba; PPh Final mengurangi laba.
      </p>

      <ConfirmDialog
        open={confirmDeleteOrder}
        title="Hapus pesanan ini?"
        description="Pesanan disembunyikan dari daftar dan laporan, tetapi jejak audit tetap tersimpan. Tindakan ini tidak dapat dibatalkan dari aplikasi."
        confirmLabel="Hapus"
        busy={busy}
        onCancel={() => setConfirmDeleteOrder(false)}
        onConfirm={() =>
          void runAction(async () => {
            await deleteOrder(getDb(), order.id);
            setConfirmDeleteOrder(false);
            navigate('/orders', { replace: true });
          }, 'Pesanan dihapus.')
        }
      />

      <ConfirmDialog
        open={confirmDeleteRefund}
        title="Hapus refund ini?"
        description="Pendapatan neto pesanan akan kembali seperti sebelum refund. Tindakan ini tercatat di audit log."
        confirmLabel="Hapus refund"
        busy={busy}
        onCancel={() => setConfirmDeleteRefund(false)}
        onConfirm={() =>
          void runAction(async () => {
            if (refund) {
              await deleteRefund(getDb(), refund.id);
            }
            setConfirmDeleteRefund(false);
          }, 'Refund dihapus.')
        }
      />

      <ConfirmDialog
        open={confirmDeleteFee !== null}
        title="Hapus fee marketplace?"
        description="Fee akan dihapus dari perhitungan laba pesanan ini. Tindakan ini tercatat di audit log."
        confirmLabel="Hapus fee"
        busy={busy}
        onCancel={() => setConfirmDeleteFee(null)}
        onConfirm={() =>
          void runAction(async () => {
            if (confirmDeleteFee) {
              await deleteOrderFee(getDb(), confirmDeleteFee);
            }
            setConfirmDeleteFee(null);
          }, 'Fee marketplace dihapus.')
        }
      />

      <ConfirmDialog
        open={confirmDeleteSettlement !== null}
        title="Hapus pencairan?"
        description="Nominal pencairan dihapus dari arus kas pesanan ini. Tindakan ini tercatat di audit log."
        confirmLabel="Hapus pencairan"
        busy={busy}
        onCancel={() => setConfirmDeleteSettlement(null)}
        onConfirm={() =>
          void runAction(async () => {
            if (confirmDeleteSettlement) {
              await deleteSettlement(getDb(), confirmDeleteSettlement);
            }
            setConfirmDeleteSettlement(null);
          }, 'Pencairan dihapus.')
        }
      />
    </div>
  );
}
