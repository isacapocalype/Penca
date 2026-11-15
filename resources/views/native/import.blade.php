@use('App\Icons\Ios')
@use('App\Icons\Android')

<native:top-bar title="Import pesanan" subtitle="CSV atau XLSX dari marketplace" display-mode="large" />

<native:column class="w-full h-full bg-theme-background">
    <native:scroll-view class="w-full flex-1" shows-indicators="false">
        <native:column class="w-full gap-4 p-4 pb-8">
            @include('native.partials.feedback', ['notice' => $notice, 'error' => $error])

            @if (! $hasStore)
                @include('native.partials.empty-state', [
                    'title' => 'Belum ada toko',
                    'message' => 'Tambahkan toko terlebih dahulu agar import tahu pesanan ini milik toko mana.',
                    'ctaLabel' => 'Tambah toko',
                    'ctaUrl' => '/stores/create',
                ])
            @else
                <native:select native:model="storeLabel" label="Toko tujuan" :options="$storeOptions" />

                @if ($stage === 'idle')
                    <native:column class="w-full gap-3 rounded-3xl bg-theme-surface border border-theme-outline p-4">
                        <native:row class="items-center gap-2">
                            <native:icon :ios="Ios::SquareAndArrowDown" :android="Android::UploadFile" :size="22" class="text-theme-primary" />
                            <native:text class="text-base text-theme-on-surface" font="heading">Pilih file marketplace</native:text>
                        </native:row>
                        <native:text class="text-sm text-theme-secondary">Ekspor pesanan dari Shopee atau TikTok Shop sebagai CSV atau XLSX, lalu pilih filenya di sini. File dibaca lokal di perangkat; tidak ada data yang dikirim ke server.</native:text>
                        <native:column class="w-full gap-1 rounded-2xl bg-theme-surface-variant p-3">
                            <native:text class="text-xs text-theme-secondary">Kolom wajib: Order ID, Tanggal pesanan, Status, SKU, Nama produk, Jumlah, Harga satuan.</native:text>
                            <native:text class="text-xs text-theme-secondary">Kolom opsional: diskon, HPP, fee, refund, dan tanggal selesai. Pemetaan otomatis dapat disesuaikan sebelum import.</native:text>
                        </native:column>
                        <native:button class="w-full" variant="primary" @tap="pickFile">Pilih file CSV/XLSX</native:button>
                        <native:text class="text-xs text-theme-muted">File yang sama tidak akan membuat pesanan ganda. Order ID yang sudah ada dilewati.</native:text>
                    </native:column>
                @elseif ($stage === 'preview')
                    <native:column class="w-full gap-2 rounded-3xl bg-theme-primary-soft border border-theme-primary/30 p-4">
                        <native:text class="text-xs text-theme-primary-text">Pratinjau import</native:text>
                        <native:text class="text-base text-theme-on-surface" font="body-semibold">{{ $preview['fileName'] ?? $pickedName }}</native:text>
                        <native:row class="w-full gap-3 pt-1">
                            <native:column class="flex-1 rounded-2xl bg-theme-surface/70 p-3">
                                <native:text class="text-lg text-theme-on-surface" font="heading-bold">{{ $preview['orderCount'] ?? 0 }}</native:text>
                                <native:text class="text-xs text-theme-secondary">pesanan</native:text>
                            </native:column>
                            <native:column class="flex-1 rounded-2xl bg-theme-surface/70 p-3">
                                <native:text class="text-lg text-theme-on-surface" font="heading-bold">{{ $preview['validRows'] ?? 0 }}</native:text>
                                <native:text class="text-xs text-theme-secondary">baris valid</native:text>
                            </native:column>
                            <native:column class="flex-1 rounded-2xl bg-theme-surface/70 p-3">
                                <native:text class="text-lg {{ ($preview['invalidRows'] ?? 0) > 0 ? 'text-theme-destructive' : 'text-theme-on-surface' }}" font="heading-bold">{{ $preview['invalidRows'] ?? 0 }}</native:text>
                                <native:text class="text-xs text-theme-secondary">baris gagal</native:text>
                            </native:column>
                        </native:row>
                        <native:text class="text-xs text-theme-secondary">{{ $preview['totalRows'] ?? 0 }} baris dibaca. Tidak ada data yang disimpan sebelum Anda menekan Import.</native:text>
                    </native:column>

                    @if ($missingFields !== [])
                        <native:column class="w-full gap-1 rounded-2xl bg-theme-danger-soft border border-theme-destructive/30 p-4">
                            <native:text class="text-sm text-theme-destructive" font="body-semibold">Kolom wajib belum dipetakan</native:text>
                            <native:text class="text-xs text-theme-destructive">{{ implode(', ', $missingFields) }}. Sesuaikan pemetaan di bawah sebelum import.</native:text>
                        </native:column>
                    @endif

                    <native:column class="w-full gap-3 rounded-3xl bg-theme-surface border border-theme-outline p-4">
                        <native:row class="w-full items-center justify-between">
                            <native:text class="text-base text-theme-on-surface" font="heading">Pemetaan kolom</native:text>
                            <native:pressable class="rounded-full bg-theme-primary-soft px-3 py-2" @tap="toggleMapping">
                                <native:text class="text-xs text-theme-primary-text" font="body-medium">{{ $showMapping ? 'Tutup' : 'Sesuaikan' }}</native:text>
                            </native:pressable>
                        </native:row>

                        @if ($showMapping)
                            @foreach ($mappingFields as $field => $label)
                                <native:select
                                    native:key="map-{{ $field }}"
                                    native:model="mappingLabels.{{ $field }}"
                                    label="{{ $label }}{{ in_array($field, $requiredFields, true) ? ' *' : '' }}"
                                    :options="['— Tidak dipetakan —', ...$mappingOptions]"
                                />
                            @endforeach
                            <native:button class="w-full" variant="secondary" @tap="reanalyze">Terapkan pemetaan</native:button>
                        @else
                            <native:text class="text-xs text-theme-secondary">Pemetaan otomatis sudah sesuai. Sesuaikan bila ada kolom yang salah terbaca.</native:text>
                        @endif
                    </native:column>

                    @if (($preview['rows'] ?? []) !== [])
                        <native:column class="w-full gap-2 rounded-3xl bg-theme-surface border border-theme-outline p-4">
                            <native:text class="text-base text-theme-on-surface" font="heading">Contoh pesanan</native:text>
                            @foreach ($preview['rows'] as $row)
                                <native:row native:key="preview-{{ $row['order_id'] }}" class="w-full items-center justify-between gap-2">
                                    <native:column class="flex-1 gap-1">
                                        <native:text class="text-sm text-theme-on-surface" font="body-medium">{{ $row['order_id'] }}</native:text>
                                        <native:text class="text-xs text-theme-secondary">{{ \App\Support\Options::dateLabel($row['ordered_at']) }} · {{ $row['status'] }} · {{ $row['items'] }} item</native:text>
                                    </native:column>
                                    <native:text class="text-sm text-theme-on-surface" font="body-semibold">Rp {{ number_format($row['gross'], 0, ',', '.') }}</native:text>
                                </native:row>
                            @endforeach
                        </native:column>
                    @endif

                    @if (($preview['errors'] ?? []) !== [])
                        <native:column class="w-full gap-2 rounded-3xl bg-theme-surface border border-theme-outline p-4">
                            <native:text class="text-base text-theme-on-surface" font="heading">Baris bermasalah</native:text>
                            @foreach ($preview['errors'] as $error)
                                <native:column native:key="error-{{ $error['row'] }}" class="w-full gap-1 rounded-2xl bg-theme-danger-soft p-3">
                                    <native:text class="text-xs text-theme-destructive" font="body-semibold">Baris {{ $error['row'] }}</native:text>
                                    <native:text class="text-xs text-theme-destructive">{{ implode(' ', $error['messages']) }}</native:text>
                                </native:column>
                            @endforeach
                        </native:column>
                    @endif

                    <native:button class="w-full" variant="primary" @tap="commit">Import {{ $preview['validRows'] ?? 0 }} baris valid</native:button>
                    <native:button class="w-full" variant="secondary" @tap="resetFlow">Pilih file lain</native:button>
                @else
                    <native:column class="w-full gap-2 rounded-3xl bg-theme-success-soft border border-theme-success/30 p-4">
                        <native:text class="text-base text-theme-success" font="heading">Import selesai diproses</native:text>
                        <native:text class="text-sm text-theme-on-surface">{{ $result['summary'] ?? '' }}</native:text>
                        <native:row class="w-full gap-3 pt-1">
                            <native:column class="flex-1 rounded-2xl bg-theme-surface/70 p-3">
                                <native:text class="text-lg text-theme-on-surface" font="heading-bold">{{ $result['ordersImported'] ?? 0 }}</native:text>
                                <native:text class="text-xs text-theme-secondary">pesanan masuk</native:text>
                            </native:column>
                            <native:column class="flex-1 rounded-2xl bg-theme-surface/70 p-3">
                                <native:text class="text-lg text-theme-on-surface" font="heading-bold">{{ $result['rowsSkipped'] ?? 0 }}</native:text>
                                <native:text class="text-xs text-theme-secondary">baris dilewati</native:text>
                            </native:column>
                            <native:column class="flex-1 rounded-2xl bg-theme-surface/70 p-3">
                                <native:text class="text-lg {{ ($result['rowsFailed'] ?? 0) > 0 ? 'text-theme-destructive' : 'text-theme-on-surface' }}" font="heading-bold">{{ $result['rowsFailed'] ?? 0 }}</native:text>
                                <native:text class="text-xs text-theme-secondary">baris gagal</native:text>
                            </native:column>
                        </native:row>
                        @if ($result['duplicateFile'] ?? false)
                            <native:text class="text-xs text-theme-secondary">File ini sudah pernah diimport sebelumnya, jadi tidak ada data baru yang dibuat.</native:text>
                        @endif
                    </native:column>

                    @if ($lastBatchId !== null && ($result['rowsFailed'] ?? 0) > 0)
                        <native:button class="w-full" variant="secondary" @tap="exportFailures">Bagikan CSV baris gagal</native:button>
                    @endif

                    <native:row class="w-full gap-3">
                        <native:button class="flex-1" variant="secondary" @tap="resetFlow">Import lagi</native:button>
                        <native:button class="flex-1" variant="primary" @tap="goOrders">Lihat pesanan</native:button>
                    </native:row>
                @endif

                <native:column class="w-full gap-3 rounded-3xl bg-theme-surface border border-theme-outline p-4">
                    <native:text class="text-base text-theme-on-surface" font="heading">Riwayat import</native:text>

                    @if ($batches->isEmpty())
                        <native:text class="text-sm text-theme-secondary">Belum ada file yang diimport.</native:text>
                    @else
                        @foreach ($batches as $batch)
                            <native:column native:key="batch-{{ $batch->id }}" class="w-full gap-1 rounded-2xl bg-theme-surface-variant p-3">
                                <native:row class="w-full items-center justify-between gap-2">
                                    <native:text class="text-sm text-theme-on-surface" font="body-medium">{{ $batch->file_name }}</native:text>
                                    <native:badge
                                        :label="$batch->status === 'completed' ? 'Selesai' : ($batch->status === 'completed_with_errors' ? 'Sebagian' : ($batch->status === 'failed' ? 'Gagal' : 'Proses'))"
                                        :variant="$batch->status === 'completed' ? 'success' : ($batch->status === 'completed_with_errors' ? 'primary' : 'destructive')"
                                    />
                                </native:row>
                                <native:text class="text-xs text-theme-secondary">{{ $batch->store?->name }} · {{ \App\Support\Options::dateTimeLabel($batch->created_at?->toDateTimeString()) }}</native:text>
                                <native:text class="text-xs text-theme-secondary">{{ (int) $batch->rows_imported }} baris masuk · {{ (int) $batch->rows_failed }} gagal · {{ (int) $batch->rows_skipped }} dilewati</native:text>
                            </native:column>
                        @endforeach
                    @endif
                </native:column>
            @endif
        </native:column>
    </native:scroll-view>

    @include('native.partials.bottom-nav', ['active' => 'more'])
</native:column>
