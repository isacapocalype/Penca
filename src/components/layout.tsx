import { useEffect, type ReactNode } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { BarChart3, ChevronLeft, Home, LayoutGrid, Receipt, WifiOff } from 'lucide-react';
import { cn } from './ui';

interface PageMeta {
  title: string;
  subtitle?: string;
  backTo?: string;
  root?: boolean;
}

function metaFor(path: string): PageMeta {
  if (path === '/') {
    return {
      title: 'Dashboard',
      subtitle: 'Ringkasan keuangan usaha',
      root: true,
    };
  }

  if (path === '/orders') {
    return { title: 'Pesanan', subtitle: 'Catat dan telusuri transaksi', root: true };
  }

  if (path === '/orders/create') {
    return { title: 'Pesanan baru', subtitle: 'Item, diskon, dan biaya marketplace', backTo: '/orders' };
  }

  if (/^\/orders\/[^/]+\/edit$/.test(path)) {
    return { title: 'Ubah pesanan', subtitle: 'Perubahan tercatat di audit log', backTo: path.replace(/\/edit$/, '') };
  }

  if (/^\/orders\/[^/]+$/.test(path)) {
    return { title: 'Detail pesanan', subtitle: 'Rincian keuangan dan riwayat', backTo: '/orders' };
  }

  if (path === '/reports') {
    return { title: 'Laporan', subtitle: 'Laba, arus kas, dan ekspor', root: true };
  }

  if (path === '/more') {
    return { title: 'Lainnya', subtitle: 'Data usaha, keamanan, pengaturan', root: true };
  }

  if (path === '/stores') {
    return { title: 'Toko', subtitle: 'Marketplace dan profil pajak', backTo: '/more' };
  }

  if (path === '/stores/create') {
    return { title: 'Toko baru', subtitle: 'Profil pajak awal dibuat otomatis', backTo: '/stores' };
  }

  if (/^\/stores\/[^/]+\/edit$/.test(path)) {
    return { title: 'Ubah toko', backTo: path.replace(/\/edit$/, '') };
  }

  if (/^\/stores\/[^/]+$/.test(path)) {
    return { title: 'Detail toko', backTo: '/stores' };
  }

  if (path === '/products') {
    return { title: 'Produk & HPP', subtitle: 'Riwayat HPP tersimpan per tanggal', backTo: '/more' };
  }

  if (path === '/products/create') {
    return { title: 'Produk baru', subtitle: 'SKU unik per toko', backTo: '/products' };
  }

  if (/^\/products\/[^/]+\/edit$/.test(path)) {
    return { title: 'Ubah produk', backTo: path.replace(/\/edit$/, '') };
  }

  if (/^\/products\/[^/]+$/.test(path)) {
    return { title: 'Detail produk', backTo: '/products' };
  }

  if (path === '/taxes') {
    return { title: 'Pajak', subtitle: 'PPN keluaran/masukan dan PPh Final', backTo: '/more' };
  }

  if (/^\/taxes\/profile\/[^/]+$/.test(path)) {
    return { title: 'Profil pajak', subtitle: 'Berlaku per tanggal, bukan menimpa histori', backTo: '/taxes' };
  }

  if (path === '/ads') {
    return { title: 'Biaya iklan', subtitle: 'Kampanye dan belanja iklan', backTo: '/more' };
  }

  if (path === '/ads/create') {
    return { title: 'Catat biaya iklan', backTo: '/ads' };
  }

  if (/^\/ads\/[^/]+\/edit$/.test(path)) {
    return { title: 'Ubah biaya iklan', backTo: '/ads' };
  }

  if (path === '/operational') {
    return { title: 'Biaya operasional', subtitle: 'Gaji, packing, transportasi', backTo: '/more' };
  }

  if (path === '/operational/create') {
    return { title: 'Catat biaya', backTo: '/operational' };
  }

  if (/^\/operational\/[^/]+\/edit$/.test(path)) {
    return { title: 'Ubah biaya', backTo: '/operational' };
  }

  if (path === '/import') {
    return { title: 'Import pesanan', subtitle: 'CSV atau XLSX, idempotent per file', backTo: '/more' };
  }

  if (path === '/backup') {
    return { title: 'Backup & restore', subtitle: 'File JSON nyata di penyimpanan aplikasi', backTo: '/more' };
  }

  if (path === '/settings') {
    return { title: 'Pengaturan', subtitle: 'Operator, tarif default, kunci periode', backTo: '/more' };
  }

  if (path === '/audit') {
    return { title: 'Audit log', subtitle: 'Riwayat perubahan data keuangan', backTo: '/more' };
  }

  return { title: 'Penca', backTo: '/' };
}

const navItems = [
  { to: '/', label: 'Dashboard', icon: Home, end: true },
  { to: '/orders', label: 'Pesanan', icon: Receipt },
  { to: '/reports', label: 'Laporan', icon: BarChart3 },
  { to: '/more', label: 'Lainnya', icon: LayoutGrid },
];

function BottomNav() {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40">
      <div className="mx-auto w-full max-w-2xl px-3 pb-3">
        <div className="nav-safe glass-panel flex items-center justify-around rounded-[1.6rem] border border-white/70 px-2 pt-2 shadow-float">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                cn(
                  'flex min-w-16 flex-col items-center gap-1 rounded-2xl px-3 py-1.5 text-[0.65rem] font-semibold transition',
                  isActive ? 'bg-primary-soft text-primary-text' : 'text-secondary hover:text-on-surface',
                )
              }
            >
              {({ isActive }) => (
                <>
                  <item.icon className={cn('h-5 w-5', isActive && 'stroke-[2.4]')} aria-hidden />
                  <span>{item.label}</span>
                </>
              )}
            </NavLink>
          ))}
        </div>
      </div>
    </nav>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const location = useLocation();
  const navigate = useNavigate();
  const meta = metaFor(location.pathname);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'auto' });
  }, [location.pathname]);

  return (
    <div className="min-h-dvh bg-background">
      <header className="sticky top-0 z-30 border-b border-outline/60 bg-background/85 backdrop-blur-xl">
        <div className="top-safe mx-auto flex w-full max-w-2xl items-center gap-3 px-4 pb-3">
          {meta.root ? (
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary text-on-surface shadow-soft">
              <span className="font-heading text-lg font-bold">P</span>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => navigate(meta.backTo ?? '/')}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-outline bg-surface text-on-surface shadow-soft transition hover:bg-surface-muted"
              aria-label="Kembali"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
          )}

          <div className="min-w-0 flex-1">
            <h1 className={cn('truncate font-heading font-bold text-on-surface', meta.root ? 'text-2xl' : 'text-lg')}>
              {meta.title}
            </h1>
            {meta.subtitle ? <p className="mt-0.5 truncate text-[0.7rem] text-secondary">{meta.subtitle}</p> : null}
          </div>

          <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-success/20 bg-success-soft px-2.5 py-1 text-[0.62rem] font-semibold text-success">
            <WifiOff className="h-3 w-3" aria-hidden />
            Offline
          </span>
        </div>
      </header>

      <main className={cn('mx-auto w-full max-w-2xl px-4 pt-4', meta.root ? 'pb-32' : 'pb-safe')}>
        <div className="animate-fade-up">{children}</div>
      </main>

      {meta.root ? <BottomNav /> : null}
    </div>
  );
}
