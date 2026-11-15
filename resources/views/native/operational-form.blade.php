<native:top-bar title="{{ $editing ? 'Ubah biaya operasional' : 'Biaya operasional baru' }}" subtitle="Biaya nyata di luar iklan dan fee" back />

<native:column class="w-full h-full bg-theme-background">
    <native:scroll-view class="w-full flex-1" shows-indicators="false">
        <native:column class="w-full gap-4 p-4 pb-10">
            @include('native.partials.feedback', ['notice' => $notice, 'error' => $error])

            <native:column class="w-full gap-3 rounded-3xl bg-theme-surface border border-theme-outline p-4">
                <native:text class="text-base text-theme-on-surface" font="heading">Rincian biaya</native:text>

                <native:select native:model="storeLabel" label="Dibebankan ke" :options="$storeOptions" />
                <native:text class="text-xs text-theme-secondary">Pilih "Tanpa toko (umum)" untuk biaya bersama seperti gaji admin atau sewa gudang.</native:text>

                <native:select native:model="categoryLabel" label="Kategori" :options="$categoryOptions" />
                <native:date-picker native:model="spentAt" label="Tanggal" mode="date" timezone="Asia/Jakarta" locale="id-ID" />
                <native:outlined-text-input native:model.blur="amount" label="Nominal" placeholder="0" keyboard="number" />
                <native:outlined-text-input native:model.blur="notes" label="Catatan" placeholder="Opsional" multiline />
            </native:column>

            <native:text class="px-1 text-xs text-theme-muted">Biaya operasional mengurangi laba operasional. Biaya umum tanpa toko tidak muncul saat filter laporan memilih satu toko; biaya itu masuk rekap semua toko.</native:text>

            <native:button class="w-full" variant="primary" @tap="save">{{ $editing ? 'Simpan perubahan' : 'Simpan biaya' }}</native:button>
        </native:column>
    </native:scroll-view>
</native:column>
