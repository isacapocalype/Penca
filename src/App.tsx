import { useEffect, useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { HashRouter, Navigate, Route, Routes } from 'react-router-dom';
import { Capacitor } from '@capacitor/core';
import { StatusBar, Style } from '@capacitor/status-bar';
import { AlertTriangle, Loader2, RefreshCw } from 'lucide-react';
import { AppShell } from './components/layout';
import { Button, ToastProvider } from './components/ui';
import { initDatabase } from './lib/db';

import DashboardPage from './pages/DashboardPage';
import OrdersPage from './pages/OrdersPage';
import OrderFormPage from './pages/OrderFormPage';
import OrderDetailPage from './pages/OrderDetailPage';
import ReportsPage from './pages/ReportsPage';
import MorePage from './pages/MorePage';
import StoresPage from './pages/StoresPage';
import StoreFormPage from './pages/StoreFormPage';
import StoreDetailPage from './pages/StoreDetailPage';
import ProductsPage from './pages/ProductsPage';
import ProductFormPage from './pages/ProductFormPage';
import ProductDetailPage from './pages/ProductDetailPage';
import TaxesPage from './pages/TaxesPage';
import TaxProfileFormPage from './pages/TaxProfileFormPage';
import AdsPage from './pages/AdsPage';
import AdFormPage from './pages/AdFormPage';
import OperationalPage from './pages/OperationalPage';
import OperationalFormPage from './pages/OperationalFormPage';
import ImportPage from './pages/ImportPage';
import BackupPage from './pages/BackupPage';
import SettingsPage from './pages/SettingsPage';
import AuditPage from './pages/AuditPage';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 0,
      refetchOnWindowFocus: false,
      staleTime: 10_000,
    },
  },
});

type BootState = { status: 'loading' } | { status: 'ready' } | { status: 'error'; message: string };

function BootScreen({ state, onRetry }: { state: BootState; onRetry: () => void }) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-background px-6 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-[1.4rem] bg-primary shadow-float">
        <span className="font-heading text-2xl font-bold text-on-surface">P</span>
      </div>
      <h1 className="mt-4 font-heading text-xl font-bold text-on-surface">Penca</h1>
      <p className="mt-1 text-xs text-secondary">Dashboard keuangan konveksi, sepenuhnya offline.</p>

      {state.status === 'loading' ? (
        <div className="mt-6 flex items-center gap-2 text-xs text-secondary">
          <Loader2 className="h-4 w-4 animate-spin" />
          Menyiapkan database perangkat…
        </div>
      ) : null}

      {state.status === 'error' ? (
        <div className="mt-6 w-full max-w-sm rounded-2xl border border-danger/20 bg-danger-soft p-4 text-left">
          <div className="flex items-start gap-2 text-danger">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <div>
              <p className="text-sm font-semibold">Database tidak dapat dibuka</p>
              <p className="mt-1 text-xs leading-relaxed">{state.message}</p>
            </div>
          </div>
          <Button className="mt-4" variant="secondary" icon={RefreshCw} fullWidth onClick={onRetry}>
            Coba lagi
          </Button>
        </div>
      ) : null}
    </div>
  );
}

export default function App() {
  const [boot, setBoot] = useState<BootState>({ status: 'loading' });

  const bootDatabase = () => {
    setBoot({ status: 'loading' });
    initDatabase()
      .then(() => setBoot({ status: 'ready' }))
      .catch((error: unknown) => {
        setBoot({
          status: 'error',
          message: error instanceof Error ? error.message : 'Terjadi kesalahan saat membuka database.',
        });
      });
  };

  useEffect(() => {
    bootDatabase();
  }, []);

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) {
      return;
    }

    StatusBar.setOverlaysWebView({ overlay: false }).catch(() => undefined);
    StatusBar.setStyle({ style: Style.Dark }).catch(() => undefined);
    StatusBar.setBackgroundColor({ color: '#FAF9F6' }).catch(() => undefined);
  }, []);

  if (boot.status !== 'ready') {
    return <BootScreen state={boot} onRetry={bootDatabase} />;
  }

  return (
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <HashRouter>
          <AppShell>
            <Routes>
              <Route path="/" element={<DashboardPage />} />
              <Route path="/orders" element={<OrdersPage />} />
              <Route path="/orders/create" element={<OrderFormPage />} />
              <Route path="/orders/:id/edit" element={<OrderFormPage />} />
              <Route path="/orders/:id" element={<OrderDetailPage />} />
              <Route path="/reports" element={<ReportsPage />} />
              <Route path="/more" element={<MorePage />} />
              <Route path="/stores" element={<StoresPage />} />
              <Route path="/stores/create" element={<StoreFormPage />} />
              <Route path="/stores/:id/edit" element={<StoreFormPage />} />
              <Route path="/stores/:id" element={<StoreDetailPage />} />
              <Route path="/products" element={<ProductsPage />} />
              <Route path="/products/create" element={<ProductFormPage />} />
              <Route path="/products/:id/edit" element={<ProductFormPage />} />
              <Route path="/products/:id" element={<ProductDetailPage />} />
              <Route path="/taxes" element={<TaxesPage />} />
              <Route path="/taxes/profile/:storeId" element={<TaxProfileFormPage />} />
              <Route path="/ads" element={<AdsPage />} />
              <Route path="/ads/create" element={<AdFormPage />} />
              <Route path="/ads/:id/edit" element={<AdFormPage />} />
              <Route path="/operational" element={<OperationalPage />} />
              <Route path="/operational/create" element={<OperationalFormPage />} />
              <Route path="/operational/:id/edit" element={<OperationalFormPage />} />
              <Route path="/import" element={<ImportPage />} />
              <Route path="/backup" element={<BackupPage />} />
              <Route path="/settings" element={<SettingsPage />} />
              <Route path="/audit" element={<AuditPage />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </AppShell>
        </HashRouter>
      </ToastProvider>
    </QueryClientProvider>
  );
}
