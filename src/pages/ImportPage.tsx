import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircle2, FileSpreadsheet, FileUp, RotateCcw, Upload } from 'lucide-react';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Feedback,
  Field,
  LoadingCard,
  SectionTitle,
  Select,
  StatCard,
  StatusBadge,
  useToast,
} from '../components/ui';
import { useDbQuery, useInvalidateAll } from '../hooks/queries';
import { getDb } from '../lib/db';
import { readPickedFile, shareStoredFile } from '../lib/files';
import { listStores } from '../services/stores';
import {
  IMPORT_FIELD_LABELS,
  REQUIRED_IMPORT_FIELDS,
  analyzeImport,
  autoMapImportHeaders,
  commitImport,
  importFailuresCsv,
  parseImportFile,
  type ImportField,
  type ImportMapping,
  type ImportPreview,
  type ImportResult,
  type ParsedImportFile,
} from '../services/import';
import type { ImportBatch } from '../lib/types';
import { formatDate, formatDateTime } from '../lib/date';
import { formatInteger, rupiah } from '../lib/money';
import { errorMessage } from '../lib/errors';

interface SelectedFile {
  name: string;
  bytes: Uint8Array;
  parsed: ParsedImportFile;
}

interface ImportBatchWithStore extends ImportBatch {
  store_name: string | null;
}

const BATCH_STATUS_LABELS: Record<string, string> = {
  completed: 'Selesai',
  completed_with_errors: 'Sebagian',
  failed: 'Gagal',
  processing: 'Proses',
};

function batchTone(status: string): 'success' | 'warning' | 'danger' | 'neutral' {
  if (status === 'completed') {
    return 'success';
  }

  if (status === 'completed_with_errors') {
    return 'warning';
  }

  if (status === 'failed') {
    return 'danger';
  }

  return 'neutral';
}

