import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Archive,
  Database,
  Lock,
  Save,
  ScrollText,
  ShieldCheck,
  Unlock,
  UserRound,
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
  Switch,
  TextInput,
  useToast,
} from '../components/ui';
import { queryKeys, useDbQuery, useInvalidateAll } from '../hooks/queries';
import { getDb } from '../lib/db';
import { getSettings, putSetting } from '../services/settings';
import { listPeriodLocks, lockPeriod, unlockPeriod } from '../services/period-locks';
import { lastBackup } from '../services/backup';
import { APP_VERSION } from '../lib/constants';
import {
  currentPeriod,
  formatDateTime,
  monthLabel,
  monthOptions,
} from '../lib/date';
import {
  basisPointsToPercent,
  formatInteger,
  percentToBasisPoints,
} from '../lib/money';
import { errorMessage } from '../lib/errors';

interface SettingsForm {
  operatorName: string;
  ppnDefault: string;
  pphDefault: string;
  autoBackup: boolean;
  retention: string;
  lockPeriod: string;
}

export default function SettingsPage() {
  const navigate = useNavigate();
  const invalidateAll = useInvalidateAll();
  const { showToast } = useToast();
  const initialized = useRef(false);

  const [form, setForm] = useState<SettingsForm>({
    operatorName: '',
    ppnDefault: '11',
    pphDefault: '0,5',
    autoBackup: true,
    retention: '10',
    lockPeriod: currentPeriod(),
  });
  const [confirmUnlock, setConfirmUnlock] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const dataQuery = useDbQuery(queryKeys.settings(), async (db) => {
    const [settings, locks, backup] = await Promise.all([
      getSettings(db),
      listPeriodLocks(db),
      lastBackup(db),
    ]);
    const orderRows = await db.query<{ count: number }>(
      'SELECT COUNT(*) AS count FROM orders WHERE deleted_at IS NULL',
    );
    const auditRows = await db.query<{ count: number }>('SELECT COUNT(*) AS count FROM audit_logs');

    return {
      settings,
      locks,
      lastBackup: backup,
      orderCount: Number(orderRows[0]?.count ?? 0),
      auditCount: Number(auditRows[0]?.count ?? 0),
      schemaVersion: settings.schema_version ?? '1',
    };
  });

  useEffect(() => {
    if (initialized.current || !dataQuery.data) {
      return;
    }

    const { settings } = dataQuery.data;
    const ppnDefault = Number.parseInt(settings.ppn_default_bp ?? '1100', 10);
    const pphDefault = Number.parseInt(settings.pph_default_bp ?? '50', 10);

    setForm({
      operatorName: settings.operator_name ?? '',
      ppnDefault: basisPointsToPercent(Number.isFinite(ppnDefault) ? ppnDefault : 1100).replace('%', ''),
      pphDefault: basisPointsToPercent(Number.isFinite(pphDefault) ? pphDefault : 50).replace('%', ''),
      autoBackup: settings.auto_backup_enabled !== '0',
      retention: String(Math.max(1, Number.parseInt(settings.backup_retention ?? '10', 10) || 10)),
      lockPeriod: currentPeriod(),
    });
    initialized.current = true;
  }, [dataQuery.data]);

  const update = <Key extends keyof SettingsForm>(key: Key, value: SettingsForm[Key]) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const runAction = async (action: () => Promise<void>, success: string) => {
    setError(null);
    setBusy(true);

    try {
      await action();
      await invalidateAll();
      showToast(success);
    } catch (caught) {
      setError(errorMessage(caught, 'Pengaturan gagal disimpan.'));
    } finally {
      setBusy(false);
    }
  };

  const saveProfile = () => {
    const ppnBp = percentToBasisPoints(form.ppnDefault);
    const pphBp = percentToBasisPoints(form.pphDefault);

    if (ppnBp < 0 || ppnBp > 10000 || pphBp < 0 || pphBp > 10000) {
      setError('Tarif PPN dan PPh harus antara 0% dan 100%.');
      return;
    }

    void runAction(async () => {
      const db = getDb();
      await putSetting(db, 'operator_name', form.operatorName.trim());
      await putSetting(db, 'ppn_default_bp', ppnBp);
      await putSetting(db, 'pph_default_bp', pphBp);
    }, 'Profil operator dan tarif default disimpan.');
  };

  const saveBackupSettings = () => {
    const retention = Number.parseInt(form.retention, 10);

    if (!Number.isFinite(retention) || retention < 1 || retention > 100) {
      setError('Retensi backup harus antara 1 dan 100 file.');
      return;
    }

    void runAction(async () => {
      const db = getDb();
      await putSetting(db, 'auto_backup_enabled', form.autoBackup);
      await putSetting(db, 'backup_retention', retention);
    }, 'Pengaturan backup disimpan.');
  };

  const lockSelectedPeriod = () => {
    const existing = dataQuery.data?.locks.some((lock) => lock.period === form.lockPeriod);

    if (existing) {
      setError(`Periode ${monthLabel(form.lockPeriod)} sudah terkunci.`);
      return;
    }

    void runAction(async () => {
      await lockPeriod(getDb(), form.lockPeriod, form.operatorName.trim() || 'Operator');
    }, `Periode ${monthLabel(form.lockPeriod)} dikunci.`);
  };

  const unlockSelectedPeriod = () => {
    if (!confirmUnlock) {
      return;
    }

    void runAction(async () => {
      await unlockPeriod(getDb(), confirmUnlock, form.operatorName.trim() || 'Operator');
      setConfirmUnlock(null);
    }, `Kunci periode ${monthLabel(confirmUnlock)} dibuka.`);
  };

  if (dataQuery.isLoading) {
    return (
      <div className="space-y-3">
        <LoadingCard rows={5} />
        <LoadingCard rows={5} />
      </div>
    );
  }

  const data = dataQuery.data;
  const locks = data?.locks ?? [];

  return (
    <div className="space-y-4">
      <Feedback error={error} onDismiss={() => setError(null)} />

      <Card className="space-y-3 p-4">
        <div className="flex items-center gap-2">
          <UserRound className="h-5 w-5 text-primary-text" aria-hidden />
          <SectionTitle
            title="Profil & tarif default"
            hint="Dipakai saat toko atau profil pajak baru dibuat"
            className="mb-0"
          />
        </div>

        <Field label="Nama operator" hint="Tercatat pada audit log saat mengunci atau membuka periode.">
          <TextInput
            value={form.operatorName}
            onChange={(event) => update('operatorName', event.target.value)}
            placeholder="Nama Anda atau admin"
          />
        </Field>

        <div className="grid grid-cols-2 gap-2.5">
          <Field label="PPN default (%)">
            <TextInput
              value={form.ppnDefault}
              onChange={(event) => update('ppnDefault', event.target.value)}
              placeholder="11"
              inputMode="decimal"
            />
          </Field>
          <Field label="PPh Final default (%)">
            <TextInput
              value={form.pphDefault}
              onChange={(event) => update('pphDefault', event.target.value)}
              placeholder="0,5"
              inputMode="decimal"
            />
          </Field>
        </div>

        <p className="text-[0.68rem] leading-relaxed text-secondary">
          Tarif default hanya dipakai saat membuat profil pajak toko baru. Profil tiap toko tetap menang dan tidak
          ditimpa oleh perubahan di sini.
        </p>

        <Button fullWidth icon={Save} loading={busy} onClick={saveProfile}>
          Simpan profil
        </Button>
      </Card>

      <Card className="space-y-3 p-4">
        <div className="flex items-center gap-2">
          <Archive className="h-5 w-5 text-primary-text" aria-hidden />
          <SectionTitle title="Backup otomatis" hint="Satu backup per hari saat aplikasi dibuka" className="mb-0" />
        </div>

        <Switch
          checked={form.autoBackup}
          onChange={(checked) => update('autoBackup', checked)}
          label="Buat backup otomatis sekali sehari"
          description="Berjalan saat aplikasi dibuka dan belum ada backup otomatis pada hari itu."
        />

        <Field
          label="Simpan berapa backup"
          hint="Backup manual dan pengaman sebelum restore juga dihitung."
        >
          <TextInput
            value={form.retention}
            onChange={(event) => update('retention', event.target.value)}
            placeholder="10"
            inputMode="numeric"
          />
        </Field>

        <MetricRow
          label="Backup otomatis terakhir"
          value={data?.settings.last_auto_backup_at ? formatDateTime(data.settings.last_auto_backup_at) : 'Belum pernah'}
        />
        <MetricRow
          label="Backup terakhir"
          value={data?.lastBackup ? formatDateTime(data.lastBackup.created_at) : 'Belum pernah'}
        />

        <div className="flex gap-2">
          <Button variant="secondary" fullWidth icon={Archive} onClick={() => navigate('/backup')}>
            Buka backup
          </Button>
          <Button fullWidth icon={Save} loading={busy} onClick={saveBackupSettings}>
            Simpan backup
          </Button>
        </div>
      </Card>

      <Card className="space-y-3 p-4">
        <div className="flex items-center gap-2">
          <Lock className="h-5 w-5 text-warning" aria-hidden />
          <SectionTitle
            title="Kunci periode"
            hint="Menolak perubahan pesanan, refund, pajak, dan HPP"
            className="mb-0"
          />
        </div>

        <p className="text-[0.68rem] leading-relaxed text-secondary">
          Gunakan setelah laporan bulanan final agar angka tidak berubah diam-diam. Membuka kunci juga tercatat di
          audit log.
        </p>

        <Field label="Periode yang dikunci">
          <Select value={form.lockPeriod} onChange={(event) => update('lockPeriod', event.target.value)}>
            {monthOptions(36).map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
        </Field>

        <Button fullWidth variant="secondary" icon={Lock} loading={busy} onClick={lockSelectedPeriod}>
          Kunci periode
        </Button>

        {locks.length === 0 ? (
          <p className="text-xs text-secondary">Belum ada periode terkunci.</p>
        ) : (
          <div className="space-y-2">
            {locks.map((lock) => (
              <div key={lock.id} className="rounded-2xl bg-surface-muted p-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-xs font-semibold text-on-surface">{monthLabel(lock.period)}</p>
                    <p className="mt-0.5 text-[0.65rem] text-secondary">
                      Dikunci {formatDateTime(lock.locked_at)} oleh {lock.locked_by || 'Operator'}
                    </p>
                  </div>
                  <Badge tone="warning">
                    <Lock className="h-3 w-3" aria-hidden /> Terkunci
                  </Badge>
                </div>
                <Button
                  className="mt-2"
                  size="sm"
                  variant="secondary"
                  icon={Unlock}
                  onClick={() => setConfirmUnlock(lock.period)}
                >
                  Buka kunci
                </Button>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card className="space-y-2 p-4">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-primary-text" aria-hidden />
          <SectionTitle title="Tentang aplikasi" hint="Data tetap di perangkat ini" className="mb-0" />
        </div>
        <MetricRow label="Versi aplikasi" value={APP_VERSION} />
        <MetricRow label="Versi skema data" value={data?.schemaVersion ?? '1'} />
        <MetricRow label="Penyimpanan" value="SQLite lokal" />
        <MetricRow label="Zona waktu" value="Asia/Jakarta" />
        <MetricRow label="Pesanan tersimpan" value={formatInteger(data?.orderCount ?? 0)} />
        <MetricRow label="Catatan audit" value={formatInteger(data?.auditCount ?? 0)} />
        <div className="flex flex-wrap gap-2 pt-1">
          <Button size="sm" variant="secondary" icon={ScrollText} onClick={() => navigate('/audit')}>
            Lihat audit log
          </Button>
          <Button size="sm" variant="ghost" icon={Database} onClick={() => navigate('/backup')}>
            Data & backup
          </Button>
        </div>
        <p className="text-[0.65rem] leading-relaxed text-muted">
          Penca berjalan sepenuhnya offline. Tidak ada akun, server, atau pengiriman data keluar perangkat.
        </p>
      </Card>

      <p className="px-1 text-center text-[0.65rem] leading-relaxed text-muted">
        Perubahan tarif default tidak mengubah profil pajak yang sudah ada. Untuk mengubah profil toko, buka Pajak →
        Profil pada toko terkait.
      </p>

      <ConfirmDialog
        open={confirmUnlock !== null}
        title="Buka kunci periode?"
        description={
          confirmUnlock
            ? `Data pada periode ${monthLabel(confirmUnlock)} dapat diubah lagi. Tindakan ini tercatat di audit log.`
            : ''
        }
        confirmLabel="Buka kunci"
        busy={busy}
        onCancel={() => setConfirmUnlock(null)}
        onConfirm={unlockSelectedPeriod}
      />

    </div>
  );
}
