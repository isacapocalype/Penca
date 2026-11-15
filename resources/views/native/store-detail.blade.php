@use('App\Icons\Ios')
@use('App\Icons\Android')

<native:top-bar title="{{ $store?->name ?? 'Toko' }}" subtitle="{{ $store?->marketplace?->name ?? 'Detail toko' }}" back />

<native:column class="w-full h-full bg-theme-background">
    <native:scroll-view class="w-full flex-1" shows-indicators="false">
        <native:column class="w-full gap-4 p-4 pb-10">
            @include('native.partials.feedback', ['notice' => $notice, 'error' => $error])

            @if ($store === null)
                <native:column class="w-full gap-3 rounded-3xl bg-theme-surface border border-theme-outline p-6">
                    <native:text class="text-base text-theme-on-surface" font="heading">Toko tidak ditemukan</native:text>
                    <native:text class="text-sm text-theme-secondary">Toko mungkin sudah dihapus atau tautan tidak valid.</native:text>
                    <native:button class="mt-2 w-full" variant="primary" @tap="goStores">Kembali ke daftar toko</native:button>
                </native:column>
            @else
                <native:column class="w-full gap-2 rounded-3xl bg-theme-primary-soft border border-theme-primary/30 p-5">
                    <native:row class="w-full items-start justify-between gap-3">
                        <native:column class="flex-1 gap-1">
                            <native:text class="text-2xl text-theme-on-surface" font="heading-bold">{{ $store->name }}</native:text>
                            <native:text class="text-sm text-theme-secondary">{{ $store->marketplace?->name }} · {{ $store->code }}</native:text>
                            @if ($store->username)
                                <native:text class="text-xs text-theme-secondary">{{ '@'.$store->username }}</native:text>
                            @endif
                        </native:column>
                        <native:badge
                            :label="\App\Support\Options::storeStatusLabel($store->status)"
                            :variant="$store->status === 'active' ? 'success' : ($store->status === 'archived' ? 'destructive' : 'primary')"
                        />
                    </native:row>
                    <native:text class="text-xs text-theme-secondary">{{ $store->products_count }} produk · {{ $store->orders_count }} pesanan</native:text>
                </native:column>

                @if ($lifetime)
                    <native:column class="w-full gap-3">
                        <native:text class="text-sm text-theme-secondary" font="body-medium">Kinerja seluruh periode tercatat</native:text>
                        <native:row class="w-full gap-3">
                            @include('native.partials.stat-card', [
                                'label' => 'Omzet bruto',
                                'value' => $rupiah($lifetime->grossRevenue),
                                'hint' => $lifetime->orderCount.' pesanan',
                            ])
                            @include('native.partials.stat-card', [
                                'label' => 'Laba bersih',
                                'value' => $rupiah($lifetime->netProfit),
                                'hint' => 'Margin '.number_format($lifetime->marginBp / 100, 2, ',', '.').'%',
                            ])
                        </native:row>
                        <native:row class="w-full gap-3">
                            @include('native.partials.stat-card', ['label' => 'HPP', 'value' => $rupiah($lifetime->hpp)])
                            @include('native.partials.stat-card', ['label' => 'Fee marketplace', 'value' => $rupiah($lifetime->marketplaceFees)])
                        </native:row>
                        <native:row class="w-full gap-3">
                            @include('native.partials.stat-card', ['label' => 'Biaya iklan', 'value' => $rupiah($lifetime->advertising)])
                            @include('native.partials.stat-card', ['label' => 'Operasional', 'value' => $rupiah($lifetime->operational)])
                        </native:row>
                    </native:column>
                @endif

                <native:column class="w-full gap-3 rounded-3xl bg-theme-surface border border-theme-outline p-4">
                    <native:row class="w-full items-center justify-between">
                        <native:text class="text-base text-theme-on-surface" font="heading">Profil pajak aktif</native:text>
                        <native:pressable class="rounded-full bg-theme-primary-soft px-3 py-2" @tap="openTaxes">
                            <native:text class="text-xs text-theme-primary-text" font="body-medium">Kelola</native:text>
                        </native:pressable>
                    </native:row>

                    @if ($profile === null)
                        <native:text class="text-sm text-theme-secondary">Belum ada profil pajak. Rekap pajak akan memakai tarif default pengaturan.</native:text>
                    @else
                        <native:row class="w-full items-center justify-between">
                            <native:text class="text-xs text-theme-secondary">Status PKP</native:text>
                            <native:text class="text-sm text-theme-on-surface" font="body-medium">{{ $profile->pkp ? 'PKP' : 'Non-PKP' }}</native:text>
                        </native:row>
                        <native:row class="w-full items-center justify-between">
                            <native:text class="text-xs text-theme-secondary">Mode PPN</native:text>
                            <native:text class="text-sm text-theme-on-surface" font="body-medium">{{ \App\Support\Options::PPN_MODES[$profile->ppn_mode] ?? $profile->ppn_mode }}</native:text>
                        </native:row>
                        <native:row class="w-full items-center justify-between">
                            <native:text class="text-xs text-theme-secondary">Tarif PPN / PPh Final</native:text>
                            <native:text class="text-sm text-theme-on-surface" font="body-medium">{{ \App\Support\Options::basisPointsToPercent((int) $profile->ppn_rate_bp) }}% / {{ \App\Support\Options::basisPointsToPercent((int) $profile->pph_rate_bp) }}%</native:text>
                        </native:row>
                        <native:text class="text-xs text-theme-muted">Berlaku sejak {{ \App\Support\Options::dateLabel($profile->effective_from?->toDateString()) }}</native:text>
                    @endif
                </native:column>

                <native:column class="w-full gap-3 rounded-3xl bg-theme-surface border border-theme-outline p-4">
                    <native:row class="w-full items-center justify-between">
                        <native:text class="text-base text-theme-on-surface" font="heading">Produk</native:text>
                        <native:pressable class="rounded-full bg-theme-surface-variant px-3 py-2" @tap="openProducts">
                            <native:text class="text-xs text-theme-primary-text" font="body-medium">Semua produk</native:text>
                        </native:pressable>
                    </native:row>

                    @if ($products->isEmpty())
                        <native:text class="text-sm text-theme-secondary">Belum ada produk untuk toko ini.</native:text>
                    @else
                        @foreach ($products as $product)
                            <native:row native:key="product-{{ $product->id }}" class="w-full items-center justify-between gap-2">
                                <native:column class="flex-1 gap-1">
                                    <native:text class="text-sm text-theme-on-surface" font="body-medium">{{ $product->sku }} · {{ $product->name }}</native:text>
                                    <native:text class="text-xs text-theme-secondary">Jual {{ $rupiah($product->selling_price) }} · HPP {{ $product->currentHpp() === null ? 'belum ada' : $rupiah($product->currentHpp()) }}</native:text>
                                </native:column>
                                @if (! $product->active)
                                    <native:badge label="Nonaktif" variant="primary" />
                                @endif
                            </native:row>
                        @endforeach
                    @endif
                </native:column>

                @if (! empty($store->notes))
                    <native:column class="w-full gap-1 rounded-2xl bg-theme-surface border border-theme-outline p-4">
                        <native:text class="text-sm text-theme-on-surface" font="body-semibold">Catatan</native:text>
                        <native:text class="text-sm text-theme-secondary">{{ $store->notes }}</native:text>
                    </native:column>
                @endif

                <native:row class="w-full gap-3">
                    <native:button class="flex-1" variant="secondary" @tap="openOrders">Lihat pesanan</native:button>
                    <native:button class="flex-1" variant="primary" @tap="edit">Ubah toko</native:button>
                </native:row>

                @if ($confirmArchive)
                    <native:column class="w-full gap-2 rounded-2xl {{ $store->status === 'archived' ? 'bg-theme-success-soft' : 'bg-theme-danger-soft' }} p-4">
                        <native:text class="text-sm text-theme-on-surface" font="body-semibold">
                            {{ $store->status === 'archived' ? 'Aktifkan kembali toko ini?' : 'Arsipkan toko ini?' }}
                        </native:text>
                        <native:text class="text-xs text-theme-secondary">
                            {{ $store->status === 'archived' ? 'Toko akan muncul lagi di pilihan pesanan baru.' : 'Data historis tetap tersimpan. Toko arsip tidak muncul di pilihan pesanan baru.' }}
                        </native:text>
                        <native:row class="w-full gap-2 pt-1">
                            <native:button class="flex-1" variant="secondary" @tap="toggleArchive">Batal</native:button>
                            <native:button class="flex-1" variant="primary" @tap="toggleStatus">
                                {{ $store->status === 'archived' ? 'Aktifkan' : 'Arsipkan' }}
                            </native:button>
                        </native:row>
                    </native:column>
                @else
                    <native:button class="w-full" variant="secondary" @tap="toggleArchive">
                        {{ $store->status === 'archived' ? 'Aktifkan toko' : 'Arsipkan toko' }}
                    </native:button>
                @endif
            @endif
        </native:column>
    </native:scroll-view>
</native:column>
