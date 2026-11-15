@use('App\Icons\Ios')
@use('App\Icons\Android')

<native:top-bar
    :title="$editing ? 'Ubah pesanan' : 'Pesanan baru'"
    :subtitle="$editing ? 'Perubahan tercatat di audit log' : 'Item dan fee dalam satu transaksi'"
    back
/>

<native:column class="w-full h-full bg-theme-background">
    <native:scroll-view class="w-full flex-1" shows-indicators="false">
        <native:column class="w-full gap-4 p-4 pb-10">
            @include('native.partials.feedback', ['notice' => $notice, 'error' => $error])

            @if ($locked)
                <native:column class="w-full gap-1 rounded-2xl bg-theme-warning-soft border border-theme-warning/30 p-4">
                    <native:text class="text-sm text-theme-on-warning" font="body-semibold">Periode terkunci</native:text>
                    <native:text class="text-xs text-theme-on-warning">Pesanan pada periode ini tidak dapat diubah. Buka kunci periode di Pengaturan bila memang diperlukan.</native:text>
                </native:column>
            @endif

            @if (! $hasStore)
                <native:column class="w-full gap-2 rounded-2xl bg-theme-surface border border-theme-outline p-4">
                    <native:text class="text-base text-theme-on-surface" font="heading">Belum ada toko aktif</native:text>
                    <native:text class="text-sm text-theme-secondary">Tambahkan toko terlebih dahulu agar pesanan punya pemilik dan tarif pajak yang jelas.</native:text>
                    <native:button class="mt-2 w-full" variant="primary" @navigate="'/stores/create'">Tambah toko</native:button>
                </native:column>
            @else
                <native:column class="w-full gap-3 rounded-2xl bg-theme-surface border border-theme-outline p-4">
                    <native:text class="text-base text-theme-on-surface" font="heading">Identitas pesanan</native:text>

                    <native:select
                        native:model="storeLabel"
                        label="Toko"
                        :options="$storeOptions"
                        :disabled="$editing"
                    />

                    <native:outlined-text-input
                        native:model.blur="marketplaceOrderId"
                        label="Order ID marketplace"
                        placeholder="Contoh: 240812ABCDEFGH"
                        autocapitalize="characters"
                    />

                    <native:row class="w-full gap-3">
                        <native:column class="flex-1">
                            <native:date-picker native:model="orderedAt" label="Tanggal pesanan" mode="date" timezone="Asia/Jakarta" locale="id-ID" />
                        </native:column>
                        <native:column class="flex-1">
                            <native:date-picker native:model="completedAt" label="Tanggal selesai" mode="date" timezone="Asia/Jakarta" locale="id-ID" />
                        </native:column>
                    </native:row>

                    <native:select native:model="statusLabel" label="Status" :options="$statusOptions" />
                    <native:text class="text-xs text-theme-secondary">Hanya status Terkirim dan Selesai yang dihitung sebagai omzet. Refund dicatat terpisah di detail pesanan.</native:text>
                </native:column>

                <native:column class="w-full gap-3 rounded-2xl bg-theme-surface border border-theme-outline p-4">
                    <native:row class="w-full items-center justify-between">
                        <native:text class="text-base text-theme-on-surface" font="heading">Diskon</native:text>
                        <native:text class="text-xs text-theme-secondary">Rupiah penuh</native:text>
                    </native:row>

                    <native:outlined-text-input
                        native:model.blur="sellerDiscount"
                        label="Diskon dari penjual"
                        placeholder="0"
                        keyboard="number"
                    />
                    <native:outlined-text-input
                        native:model.blur="marketplaceDiscount"
                        label="Diskon dari marketplace"
                        placeholder="0"
                        keyboard="number"
                    />
                    <native:text class="text-xs text-theme-secondary">Diskon marketplace tidak mengurangi omzet penjual. Diskon penjual mengurangi omzet dan laba.</native:text>
                </native:column>

                <native:column class="w-full gap-3 rounded-2xl bg-theme-surface border border-theme-outline p-4">
                    <native:row class="w-full items-center justify-between">
                        <native:text class="text-base text-theme-on-surface" font="heading">Item pesanan</native:text>
                        <native:text class="text-xs text-theme-secondary">{{ count($items) }} item</native:text>
                    </native:row>

                    @if ($items !== [])
                        @foreach ($items as $index => $item)
                            <native:column native:key="item-{{ $index }}" class="w-full gap-1 rounded-2xl bg-theme-surface-variant p-3">
                                <native:row class="w-full items-start justify-between gap-2">
                                    <native:column class="flex-1 gap-1">
                                        <native:text class="text-sm text-theme-on-surface" font="body-semibold">{{ $item['sku'] }} · {{ $item['product_name'] }}</native:text>
                                        <native:text class="text-xs text-theme-secondary">{{ $item['qty'] }} × {{ $rupiah($item['unit_price']) }} · HPP {{ $rupiah($item['hpp_unit_snapshot']) }}/unit</native:text>
                                    </native:column>
                                    <native:column class="items-end gap-1">
                                        <native:text class="text-sm text-theme-on-surface" font="body-semibold">{{ $rupiah($item['qty'] * $item['unit_price']) }}</native:text>
                                        <native:pressable class="rounded-full bg-theme-danger-soft px-3 py-1" @tap="removeItem({{ $index }})">
                                            <native:text class="text-xs text-theme-destructive" font="body-medium">Hapus</native:text>
                                        </native:pressable>
                                    </native:column>
                                </native:row>
                            </native:column>
                        @endforeach
                    @else
                        <native:text class="text-sm text-theme-secondary">Belum ada item. Tambahkan minimal satu item sebelum menyimpan.</native:text>
                    @endif

                    <native:column class="w-full gap-3 border-t border-theme-outline pt-3">
                        <native:text class="text-sm text-theme-on-surface" font="body-semibold">Tambah item</native:text>

                        @if ($hasProducts)
                            <native:select
                                native:model="itemProductLabel"
                                label="Produk dari master"
                                :options="$productOptions"
                                placeholder="Pilih produk (opsional)"
                            />
                        @else
                            <native:text class="text-xs text-theme-secondary">Toko ini belum punya produk aktif. Isi SKU dan nama secara manual, atau tambahkan produk di menu Produk & HPP.</native:text>
                        @endif

                        @if (! empty($itemError))
                            <native:column class="w-full rounded-xl bg-theme-danger-soft p-3">
                                <native:text class="text-xs text-theme-destructive">{{ $itemError }}</native:text>
                            </native:column>
                        @endif

                        <native:row class="w-full gap-3">
                            <native:column class="flex-1">
                                <native:outlined-text-input native:model.blur="itemSku" label="SKU" placeholder="KA-01" />
                            </native:column>
                            <native:column class="flex-1">
                                <native:outlined-text-input native:model.blur="itemName" label="Nama produk" placeholder="Kaos custom" />
                            </native:column>
                        </native:row>

                        <native:row class="w-full gap-3">
                            <native:column class="flex-1">
                                <native:outlined-text-input native:model.blur="itemQty" label="Jumlah" placeholder="1" keyboard="number" />
                            </native:column>
                            <native:column class="flex-1">
                                <native:outlined-text-input native:model.blur="itemPrice" label="Harga satuan" placeholder="0" keyboard="number" />
                            </native:column>
                        </native:row>

                        <native:outlined-text-input native:model.blur="itemHpp" label="HPP satuan (snapshot)" placeholder="0" keyboard="number" />
                        <native:text class="text-xs text-theme-secondary">HPP disimpan sebagai snapshot. Perubahan HPP produk setelah pesanan dibuat tidak mengubah pesanan ini.</native:text>

                        <native:button class="w-full" variant="secondary" @tap="addItem">Tambah item</native:button>
                    </native:column>
                </native:column>

                @if (! $editing)
                    <native:column class="w-full gap-3 rounded-2xl bg-theme-surface border border-theme-outline p-4">
                        <native:row class="w-full items-center justify-between">
                            <native:column class="gap-1">
                                <native:text class="text-base text-theme-on-surface" font="heading">Fee marketplace</native:text>
                                <native:text class="text-xs text-theme-secondary">Hanya fee ditanggung penjual yang mengurangi laba.</native:text>
                            </native:column>
                            <native:pressable class="rounded-full bg-theme-primary-soft px-3 py-2" @tap="$toggle('showFeeForm')">
                                <native:text class="text-xs text-theme-primary-text" font="body-medium">{{ $showFeeForm ? 'Tutup' : 'Tambah fee' }}</native:text>
                            </native:pressable>
                        </native:row>

                        @foreach ($fees as $index => $fee)
                            <native:row native:key="fee-{{ $index }}" class="w-full items-center justify-between gap-2 rounded-2xl bg-theme-surface-variant p-3">
                                <native:column class="flex-1 gap-1">
                                    <native:text class="text-sm text-theme-on-surface" font="body-medium">{{ $fee['description'] }}</native:text>
                                    <native:text class="text-xs text-theme-secondary">{{ \App\Support\Options::FEE_BORNE[$fee['borne_by']] ?? $fee['borne_by'] }} · {{ $rupiah($fee['amount']) }}</native:text>
                                </native:column>
                                <native:pressable class="rounded-full bg-theme-danger-soft px-3 py-1" @tap="removeFee({{ $index }})">
                                    <native:text class="text-xs text-theme-destructive" font="body-medium">Hapus</native:text>
                                </native:pressable>
                            </native:row>
                        @endforeach

                        @if ($showFeeForm)
                            <native:column class="w-full gap-3 rounded-2xl bg-theme-surface-variant p-3">
                                <native:outlined-text-input native:model.blur="feeDescription" label="Keterangan fee" placeholder="Biaya administrasi" />
                                <native:outlined-text-input native:model.blur="feeAmount" label="Nominal fee" placeholder="0" keyboard="number" />
                                <native:select native:model="feeBorneLabel" label="Ditanggung oleh" :options="$feeBorneOptions" />
                                <native:button class="w-full" variant="primary" @tap="addFee">Simpan fee</native:button>
                            </native:column>
                        @endif

                        <native:text class="text-xs text-theme-secondary">Fee tambahan dapat diubah setelah pesanan tersimpan melalui detail pesanan.</native:text>
                    </native:column>
                @endif

                <native:column class="w-full gap-3 rounded-2xl bg-theme-surface border border-theme-outline p-4">
                    <native:text class="text-base text-theme-on-surface" font="heading">Ringkasan draft</native:text>
                    <native:row class="w-full items-center justify-between">
                        <native:text class="text-sm text-theme-secondary">Omzet bruto item</native:text>
                        <native:text class="text-sm text-theme-on-surface" font="body-semibold">{{ $rupiah($draftGross) }}</native:text>
                    </native:row>
                    <native:row class="w-full items-center justify-between">
                        <native:text class="text-sm text-theme-secondary">Total HPP</native:text>
                        <native:text class="text-sm text-theme-on-surface" font="body-semibold">{{ $rupiah($draftHpp) }}</native:text>
                    </native:row>
                    <native:text class="text-xs text-theme-secondary">Angka final dihitung ulang oleh server setelah disimpan, termasuk diskon dan refund.</native:text>
                </native:column>

                <native:outlined-text-input native:model.blur="notes" label="Catatan" placeholder="Opsional" multiline />

                <native:button class="w-full" variant="primary" @tap="save">{{ $editing ? 'Simpan perubahan' : 'Simpan pesanan' }}</native:button>
            @endif
        </native:column>
    </native:scroll-view>
</native:column>
