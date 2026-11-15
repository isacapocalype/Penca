@use('App\Icons\Ios')
@use('App\Icons\Android')

<native:top-bar title="Produk & HPP" subtitle="{{ $products->count() }} produk" display-mode="large" />

<native:column class="w-full h-full bg-theme-background">
    <native:column class="w-full gap-3 border-b border-theme-outline px-4 pb-3 pt-2">
        @include('native.partials.feedback', ['notice' => $notice, 'error' => $error])

        <native:outlined-text-input
            native:model.debounce.300ms="search"
            placeholder="Cari SKU atau nama produk"
            label="Cari produk"
        />
        <native:row class="w-full gap-3">
            <native:column class="flex-1">
                <native:select native:model="storeFilterLabel" label="Toko" :options="$storeOptions" />
            </native:column>
            <native:column class="flex-1">
                <native:select native:model="statusFilterLabel" label="Status" :options="$statusOptions" />
            </native:column>
        </native:row>
    </native:column>

    <native:scroll-view class="w-full flex-1" shows-indicators="false">
        <native:column class="w-full gap-3 p-4 pb-8">
            @if ($products->isEmpty())
                @include('native.partials.empty-state', [
                    'title' => 'Belum ada produk',
                    'message' => 'Tambahkan produk beserta HPP agar setiap pesanan punya modal yang tercatat.',
                    'ctaLabel' => 'Tambah produk',
                    'ctaUrl' => '/products/create',
                ])
            @else
                @foreach ($products as $row)
                    @php($product = $row['product'])
                    @php($openProductAction = "open('".$product->id."')")
                    <native:pressable native:key="product-{{ $product->id }}" class="w-full rounded-2xl bg-theme-surface border border-theme-outline p-4" @tap="{!! $openProductAction !!}">
                        <native:row class="w-full items-start gap-3">
                            <native:column class="h-11 w-11 items-center justify-center rounded-full bg-theme-primary-soft">
                                <native:icon :ios="Ios::Tag" :android="Android::Inventory" :size="20" class="text-theme-primary-text" />
                            </native:column>
                            <native:column class="flex-1 gap-1">
                                <native:row class="w-full items-center justify-between gap-2">
                                    <native:text class="text-base text-theme-on-surface" font="body-semibold">{{ $product->name }}</native:text>
                                    @if (! $product->active)
                                        <native:badge label="Nonaktif" variant="primary" />
                                    @endif
                                </native:row>
                                <native:text class="text-xs text-theme-secondary">{{ $product->sku }} · {{ $product->store?->name }}</native:text>
                                <native:row class="mt-1 w-full items-center justify-between">
                                    <native:text class="text-xs text-theme-secondary">Jual {{ $rupiah($product->selling_price) }}</native:text>
                                    <native:text class="text-xs {{ $row['hpp'] === null ? 'text-theme-destructive' : 'text-theme-secondary' }}">
                                        {{ $row['hpp'] === null ? 'HPP belum ada' : 'HPP '.$rupiah($row['hpp']) }}
                                    </native:text>
                                </native:row>
                            </native:column>
                        </native:row>
                    </native:pressable>
                @endforeach
            @endif
        </native:column>
    </native:scroll-view>

    <native:fab icon="add" label="Tambah produk" @tap="create" />
    @include('native.partials.bottom-nav', ['active' => 'more'])
</native:column>
