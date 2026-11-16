import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Megaphone, Save } from 'lucide-react';
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
import { getAdExpense, listAdCampaigns, saveAdExpense } from '../services/ads';
import { AD_PLATFORM_LABELS } from '../lib/constants';
import { today } from '../lib/date';
import { errorMessage } from '../lib/errors';

interface AdFormState {
  storeId: string;
  campaignId: string;
  spentAt: string;
  amount: string;
  clicks: string;
  impressions: string;
  attributedOrders: string;
  attributedRevenue: string;
  notes: string;
}

const EMPTY_FORM: AdFormState = {
  storeId: '',
  campaignId: '',
  spentAt: today(),
  amount: '',
  clicks: '',
  impressions: '',
  attributedOrders: '',
  attributedRevenue: '',
  notes: '',
};

export default function AdFormPage() {
  const { id = '' } = useParams<{ id: string }>();
  const editing = Boolean(id);
  const navigate = useNavigate();
  const invalidateAll = useInvalidateAll();
  const { showToast } = useToast();
  const initialized = useRef(false);

  const [form, setForm] = useState<AdFormState>(EMPTY_FORM);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const storesQuery = useDbQuery(queryKeys.stores(), (db) => listStores(db));
  const expenseQuery = useDbQuery(queryKeys.adExpense(id), (db) => getAdExpense(db, id), {
    enabled: editing,
  });
  const campaignsQuery = useDbQuery(
    queryKeys.adCampaigns(form.storeId),
    (db) => listAdCampaigns(db, form.storeId || null),
    { enabled: Boolean(form.storeId) },
  );

  const stores = storesQuery.data ?? [];
  const campaigns = campaignsQuery.data ?? [];

  useEffect(() => {
    if (initialized.current) {
      return;
    }

    if (editing) {
      if (!expenseQuery.data) {
        return;
      }

      const expense = expenseQuery.data;

      setForm({
        storeId: expense.store_id,
        campaignId: expense.ad_campaign_id ?? '',
        spentAt: expense.spent_at,
        amount: String(expense.amount),
        clicks: expense.clicks === null ? '' : String(expense.clicks),
        impressions: expense.impressions === null ? '' : String(expense.impressions),
        attributedOrders:
          expense.attributed_orders === null ? '' : String(expense.attributed_orders),
        attributedRevenue:
          expense.attributed_revenue === null ? '' : String(expense.attributed_revenue),
        notes: expense.notes ?? '',
      });
      initialized.current = true;
      return;
    }

    if (stores.length > 0) {
      setForm((current) => ({ ...current, storeId: current.storeId || stores[0].id }));
      initialized.current = true;
    }
  }, [editing, expenseQuery.data, stores]);

  const update = <Key extends keyof AdFormState>(key: Key, value: AdFormState[Key]) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const chooseStore = (storeId: string) => {
    setForm((current) => ({ ...current, storeId, campaignId: '' }));
  };

  const submit = async () => {
    setError(null);

    if (!form.storeId) {
      setError('Pilih toko terlebih dahulu.');
      return;
    }

    if (!/^\d{4}-\d{2}-\d{2}$/.test(form.spentAt)) {
      setError('Tanggal belanja wajib diisi.');
      return;
    }

    setSaving(true);

    try {
      await saveAdExpense(
        getDb(),
        {
          store_id: form.storeId,
          ad_campaign_id: form.campaignId || null,
          spent_at: form.spentAt,
          amount: form.amount,
          clicks: form.clicks,
          impressions: form.impressions,
          attributed_orders: form.attributedOrders,
          attributed_revenue: form.attributedRevenue,
          notes: form.notes,
        },
        editing ? id : null,
      );
      await invalidateAll();
      showToast(editing ? 'Biaya iklan diperbarui.' : 'Biaya iklan dicatat.');
      navigate('/ads', { replace: true });
    } catch (caught) {
      setError(errorMessage(caught, 'Biaya iklan gagal disimpan.'));
    } finally {
      setSaving(false);
    }
  };

  if (storesQuery.isLoading || (editing && expenseQuery.isLoading)) {
    return <LoadingCard rows={7} />;
  }

  if (editing && expenseQuery.data === null) {
    return (
      <Card className="space-y-3 p-6 text-center">
        <Megaphone className="mx-auto h-8 w-8 text-muted" aria-hidden />
        <p className="font-heading text-base font-bold text-on-surface">Biaya iklan tidak ditemukan</p>
        <p className="text-xs text-secondary">Catatan mungkin sudah dihapus.</p>
        <Button variant="secondary" onClick={() => navigate('/ads')}>
          Kembali ke biaya iklan
        </Button>
      </Card>
    );
  }

  if (!editing && stores.length === 0) {
    return (
      <Card className="space-y-3 p-6 text-center">
        <Megaphone className="mx-auto h-8 w-8 text-muted" aria-hidden />
        <p className="font-heading text-base font-bold text-on-surface">Belum ada toko</p>
        <p className="text-xs text-secondary">Tambahkan toko terlebih dahulu agar biaya iklan bisa dicatat.</p>
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
        <SectionTitle
          title="Catatan belanja iklan"
          hint="Hanya uang yang benar-benar keluar yang boleh dicatat sebagai biaya"
        />

        <Field label="Toko" required>
          <Select value={form.storeId} onChange={(event) => chooseStore(event.target.value)}>
            <option value="">Pilih toko</option>
            {stores.map((store) => (
              <option key={store.id} value={store.id}>
                {store.name} · {store.marketplace_name}
              </option>
            ))}
          </Select>
        </Field>

        <Field
          label="Kampanye"
          hint={
            form.storeId && campaigns.length === 0
              ? 'Toko ini belum punya kampanye. Biaya tetap bisa disimpan tanpa kampanye.'
              : 'Opsional. Kampanye membantu mengelompokkan belanja.'
          }
        >
          <Select value={form.campaignId} onChange={(event) => update('campaignId', event.target.value)}>
            <option value="">Tanpa kampanye</option>
            {campaigns.map((campaign) => (
              <option key={campaign.id} value={campaign.id}>
                {campaign.name} · {AD_PLATFORM_LABELS[campaign.platform]}
                {campaign.active ? '' : ' (nonaktif)'}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Tanggal belanja" required>
          <TextInput
            type="date"
            value={form.spentAt}
            onChange={(event) => update('spentAt', event.target.value)}
          />
        </Field>

        <Field label="Nominal belanja" required>
          <TextInput
            value={form.amount}
            onChange={(event) => update('amount', event.target.value)}
            placeholder="0"
            inputMode="numeric"
          />
        </Field>
      </Card>

      <Card className="space-y-3 p-4">
        <SectionTitle
          title="Metrik opsional"
          hint="Isi hanya bila angka ini memang dilaporkan marketplace; jangan menebak"
        />

        <div className="grid grid-cols-2 gap-2.5">
          <Field label="Klik">
            <TextInput
              value={form.clicks}
              onChange={(event) => update('clicks', event.target.value)}
              placeholder="0"
              inputMode="numeric"
            />
          </Field>
          <Field label="Impresi">
            <TextInput
              value={form.impressions}
              onChange={(event) => update('impressions', event.target.value)}
              placeholder="0"
              inputMode="numeric"
            />
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-2.5">
          <Field label="Pesanan atribusi">
            <TextInput
              value={form.attributedOrders}
              onChange={(event) => update('attributedOrders', event.target.value)}
              placeholder="0"
              inputMode="numeric"
            />
          </Field>
          <Field label="Omzet atribusi">
            <TextInput
              value={form.attributedRevenue}
              onChange={(event) => update('attributedRevenue', event.target.value)}
              placeholder="0"
              inputMode="numeric"
            />
          </Field>
        </div>

        <p className="text-[0.68rem] leading-relaxed text-secondary">
          ROAS = omzet atribusi ÷ biaya iklan. Omzet atribusi bukan jaminan laba karena HPP dan fee marketplace
          dihitung terpisah.
        </p>
      </Card>

      <Card className="space-y-3 p-4">
        <SectionTitle title="Catatan" hint="Opsional, tersimpan lokal" />
        <Field label="Catatan internal">
          <TextArea
            value={form.notes}
            onChange={(event) => update('notes', event.target.value)}
            placeholder="Contoh: kampanye 11.11, termasuk diskon platform"
          />
        </Field>
      </Card>

      <Button fullWidth size="lg" icon={Save} loading={saving} onClick={() => void submit()}>
        {editing ? 'Simpan perubahan' : 'Simpan biaya iklan'}
      </Button>

      <p className="px-1 text-center text-[0.65rem] leading-relaxed text-muted">
        Belanja iklan mengurangi laba operasional. Tanggal pada periode terkunci tidak dapat diubah sampai kuncinya
        dibuka di Pengaturan.
      </p>
    </div>
  );
}
