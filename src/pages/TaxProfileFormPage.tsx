import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { CalendarClock, Save, ShieldCheck, Store as StoreIcon } from 'lucide-react';
import {
  Badge,
  Button,
  Card,
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
import { getStore } from '../services/stores';
import { listTaxProfiles, saveTaxProfile } from '../services/taxes';
import {
  PPH_BASIS,
  PPH_BASIS_LABELS,
  PPN_MODES,
  PPN_MODE_LABELS,
  type PphBasis,
  type PpnMode,
} from '../lib/constants';
import { formatDate, today } from '../lib/date';
import { basisPointsToPercent, percentToBasisPoints, rupiah } from '../lib/money';
import { errorMessage } from '../lib/errors';

interface ProfileFormState {
  pkp: boolean;
  ppnMode: PpnMode;
  ppnRate: string;
  pphRate: string;
  pphBasis: PphBasis;
  effectiveFrom: string;
}

export default function TaxProfileFormPage() {
  const { storeId = '' } = useParams<{ storeId: string }>();
  const navigate = useNavigate();
  const invalidateAll = useInvalidateAll();
  const { showToast } = useToast();
  const initialized = useRef(false);
  const [form, setForm] = useState<ProfileFormState>({
    pkp: false,
    ppnMode: 'none',
    ppnRate: '11',
    pphRate: '0,5',
    pphBasis: 'gross',
    effectiveFrom: today(),
  });
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const storeQuery = useDbQuery(queryKeys.store(storeId), (db) => getStore(db, storeId));
  const profilesQuery = useDbQuery(queryKeys.taxProfiles(storeId), (db) => listTaxProfiles(db, storeId));

  useEffect(() => {
    if (initialized.current || !profilesQuery.data) {
      return;
    }

    const latest = profilesQuery.data[0];

    if (latest) {
      setForm((current) => ({
        ...current,
        pkp: Boolean(latest.pkp),
        ppnMode: latest.ppn_mode,
        ppnRate: basisPointsToPercent(latest.ppn_rate_bp).replace('%', ''),
        pphRate: basisPointsToPercent(latest.pph_rate_bp).replace('%', ''),
        pphBasis: latest.pph_basis,
      }));
    }

    initialized.current = true;
  }, [profilesQuery.data]);

  if (storeQuery.isLoading || profilesQuery.isLoading) {
    return <LoadingCard rows={6} />;
  }

  const store = storeQuery.data;

  if (!store) {
    return (
      <Card className="space-y-3 p-6 text-center">
        <StoreIcon className="mx-auto h-8 w-8 text-muted" aria-hidden />
        <p className="font-heading text-base font-bold text-on-surface">Toko tidak ditemukan</p>
        <Button variant="secondary" onClick={() => navigate('/taxes')}>
          Kembali ke pajak
        </Button>
      </Card>
    );
  }

  const update = <Key extends keyof ProfileFormState>(key: Key, value: ProfileFormState[Key]) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const submit = async () => {
    setError(null);

    if (!/^\d{4}-\d{2}-\d{2}$/.test(form.effectiveFrom)) {
      setError('Tanggal berlaku wajib diisi.');
      return;
    }

    const ppnRate = percentToBasisPoints(form.ppnRate);
    const pphRate = percentToBasisPoints(form.pphRate);

    if (ppnRate < 0 || ppnRate > 10000 || pphRate < 0 || pphRate > 10000) {
      setError('Tarif PPN dan PPh harus antara 0% dan 100%.');
      return;
    }

    if (form.pkp && form.ppnMode === 'none') {
      setError('Toko PKP sebaiknya memilih mode PPN termasuk atau ditambah. Pilih mode PPN yang benar.');
      return;
    }

    setSaving(true);

    try {
      await saveTaxProfile(getDb(), store.id, {
        pkp: form.pkp,
        ppn_mode: form.ppnMode,
        ppn_rate_bp: ppnRate,
        pph_rate_bp: pphRate,
        pph_basis: form.pphBasis,
        effective_from: form.effectiveFrom,
        effective_to: null,
      });
      await invalidateAll();
      showToast('Profil pajak disimpan. Profil lama tetap menjadi histori.');
    } catch (caught) {
      setError(errorMessage(caught, 'Profil pajak gagal disimpan.'));
    } finally {
      setSaving(false);
    }
  };

  const profiles = profilesQuery.data ?? [];
  const latest = profiles[0] ?? null;

  return (
    <div className="space-y-4">
      <Feedback error={error} onDismiss={() => setError(null)} />

      <Card className="space-y-3 overflow-hidden border-primary/30 bg-gradient-to-br from-primary-soft via-surface to-surface p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="truncate font-heading text-xl font-bold text-on-surface">{store.name}</h2>
            <p className="mt-0.5 text-xs text-secondary">
              {store.marketplace_name} · {store.code}
            </p>
          </div>
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary text-on-surface shadow-soft">
            <ShieldCheck className="h-5 w-5" aria-hidden />
          </span>
        </div>

        {latest ? (
          <div className="space-y-0.5 rounded-2xl bg-surface/80 p-3">
            <MetricRow label="Status" value={latest.pkp ? 'PKP' : 'Non-PKP'} />
            <MetricRow label="Mode PPN" value={PPN_MODE_LABELS[latest.ppn_mode]} />
            <MetricRow label="Tarif PPN" value={basisPointsToPercent(latest.ppn_rate_bp)} />
            <MetricRow label="Tarif PPh Final" value={basisPointsToPercent(latest.pph_rate_bp)} />
            <MetricRow label="Dasar PPh" value={PPH_BASIS_LABELS[latest.pph_basis]} />
            <MetricRow
              label="Berlaku"
              value={`${formatDate(latest.effective_from)} – ${latest.effective_to ? formatDate(latest.effective_to) : 'sekarang'}`}
            />
          </div>
        ) : (
          <p className="rounded-2xl bg-surface/80 p-3 text-xs text-secondary">
            Belum ada profil pajak. Menyimpan profil akan mulai berlaku sesuai tanggal yang dipilih.
          </p>
        )}
      </Card>

      <Card className="space-y-3 p-4">
        <SectionTitle
          title="Profil pajak baru"
          hint="Profil lama tidak ditimpa. Tanggal efektif memisahkan tarif lama dan tarif baru."
        />

        <Switch
          checked={form.pkp}
          onChange={(checked) => update('pkp', checked)}
          label="Toko terdaftar PKP"
          description="PKP memungut PPN keluaran dari penjualan. Non-PKP tidak memungut PPN."
        />

        <Field label="Mode PPN">
          <Select value={form.ppnMode} onChange={(event) => update('ppnMode', event.target.value as PpnMode)}>
            {PPN_MODES.map((mode) => (
              <option key={mode} value={mode}>
                {PPN_MODE_LABELS[mode]}
              </option>
            ))}
          </Select>
        </Field>

        <div className="grid grid-cols-2 gap-2.5">
          <Field label="Tarif PPN (%)">
            <TextInput
              value={form.ppnRate}
              onChange={(event) => update('ppnRate', event.target.value)}
              placeholder="11"
              inputMode="decimal"
            />
          </Field>
          <Field label="Tarif PPh Final (%)">
            <TextInput
              value={form.pphRate}
              onChange={(event) => update('pphRate', event.target.value)}
              placeholder="0,5"
              inputMode="decimal"
            />
          </Field>
        </div>

        <Field label="Dasar PPh Final">
          <Select value={form.pphBasis} onChange={(event) => update('pphBasis', event.target.value as PphBasis)}>
            {PPH_BASIS.map((basis) => (
              <option key={basis} value={basis}>
                {PPH_BASIS_LABELS[basis]}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Berlaku sejak" required>
          <TextInput
            type="date"
            value={form.effectiveFrom}
            onChange={(event) => update('effectiveFrom', event.target.value)}
          />
        </Field>

        <Button fullWidth size="lg" icon={Save} loading={saving} onClick={() => void submit()}>
          Simpan profil pajak
        </Button>
      </Card>

      <Card className="p-4">
        <SectionTitle title="Riwayat profil" hint="Urut dari yang paling baru" action={<Badge tone="neutral">{profiles.length}</Badge>} />
        {profiles.length === 0 ? (
          <p className="py-2 text-xs text-secondary">Belum ada profil tersimpan.</p>
        ) : (
          <div className="divide-y divide-outline/70">
            {profiles.map((profile) => (
              <div key={profile.id} className="flex items-start justify-between gap-3 py-2.5">
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-on-surface">
                    {profile.pkp ? 'PKP' : 'Non-PKP'} · {PPN_MODE_LABELS[profile.ppn_mode]}
                  </p>
                  <p className="mt-0.5 text-[0.65rem] text-secondary">
                    PPN {basisPointsToPercent(profile.ppn_rate_bp)} · PPh {basisPointsToPercent(profile.pph_rate_bp)} ·{' '}
                    {PPH_BASIS_LABELS[profile.pph_basis]}
                  </p>
                  <p className="text-[0.65rem] text-muted">
                    {formatDate(profile.effective_from)} – {profile.effective_to ? formatDate(profile.effective_to) : 'sekarang'}
                  </p>
                </div>
                <CalendarClock className="mt-0.5 h-4 w-4 shrink-0 text-muted" aria-hidden />
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card className="space-y-1 p-4">
        <p className="text-sm font-semibold text-on-surface">Cara perhitungan</p>
        <p className="text-[0.7rem] leading-relaxed text-secondary">
          PPN termasuk harga dihitung sebagai neto × tarif / (100% + tarif). PPN ditambah di atas harga dihitung sebagai
          neto × tarif. PPh Final dihitung dari omzet bruto atau pendapatan neto sesuai profil. Semua nominal dalam
          rupiah penuh dan dibulatkan setengah ke atas.
        </p>
        <p className="text-[0.7rem] leading-relaxed text-secondary">
          Contoh: pendapatan neto {rupiah(1_000_000)} dengan PPN 11% termasuk harga menghasilkan PPN{' '}
          {rupiah(99_099)}. PPh Final 0,5% dari omzet {rupiah(1_000_000)} menghasilkan {rupiah(5_000)}.
        </p>
        <p className="text-[0.65rem] text-muted">Tarif default pengaturan hanya dipakai saat toko baru dibuat.</p>
      </Card>
    </div>
  );
}
