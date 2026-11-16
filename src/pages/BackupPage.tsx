import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Archive,
  CheckCircle2,
  Database,
  Download,
  FileJson,
  RotateCcw,
  Settings,
  ShieldAlert,
  ShieldCheck,
} from 'lucide-react';
import {
  Badge,
  Button,
  Card,
  ConfirmDialog,
  EmptyState,
  Feedback,
  LoadingCard,
  SectionTitle,
  StatCard,
  useToast,
} from '../components/ui';
import { queryKeys, useDbQuery, useInvalidateAll } from '../hooks/queries';
import { getDb } from '../lib/db';
import { readPickedFile } from '../lib/files';
import {
  BACKUP_REASON_LABELS,
  backupHistory,
  createBackup,
  restoreBackupText,
  shareBackup,
} from '../services/backup';
import { getSettings } from '../services/settings';
import { formatDateTime } from '../lib/date';
import { errorMessage } from '../lib/errors';

interface RestoreCandidate {
  name: string;
  text: string;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`;
  }

  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }

  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export default function BackupPage() {
  const navigate = useNavigate();
  const invalidateAll = useInvalidateAll();
  const { showToast } = useToast();
  const restoreInputRef = useRef<HTMLInputElement>(null);

  const [restoreCandidate, setRestoreCandidate] = useState<RestoreCandidate | null>(null);
  const [confirmRestore, setConfirmRestore] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const dataQuery = useDbQuery(queryKeys.backupHistory(), async (db) => {
    const [history, settings] = await Promise.all([backupHistory(db, 20), getSettings(db)]);

    return {
      history,
      autoBackup: settings.auto_backup_enabled !== '0',
      retention: Math.max(1, Number.parseInt(settings.backup_retention ?? '10', 10) || 10),
      lastAutoBackupAt: settings.last_auto_backup_at ?? null,
    };
  });

  const data = dataQuery.data;
  const history = data?.history ?? [];
  const last = history[0] ?? null;

  const runAction = async (action: () => Promise<void>, success: string) => {
    setError(null);
    setBusy(true);

    try {
      await action();
      await invalidateAll();
      showToast(success);
    } catch (caught) {
      setError(errorMessage(caught, 'Tindakan backup gagal diproses.'));
    } finally {
      setBusy(false);
    }
  };

  const makeBackup = () => {
    void runAction(async () => {
      await createBackup(getDb());
    }, 'Backup JSON dibuat di penyimpanan aplikasi.');
  };

  const share = (backup: (typeof history)[number]) => {
    void runAction(async () => {
      await shareBackup(backup);
    }, 'File backup disiapkan untuk dibagikan.');
  };

  const chooseRestoreFile = async (file: File | undefined) => {
    setError(null);

    if (!file) {
      return;
    }

    try {
      const picked = await readPickedFile(file);
      setRestoreCandidate({ name: picked.name, text: picked.text });
    } catch (caught) {
      setError(errorMessage(caught, 'File backup tidak dapat dibaca.'));
    }
  };

  const performRestore = () => {
    if (!restoreCandidate) {
      return;
    }

    void runAction(async () => {
      await restoreBackupText(getDb(), restoreCandidate.text, restoreCandidate.name);
      setRestoreCandidate(null);
      setConfirmRestore(false);
    }, 'Data dipulihkan dari backup. Backup pengaman tersimpan di riwayat.');
  };

  if (dataQuery.isLoading) {
    return (
      <div className="space-y-3">
        <LoadingCard rows={3} />
        <LoadingCard rows={5} />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Feedback error={error} onDismiss={() => setError(null)} />

      <Card className="space-y-3 overflow-hidden border-primary/30 bg-gradient-to-br from-primary-soft via-surface to-surface p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-primary-text">
              Backup terakhir
            </p>
            <p className="mt-1 font-heading text-lg font-bold text-on-surface">
              {last ? formatDateTime(last.created_at) : 'Belum pernah backup'}
            </p>
            <p className="mt-1 text-[0.68rem] leading-relaxed text-secondary">
              {last
                ? `${last.file_name} · ${formatBytes(last.size)} · skema ${last.schema_version}`
                : 'Buat backup pertama sebelum mengisi data penting.'}
            </p>
          </div>
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary text-on-surface shadow-soft">
            <Archive className="h-6 w-6" aria-hidden />
          </span>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-2xl bg-surface/80 p-3">
            <p className="text-sm font-semibold text-on-surface">{data?.autoBackup ? 'Aktif' : 'Nonaktif'}</p>
            <p className="text-[0.65rem] text-secondary">Backup otomatis saat aplikasi dibuka</p>
          </div>
          <div className="rounded-2xl bg-surface/80 p-3">
            <p className="text-sm font-semibold text-on-surface">{data?.retention ?? 10} file</p>
            <p className="text-[0.65rem] text-secondary">Disimpan sebelum dipangkas</p>
          </div>
        </div>

        <Button fullWidth icon={Archive} loading={busy} onClick={makeBackup}>
          Buat backup sekarang
        </Button>
        <p className="text-[0.65rem] leading-relaxed text-secondary">
          Backup berisi seluruh tabel dalam satu file JSON Penca. File ini adalah jalur pemulihan yang didukung aplikasi
          dan disimpan di penyimpanan lokal aplikasi.
        </p>
      </Card>

      <div className="grid grid-cols-2 gap-2.5">
        <StatCard label="Total backup" value={`${history.length}`} hint="Maksimal sesuai retensi" icon={Database} />
        <StatCard
          label="Backup otomatis terakhir"
          value={data?.lastAutoBackupAt ? formatDateTime(data.lastAutoBackupAt) : 'Belum ada'}
          icon={CheckCircle2}
        />
      </div>

      <Card className="space-y-3 p-4">
        <div className="flex items-start gap-2">
          <RotateCcw className="mt-0.5 h-5 w-5 shrink-0 text-warning" aria-hidden />
          <div>
            <p className="text-sm font-semibold text-on-surface">Restore dari backup JSON</p>
            <p className="mt-1 text-[0.68rem] leading-relaxed text-secondary">
              Restore mengganti seluruh data toko, produk, pesanan, biaya, dan pajak. Sebelum data diganti, aplikasi
              membuat backup pengaman otomatis. Restore hanya menerima file JSON Penca yang checksum-nya cocok.
            </p>
          </div>
        </div>

        <input
          ref={restoreInputRef}
          type="file"
          accept=".json,application/json"
          className="hidden"
          onChange={(event) => void chooseRestoreFile(event.target.files?.[0])}
        />

        {restoreCandidate ? (
          <div className="space-y-2 rounded-2xl bg-surface-muted p-3">
            <div className="flex items-start gap-2">
              <FileJson className="mt-0.5 h-4 w-4 shrink-0 text-primary-text" aria-hidden />
              <div className="min-w-0">
                <p className="truncate text-xs font-semibold text-on-surface">{restoreCandidate.name}</p>
                <p className="mt-0.5 text-[0.65rem] text-secondary">
                  File dipilih. Periksa kembali sebelum memulihkan data.
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="secondary" fullWidth onClick={() => setRestoreCandidate(null)}>
                Batalkan
              </Button>
              <Button size="sm" variant="danger" fullWidth onClick={() => setConfirmRestore(true)}>
                Restore data
              </Button>
            </div>
          </div>
        ) : (
          <Button
            variant="secondary"
            fullWidth
            icon={Download}
            onClick={() => restoreInputRef.current?.click()}
          >
            Pilih file JSON
          </Button>
        )}

        <div className="rounded-2xl border border-warning/30 bg-warning-soft p-3">
          <div className="flex items-start gap-2">
            <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-warning" aria-hidden />
            <p className="text-[0.68rem] leading-relaxed text-warning">
              Snapshot database .db tidak dibuat oleh adapter SQLite native Penca. Jangan menganggap file .db tersedia
              atau dapat dipulihkan dari aplikasi ini; gunakan backup JSON di atas.
            </p>
          </div>
        </div>
      </Card>

      <Card className="space-y-3 p-4">
        <div className="flex items-start justify-between gap-2">
          <SectionTitle title="Riwayat backup" hint="File lama dipangkas sesuai retensi" className="mb-0" />
          <Button size="sm" variant="ghost" icon={Settings} onClick={() => navigate('/settings')}>
            Pengaturan
          </Button>
        </div>

        {history.length === 0 ? (
          <EmptyState
            icon={Archive}
            title="Belum ada backup"
            description="Buat backup pertama agar data keuangan bisa dipulihkan bila perangkat hilang atau aplikasi dipasang ulang."
            action={
              <Button size="sm" variant="secondary" icon={Archive} onClick={makeBackup}>
                Buat backup
              </Button>
            }
          />
        ) : (
          <div className="space-y-2">
            {history.map((backup) => (
              <div key={backup.id} className="rounded-2xl border border-outline/70 bg-surface p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <p className="truncate text-xs font-semibold text-on-surface">{backup.file_name}</p>
                      <Badge tone={backup.reason === 'pre_restore' ? 'primary' : 'success'}>
                        {BACKUP_REASON_LABELS[backup.reason] ?? backup.reason}
                      </Badge>
                    </div>
                    <p className="mt-0.5 text-[0.65rem] text-secondary">
                      {formatDateTime(backup.created_at)} · {formatBytes(backup.size)}
                    </p>
                    <p className="text-[0.65rem] text-muted">
                      SHA-256 {backup.checksum.slice(0, 16)}… · skema {backup.schema_version}
                    </p>
                    {backup.restored_at ? (
                      <p className="mt-0.5 text-[0.65rem] text-success">
                        Pernah dipulihkan {formatDateTime(backup.restored_at)}
                      </p>
                    ) : null}
                  </div>
                  <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-success" aria-hidden />
                </div>
                <div className="mt-2 flex gap-2">
                  <Button
                    size="sm"
                    variant="secondary"
                    fullWidth
                    icon={Download}
                    loading={busy}
                    onClick={() => share(backup)}
                  >
                    Bagikan JSON
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <p className="px-1 text-center text-[0.65rem] leading-relaxed text-muted">
        File backup memuat seluruh data keuangan. Simpan hanya di tempat yang Anda percaya. Mengunggah atau membagikan
        backup ke pihak lain dapat membocorkan data usaha.
      </p>

      <ConfirmDialog
        open={confirmRestore}
        title="Ganti seluruh data saat ini?"
        description={`Semua data akan diganti dengan isi backup ${restoreCandidate?.name ?? ''}. Backup pengaman dibuat terlebih dahulu, dan tindakan ini tercatat di audit log.`}
        confirmLabel="Ya, restore"
        busy={busy}
        onCancel={() => setConfirmRestore(false)}
        onConfirm={performRestore}
      />
    </div>
  );
}
