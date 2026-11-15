<native:top-bar title="{{ $editing ? 'Ubah biaya iklan' : 'Biaya iklan baru' }}" subtitle="Belanja iklan yang benar-benar keluar" back />

<native:column class="w-full h-full bg-theme-background">
    <native:scroll-view class="w-full flex-1" shows-indicators="false">
        <native:column class="w-full gap-4 p-4 pb-10">
            @include('native.partials.feedback', ['notice' => $notice, 'error' => $error])

            <native:column class="w-full gap-3 rounded-3xl bg-theme-surface border border-theme-outline p-4">
                <native:text class="text-base text-theme-on-surface" font="heading">Catatan belanja</native:text>

                <native:select native:model="storeLabel" label="Toko" :options="$storeOptions" />
                @if ($campaignOptions === [])
                    <native:text class="text-xs text-theme-secondary">Toko ini belum punya kampanye. Biaya tetap bisa disimpan tanpa kampanye.</native:text>
                @else
                    <native:select native:model="campaignLabel" label="Kampanye" :options="$campaignOptions" placeholder="Tanpa kampanye (opsional)" />
                @endif

                <native:date-picker native:model="spentAt" label="Tanggal belanja" mode="date" timezone="Asia/Jakarta" locale="id-ID" />
                <native:outlined-text-input native:model.blur="amount" label="Nominal belanja" placeholder="0" keyboard="number" />
            </native:column>

            <native:column class="w-full gap-3 rounded-3xl bg-theme-surface border border-theme-outline p-4">
                <native:row class="w-full items-center justify-between">
                    <native:text class="text-base text-theme-on-surface" font="heading">Metrik opsional</native:text>
                    <native:text class="text-xs text-theme-secondary">Untuk ROAS</native:text>
                </native:row>
                <native:outlined-text-input native:model.blur="clicks" label="Klik" placeholder="0" keyboard="number" />
                <native:outlined-text-input native:model.blur="impressions" label="Impresi" placeholder="0" keyboard="number" />
                <native:outlined-text-input native:model.blur="attributedOrders" label="Pesanan atribusi" placeholder="0" keyboard="number" />
                <native:outlined-text-input native:model.blur="attributedRevenue" label="Omzet atribusi" placeholder="0" keyboard="number" />
                <native:text class="text-xs text-theme-secondary">ROAS = omzet atribusi ÷ biaya iklan. Isi omzet atribusi hanya bila memang dilaporkan marketplace; jangan menebak.</native:text>
            </native:column>

            <native:column class="w-full gap-3 rounded-3xl bg-theme-surface border border-theme-outline p-4">
                <native:text class="text-base text-theme-on-surface" font="heading">Catatan</native:text>
                <native:outlined-text-input native:model.blur="notes" label="Catatan internal" placeholder="Opsional" multiline />
            </native:column>

            <native:button class="w-full" variant="primary" @tap="save">{{ $editing ? 'Simpan perubahan' : 'Simpan biaya iklan' }}</native:button>
        </native:column>
    </native:scroll-view>
</native:column>
