import { Link } from 'react-router-dom';
import {
  Archive,
  ChevronRight,
  Database,
  Landmark,
  Megaphone,
  Package,
  Percent,
  ScrollText,
  Settings,
  ShieldCheck,
  Store,
  Upload,
  Wallet,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Badge, Card, SectionLabel } from '../components/ui';
import { queryKeys, useDbQuery } from '../hooks/queries';
import { listStores } from '../services/stores';
import { listProducts } from '../services/products';
import { lastBackup } from '../services/backup';
import { formatDateTime } from '../lib/date';
import { APP_VERSION } from '../lib/constants';

interface MoreRow {
  to: string;
  label: string;
  detail: string;
  icon: LucideIcon;
}

function MoreLink({ row }: { row: MoreRow }) {
  return (
    <Link
      to={row.to}
      className="flex items-center gap-3 rounded-2xl border border-outline/70 bg-surface px-3.5 py-3 transition active:scale-[0.995]"
    >
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-primary-soft text-primary-text">
        <row.icon className="h-5 w-5" aria-hidden />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold text-on-surface">{row.label}</span>
        <span className="mt-0.5 block truncate text-[0.68rem] text-secondary">{row.detail}</span>
      </span>
      <ChevronRight className="h-4 w-4 shrink-0 text-muted" aria-hidden />
    </Link>
  );
}

export default function MorePage() {
  const dashboardQuery = useDbQuery(['more', 'dashboard'], async (db) => {
    const stores = await listStores(db);
    const products = await listProducts(db, { active: true, limit: 500 });
    const backup = await lastBackup(db);
    const schema = await db.query<{ value: string | null }>(
      "SELECT value FROM settings WHERE key = 'schema_version'",
    );

    return {
      storeCount: stores.length,
      productCount: products.length,
      lastBackup: backup,
      schemaVersion: schema[0]?.value ?? '1',
    };
  });

  const data = dashboardQuery.data;

  const businessRows: MoreRow[] = [
    {
      to: '/stores',
      label: 'Toko',
      detail: data ? `${data.storeCount} toko aktif` : 'Marketplace dan profil pajak',
      icon: Store,
    },
    {
      to: '/products',
      label: 'Produk & HPP',
      detail: data ? `${data.productCount} produk aktif` : 'Riwayat HPP per tanggal',
      icon: Package,
    },
    { to: '/taxes', label: 'Pajak', detail: 'PPN, PPh Final, dan profil toko', icon: Percent },
    { to: '/ads', label: 'Biaya iklan', detail: 'Kampanye dan belanja iklan', icon: Megaphone },
    {
      to: '/operational',
      label: 'Biaya operasional',
      detail: 'Gaji, packing, transportasi',
      icon: Wallet,
    },
  ];

  const dataRows: MoreRow[] = [
    { to: '/import', label: 'Import pesanan', detail: 'CSV atau XLSX dari marketplace', icon: Upload },
    {
      to: '/backup',
      label: 'Backup & restore',
      detail: data?.lastBackup
        ? `Terakhir ${formatDateTime(data.lastBackup.created_at)}`
        : 'Belum pernah backup',
      icon: Archive,
    },
    {
      to: '/audit',
      label: 'Audit log',
      detail: 'Riwayat perubahan data keuangan',
      icon: ScrollText,
    },
    { to: '/settings', label: 'Pengaturan', detail: 'Tarif default, operator, kunci periode', icon: Settings },
  ];

  return (
    <div className="space-y-5">
      <Card className="overflow-hidden border-primary/30 bg-gradient-to-br from-primary-soft via-surface to-surface p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-primary-text">Penca</p>
            <h2 className="mt-1 font-heading text-2xl font-bold text-on-surface">Dashboard konveksi</h2>
            <p className="mt-1 text-xs leading-relaxed text-secondary">
              Sepenuhnya offline. Tidak ada akun, server, atau pengiriman data keluar perangkat.
            </p>
          </div>
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary text-on-surface shadow-soft">
            <Landmark className="h-6 w-6" aria-hidden />
          </span>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2">
          <div className="rounded-2xl bg-surface/80 p-3">
            <p className="font-heading text-xl font-bold tabular-nums text-on-surface">{data?.storeCount ?? '—'}</p>
            <p className="text-[0.66rem] text-secondary">Toko aktif</p>
          </div>
          <div className="rounded-2xl bg-surface/80 p-3">
            <p className="font-heading text-xl font-bold tabular-nums text-on-surface">{data?.productCount ?? '—'}</p>
            <p className="text-[0.66rem] text-secondary">Produk aktif</p>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap gap-1.5">
          <Badge tone="success">
            <ShieldCheck className="h-3 w-3" aria-hidden /> Data lokal
          </Badge>
          <Badge tone="neutral">
            <Database className="h-3 w-3" aria-hidden /> SQLite
          </Badge>
        </div>
      </Card>

      <section>
        <SectionLabel>Data usaha</SectionLabel>
        <div className="mt-2 space-y-2">
          {businessRows.map((row) => (
            <MoreLink key={row.to} row={row} />
          ))}
        </div>
      </section>

      <section>
        <SectionLabel>Data & keamanan</SectionLabel>
        <div className="mt-2 space-y-2">
          {dataRows.map((row) => (
            <MoreLink key={row.to} row={row} />
          ))}
        </div>
      </section>

      <Card className="space-y-1 p-4">
        <p className="text-sm font-semibold text-on-surface">Data sensitif</p>
        <p className="text-[0.7rem] leading-relaxed text-secondary">
          File backup memuat seluruh data keuangan. Simpan hanya di tempat yang Anda percaya dan jangan bagikan ke pihak
          lain. Restore mengganti seluruh data, jadi buat backup terbaru sebelum mencoba.
        </p>
        <p className="pt-1 text-[0.66rem] text-muted">
          Penca · versi {APP_VERSION} · skema {data?.schemaVersion ?? '1'}
        </p>
      </Card>
    </div>
  );
}
