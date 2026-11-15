@use('App\Icons\Ios')
@use('App\Icons\Android')

<native:top-bar title="{{ $product?->name ?? 'Produk' }}" subtitle="{{ $product?->sku ?? 'Detail produk' }}" back />

<native:column class="w-full h-full bg-theme-background">
    <native:scroll-view class="w-full flex-1" shows-indicators="false">
        <native:column class="w-full gap-4 p-4 pb-10">
            @include('native.partials.feedback', ['notice' => $notice, 'error' => $error])

            @if ($product === null)
                <native:column class="w-full gap-3 rounded-3xl bg-theme-surface border border-theme-outline p-6">
                    <native:text class="text-base text-theme-on-surface" font="heading">Produk tidak ditemukan</native:text>
                    <native:text class="text-sm text-theme-secondary">Produk mungkin sudah dihapus atau tautan tidak valid.</native:text>
                    <native:button class="mt-2 w-full" variant="primary" @tap="goProducts">Kembali ke daftar produk</native:button>
                </native:column>
            @else
                <native:column class="w-full gap-2 rounded-3xl bg-theme-primary-soft border border-theme-primary/30 p-5">
                    <native:row class="w-full items-start justify-between gap-3">
                        <native:column class="flex-1 gap-1">
                            <native:text class="text-2xl text-theme-on-surface" font="heading-bold">{{ $product->name }}</native:text>
                            <native:text class="text-sm text-theme-secondary">{{ $product->sku }} · {{ $product->store?->name }}</native:text>
                            <native:text class="text-xs text-theme-secondary">{{ $product->store?->marketplace?->name }}</native:text>
                        </native:column>
                        <native:badge :label="$product->active ? 'Aktif' : 'Nonaktif'" :variant="$product->active ? 'success' : 'primary'" />
                    </native:row>
                    <native:row class="mt-2 w-full gap-3">
                        <native:column class="flex-1 gap-1 rounded-2xl bg-theme-surface/70 p-3">
                            <native:text class="text-xs text-theme-secondary">Harga jual</native:text>
                            <native:text class="text-lg text-theme-on-surface" font="heading-bold">{{ $rupiah($product->selling_price) }}</native:text>
                        </native:column>
                        <native:column class="flex-1 gap-1 rounded-2xl bg-theme-surface/70 p-3">
                            <native:text class="text-xs text-theme-secondary">HPP aktif</native:text>
                            <native:text class="text-lg {{ $currentHpp === null ? 'text-theme-destructive' : 'text-theme-on-surface' }}" font="heading-bold">{{ $currentHpp === null ? 'Belum ada' : $rupiah($currentHpp) }}</native:text>
                        </native:column>
                    </native:row>
                    @if ($currentHpp !== null)
                        <native:text class="text-xs text-theme-secondary">Laba kotor per unit {{ $rupiah($product->selling_price - $currentHpp) }} sebelum diskon dan fee.</native:text>
                    @endif
                </native:column>

                <native:column class="w-full gap-3 rounded-3xl bg-theme-surface border border-theme-outline p-4">
                    <native:text class="text-base text-theme-on-surface" font="heading">Penjualan tercatat</native:text>
                    @if ($sales === null || (int) $sales->qty === 0)
                        <native:text class="text-sm text-theme-secondary">Produk ini belum muncul pada pesanan berstatus Terkirim atau Selesai.</native:text>
                    @else
                        <native:row class="w-full gap-3">
                            @include('native.partials.stat-card', ['label' => 'Unit terjual', 'value' => (string) (int) $sales->qty])
                            @include('native.partials.stat-card', ['label' => 'Omzet', 'value' => $rupiah((int) $sales->revenue)])
                        </native:row>
                        <native:row class="w-full gap-3">
                            @include('native.partials.stat-card', ['label' => 'HPP tersnapshot', 'value' => $rupiah((int) $sales->hpp)])
                            @include('native.partials.stat-card', ['label' => 'Laba kotor', 'value' => $rupiah((int) $sales->revenue - (int) $sales->hpp)])
                        </native:row>
                        <native:text class="text-xs text-theme-secondary">Dihitung dari snapshot HPP pada masing-masing pesanan, bukan dari HPP aktif saat ini.</native:text>
                    @endif
                </native:column>

                <native:column class="w-full gap-3 rounded-3xl bg-theme-surface border border-theme-outline p-4">
                    <native:row class="w-full items-center justify-between">
                        <native:column class="flex-1 gap-1">
                            <native:text class="text-base text-theme-on-surface" font="heading">Riwayat HPP</native:text>
                            <native:text class="text-xs text-theme-secondary">Satu harga aktif per tanggal, tanpa tumpang tindih.</native:text>
                        </native:column>
                        <native:pressable class="rounded-full bg-theme-primary-soft px-3 py-2" @tap="toggleHppForm">
                            <native:text class="text-xs text-theme-primary-text" font="body-medium">{{ $showHppForm ? 'Tutup' : 'Ubah HPP' }}</native:text>
                        </native:pressable>
                    </native:row>

                    @if ($showHppForm)
                        <native:column class="w-full gap-3 rounded-2xl bg-theme-surface-variant p-3">
                            <native:outlined-text-input native:model.blur="hppUnit" label="HPP per unit" placeholder="0" keyboard="number" />
                            <native:date-picker native:model="hppEffectiveFrom" label="Berlaku sejak" mode="date" timezone="Asia/Jakarta" locale="id-ID" />
                            <native:outlined-text-input native:model.blur="hppNotes" label="Catatan" placeholder="Contoh: kenaikan harga kain" />
                            <native:button class="w-full" variant="primary" @tap="saveHpp">Simpan HPP</native:button>
                        </native:column>
                    @endif

                    @if ($costs->isEmpty())
                        <native:text class="text-sm text-theme-secondary">Belum ada riwayat HPP. Tambahkan HPP agar pesanan baru punya modal yang benar.</native:text>
                    @else
                        @foreach ($costs as $cost)
                            <native:row native:key="cost-{{ $cost->id }}" class="w-full items-center justify-between gap-2 rounded-2xl bg-theme-surface-variant p-3">
                                <native:column class="flex-1 gap-1">
                                    <native:text class="text-sm text-theme-on-surface" font="body-semibold">{{ $rupiah($cost->hpp_unit) }}/unit</native:text>
                                    <native:text class="text-xs text-theme-secondary">
                                        {{ \App\Support\Options::dateLabel($cost->effective_from?->toDateString()) }} –
                                        {{ $cost->effective_to ? \App\Support\Options::dateLabel($cost->effective_to->toDateString()) : 'sekarang' }}
                                    </native:text>
                                    @if ($cost->notes)
                                        <native:text class="text-xs text-theme-muted">{{ $cost->notes }}</native:text>
                                    @endif
                                </native:column>
                            </native:row>
                        @endforeach
                    @endif
                </native:column>

                @if (! empty($product->notes))
                    <native:column class="w-full gap-1 rounded-2xl bg-theme-surface border border-theme-outline p-4">
                        <native:text class="text-sm text-theme-on-surface" font="body-semibold">Catatan</native:text>
                        <native:text class="text-sm text-theme-secondary">{{ $product->notes }}</native:text>
                    </native:column>
                @endif

                <native:row class="w-full gap-3">
                    <native:button class="flex-1" variant="secondary" @tap="toggleActive">{{ $product->active ? 'Nonaktifkan' : 'Aktifkan' }}</native:button>
                    <native:button class="flex-1" variant="primary" @tap="edit">Ubah produk</native:button>
                </native:row>
            @endif
        </native:column>
    </native:scroll-view>
</native:column>
