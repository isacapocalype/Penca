@use('App\Icons\Ios')
@use('App\Icons\Android')

<native:top-bar title="Lainnya" display-mode="large" />

<native:column class="w-full h-full bg-theme-background">
    <native:scroll-view class="w-full flex-1" shows-indicators="false">
        <native:column class="w-full gap-4 p-4 pb-8">
            @include('native.partials.feedback', ['notice' => $notice, 'error' => $error])

            <native:column class="w-full gap-2 rounded-3xl bg-theme-primary-soft border border-theme-primary/30 p-5">
                <native:row class="w-full items-center justify-between">
                    <native:column class="gap-1">
                        <native:text class="text-xl text-theme-on-surface" font="heading-bold">Penca</native:text>
                        <native:text class="text-sm text-theme-secondary">Dashboard konveksi offline-first</native:text>
                    </native:column>
                    <native:column class="h-12 w-12 items-center justify-center rounded-2xl bg-theme-primary">
                        <native:icon :ios="Ios::ChartBar" :android="Android::BarChart" :size="24" class="text-theme-on-primary" />
                    </native:column>
                </native:row>
                <native:row class="w-full gap-2 pt-2">
                    <native:column class="flex-1 rounded-2xl bg-theme-surface/70 p-3">
                        <native:text class="text-xl text-theme-on-surface" font="heading-bold">{{ $storeCount }}</native:text>
                        <native:text class="text-xs text-theme-secondary">Toko aktif</native:text>
                    </native:column>
                    <native:column class="flex-1 rounded-2xl bg-theme-surface/70 p-3">
                        <native:text class="text-xl text-theme-on-surface" font="heading-bold">{{ $productCount }}</native:text>
                        <native:text class="text-xs text-theme-secondary">Produk aktif</native:text>
                    </native:column>
                </native:row>
            </native:column>

            <native:column class="w-full gap-2">
                <native:text class="px-1 text-xs text-theme-secondary" font="body-semibold">DATA USAHA</native:text>

                @include('native.partials.more-row', [
                    'label' => 'Toko',
                    'detail' => $storeCount.' toko aktif',
                    'path' => '/stores',
                    'ios' => Ios::Storefront,
                    'android' => Android::Storefront,
                ])
                @include('native.partials.more-row', [
                    'label' => 'Produk & HPP',
                    'detail' => $productCount.' produk aktif',
                    'path' => '/products',
                    'ios' => Ios::Tag,
                    'android' => Android::Inventory,
                ])
                @include('native.partials.more-row', [
                    'label' => 'Pajak',
                    'detail' => 'PPN, PPh Final, dan profil toko',
                    'path' => '/taxes',
                    'ios' => Ios::Percent,
                    'android' => Android::Percent,
                ])
                @include('native.partials.more-row', [
                    'label' => 'Biaya iklan',
                    'detail' => 'Kampanye dan belanja iklan',
                    'path' => '/ads',
                    'ios' => Ios::Megaphone,
                    'android' => Android::Campaign,
                ])
                @include('native.partials.more-row', [
                    'label' => 'Biaya operasional',
                    'detail' => 'Gaji, packing, transportasi',
                    'path' => '/operational',
                    'ios' => Ios::WalletPass,
                    'android' => Android::AccountBalanceWallet,
                ])
            </native:column>

            <native:column class="w-full gap-2">
                <native:text class="px-1 text-xs text-theme-secondary" font="body-semibold">DATA & KEAMANAN</native:text>

                @include('native.partials.more-row', [
                    'label' => 'Import pesanan',
                    'detail' => 'CSV atau XLSX dari marketplace',
                    'path' => '/import',
                    'ios' => Ios::SquareAndArrowDown,
                    'android' => Android::UploadFile,
                ])
                @include('native.partials.more-row', [
                    'label' => 'Backup & restore',
                    'detail' => $lastBackup
                        ? 'Terakhir '.$lastBackup->created_at?->translatedFormat('d M Y H:i')
                        : 'Belum pernah backup',
                    'path' => '/backup',
                    'ios' => Ios::Archivebox,
                    'android' => Android::Backup,
                ])
                @include('native.partials.more-row', [
                    'label' => 'Audit log',
                    'detail' => 'Riwayat perubahan data keuangan',
                    'path' => '/audit',
                    'ios' => Ios::DocText,
                    'android' => Android::History,
                ])
                @include('native.partials.more-row', [
                    'label' => 'Pengaturan',
                    'detail' => 'Tarif default dan operator',
                    'path' => '/settings',
                    'ios' => Ios::Gearshape,
                    'android' => Android::Settings,
                ])
            </native:column>

            <native:column class="w-full gap-1 rounded-2xl bg-theme-surface border border-theme-outline p-4">
                <native:text class="text-sm text-theme-on-surface" font="body-semibold">Data sensitif</native:text>
                <native:text class="text-xs text-theme-secondary">File backup berisi seluruh data keuangan. Simpan hanya di tempat yang Anda percaya dan jangan bagikan ke pihak lain.</native:text>
                <native:text class="pt-1 text-xs text-theme-muted">Penca · versi {{ config('nativephp.app_version', '1.0.0') }} · skema {{ \App\Models\Setting::value('schema_version', '1') }}</native:text>
            </native:column>
        </native:column>
    </native:scroll-view>

    @include('native.partials.bottom-nav', ['active' => 'more'])
</native:column>
