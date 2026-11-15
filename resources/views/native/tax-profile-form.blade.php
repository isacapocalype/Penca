<native:top-bar title="Profil pajak" subtitle="{{ $store?->name ?? 'Toko' }}" back />

<native:column class="w-full h-full bg-theme-background">
    <native:scroll-view class="w-full flex-1" shows-indicators="false">
        <native:column class="w-full gap-4 p-4 pb-10">
            @include('native.partials.feedback', ['notice' => $notice, 'error' => $error])

            @if ($store === null)
                <native:column class="w-full gap-3 rounded-3xl bg-theme-surface border border-theme-outline p-6">
                    <native:text class="text-base text-theme-on-surface" font="heading">Toko tidak ditemukan</native:text>
                    <native:text class="text-sm text-theme-secondary">Buka profil pajak dari daftar toko atau menu Pajak.</native:text>
                    <native:button class="mt-2 w-full" variant="primary" @tap="goTaxes">Kembali ke Pajak</native:button>
                </native:column>
            @else
                <native:row class="w-full items-center justify-between rounded-2xl bg-theme-surface border border-theme-outline p-4">
                    <native:column class="flex-1 gap-1">
                        <native:text class="text-base text-theme-on-surface" font="body-semibold">Status PKP</native:text>
                        <native:text class="text-xs text-theme-secondary">Aktifkan bila toko sudah dikukuhkan sebagai Pengusaha Kena Pajak.</native:text>
                    </native:column>
                    <native:toggle native:model="pkp" label="PKP" />
                </native:row>

                <native:column class="w-full gap-3 rounded-3xl bg-theme-surface border border-theme-outline p-4">
                    <native:text class="text-base text-theme-on-surface" font="heading">PPN</native:text>
                    <native:select native:model="ppnModeLabel" label="Perlakuan PPN" :options="$ppnModeOptions" />
                    <native:text class="text-xs text-theme-secondary">Termasuk harga berarti PPN dihitung dari total yang dibayar pembeli. Ditambah di atas harga berarti PPN menjadi tambahan dari pembeli. Tidak memungut PPN untuk toko non-PKP.</native:text>
                    <native:outlined-text-input native:model.blur="ppnRate" label="Tarif PPN (%)" placeholder="11" keyboard="decimal" />
                    @if (! $pkp)
                        <native:text class="text-xs text-theme-warning">Toko non-PKP sebaiknya memakai mode Tidak memungut PPN. PPN keluaran tetap bisa dihitung bila mode lain dipilih.</native:text>
                    @endif
                </native:column>

                <native:column class="w-full gap-3 rounded-3xl bg-theme-surface border border-theme-outline p-4">
                    <native:text class="text-base text-theme-on-surface" font="heading">PPh Final</native:text>
                    <native:outlined-text-input native:model.blur="pphRate" label="Tarif PPh Final (%)" placeholder="0,5" keyboard="decimal" />
                    <native:select native:model="pphBasisLabel" label="Dasar pengenaan" :options="$pphBasisOptions" />
                    <native:text class="text-xs text-theme-secondary">PPh Final mengurangi laba setelah pajak. Dasar omzet bruto memakai nilai sebelum diskon penjual dan refund.</native:text>
                </native:column>

                <native:column class="w-full gap-3 rounded-3xl bg-theme-surface border border-theme-outline p-4">
                    <native:text class="text-base text-theme-on-surface" font="heading">Masa berlaku</native:text>
                    <native:date-picker native:model="effectiveFrom" label="Berlaku sejak" mode="date" timezone="Asia/Jakarta" locale="id-ID" />
                    <native:text class="text-xs text-theme-secondary">Menyimpan tanggal yang sama akan memperbarui profil pada tanggal itu. Profil lama otomatis berakhir sehari sebelum tanggal baru.</native:text>
                </native:column>

                <native:button class="w-full" variant="primary" @tap="save">Simpan profil pajak</native:button>

                <native:column class="w-full gap-3 rounded-3xl bg-theme-surface border border-theme-outline p-4">
                    <native:text class="text-base text-theme-on-surface" font="heading">Riwayat profil</native:text>

                    @if ($profiles->isEmpty())
                        <native:text class="text-sm text-theme-secondary">Belum ada profil tersimpan.</native:text>
                    @else
                        @foreach ($profiles as $profile)
                            <native:column native:key="profile-{{ $profile->id }}" class="w-full gap-1 rounded-2xl bg-theme-surface-variant p-3">
                                <native:row class="w-full items-center justify-between">
                                    <native:text class="text-sm text-theme-on-surface" font="body-semibold">{{ $profile->pkp ? 'PKP' : 'Non-PKP' }} · {{ \App\Support\Options::PPN_MODES[$profile->ppn_mode] ?? $profile->ppn_mode }}</native:text>
                                    <native:text class="text-xs text-theme-secondary">PPN {{ \App\Support\Options::basisPointsToPercent((int) $profile->ppn_rate_bp) }}%</native:text>
                                </native:row>
                                <native:text class="text-xs text-theme-secondary">PPh Final {{ \App\Support\Options::basisPointsToPercent((int) $profile->pph_rate_bp) }}% · dasar {{ \App\Support\Options::PPH_BASIS[$profile->pph_basis] ?? $profile->pph_basis }}</native:text>
                                <native:text class="text-xs text-theme-muted">
                                    {{ \App\Support\Options::dateLabel($profile->effective_from?->toDateString()) }} –
                                    {{ $profile->effective_to ? \App\Support\Options::dateLabel($profile->effective_to->toDateString()) : 'sekarang' }}
                                </native:text>
                            </native:column>
                        @endforeach
                    @endif
                </native:column>

                <native:text class="px-1 text-xs text-theme-muted">Perubahan profil tidak mengubah entri pajak yang sudah tercatat. Hitung ulang rekap pajak setelah mengubah tarif yang berlaku untuk periode berjalan.</native:text>
            @endif
        </native:column>
    </native:scroll-view>
</native:column>
