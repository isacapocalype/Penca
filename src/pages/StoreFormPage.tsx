import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Save, Store as StoreIcon } from 'lucide-react';
import { Button, Card, Feedback, Field, LoadingCard, Select, TextArea, TextInput, useToast } from '../components/ui';
import { queryKeys, useDbQuery, useInvalidateAll } from '../hooks/queries';
import { getDb } from '../lib/db';
import { getStore, saveStore } from '../services/stores';
import type { Marketplace } from '../lib/types';
import { STORE_STATUSES, STORE_STATUS_LABELS, type StoreStatus } from '../lib/constants';
import { errorMessage } from '../lib/errors';

interface StoreFormState {
  marketplace_id: string;
  name: string;
  code: string;
  username: string;
  url: string;
  status: StoreStatus;
  notes: string;
}

const EMPTY_FORM: StoreFormState = {
  marketplace_id: '',
  name: '',
  code: '',
  username: '',
  url: '',
  status: 'active',
  notes: '',
};

export default function StoreFormPage() {
  const { id } = useParams<{ id: string }>();
  const editing = Boolean(id);
  const navigate = useNavigate();
  const invalidateAll = useInvalidateAll();
  const { showToast } = useToast();
  const initialized = useRef(false);
  const [form, setForm] = useState<StoreFormState>(EMPTY_FORM);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const marketplacesQuery = useDbQuery(['marketplaces'], (db) =>
    db.query<Marketplace>('SELECT * FROM marketplaces WHERE active = 1 ORDER BY name COLLATE NOCASE'),
  );
  const storeQuery = useDbQuery(queryKeys.store(id ?? 'new'), (db) => (id ? getStore(db, id) : Promise.resolve(null)), {
    enabled: editing,
  });

  useEffect(() => {
    if (initialized.current) {
      return;
    }

    if (editing) {
      if (storeQuery.data) {
        setForm({
          marketplace_id: storeQuery.data.marketplace_id,
          name: storeQuery.data.name,
          code: storeQuery.data.code,
          username: storeQuery.data.username ?? '',
          url: storeQuery.data.url ?? '',
          status: storeQuery.data.status,
          notes: storeQuery.data.notes ?? '',
        });
        initialized.current = true;
      }

      return;
    }

    if (marketplacesQuery.data) {
      setForm((current) => ({
        ...current,
        marketplace_id: current.marketplace_id || (marketplacesQuery.data![0]?.id ?? ''),
      }));
      initialized.current = true;
    }
  }, [editing, storeQuery.data, marketplacesQuery.data]);

  if (editing && storeQuery.isLoading) {
    return <LoadingCard rows={6} />;
  }

  if (editing && !storeQuery.isLoading && !storeQuery.data) {
    return (
      <Card className="space-y-3 p-6 text-center">
        <StoreIcon className="mx-auto h-8 w-8 text-muted" aria-hidden />
        <p className="font-heading text-base font-bold text-on-surface">Toko tidak ditemukan</p>
        <p className="text-xs text-secondary">Toko mungkin sudah dihapus atau tautan tidak valid.</p>
        <Button variant="secondary" onClick={() => navigate('/stores')}>
          Kembali ke daftar toko
        </Button>
      </Card>
    );
  }

  const marketplaces = marketplacesQuery.data ?? [];

  const update = <Key extends keyof StoreFormState>(key: Key, value: StoreFormState[Key]) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const submit = async () => {
    setError(null);

    if (!form.marketplace_id) {
      setError('Pilih marketplace terlebih dahulu.');
      return;
    }

    if (!form.name.trim()) {
      setError('Nama toko wajib diisi.');
      return;
    }

    if (!form.code.trim()) {
      setError('Kode toko wajib diisi.');
      return;
    }

    setSaving(true);

    try {
      const store = await saveStore(
        getDb(),
        {
          marketplace_id: form.marketplace_id,
          name: form.name,
          code: form.code,
          username: form.username,
          url: form.url,
          status: form.status,
          notes: form.notes,
        },
        id ?? null,
      );
      await invalidateAll();
      showToast(editing ? 'Perubahan toko disimpan.' : 'Toko baru dibuat.');
      navigate(`/stores/${store.id}`, { replace: true });
    } catch (caught) {
      setError(errorMessage(caught, 'Toko gagal disimpan.'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <Feedback error={error} onDismiss={() => setError(null)} />

      {marketplaces.length === 0 ? (
        <Card className="p-4 text-xs text-secondary">
          Data marketplace bawaan tidak ditemukan. Database aplikasi mungkin belum dimigrasi dengan benar.
        </Card>
      ) : null}

      <Card className="space-y-3 p-4">
        <p className="font-heading text-base font-bold text-on-surface">Identitas</p>

        <Field label="Marketplace" required>
          <Select
            value={form.marketplace_id}
            onChange={(event) => update('marketplace_id', event.target.value)}
            disabled={editing}
          >
            <option value="">Pilih marketplace</option>
            {marketplaces.map((marketplace) => (
              <option key={marketplace.id} value={marketplace.id}>
                {marketplace.name}
              </option>
            ))}
          </Select>
        </Field>
        {editing ? (
          <p className="text-[0.68rem] text-secondary">
            Marketplace tidak dapat diubah agar histori pesanan tetap pada platform yang benar.
          </p>
        ) : null}

        <Field label="Nama toko" required>
          <TextInput
            value={form.name}
            onChange={(event) => update('name', event.target.value)}
            placeholder="Konveksi Amanah"
            autoComplete="organization"
          />
        </Field>

        <Field
          label="Kode toko"
          required
          hint="Kode harus unik per marketplace dan dipakai pada laporan serta import."
        >
          <TextInput
            value={form.code}
            onChange={(event) => update('code', event.target.value.toUpperCase())}
            placeholder="AMANAH"
            autoCapitalize="characters"
          />
        </Field>

        <Field label="Username marketplace">
          <TextInput
            value={form.username}
            onChange={(event) => update('username', event.target.value)}
            placeholder="amanah.official"
            autoComplete="username"
          />
        </Field>

        <Field label="URL toko">
          <TextInput
            type="url"
            value={form.url}
            onChange={(event) => update('url', event.target.value)}
            placeholder="https://shopee.co.id/amanah"
            inputMode="url"
          />
        </Field>
      </Card>

      <Card className="space-y-3 p-4">
        <p className="font-heading text-base font-bold text-on-surface">Status</p>
        <Field label="Status toko">
          <Select value={form.status} onChange={(event) => update('status', event.target.value as StoreStatus)}>
            {STORE_STATUSES.map((status) => (
              <option key={status} value={status}>
                {STORE_STATUS_LABELS[status]}
              </option>
            ))}
          </Select>
        </Field>
        <p className="text-[0.68rem] leading-relaxed text-secondary">
          Toko nonaktif tetap tersimpan untuk histori. Toko arsip tidak muncul di pilihan pesanan baru.
        </p>
      </Card>

      <Card className="space-y-3 p-4">
        <Field label="Catatan internal">
          <TextArea
            value={form.notes}
            onChange={(event) => update('notes', event.target.value)}
            placeholder="Opsional"
          />
        </Field>
      </Card>

      <Button fullWidth size="lg" icon={Save} loading={saving} onClick={() => void submit()}>
        {editing ? 'Simpan perubahan' : 'Simpan toko'}
      </Button>

      {!editing ? (
        <p className="px-1 text-center text-[0.68rem] leading-relaxed text-muted">
          Profil pajak awal dibuat otomatis dengan PPN nonaktif dan PPh Final default. Ubah di menu Pajak bila toko sudah
          PKP.
        </p>
      ) : null}
    </div>
  );
}