export default function ImportPage() {
  const navigate = useNavigate();
  const invalidateAll = useInvalidateAll();
  const { showToast } = useToast();
  const inputRef = useRef<HTMLInputElement>(null);

  const [storeId, setStoreId] = useState('');
  const [selected, setSelected] = useState<SelectedFile | null>(null);
  const [mapping, setMapping] = useState<ImportMapping>({});
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [showMapping, setShowMapping] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const storesQuery = useDbQuery(['stores', false], (db) => listStores(db));
  const historyQuery = useDbQuery(['import', 'history'], (db) =>
    db.query<ImportBatchWithStore>(
      `SELECT ib.*, s.name AS store_name
       FROM import_batches ib
       LEFT JOIN stores s ON s.id = ib.store_id
       ORDER BY ib.created_at DESC
       LIMIT 12`,
    ),
  );

  const stores = storesQuery.data ?? [];
  const history = historyQuery.data ?? [];
  const missingFields = REQUIRED_IMPORT_FIELDS.filter((field) => mapping[field] === undefined);

  const resetFlow = () => {
    setSelected(null);
    setMapping({});
    setPreview(null);
    setResult(null);
    setShowMapping(false);
    setError(null);
    if (inputRef.current) {
      inputRef.current.value = '';
    }
  };

  const chooseStore = (value: string) => {
    setStoreId(value);
    if (selected) {
      resetFlow();
    }
  };

  const handleFile = async (file: File | undefined) => {
    setError(null);

    if (!file) {
      return;
    }

    if (!storeId) {
      setError('Pilih toko tujuan terlebih dahulu.');
      return;
    }

    setBusy(true);

    try {
      const picked = await readPickedFile(file);
      const parsed = parseImportFile(picked.name, picked.bytes);
      const initialMapping = autoMapImportHeaders(parsed.headers);
      const analysis = await analyzeImport(getDb(), storeId, picked.name, parsed, initialMapping);

      setSelected({ name: picked.name, bytes: picked.bytes, parsed });
      setMapping(initialMapping);
      setPreview(analysis);
      setResult(null);
    } catch (caught) {
      setError(errorMessage(caught, 'File import tidak dapat dibaca.'));
      setSelected(null);
      setPreview(null);
      setMapping({});
    } finally {
      setBusy(false);
    }
  };

  const updateMapping = async (field: ImportField, value: string) => {
    if (!selected || !storeId) {
      return;
    }

    const next: ImportMapping = { ...mapping };

    if (value === '') {
      delete next[field];
    } else {
      next[field] = Number(value);
    }

    setMapping(next);
    setError(null);

    try {
      setPreview(await analyzeImport(getDb(), storeId, selected.name, selected.parsed, next));
    } catch (caught) {
      setError(errorMessage(caught, 'Pemetaan kolom gagal diterapkan.'));
    }
  };

  const runImport = async () => {
    setError(null);

    if (!selected || !storeId) {
      setError('Pilih toko dan file terlebih dahulu.');
      return;
    }

    if (missingFields.length > 0) {
      setError(`Kolom wajib belum dipetakan: ${missingFields.map((field) => IMPORT_FIELD_LABELS[field]).join(', ')}.`);
      return;
    }

    setBusy(true);

    try {
      const imported = await commitImport(
        getDb(),
        storeId,
        selected.name,
        selected.bytes,
        selected.parsed,
        mapping,
      );
      setResult(imported);
      setPreview(null);
      await invalidateAll();
      showToast(
        imported.duplicateFile
          ? 'File ini sudah pernah diimpor. Tidak ada data baru yang dibuat.'
          : `Import selesai. ${imported.ordersImported} pesanan masuk.`,
      );
    } catch (caught) {
      setError(errorMessage(caught, 'Import gagal diproses.'));
    } finally {
      setBusy(false);
    }
  };

  const exportFailures = async () => {
    if (!result) {
      return;
    }

    setBusy(true);
    setError(null);

    try {
      const file = await importFailuresCsv(getDb(), result.batchId);
      await shareStoredFile(file.path, 'CSV baris import gagal', 'text/csv');
      showToast(`CSV ${file.rows} baris gagal disiapkan.`);
    } catch (caught) {
      setError(errorMessage(caught, 'CSV baris gagal tidak dapat dibuat.'));
    } finally {
      setBusy(false);
    }
  };

  if (storesQuery.isLoading || historyQuery.isLoading) {
    return (
      <div className="space-y-3">
        <LoadingCard rows={3} />
        <LoadingCard rows={5} />
      </div>
    );
  }

  if (stores.length === 0) {
    return (
      <Card className="space-y-3 p-6 text-center">
        <FileUp className="mx-auto h-8 w-8 text-muted" aria-hidden />
        <p className="font-heading text-base font-bold text-on-surface">Belum ada toko</p>
        <p className="text-xs text-secondary">
          Tambahkan toko terlebih dahulu agar import tahu pesanan ini milik toko mana.
        </p>
        <Button variant="secondary" onClick={() => navigate('/stores/create')}>
          Tambah toko
        </Button>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Feedback error={error} onDismiss={() => setError(null)} />

      <Card className="space-y-3 p-4">
        <Field label="Toko tujuan" required>
          <Select value={storeId} onChange={(event) => chooseStore(event.target.value)}>
            <option value="">Pilih toko</option>
            {stores.map((store) => (
              <option key={store.id} value={store.id}>
                {store.name} · {store.marketplace_name} ({store.code})
              </option>
            ))}
          </Select>
        </Field>

        {!storeId ? (
          <p className="rounded-2xl bg-warning-soft p-3 text-[0.68rem] leading-relaxed text-warning">
            Pilih toko sebelum membaca file agar setiap pesanan masuk ke toko yang benar.
          </p>
        ) : null}

        <input
          ref={inputRef}
          type="file"
          accept=".csv,.txt,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          className="hidden"
          onChange={(event) => void handleFile(event.target.files?.[0])}
        />

        {!result ? (
          <div className="rounded-2xl bg-surface-muted p-4">
            <div className="flex items-start gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-primary-soft text-primary-text">
                <FileSpreadsheet className="h-5 w-5" aria-hidden />
              </span>
              <div>
                <p className="text-sm font-semibold text-on-surface">Pilih file marketplace</p>
                <p className="mt-1 text-[0.7rem] leading-relaxed text-secondary">
                  Ekspor pesanan dari Shopee atau TikTok Shop sebagai CSV atau XLSX. File dibaca di perangkat ini dan
                  tidak dikirim ke server mana pun.
                </p>
              </div>
            </div>
            <div className="mt-3 rounded-2xl bg-surface p-3">
              <p className="text-[0.68rem] leading-relaxed text-secondary">
                Kolom wajib: Order ID, Tanggal pesanan, Status, SKU, Nama produk, Jumlah, dan Harga satuan. Diskon, HPP,
                fee, refund, dan tanggal selesai bersifat opsional.
              </p>
            </div>
            <Button
              className="mt-3"
              fullWidth
              icon={Upload}
              loading={busy}
              disabled={!storeId}
              onClick={() => inputRef.current?.click()}
            >
              {selected ? 'Pilih file lain' : 'Pilih file CSV/XLSX'}
            </Button>
            <p className="mt-2 text-center text-[0.65rem] text-muted">
              File yang sama tidak membuat pesanan ganda. Order ID yang sudah ada dilewati.
            </p>
          </div>
        ) : null}
      </Card>

      {result ? (
        <Card className="space-y-3 border-success/30 bg-success-soft p-4">
          <div className="flex items-start gap-2 text-success">
            <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" aria-hidden />
            <div>
              <p className="text-sm font-semibold">Import selesai diproses</p>
              <p className="mt-0.5 text-[0.68rem] leading-relaxed text-on-surface">
                {result.duplicateFile
                  ? 'File ini sudah pernah diimport sebelumnya, jadi tidak ada data baru yang dibuat.'
                  : 'Baris valid sudah diproses. Baris gagal tidak disimpan dan dapat diunduh untuk diperbaiki.'}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <div className="rounded-2xl bg-surface/80 p-2.5">
              <p className="font-heading text-lg font-bold tabular-nums text-on-surface">
                {formatInteger(result.ordersImported)}
              </p>
              <p className="text-[0.62rem] text-secondary">pesanan masuk</p>
            </div>
            <div className="rounded-2xl bg-surface/80 p-2.5">
              <p className="font-heading text-lg font-bold tabular-nums text-on-surface">
                {formatInteger(result.rowsSkipped)}
              </p>
              <p className="text-[0.62rem] text-secondary">baris dilewati</p>
            </div>
            <div className="rounded-2xl bg-surface/80 p-2.5">
              <p
                className={`font-heading text-lg font-bold tabular-nums ${
                  result.rowsFailed > 0 ? 'text-danger' : 'text-on-surface'
                }`}
              >
                {formatInteger(result.rowsFailed)}
              </p>
              <p className="text-[0.62rem] text-secondary">baris gagal</p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {result.rowsFailed > 0 ? (
              <Button size="sm" variant="secondary" icon={FileSpreadsheet} loading={busy} onClick={() => void exportFailures()}>
                Unduh CSV gagal
              </Button>
            ) : null}
            <Button size="sm" variant="secondary" icon={RotateCcw} onClick={resetFlow}>
              Import lagi
            </Button>
            <Button size="sm" onClick={() => navigate('/orders')}>
              Lihat pesanan
            </Button>
          </div>
        </Card>
      ) : null}

      {selected && preview ? (
        <>
          <Card className="space-y-3 overflow-hidden border-primary/30 bg-gradient-to-br from-primary-soft via-surface to-surface p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-primary-text">
                  Pratinjau import
                </p>
                <p className="mt-1 truncate text-sm font-semibold text-on-surface">{selected.name}</p>
                <p className="mt-0.5 text-[0.65rem] text-secondary">
                  {formatInteger(preview.totalRows)} baris dibaca · belum ada data yang disimpan
                </p>
              </div>
              <Badge tone={missingFields.length > 0 ? 'danger' : 'success'}>
                {missingFields.length > 0 ? 'Perlu pemetaan' : 'Siap diimport'}
              </Badge>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <StatCard label="Pesanan" value={formatInteger(preview.orderCount)} />
              <StatCard label="Baris valid" value={formatInteger(preview.validRows)} tone="success" />
              <StatCard
                label="Baris gagal"
                value={formatInteger(preview.invalidRows)}
                tone={preview.invalidRows > 0 ? 'danger' : 'neutral'}
              />
            </div>
          </Card>

          {missingFields.length > 0 ? (
            <Card className="border-danger/30 bg-danger-soft p-4">
              <p className="text-sm font-semibold text-danger">Kolom wajib belum dipetakan</p>
              <p className="mt-1 text-[0.68rem] leading-relaxed text-danger">
                {missingFields.map((field) => IMPORT_FIELD_LABELS[field]).join(', ')}. Sesuaikan pemetaan di bawah
                sebelum import.
              </p>
            </Card>
          ) : null}

          <Card className="space-y-3 p-4">
            <div className="flex items-start justify-between gap-2">
              <SectionTitle
                title="Pemetaan kolom"
                hint="Pemetaan otomatis bisa disesuaikan bila ada kolom yang salah terbaca"
                className="mb-0"
              />
              <Button size="sm" variant="soft" onClick={() => setShowMapping((value) => !value)}>
                {showMapping ? 'Tutup' : 'Sesuaikan'}
              </Button>
            </div>

            {showMapping ? (
              <div className="space-y-2.5">
                {(Object.keys(IMPORT_FIELD_LABELS) as ImportField[]).map((field) => (
                  <Field
                    key={field}
                    label={`${IMPORT_FIELD_LABELS[field]}${
                      REQUIRED_IMPORT_FIELDS.includes(field) ? ' *' : ''
                    }`}
                  >
                    <Select
                      value={mapping[field] === undefined ? '' : String(mapping[field])}
                      onChange={(event) => void updateMapping(field, event.target.value)}
                    >
                      <option value="">— Tidak dipetakan —</option>
                      {preview.headers.map((header, index) => (
                        <option key={`${header}-${index}`} value={String(index)}>
                          {header || `Kolom ${index + 1}`}
                        </option>
                      ))}
                    </Select>
                  </Field>
                ))}
              </div>
            ) : (
              <p className="text-[0.68rem] leading-relaxed text-secondary">
                Pemetaan otomatis sudah diterapkan. Buka penyesuaian bila ada kolom yang salah dibaca.
              </p>
            )}
          </Card>

          {preview.rows.length > 0 ? (
            <Card className="p-4">
              <SectionTitle title="Contoh pesanan" hint="Maksimal 10 pesanan pertama" />
              <div className="divide-y divide-outline/70">
                {preview.rows.map((row) => (
                  <div key={row.orderId} className="flex items-start justify-between gap-3 py-2.5">
                    <div className="min-w-0">
                      <p className="truncate text-xs font-semibold text-on-surface">{row.orderId}</p>
                      <p className="mt-0.5 text-[0.65rem] text-secondary">
                        {formatDate(row.orderedAt)} · <StatusBadge status={row.status} /> · {row.items} item
                      </p>
                    </div>
                    <p className="shrink-0 text-xs font-semibold tabular-nums text-on-surface">
                      {rupiah(row.gross)}
                    </p>
                  </div>
                ))}
              </div>
            </Card>
          ) : null}

          {preview.errors.length > 0 ? (
            <Card className="p-4">
              <SectionTitle title="Baris bermasalah" hint="Baris gagal tidak disimpan" />
              <div className="max-h-72 space-y-2 overflow-y-auto">
                {preview.errors.map((rowError) => (
                  <div key={rowError.row} className="rounded-2xl bg-danger-soft p-3">
                    <p className="text-xs font-semibold text-danger">Baris {rowError.row}</p>
                    <p className="mt-0.5 text-[0.68rem] leading-relaxed text-danger">
                      {rowError.messages.join(' ')}
                    </p>
                  </div>
                ))}
              </div>
            </Card>
          ) : null}

          <div className="grid grid-cols-2 gap-2">
            <Button variant="secondary" onClick={resetFlow}>
              Pilih file lain
            </Button>
            <Button
              icon={Upload}
              loading={busy}
              disabled={missingFields.length > 0 || preview.validRows === 0}
              onClick={() => void runImport()}
            >
              Import {formatInteger(preview.validRows)} baris
            </Button>
          </div>
        </>
      ) : null}

      <Card className="p-4">
        <SectionTitle title="Riwayat import" hint="Termasuk file yang gagal atau dilewati" />
        {history.length === 0 ? (
          <EmptyState
            icon={FileUp}
            title="Belum ada file yang diimport"
            description="Riwayat muncul setelah file marketplace selesai diproses."
          />
        ) : (
          <div className="space-y-2">
            {history.map((batch) => {
              const tone = batchTone(batch.status);

              return (
                <div key={batch.id} className="rounded-2xl border border-outline/70 bg-surface p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-xs font-semibold text-on-surface">{batch.file_name}</p>
                      <p className="mt-0.5 text-[0.65rem] text-secondary">
                        {batch.store_name ?? 'Toko tidak ditemukan'} · {formatDateTime(batch.created_at)}
                      </p>
                    </div>
                    <Badge tone={tone}>{BATCH_STATUS_LABELS[batch.status] ?? batch.status}</Badge>
                  </div>
                  <p className="mt-1.5 text-[0.65rem] text-secondary">
                    {formatInteger(batch.rows_imported)} baris masuk · {formatInteger(batch.rows_failed)} gagal ·{' '}
                    {formatInteger(batch.rows_skipped)} dilewati
                  </p>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      <p className="px-1 text-center text-[0.65rem] leading-relaxed text-muted">
        Import bersifat idempotent per file dan per Order ID. Baris yang gagal tidak mengubah data lama; pesan kesalahan
        dapat diunduh agar file sumber diperbaiki.
      </p>
    </div>
  );
}
