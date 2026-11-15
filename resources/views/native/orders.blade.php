@use('App\Icons\Ios')
@use('App\Icons\Android')

<native:top-bar title="Pesanan" subtitle="{{ $orders->count() }} pesanan ditampilkan" display-mode="large" />

<native:column class="w-full h-full bg-theme-background">
    <native:column class="w-full gap-3 border-b border-theme-outline px-4 pb-3 pt-2">
        @include('native.partials.feedback', ['notice' => $notice, 'error' => $error])

        <native:outlined-text-input
            native:model.debounce.300ms="search"
            placeholder="Cari order ID atau toko"
            label="Cari"
            leading-icon="magnifyingglass"
        />

        <native:row class="w-full gap-3">
            <native:column class="flex-1">
                <native:select native:model="statusFilterLabel" label="Status" :options="$statusOptions" />
            </native:column>
            <native:column class="flex-1">
                <native:select native:model="storeFilterLabel" label="Toko" :options="$storeOptions" />
            </native:column>
        </native:row>
    </native:column>

    @if ($orders->isEmpty())
        <native:scroll-view class="w-full flex-1" shows-indicators="false">
            <native:column class="w-full p-4">
                @include('native.partials.empty-state', [
                    'title' => 'Tidak ada pesanan',
                    'message' => 'Ubah filter atau tambahkan pesanan baru. Pesanan yang diimport juga tampil di sini.',
                    'ctaLabel' => 'Tambah pesanan',
                    'ctaUrl' => '/orders/create',
                ])
            </native:column>
        </native:scroll-view>
    @else
        <native:list class="w-full flex-1" separator>
            @foreach ($orders as $order)
                @php($openOrderAction = "open('".$order->id."')")
                <native:list-item
                    native:key="order-{{ $order->id }}"
                    :headline="$order->marketplace_order_id"
                    :supporting="$order->store?->name.' · '.\App\Support\Options::dateLabel($order->ordered_at?->toDateString()).' · '.$order->statusLabel()"
                    :trailingText="$rupiah($order->netRevenue())"
                    :leadingIconIos="Ios::Receipt"
                    :leadingIconAndroid="Android::ReceiptLong"
                    @tap="{!! $openOrderAction !!}"
                />
            @endforeach
        </native:list>
    @endif

    <native:fab icon="add" label="Pesanan baru" @tap="create" />
    @include('native.partials.bottom-nav', ['active' => 'orders'])
</native:column>
