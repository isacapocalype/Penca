@use('App\Icons\Ios')
@use('App\Icons\Android')

<native:top-bar title="Audit log" subtitle="Riwayat perubahan data keuangan" display-mode="large" back />

<native:column class="w-full h-full bg-theme-background">
    <native:scroll-view class="w-full flex-1" shows-indicators="false">
        <native:column class="w-full gap-4 p-4 pb-10">
            @include('native.partials.feedback', ['notice' => $notice, 'error' => $error])

            <native:column class="w-full gap-3 rounded-3xl bg-theme-surface border border-theme-outline p-4">
                <native:row class="w-full items-center justify-between">
                    <native:text class="text-base text-theme-on-surface" font="heading">Filter</native:text>
                    <native:pressable class="rounded-full bg-theme-surface-variant px-3 py-2" @tap="resetFilters">
                        <native:text class="text-xs text-theme-on-surface" font="body-medium">Reset</native:text>
                    </native:pressable>
                </native:row>
                <native:select native:model="eventFilterLabel" label="Peristiwa" :options="$eventOptions" />
                <native:select native:model="storeFilterLabel" label="Toko" :options="$storeFilterOptions" />
                <native:outlined-text-input native:model.debounce.300ms="search" label="Cari ringkasan atau ID" placeholder="Order ID, produk, ringkasan" />
                <native:text class="text-xs text-theme-secondary">Menampilkan {{ $logs->count() }} dari {{ number_format($total, 0, ',', '.') }} catatan. Audit log tidak dapat diedit atau dihapus dari aplikasi.</native:text>
            </native:column>

            @if ($logs->isEmpty())
                @include('native.partials.empty-state', [
                    'title' => 'Tidak ada catatan audit',
                    'message' => 'Setiap pembuatan, perubahan, penghapusan, dan restore data akan tercatat di sini.',
                ])
            @else
                @foreach ($logs as $log)
                    @php
                        $before = is_array($log->before) ? $log->before : [];
                        $after = is_array($log->after) ? $log->after : [];
                        $expanded = $expandedId === $log->id;
                        $variant = match ($log->event) {
                            'created' => 'success',
                            'deleted' => 'destructive',
                            default => 'primary',
                        };
                    @endphp

                    <native:column native:key="audit-{{ $log->id }}" class="w-full gap-2 rounded-2xl bg-theme-surface border border-theme-outline p-4">
                        <native:row class="w-full items-start justify-between gap-2">
                            <native:column class="flex-1 gap-1">
                                <native:row class="items-center gap-2">
                                    <native:badge :label="$eventLabels[$log->event] ?? ucfirst($log->event)" :variant="$variant" />
                                    <native:text class="text-xs text-theme-secondary">{{ $modelLabel($log->auditable_type) }}</native:text>
                                </native:row>
                                <native:text class="text-sm text-theme-on-surface" font="body-semibold">{{ $log->summary }}</native:text>
                                <native:text class="text-xs text-theme-secondary">{{ \App\Support\Options::dateTimeLabel($log->created_at?->toDateTimeString()) }} · {{ $log->store?->name ?? 'Umum / tanpa toko' }}</native:text>
                            </native:column>
                            @php($toggleAuditAction = "toggle('".$log->id."')")
                            <native:pressable class="rounded-full bg-theme-surface-variant px-3 py-2" @tap="{!! $toggleAuditAction !!}">
                                <native:text class="text-xs text-theme-on-surface" font="body-medium">{{ $expanded ? 'Tutup' : 'Detail' }}</native:text>
                            </native:pressable>
                        </native:row>

                        @if ($expanded)
                            @if ($before === [] && $after === [])
                                <native:text class="text-xs text-theme-secondary">Tidak ada detail atribut untuk catatan ini.</native:text>
                            @elseif ($log->event === 'updated' && $before !== [])
                                <native:column class="w-full gap-1 rounded-xl bg-theme-surface-variant p-3">
                                    <native:text class="text-xs text-theme-secondary" font="body-semibold">Perubahan</native:text>
                                    @foreach ($before as $key => $oldValue)
                                        <native:row native:key="delta-{{ $key }}" class="w-full items-start justify-between gap-3">
                                            <native:text class="flex-1 text-xs text-theme-secondary">{{ $formatKey((string) $key) }}</native:text>
                                            <native:column class="flex-1 items-end gap-0.5">
                                                <native:text class="text-right text-xs text-theme-muted">{{ $formatValue($oldValue) }}</native:text>
                                                <native:text class="text-right text-xs text-theme-on-surface" font="body-medium">{{ $formatValue($after[$key] ?? null) }}</native:text>
                                            </native:column>
                                        </native:row>
                                    @endforeach
                                </native:column>
                            @else
                                @foreach ([['label' => 'Sebelum', 'data' => $before], ['label' => 'Sesudah', 'data' => $after]] as $section)
                                    @if ($section['data'] !== [])
                                        <native:column class="w-full gap-1 rounded-xl bg-theme-surface-variant p-3">
                                            <native:text class="text-xs text-theme-secondary" font="body-semibold">{{ $section['label'] }}</native:text>
                                            @foreach ($section['data'] as $key => $value)
                                                <native:row native:key="detail-{{ $section['label'] }}-{{ $key }}" class="w-full items-start justify-between gap-3">
                                                    <native:text class="flex-1 text-xs text-theme-secondary">{{ $formatKey((string) $key) }}</native:text>
                                                    <native:text class="flex-1 text-right text-xs text-theme-on-surface">{{ $formatValue($value) }}</native:text>
                                                </native:row>
                                            @endforeach
                                        </native:column>
                                    @endif
                                @endforeach
                            @endif
                        @endif
                    </native:column>
                @endforeach

                @if ($hasMore)
                    <native:button class="w-full" variant="secondary" @tap="loadMore">Muat 50 catatan lagi</native:button>
                @else
                    <native:text class="px-1 text-center text-xs text-theme-muted">Semua catatan yang cocok sudah ditampilkan.</native:text>
                @endif
            @endif
        </native:column>
    </native:scroll-view>

    @include('native.partials.bottom-nav', ['active' => 'more'])
</native:column>
