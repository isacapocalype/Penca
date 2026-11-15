@use('App\Icons\Ios')
@use('App\Icons\Android')

<native:top-bar title="{{ $editing ? 'Ubah toko' : 'Toko baru' }}" subtitle="Identitas toko dan marketplace" back />

<native:column class="w-full h-full bg-theme-background">
    <native:scroll-view class="w-full flex-1" shows-indicators="false">
        <native:column class="w-full gap-4 p-4 pb-10">
            @include('native.partials.feedback', ['notice' => $notice, 'error' => $error])

            <native:column class="w-full gap-3 rounded-3xl bg-theme-surface border border-theme-outline p-4">
                <native:text class="text-base text-theme-on-surface" font="heading">Identitas</native:text>

                <native:select
                    native:model="marketplaceLabel"
                    label="Marketplace"
                    :options="$marketplaceOptions"
                    :disabled="$editing"
                />
                @if ($editing)
                    <native:text class="text-xs text-theme-secondary">Marketplace tidak dapat diubah agar histori pesanan tetap pada platform yang benar.</native:text>
                @endif

                <native:outlined-text-input native:model.blur="name" label="Nama toko" placeholder="Konveksi Amanah" />
                <native:outlined-text-input native:model.blur="code" label="Kode toko" placeholder="AMANAH" autocapitalize="characters" />
                <native:text class="text-xs text-theme-secondary">Kode harus unik per marketplace. Kode dipakai untuk membedakan toko pada laporan dan import.</native:text>
                <native:outlined-text-input native:model.blur="username" label="Username marketplace" placeholder="amanah.official" />
                <native:outlined-text-input native:model.blur="url" label="URL toko" placeholder="https://shopee.co.id/amanah" keyboard="url" />
            </native:column>

            <native:column class="w-full gap-3 rounded-3xl bg-theme-surface border border-theme-outline p-4">
                <native:text class="text-base text-theme-on-surface" font="heading">Status</native:text>
                <native:select native:model="statusLabel" label="Status toko" :options="$statusOptions" />
                <native:text class="text-xs text-theme-secondary">Toko nonaktif tetap tersimpan untuk histori. Toko arsip tidak muncul di pilihan pesanan baru.</native:text>
            </native:column>

            <native:column class="w-full gap-3 rounded-3xl bg-theme-surface border border-theme-outline p-4">
                <native:text class="text-base text-theme-on-surface" font="heading">Catatan</native:text>
                <native:outlined-text-input native:model.blur="notes" label="Catatan internal" placeholder="Opsional" multiline />
            </native:column>

            <native:button class="w-full" variant="primary" @tap="save">{{ $editing ? 'Simpan perubahan' : 'Simpan toko' }}</native:button>

            @if (! $editing)
                <native:text class="px-1 text-xs text-theme-muted">Profil pajak awal dibuat otomatis dengan PPN nonaktif dan PPh Final default. Ubah di menu Pajak bila toko sudah PKP.</native:text>
            @endif
        </native:column>
    </native:scroll-view>
</native:column>
