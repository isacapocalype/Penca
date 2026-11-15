@use('App\Icons\Ios')
@use('App\Icons\Android')

<native:top-bar title="Dashboard" subtitle="{{ $todayLabel }}" display-mode="large" />

<native:column class="w-full h-full bg-theme-background">
    <native:scroll-view class="w-full flex-1" shows-indicators="false">
        <native:column class="w-full gap-4 p-4 pb-8">
            @include('native.partials.feedback', ['notice' => $notice, 'error' => $error])

            <native:row class="w-full items-center justify-between">
                <native:text class="text-sm text-theme-secondary">Ringkasan usaha</native:text>
                <native:pressable class="rounded-full bg-theme-primary-soft px-3 py-2" @tap="goReports">
                    <native:row class="items-center gap-1">
                        <native:text class="text-xs text-theme-primary-text" font="body-medium">Lihat laporan</native:text>
                        <native:icon :ios="Ios::ChevronRight" :android="Android::ChevronRight" :size="12" class="text-theme-primary-text" />
                    </native:row>
                </native:pressable>
            </native:row>

            <native:column class="w-full gap-1 rounded-3xl bg-theme-primary-soft border border-theme-primary/30 p-5">
                <native:text class="text-sm text-theme-primary-text">Laba bersih · {{ $summary->periodLabel() }}</native:text>
                <native:text class="text-4xl text-theme-on-surface" font="heading-bold">{{ $rupiah($summary->netProfit) }}</native:text>
                <native:row class="items-center gap-2">
                    <native:text class="text-sm text-theme-secondary">Margin</native:text>
                    <native:text class="text-sm text-theme-primary-text" font="body-semibold">{{ number_format($summary->marginBp / 100, 2, ',', '.') }}%</native:text>
                    @if ($summary->hasSales())
                        <native:text class="text-sm text-theme-secondary">dari {{ $rupiah($summary->netRevenue) }} pendapatan neto</native:text>
                    @endif
                </native:row>
                <native:text class="mt-1 text-xs text-theme-secondary">PPN dihitung terpisah dan tidak mengurangi laba. PPh Final sudah dikurangkan.</native:text>
            </native:column>

            <native:column class="w-full gap-2">
                <native:text class="text-sm text-theme-secondary" font="body-medium">Periode</native:text>
                <native:select
                    native:model="periodLabel"
                    label="Rentang tanggal"
                    :options="$periodOptions"
                />
                @if ($isCustomRange)
                    <native:row class="w-full gap-3">
                        <native:column class="flex-1">
                            <native:date-picker native:model="customStart" label="Mulai" mode="date" timezone="Asia/Jakarta" locale="id-ID" />
                        </native:column>
                        <native:column class="flex-1">
                            <native:date-picker native:model="customEnd" label="Sampai" mode="date" timezone="Asia/Jakarta" locale="id-ID" />
                        </native:column>
                    </native:row>
                @endif
                <native:select
                    native:model="storeLabel"
                    label="Toko"
                    :options="$storeFilterOptions"
                />
            </native:column>

            <native:row class="w-full gap-3">
                @include('native.partials.stat-card', [
                    'label' => 'Omzet bruto',
                    'value' => $rupiah($summary->grossRevenue),
                    'hint' => $summary->orderCount.' pesanan',
                ])
                @include('native.partials.stat-card', [
                    'label' => 'Pesanan',
                    'value' => (string) $summary->orderCount,
                    'hint' => $summary->itemsSold.' produk terjual',
                ])
            </native:row>

            <native:row class="w-full gap-3">
                @include('native.partials.stat-card', [
                    'label' => 'HPP',
                    'value' => $rupiah($summary->hpp),
                    'hint' => 'Modal produksi',
                ])
                @include('native.partials.stat-card', [
                    'label' => 'Fee marketplace',
                    'value' => $rupiah($summary->marketplaceFees),
                    'hint' => 'Ditanggung penjual',
                ])
            </native:row>

            <native:row class="w-full gap-3">
                @include('native.partials.stat-card', [
                    'label' => 'Biaya iklan',
                    'value' => $rupiah($summary->advertising),
                    'hint' => 'Sesuai tanggal belanja',
                ])
                @include('native.partials.stat-card', [
                    'label' => 'Operasional',
                    'value' => $rupiah($summary->operational),
                    'hint' => 'Gaji, packing, dll.',
                ])
            </native:row>

            <native:row class="w-full gap-3">
                @include('native.partials.stat-card', [
                    'label' => 'PPh Final',
                    'value' => $rupiah($summary->pphFinal),
                    'hint' => 'Mengurangi laba',
                ])
                @include('native.partials.stat-card', [
                    'label' => 'PPN kurang bayar',
                    'value' => $rupiah($summary->ppnPayable),
                    'hint' => 'Bukan pengurang laba',
                ])
            </native:row>

            <native:row class="w-full gap-3">
                @include('native.partials.stat-card', [
                    'label' => 'Pendapatan neto',
                    'value' => $rupiah($summary->netRevenue),
                    'hint' => 'Setelah diskon & refund',
                ])
                @include('native.partials.stat-card', [
                    'label' => 'Dana dicairkan',
                    'value' => $rupiah($summary->settlementTotal),
                    'hint' => 'Kas aktual, bukan laba',
                ])
            </native:row>

            <native:column class="w-full gap-3 rounded-3xl bg-theme-surface border border-theme-outline p-4">
                <native:row class="w-full items-center justify-between">
                    <native:column class="gap-1">
                        <native:text class="text-base text-theme-on-surface" font="heading">Omzet harian</native:text>
                        <native:text class="text-xs text-theme-secondary">{{ $summary->periodLabel() }}</native:text>
                    </native:column>
                    <native:icon :ios="Ios::ChartBar" :android="Android::BarChart" :size="22" class="text-theme-primary" />
                </native:row>

                @if ($summary->grossRevenue === 0)
                    <native:column class="w-full items-center gap-2 py-4">
                        <native:text class="text-sm text-theme-secondary">Belum ada omzet pada periode ini.</native:text>
                        <native:text class="text-xs text-theme-muted">Grafik akan terisi dari pesanan berstatus Terkirim atau Selesai.</native:text>
                    </native:column>
                @else
                    @foreach ($daily as $row)
                        <native:column class="w-full gap-1">
                            <native:row class="w-full items-center justify-between">
                                <native:text class="text-xs text-theme-secondary">{{ $row['label'] }}</native:text>
                                <native:text class="text-xs text-theme-on-surface" font="body-medium">{{ $compact($row['gross']) }}</native:text>
                            </native:row>
                            <native:column class="h-2 w-full overflow-hidden rounded-full bg-theme-surface-variant">
                                @if ($row['gross'] > 0)
                                    @php($barWidth = max(2, (int) round($row['gross'] / $peak * 100)))
                                    <native:column class="h-2 rounded-full bg-theme-primary w-[{{ $barWidth }}%]"></native:column>
                                @endif
                            </native:column>
                        </native:column>
                    @endforeach
                @endif
            </native:column>

            <native:column class="w-full gap-3">
                <native:text class="text-base text-theme-on-surface" font="heading">Performa toko</native:text>

                @if ($summary->stores === [])
                    @include('native.partials.empty-state', [
                        'title' => 'Belum ada penjualan',
                        'message' => 'Tambahkan pesanan atau import data marketplace untuk melihat performa toko.',
                        'ctaLabel' => 'Tambah pesanan',
                        'ctaUrl' => '/orders/create',
                    ])
                @else
                    @foreach ($summary->stores as $store)
                        @php($openStoreAction = "openStore('".$store['store_id']."')")
                        <native:pressable class="w-full rounded-2xl bg-theme-surface border border-theme-outline p-4" @tap="{!! $openStoreAction !!}">
                            <native:row class="w-full items-start justify-between gap-3">
                                <native:column class="flex-1 gap-1">
                                    <native:text class="text-base text-theme-on-surface" font="body-semibold">{{ $store['name'] }}</native:text>
                                    <native:text class="text-xs text-theme-secondary">{{ $store['marketplace'] }} · {{ $store['orders'] }} pesanan</native:text>
                                </native:column>
                                <native:column class="items-end gap-1">
                                    <native:text class="text-sm text-theme-on-surface" font="body-semibold">{{ $rupiah($store['net_profit']) }}</native:text>
                                    <native:text class="text-xs text-theme-secondary">laba bersih</native:text>
                                </native:column>
                            </native:row>
                            <native:row class="mt-3 w-full items-center justify-between">
                                <native:text class="text-xs text-theme-secondary">Omzet {{ $rupiah($store['gross']) }}</native:text>
                                <native:text class="text-xs text-theme-secondary">Fee {{ $rupiah($store['fees']) }}</native:text>
                                <native:text class="text-xs text-theme-secondary">Iklan {{ $rupiah($store['ads']) }}</native:text>
                            </native:row>
                        </native:pressable>
                    @endforeach
                @endif
            </native:column>

            <native:column class="w-full gap-3">
                <native:row class="w-full items-center justify-between">
                    <native:text class="text-base text-theme-on-surface" font="heading">Pesanan terbaru</native:text>
                    <native:pressable class="rounded-full bg-theme-surface-variant px-3 py-2" @tap="goOrders">
                        <native:text class="text-xs text-theme-primary-text" font="body-medium">Semua pesanan</native:text>
                    </native:pressable>
                </native:row>

                @if ($recentOrders->isEmpty())
                    <native:column class="w-full rounded-2xl bg-theme-surface border border-theme-outline p-4">
                        <native:text class="text-sm text-theme-secondary">Belum ada pesanan. Pesanan baru akan tampil di sini.</native:text>
                    </native:column>
                @else
                    @foreach ($recentOrders as $order)
                        @php($openOrderAction = "openOrder('".$order->id."')")
                        <native:pressable class="w-full rounded-2xl bg-theme-surface border border-theme-outline p-4" @tap="{!! $openOrderAction !!}">
                            <native:row class="w-full items-center justify-between gap-3">
                                <native:column class="flex-1 gap-1">
                                    <native:text class="text-sm text-theme-on-surface" font="body-semibold">{{ $order->marketplace_order_id }}</native:text>
                                    <native:text class="text-xs text-theme-secondary">{{ $order->store?->name }} · {{ \App\Support\Options::dateLabel($order->ordered_at?->toDateString()) }}</native:text>
                                </native:column>
                                <native:column class="items-end gap-1">
                                    <native:text class="text-sm text-theme-on-surface" font="body-semibold">{{ $rupiah($order->netRevenue()) }}</native:text>
                                    <native:text class="text-xs text-theme-secondary">{{ $order->statusLabel() }}</native:text>
                                </native:column>
                            </native:row>
                        </native:pressable>
                    @endforeach
                @endif
            </native:column>
        </native:column>
    </native:scroll-view>

    @include('native.partials.bottom-nav', ['active' => 'dashboard'])
</native:column>
