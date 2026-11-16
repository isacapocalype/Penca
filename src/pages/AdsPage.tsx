import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Megaphone, MousePointerClick, Pencil, Plus, Target, Trash2, TrendingUp } from 'lucide-react';
import {
  Badge,
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
  TextInput,
  useToast,
} from '../components/ui';
import { queryKeys, useDbQuery, useInvalidateAll } from '../hooks/queries';
import { getDb } from '../lib/db';
import { listStores } from '../services/stores';
import {
  createAdCampaign,
  deleteAdExpense,
  listAdCampaigns,
  listAdExpenses,
  toggleAdCampaign,
} from '../services/ads';
import { AD_PLATFORMS, AD_PLATFORM_LABELS, type AdPlatform } from '../lib/constants';
import { currentPeriod, formatDate, monthLabel, monthOptions } from '../lib/date';
import { compactRupiah, formatDecimal, formatInteger, parseRupiah, rupiah } from '../lib/money';
import { errorMessage } from '../lib/errors';

export default function AdsPage() {
  const navigate = useNavigate();
  const invalidateAll = useInvalidateAll();
  const { showToast } = useToast();
  const [period, setPeriod] = useState(currentPeriod());
  const [storeId, setStoreId] = useState('');
  const [showCampaignForm, setShowCampaignForm] = useState(false);
  const [campaignStore, setCampaignStore] = useState('');
  const [campaignName, setCampaignName] = useState('');
  const [campaignPlatform, setCampaignPlatform] = useState<AdPlatform>('shopee');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const storesQuery = useDbQuery(queryKeys.stores(), (db) => listStores(db));
  const adsQuery = useDbQuery(queryKeys.ads(period, storeId), (db) =>
    listAdExpenses(db, period, storeId || null),
  );
  const campaignsQuery = useDbQuery(queryKeys.adCampaigns(storeId), (db) =>
    listAdCampaigns(db, storeId || null),
  );

  const stores = storesQuery.data ?? [];
  const expenses = adsQuery.data ?? [];
  const campaigns = campaignsQuery.data ?? [];
  const totalSpend = expenses.reduce((sum, expense) => sum + expense.amount, 0);
  const totalAttributed = expenses.reduce((sum, expense) => sum + (expense.attributed_revenue ?? 0), 0);
  const totalClicks = expenses.reduce((sum, expense) => sum + (expense.clicks ?? 0), 0);
  const totalOrders = expenses.reduce((sum, expense) => sum + (expense.attributed_orders ?? 0), 0);
  const roas = totalSpend > 0 && totalAttributed > 0 ? totalAttributed / totalSpend : null;

  const runAction = async (action: () => Promise<unknown>, success: string) => {
    setError(null);
    setBusy(true);

    try {
      await action();
      await invalidateAll();
      showToast(success);
    } catch (caught) {
      setError(errorMessage(caught, 'Tindakan iklan gagal diproses.'));
    } finally {
      setBusy(false);
    }
  };

  const openCampaignForm = () => {
    setCampaignStore(storeId || stores[0]?.id || '');
    setCampaignName('');
    setCampaignPlatform('shopee');
    setShowCampaignForm((value) => !value);
  };

  const submitCampaign = () => {
    if (!campaignStore) {
      setError('Pilih toko untuk kampanye iklan.');
      return;
    }

    if (!campaignName.trim()) {
      setError('Nama kampanye wajib diisi.');
      return;
    }

    void runAction(async () => {
      await createAdCampaign(getDb(), {
        store_id: campaignStore,
        name: campaignName,
        platform: campaignPlatform,
      });
      setCampaignName('');
      setShowCampaignForm(false);
    }, 'Kampanye iklan dibuat.');
  };

  if (adsQuery.isLoading || campaignsQuery.isLoading || storesQuery.isLoading) {
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
          <Button size="sm" icon={Plus} onClick={() => navigate('/ads/create')}>
            Catat biaya iklan
          </Button>
          <Button size="sm" variant="soft" onClick={openCampaignForm}>
            {showCampaignForm ? 'Tutup kampanye' : 'Kampanye baru'}
          </Button>
        </div>
      </Card>

      <Card className="overflow-hidden border-primary/30 bg-gradient-to-br from-primary-soft via-surface to-surface p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-primary-text">
              Belanja iklan {monthLabel(period)}
            </p>
            <p className="mt-1 font-heading text-[1.9rem] font-bold leading-none tabular-nums text-on-surface">
              {rupiah(totalSpend)}
            </p>
            <p className="mt-2 text-[0.7rem] text-secondary">
              {expenses.length} catatan · omzet atribusi {compactRupiah(totalAttributed)}
            </p>
          </div>
          <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary text-on-surface shadow-soft">
            <Megaphone className="h-5 w-5" aria-hidden />
          </span>
        </div>
        <div className="mt-4 grid grid-cols-3 gap-2">
          <div className="rounded-2xl bg-surface/80 p-2.5">
            <p className="text-[0.62rem] text-secondary">ROAS</p>
            <p className="mt-0.5 text-xs font-semibold tabular-nums text-on-surface">
              {roas === null ? '—' : `${formatDecimal(roas, 2)}×`}
            </p>
          </div>
          <div className="rounded-2xl bg-surface/80 p-2.5">
            <p className="text-[0.62rem] text-secondary">Klik</p>
            <p className="mt-0.5 text-xs font-semibold tabular-nums text-on-surface">{formatInteger(totalClicks)}</p>
          </div>
          <div className="rounded-2xl bg-surface/80 p-2.5">
            <p className="text-[0.62rem] text-secondary">Pesanan atribusi</p>
            <p className="mt-0.5 text-xs font-semibold tabular-nums text-on-surface">{formatInteger(totalOrders)}</p>
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-2 gap-2.5">
        <StatCard label="Total belanja" value={compactRupiah(totalSpend)} icon={Megaphone} hint={`${expenses.length} catatan`} />
        <StatCard
          label="Omzet atribusi"
          value={compactRupiah(totalAttributed)}
          icon={TrendingUp}
          hint="Omzet yang diklaim kampanye"
        />
        <StatCard label="Klik" value={formatInteger(totalClicks)} icon={MousePointerClick} />
        <StatCard label="Pesanan atribusi" value={formatInteger(totalOrders)} icon={Target} />
      </div>

      {showCampaignForm ? (
        <Card className="space-y-3 p-4">
          <SectionTitle title="Kampanye iklan baru" hint="Kampanye membantu mengelompokkan belanja iklan" />
          <Field label="Toko" required>
            <Select value={campaignStore} onChange={(event) => setCampaignStore(event.target.value)}>
              <option value="">Pilih toko</option>
              {stores.map((store) => (
                <option key={store.id} value={store.id}>
                  {store.name} · {store.marketplace_name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Nama kampanye" required>
            <TextInput
              value={campaignName}
              onChange={(event) => setCampaignName(event.target.value)}
              placeholder="Promo 11.11"
            />
          </Field>
          <Field label="Platform">
            <Select value={campaignPlatform} onChange={(event) => setCampaignPlatform(event.target.value as AdPlatform)}>
              {AD_PLATFORMS.map((platform) => (
                <option key={platform} value={platform}>
                  {AD_PLATFORM_LABELS[platform]}
                </option>
              ))}
            </Select>
          </Field>
          <Button fullWidth icon={Plus} loading={busy} onClick={submitCampaign}>
            Simpan kampanye
          </Button>
        </Card>
      ) : null}

      <Card className="p-4">
        <SectionTitle title="Kampanye" hint="Kampanye nonaktif tetap menyimpan biaya lama" action={<Badge tone="neutral">{campaigns.length}</Badge>} />
        {campaigns.length === 0 ? (
          <p className="py-2 text-xs text-secondary">Belum ada kampanye untuk filter ini.</p>
        ) : (
          <div className="divide-y divide-outline/70">
            {campaigns.map((campaign) => (
              <div key={campaign.id} className="flex items-center justify-between gap-3 py-2.5">
                <div className="min-w-0">
                  <p className="truncate text-xs font-semibold text-on-surface">{campaign.name}</p>
                  <p className="mt-0.5 text-[0.65rem] text-secondary">
                    {AD_PLATFORM_LABELS[campaign.platform]} · {campaign.active ? 'Aktif' : 'Nonaktif'} ·{' '}
                    {rupiah(
                      expenses
                        .filter((expense) => expense.ad_campaign_id === campaign.id)
                        .reduce((sum, expense) => sum + expense.amount, 0),
                    )}
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="secondary"
                  loading={busy}
                  onClick={() =>
                    void runAction(
                      async () => toggleAdCampaign(getDb(), campaign.id),
                      campaign.active ? 'Kampanye dinonaktifkan.' : 'Kampanye diaktifkan.',
                    )
                  }
                >
                  {campaign.active ? 'Nonaktifkan' : 'Aktifkan'}
                </Button>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card className="p-4">
        <SectionTitle title="Catatan belanja" hint="Belanja iklan langsung mengurangi laba operasional" />
        {expenses.length === 0 ? (
          <EmptyState
            icon={Megaphone}
            title="Belum ada belanja iklan"
            description="Catat biaya iklan agar laba bersih tidak melebih-lebihkan keuntungan."
            action={
              <Button size="sm" variant="secondary" icon={Plus} onClick={() => navigate('/ads/create')}>
                Catat biaya
              </Button>
            }
          />
        ) : (
          <div className="divide-y divide-outline/70">
            {expenses.map((expense) => (
              <div key={expense.id} className="flex items-start justify-between gap-3 py-3">
                <div className="min-w-0">
                  <p className="truncate text-xs font-semibold text-on-surface">
                    {expense.store_name} · {expense.marketplace_name}
                  </p>
                  <p className="mt-0.5 text-[0.65rem] text-secondary">
                    {formatDate(expense.spent_at)}
                    {expense.campaign_name ? ` · ${expense.campaign_name}` : ' · tanpa kampanye'}
                  </p>
                  <p className="text-[0.65rem] text-secondary">
                    Klik {formatInteger(expense.clicks ?? 0)} · impresi {formatInteger(expense.impressions ?? 0)} · atribusi{' '}
                    {formatInteger(expense.attributed_orders ?? 0)} pesanan / {rupiah(expense.attributed_revenue ?? 0)}
                  </p>
                  {expense.notes ? <p className="text-[0.65rem] text-muted">{expense.notes}</p> : null}
                </div>
                <div className="flex shrink-0 flex-col items-end gap-2">
                  <span className="text-xs font-semibold tabular-nums text-on-surface">{rupiah(expense.amount)}</span>
                  <div className="flex gap-1.5">
                    <button
                      type="button"
                      aria-label="Ubah biaya iklan"
                      onClick={() => navigate(`/ads/${expense.id}/edit`)}
                      className="rounded-full bg-surface-muted p-2 text-secondary"
                    >
                      <Pencil className="h-3.5 w-3.5" aria-hidden />
                    </button>
                    <button
                      type="button"
                      aria-label="Hapus biaya iklan"
                      onClick={() => setConfirmDeleteId(expense.id)}
                      className="rounded-full bg-danger-soft p-2 text-danger"
                    >
                      <Trash2 className="h-3.5 w-3.5" aria-hidden />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <p className="px-1 text-center text-[0.65rem] leading-relaxed text-muted">
        ROAS memakai omzet atribusi yang Anda isi sendiri. Angka ini bukan jaminan laba; HPP dan fee marketplace tetap
        dihitung terpisah.
      </p>

      <ConfirmDialog
        open={confirmDeleteId !== null}
        title="Hapus biaya iklan?"
        description="Catatan belanja dihapus dari laba periode. Tindakan ini tercatat di audit log dan tidak dihitung ulang otomatis."
        confirmLabel="Hapus biaya"
        busy={busy}
        onCancel={() => setConfirmDeleteId(null)}
        onConfirm={() =>
          void runAction(async () => {
            if (confirmDeleteId) {
              await deleteAdExpense(getDb(), confirmDeleteId);
            }
            setConfirmDeleteId(null);
          }, 'Biaya iklan dihapus.')
        }
      />
    </div>
  );
}
