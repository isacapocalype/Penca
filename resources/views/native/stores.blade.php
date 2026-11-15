@use('App\Icons\Ios')
@use('App\Icons\Android')

<native:top-bar title="Toko" subtitle="{{ $stores->count() }} toko" display-mode="large" />

<native:column class="w-full h-full bg-theme-background">
    <native:column class="w-full gap-3 border-b border-theme-outline px-4 pb-3 pt-2">
        @include('native.partials.feedback', ['notice' => $notice, 'error' => $error])

        <native:outlined-text-input
            native:model.debounce.300ms="search"
            placeholder="Cari nama, kode, atau username"
            label="Cari toko"
        />
        <native:select native:model="statusFilterLabel" label="Status" :options="$statusOptions" />
    </native:column>

    <native:scroll-view class="w-full flex-1" shows-indicators="false">
        <native:column class="w-full gap-3 p-4 pb-8">
            @if ($stores->isEmpty())
                @include('native.partials.empty-state', [
                    'title' => 'Belum ada toko',
                    'message' => 'Tambahkan toko Shopee atau TikTok Shop untuk mulai mencatat pesanan dan biaya.',
                    'ctaLabel' => 'Tambah toko',
                    'ctaUrl' => '/stores/create',
                ])
            @else
                @foreach ($stores as $store)
                    @php($openStoreAction = "open('".$store->id."')")
                    <native:pressable native:key="store-{{ $store->id }}" class="w-full rounded-2xl bg-theme-surface border border-theme-outline p-4" @tap="{!! $openStoreAction !!}">
                        <native:row class="w-full items-start gap-3">
                            <native:column class="h-11 w-11 items-center justify-center rounded-full bg-theme-primary-soft">
                                <native:icon :ios="Ios::Storefront" :android="Android::Storefront" :size="20" class="text-theme-primary-text" />
                            </native:column>
                            <native:column class="flex-1 gap-1">
                                <native:row class="w-full items-center justify-between gap-2">
                                    <native:text class="text-base text-theme-on-surface" font="body-semibold">{{ $store->name }}</native:text>
                                    <native:badge
                                        :label="\App\Support\Options::storeStatusLabel($store->status)"
                                        :variant="$store->status === 'active' ? 'success' : ($store->status === 'archived' ? 'destructive' : 'primary')"
                                    />
                                </native:row>
                                <native:text class="text-xs text-theme-secondary">{{ $store->marketplace?->name }} · {{ $store->code }}{{ $store->username ? ' · @'.$store->username : '' }}</native:text>
                                <native:text class="text-xs text-theme-muted">{{ $store->products_count }} produk · {{ $store->orders_count }} pesanan</native:text>
                            </native:column>
                        </native:row>
                    </native:pressable>
                @endforeach
            @endif
        </native:column>
    </native:scroll-view>

    <native:fab icon="add" label="Tambah toko" @tap="create" />
    @include('native.partials.bottom-nav', ['active' => 'more'])
</native:column>
