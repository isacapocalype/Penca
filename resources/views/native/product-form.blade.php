<native:top-bar title="{{ $editing ? 'Ubah produk' : 'Produk baru' }}" subtitle="SKU, harga jual, dan HPP" back />

<native:column class="w-full h-full bg-theme-background">
    <native:scroll-view class="w-full flex-1" shows-indicators="false">
        <native:column class="w-full gap-4 p-4 pb-10">
            @include('native.partials.feedback', ['notice' => $notice, 'error' => $error])

            <native:column class="w-full gap-3 rounded-3xl bg-theme-surface border border-theme-outline p-4">
                <native:text class="text-base text-theme-on-surface" font="heading">Identitas produk</native:text>

                <native:select native:model="storeLabel" label="Toko" :options="$storeOptions" :disabled="$editing" />
                @if ($editing)
                    <native:text class="text-xs text-theme-secondary">Toko tidak dapat diubah agar SKU dan histori penjualan tetap konsisten.</native:text>
                @endif

                <native:outlined-text-input native:model.blur="sku" label="SKU" placeholder="KA-01" autocapitalize="characters" />
                <native:outlined-text-input native:model.blur="name" label="Nama produk" placeholder="Kaos custom" />
                <native:outlined-text-input native:model.blur="sellingPrice" label="Harga jual" placeholder="0" keyboard="number" />
                <native:outlined-text-input native:model.blur="notes" label="Catatan" placeholder="Opsional" multiline />
            </native:column>

            <native:column class="w-full gap-3 rounded-3xl bg-theme-surface border border-theme-outline p-4">
                <native:row class="w-full items-center justify-between">
                    <native:column class="flex-1 gap-1">
                        <native:text class="text-base text-theme-on-surface" font="heading">Produk aktif</native:text>
                        <native:text class="text-xs text-theme-secondary">Produk nonaktif tidak muncul saat membuat pesanan baru.</native:text>
                    </native:column>
                    <native:toggle native:model="active" label="Aktif" />
                </native:row>
            </native:column>

            @if (! $editing)
                <native:column class="w-full gap-3 rounded-3xl bg-theme-surface border border-theme-outline p-4">
                    <native:text class="text-base text-theme-on-surface" font="heading">HPP awal</native:text>
                    <native:text class="text-xs text-theme-secondary">Opsional. HPP disimpan sebagai riwayat; HPP bisa diubah kapan saja dari detail produk tanpa mengubah pesanan lama.</native:text>
                    <native:outlined-text-input native:model.blur="initialHpp" label="HPP per unit" placeholder="0" keyboard="number" />
                    <native:date-picker native:model="hppEffectiveFrom" label="Berlaku sejak" mode="date" timezone="Asia/Jakarta" locale="id-ID" />
                </native:column>
            @endif

            <native:button class="w-full" variant="primary" @tap="save">{{ $editing ? 'Simpan perubahan' : 'Simpan produk' }}</native:button>
        </native:column>
    </native:scroll-view>
</native:column>
