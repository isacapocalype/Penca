@use('App\Icons\Ios')
@use('App\Icons\Android')

<native:top-bar title="Laporan" subtitle="{{ $summary->periodLabel() }}" display-mode="large" />

<native:column class="w-full h-full bg-theme-background">
    <native:scroll-view class="w-full flex-1" shows-indicators="false">
        <native:column class="w-full gap-4 p-4 pb-8">
            @include('native.partials.feedback', ['notice' => $notice, 'error' => $error])

            <native:column class="w-full gap-2">
                <native:select native:model="periodLabel" label="Rentang tanggal" :options="$periodOptions" />
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
                <native:select native:model="storeLabel" label="Toko" :options="$storeFilterOptions" />
            </native:column>

            <native:column class="w-full gap-1 rounded-3xl bg-theme-primary-soft border border-theme-primary/30 p-5">
                <native:text class="text-sm text-theme-primary-text">Laba bersih</native:text>
                <native:text class="text-4xl text-theme-on-surface" font="heading-bold">{{ $rupiah($summary->netProfit) }}</native:text>
                <native:row class="items-center gap-2">
                    <native:text class="text-sm text-theme-secondary">Margin {{ number_format($summary->marginBp / 100, 2, ',', '.') }}%</native:text>
                    @if ($profitDelta !== null)
                        <native:text class="text-sm {{ $profitDelta >= 0 ? 'text-theme-success' : 'text-theme-destructive' }}" font="body-semibold">
                            {{ $profitDelta >= 0 ? '↑' : '↓' }} {{ number_format(abs($profitDelta) / 100, 1, ',', '.') }}%
                        </native:text>
                    @endif
                </native:row>
                <native:text class="text-xs text-theme-secondary">Dibanding {{ \App\Support\Options::dateLabel($previousStart) }} – {{ \App\Support\Options::dateLabel($previousEnd) }}</native:text>
                @if ($profitDelta === null)
                    <native:text class="text-xs text-theme-muted">Periode pembanding belum punya laba, jadi persentase perubahan tidak dihitung.</native:text>
                @endif
            </native:column>

            <native:row class="w-full gap-3">
                @include('native.partials.stat-card', [
                    'label' => 'Pendapatan neto',
                    'value' => $rupiah($summary->netRevenue),
                    'hint' => $summary->orderCount.' pesanan',
                ])
                @include('native.partials.stat-card', [
                    'label' => 'Omzet bruto',
                    'value' => $rupiah($summary->grossRevenue),
                    'hint' => $summary->itemsSold.' produk terjual',
                ])
            </native:row>

            <native:row class="w-full gap-3">
                @include('native.partials.stat-card', ['label' => 'Diskon penjual', 'value' => $rupiah($summary->sellerDiscount)])
                @include('native.partials.stat-card', ['label' => 'Refund', 'value' => $rupiah($summary->refunds)])
            </native:row>

            <native:row class="w-full gap-3">
                @include('native.partials.stat-card', ['label' => 'HPP', 'value' => $rupiah($summary->hpp)])
                @include('native.partials.stat-card', ['label' => 'Laba kotor', 'value' => $rupiah($summary->grossProfit)])
            </native:row>

            <native:row class="w-full gap-3">
                @include('native.partials.stat-card', ['label' => 'Fee marketplace', 'value' => $rupiah($summary->marketplaceFees)])
                @include('native.partials.stat-card', ['label' => 'Biaya iklan', 'value' => $rupiah($summary->advertising)])
            </native:row>

            <native:row class="w-full gap-3">
                @include('native.partials.stat-card', ['label' => 'Operasional', 'value' => $rupiah($summary->operational)])
                @include('native.partials.stat-card', ['label' => 'Laba operasional', 'value' => $rupiah($summary->operatingProfit)])
            </native:row>

            <native:column class="w-full gap-1 rounded-2xl bg-theme-surface border border-theme-outline p-4">
                <native:row class="w-full items-center justify-between">
                    <native:text class="text-sm text-theme-secondary">Dana dicairkan</native:text>
                    <native:text class="text-sm text-theme-on-surface" font="body-semibold">{{ $rupiah($summary->settlementTotal) }}</native:text>
                </native:row>
                <native:text class="text-xs text-theme-muted">Pencairan marketplace adalah kas aktual pada periode ini, bukan tambahan laba.</native:text>
            </native:column>

            <native:column class="w-full gap-2 rounded-2xl bg-theme-surface border border-theme-outline p-4">
                <native:row class="w-full items-center justify-between">
                    <native:text class="text-sm text-theme-on-surface" font="body-semibold">Pajak periode ini</native:text>
                    <native:text class="text-xs text-theme-secondary">PPN bukan pengurang laba</native:text>
                </native:row>
                <native:row class="w-full items-center justify-between">
                    <native:text class="text-xs text-theme-secondary">PPN keluaran</native:text>
                    <native:text class="text-sm text-theme-on-surface" font="body-medium">{{ $rupiah($summary->ppnOutput) }}</native:text>
                </native:row>
                <native:row class="w-full items-center justify-between">
                    <native:text class="text-xs text-theme-secondary">PPN masukan</native:text>
                    <native:text class="text-sm text-theme-on-surface" font="body-medium">{{ $rupiah($summary->ppnInput) }}</native:text>
                </native:row>
                <native:row class="w-full items-center justify-between">
                    <native:text class="text-xs text-theme-secondary">PPN kurang bayar</native:text>
                    <native:text class="text-sm text-theme-on-surface" font="body-medium">{{ $rupiah($summary->ppnPayable) }}</native:text>
                </native:row>
                <native:row class="w-full items-center justify-between">
                    <native:text class="text-xs text-theme-secondary">PPh Final (mengurangi laba)</native:text>
                    <native:text class="text-sm text-theme-on-surface" font="body-medium">{{ $rupiah($summary->pphFinal) }}</native:text>
                </native:row>
                <native:button class="mt-1 w-full" variant="secondary" @navigate="'/taxes'">Buka rekap pajak</native:button>
            </native:column>

            <native:column class="w-full gap-3 rounded-3xl bg-theme-surface border border-theme-outline p-4">
                <native:row class="w-full items-center justify-between">
                    <native:text class="text-base text-theme-on-surface" font="heading">Omzet per hari</native:text>
                    <native:icon :ios="Ios::ChartBar" :android="Android::BarChart" :size="22" class="text-theme-primary" />
                </native:row>

                @if ($summary->daily === [])
                    <native:text class="text-sm text-theme-secondary">Belum ada transaksi pada periode ini.</native:text>
                @else
                    @php($peak = max(1, ...array_map(fn (array $row): int => max(0, (int) $row['gross']), $summary->daily)))
                    @foreach ($summary->daily as $row)
                        <native:column class="w-full gap-1">
                            <native:row class="w-full items-center justify-between">
                                <native:text class="text-xs text-theme-secondary">{{ \App\Support\Options::dateLabel($row['date']) }}</native:text>
                                <native:text class="text-xs text-theme-on-surface" font="body-medium">{{ $compact($row['gross']) }} · laba {{ $compact($row['net_profit']) }}</native:text>
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

            <native:column class="w-full gap-3 rounded-3xl bg-theme-surface border border-theme-outline p-4">
                <native:text class="text-base text-theme-on-surface" font="heading">Performa toko</native:text>

                @if ($summary->stores === [])
                    <native:text class="text-sm text-theme-secondary">Belum ada toko dengan transaksi pada periode ini.</native:text>
                @else
                    @foreach ($summary->stores as $store)
                        <native:column native:key="store-{{ $store['store_id'] }}" class="w-full gap-1 rounded-2xl bg-theme-surface-variant p-3">
                            <native:row class="w-full items-center justify-between">
                                <native:text class="text-sm text-theme-on-surface" font="body-semibold">{{ $store['name'] }}</native:text>
                                <native:text class="text-sm text-theme-on-surface" font="body-semibold">{{ $rupiah($store['net_profit']) }}</native:text>
                            </native:row>
                            <native:text class="text-xs text-theme-secondary">{{ $store['marketplace'] }} · {{ $store['orders'] }} pesanan · omzet {{ $rupiah($store['gross']) }}</native:text>
                        </native:column>
                    @endforeach
                @endif
            </native:column>

            <native:column class="w-full gap-3 rounded-3xl bg-theme-surface border border-theme-outline p-4">
                <native:text class="text-base text-theme-on-surface" font="heading">Produk terlaris</native:text>

                @if ($topProducts->isEmpty())
                    <native:text class="text-sm text-theme-secondary">Belum ada produk terjual pada periode ini.</native:text>
                @else
                    @foreach ($topProducts as $product)
                        <native:row native:key="product-{{ $product->sku }}" class="w-full items-center justify-between gap-2">
                            <native:column class="flex-1 gap-1">
                                <native:text class="text-sm text-theme-on-surface" font="body-medium">{{ $product->sku }} · {{ $product->product_name }}</native:text>
                                <native:text class="text-xs text-theme-secondary">{{ (int) $product->qty }} unit · laba kotor {{ $rupiah((int) $product->revenue - (int) $product->hpp) }}</native:text>
                            </native:column>
                            <native:text class="text-sm text-theme-on-surface" font="body-semibold">{{ $rupiah((int) $product->revenue) }}</native:text>
                        </native:row>
                    @endforeach
                @endif
            </native:column>

            <native:column class="w-full gap-3 rounded-3xl bg-theme-surface border border-theme-outline p-4">
                <native:column class="gap-1">
                    <native:text class="text-base text-theme-on-surface" font="heading">Ekspor laporan</native:text>
                    <native:text class="text-xs text-theme-secondary">File dibuat dari data periode dan toko yang dipilih, lalu lembar berbagi sistem terbuka.</native:text>
                </native:column>

                <native:row class="w-full gap-2">
                    <native:button class="flex-1" variant="secondary" @tap="exportCsv">CSV</native:button>
                    <native:button class="flex-1" variant="secondary" @tap="exportXlsx">XLSX</native:button>
                    <native:button class="flex-1" variant="secondary" @tap="exportPdf">PDF</native:button>
                </native:row>

                @if ($lastExport !== null)
                    <native:text class="text-xs text-theme-success">{{ $lastExport }}</native:text>
                @else
                    <native:text class="text-xs text-theme-muted">Belum ada file yang diekspor pada sesi ini.</native:text>
                @endif
            </native:column>
        </native:column>
    </native:scroll-view>

    @include('native.partials.bottom-nav', ['active' => 'reports'])
</native:column>
