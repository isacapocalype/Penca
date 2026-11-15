@use('App\Icons\Ios')
@use('App\Icons\Android')

<native:top-bar title="Pajak" subtitle="{{ $recap->periodLabel }}" display-mode="large" />

<native:column class="w-full h-full bg-theme-background">
    <native:scroll-view class="w-full flex-1" shows-indicators="false">
        <native:column class="w-full gap-4 p-4 pb-8">
            @include('native.partials.feedback', ['notice' => $notice, 'error' => $error])

            <native:column class="w-full gap-2">
                <native:select native:model="periodLabel" label="Periode pajak" :options="$monthOptions" />
                <native:select native:model="storeFilterLabel" label="Toko" :options="$storeFilterOptions" />
            </native:column>

            <native:row class="w-full gap-3">
                @include('native.partials.stat-card', ['label' => 'PPN keluaran', 'value' => $rupiah($recap->ppnOutput), 'hint' => 'Dari penjualan PKP'])
                @include('native.partials.stat-card', ['label' => 'PPN masukan', 'value' => $rupiah($recap->ppnInput), 'hint' => 'Entri manual'])
            </native:row>

            <native:row class="w-full gap-3">
                @include('native.partials.stat-card', ['label' => 'PPN kurang bayar', 'value' => $rupiah($recap->ppnPayable), 'hint' => 'Bukan pengurang laba'])
                @include('native.partials.stat-card', ['label' => 'PPh Final', 'value' => $rupiah($recap->pphFinal), 'hint' => 'Mengurangi laba'])
            </native:row>

            <native:column class="w-full gap-2 rounded-2xl bg-theme-info-soft border border-theme-info/20 p-4">
                <native:text class="text-sm text-theme-on-surface" font="body-semibold">Pemisahan yang benar</native:text>
                <native:text class="text-xs text-theme-secondary">PPN adalah kewajiban/kredit terpisah dan tidak mengurangi laba. PPh Final mengurangi laba setelah pajak. Keduanya dihitung dari pesanan berstatus Terkirim atau Selesai.</native:text>
            </native:column>

            <native:column class="w-full gap-3 rounded-3xl bg-theme-surface border border-theme-outline p-4">
                <native:row class="w-full items-center justify-between">
                    <native:column class="flex-1 gap-1">
                        <native:text class="text-base text-theme-on-surface" font="heading">Rekap per toko</native:text>
                        <native:text class="text-xs text-theme-secondary">Omzet bruto {{ $rupiah($recap->grossRevenue) }} · neto {{ $rupiah($recap->netRevenue) }}</native:text>
                    </native:column>
                    <native:pressable class="rounded-full bg-theme-primary px-3 py-2" @tap="generate">
                        <native:text class="text-xs text-theme-on-primary" font="body-semibold">Hitung ulang</native:text>
                    </native:pressable>
                </native:row>

                @if ($recap->stores === [])
                    <native:text class="text-sm text-theme-secondary">Belum ada transaksi atau entri pajak pada periode ini.</native:text>
                @else
                    @foreach ($recap->stores as $store)
                        @php($openProfileAction = "openProfile('".$store['store_id']."')")
                        <native:column native:key="recap-{{ $store['store_id'] }}" class="w-full gap-1 rounded-2xl bg-theme-surface-variant p-3">
                            <native:row class="w-full items-center justify-between">
                                <native:text class="text-sm text-theme-on-surface" font="body-semibold">{{ $store['store_name'] }}</native:text>
                                <native:text class="text-xs text-theme-secondary">{{ $store['orders'] }} pesanan</native:text>
                            </native:row>
                            <native:text class="text-xs text-theme-secondary">PPN keluaran {{ $rupiah($store['ppn_output']) }} · PPN masukan {{ $rupiah($store['ppn_input']) }} · kurang bayar {{ $rupiah($store['ppn_payable']) }}</native:text>
                            <native:text class="text-xs text-theme-secondary">PPh Final {{ $rupiah($store['pph_final']) }} · {{ $store['pkp'] ? 'PKP' : 'Non-PKP' }} · PPN {{ \App\Support\Options::PPN_MODES[$store['ppn_mode']] ?? $store['ppn_mode'] }}</native:text>
                            <native:pressable class="mt-1 self-start rounded-full bg-theme-primary-soft px-3 py-1" @tap="{!! $openProfileAction !!}">
                                <native:text class="text-xs text-theme-primary-text" font="body-medium">Atur profil pajak</native:text>
                            </native:pressable>
                        </native:column>
                    @endforeach
                @endif
            </native:column>

            <native:column class="w-full gap-3 rounded-3xl bg-theme-surface border border-theme-outline p-4">
                <native:row class="w-full items-center justify-between">
                    <native:column class="flex-1 gap-1">
                        <native:text class="text-base text-theme-on-surface" font="heading">Entri pajak tercatat</native:text>
                        <native:text class="text-xs text-theme-secondary">Hitung ulang membuat/memperbarui entri otomatis. Entri manual tidak dihapus.</native:text>
                    </native:column>
                    <native:pressable class="rounded-full bg-theme-primary-soft px-3 py-2" @tap="toggleEntryForm">
                        <native:text class="text-xs text-theme-primary-text" font="body-medium">{{ $showEntryForm ? 'Tutup' : 'Entri manual' }}</native:text>
                    </native:pressable>
                </native:row>

                @if ($showEntryForm)
                    <native:column class="w-full gap-3 rounded-2xl bg-theme-surface-variant p-3">
                        <native:select native:model="entryStoreLabel" label="Toko" :options="$storeValues" />
                        <native:select native:model="entryTypeLabel" label="Jenis pajak" :options="$typeOptions" />
                        <native:outlined-text-input native:model.blur="entryBase" label="Dasar pengenaan" placeholder="0" keyboard="number" />
                        <native:outlined-text-input native:model.blur="entryRate" label="Tarif (%)" placeholder="11" keyboard="decimal" />
                        <native:outlined-text-input native:model.blur="entryAmount" label="Nominal pajak" placeholder="Kosongkan untuk hitung otomatis" keyboard="number" />
                        <native:select native:model="entryStatusLabel" label="Status" :options="$statusOptions" />
                        <native:outlined-text-input native:model.blur="entryReference" label="Referensi" placeholder="Nomor faktur / bukti potong" />
                        <native:outlined-text-input native:model.blur="entryNotes" label="Catatan" placeholder="Opsional" />
                        <native:button class="w-full" variant="primary" @tap="addEntry">Simpan entri</native:button>
                    </native:column>
                @endif

                @if ($recap->entries === [])
                    <native:text class="text-sm text-theme-secondary">Belum ada entri pajak. Tekan Hitung ulang untuk membuat PPN keluaran dan PPh Final dari transaksi, atau tambahkan PPN masukan secara manual.</native:text>
                @else
                    @foreach ($recap->entries as $entry)
                        <native:column native:key="entry-{{ $entry['id'] }}" class="w-full gap-2 rounded-2xl bg-theme-surface-variant p-3">
                            @php($markReportedAction = "markStatus('".$entry['id']."', 'reported')")
                            @php($markPaidAction = "markStatus('".$entry['id']."', 'paid')")
                            @php($deleteEntryAction = "deleteEntry('".$entry['id']."')")
                            @php($askDeleteEntryAction = "askDelete('".$entry['id']."')")
                            <native:row class="w-full items-start justify-between gap-2">
                                <native:column class="flex-1 gap-1">
                                    <native:text class="text-sm text-theme-on-surface" font="body-semibold">{{ $entry['type_label'] }} · {{ $entry['store_name'] }}</native:text>
                                    <native:text class="text-xs text-theme-secondary">Dasar {{ $rupiah($entry['base_amount']) }} · {{ $percent($entry['rate_bp']) }} · {{ $entry['reference'] === 'auto' ? 'otomatis' : 'manual' }}</native:text>
                                    @if ($entry['notes'])
                                        <native:text class="text-xs text-theme-muted">{{ $entry['notes'] }}</native:text>
                                    @endif
                                </native:column>
                                <native:column class="items-end gap-1">
                                    <native:text class="text-sm text-theme-on-surface" font="body-semibold">{{ $rupiah($entry['amount']) }}</native:text>
                                    <native:badge
                                        :label="\App\Support\Options::TAX_STATUSES[$entry['status']] ?? $entry['status']"
                                        :variant="$entry['status'] === 'paid' ? 'success' : ($entry['status'] === 'reported' ? 'accent' : 'primary')"
                                    />
                                </native:column>
                            </native:row>

                            @if ($entry['status'] !== 'reported' && $entry['status'] !== 'paid')
                                <native:row class="w-full gap-2">
                                    <native:pressable class="flex-1 rounded-full bg-theme-primary-soft px-3 py-2" @tap="{!! $markReportedAction !!}">
                                        <native:text class="text-center text-xs text-theme-primary-text" font="body-medium">Tandai dilaporkan</native:text>
                                    </native:pressable>
                                    <native:pressable class="flex-1 rounded-full bg-theme-success-soft px-3 py-2" @tap="{!! $markPaidAction !!}">
                                        <native:text class="text-center text-xs text-theme-success" font="body-medium">Tandai dibayar</native:text>
                                    </native:pressable>
                                </native:row>
                            @elseif ($entry['status'] === 'reported')
                                <native:pressable class="self-start rounded-full bg-theme-success-soft px-3 py-2" @tap="{!! $markPaidAction !!}">
                                    <native:text class="text-xs text-theme-success" font="body-medium">Tandai dibayar</native:text>
                                </native:pressable>
                            @endif

                            @if ($confirmDeleteId === $entry['id'])
                                <native:column class="w-full gap-2 rounded-xl bg-theme-danger-soft p-3">
                                    <native:text class="text-xs text-theme-destructive">Hapus entri pajak ini? Tindakan tercatat di audit log.</native:text>
                                    <native:row class="w-full gap-2">
                                        <native:button class="flex-1" variant="secondary" @tap="cancelDelete">Batal</native:button>
                                        <native:button class="flex-1" variant="destructive" @tap="{!! $deleteEntryAction !!}">Hapus</native:button>
                                    </native:row>
                                </native:column>
                            @else
                                <native:pressable class="self-start rounded-full bg-theme-surface px-3 py-1" @tap="{!! $askDeleteEntryAction !!}">
                                    <native:text class="text-xs text-theme-destructive" font="body-medium">Hapus entri</native:text>
                                </native:pressable>
                            @endif
                        </native:column>
                    @endforeach
                @endif
            </native:column>

            <native:column class="w-full gap-3 rounded-3xl bg-theme-surface border border-theme-outline p-4">
                <native:text class="text-base text-theme-on-surface" font="heading">Profil pajak toko</native:text>
                <native:text class="text-xs text-theme-secondary">Tarif baru berlaku sejak tanggal efektif. Tarif lama ditutup otomatis agar tidak tumpang tindih.</native:text>

                @if ($stores->isEmpty())
                    <native:text class="text-sm text-theme-secondary">Belum ada toko aktif.</native:text>
                @else
                    @foreach ($stores as $store)
                        @php($latest = $store->taxProfiles->first())
                        @php($openStoreProfileAction = "openProfile('".$store->id."')")
                        <native:row native:key="profile-{{ $store->id }}" class="w-full items-center justify-between gap-2 rounded-2xl bg-theme-surface-variant p-3">
                            <native:column class="flex-1 gap-1">
                                <native:text class="text-sm text-theme-on-surface" font="body-medium">{{ $store->name }}</native:text>
                                @if ($latest)
                                    <native:text class="text-xs text-theme-secondary">{{ $latest->pkp ? 'PKP' : 'Non-PKP' }} · PPN {{ \App\Support\Options::PPN_MODES[$latest->ppn_mode] ?? $latest->ppn_mode }} {{ \App\Support\Options::basisPointsToPercent((int) $latest->ppn_rate_bp) }}% · PPh {{ \App\Support\Options::basisPointsToPercent((int) $latest->pph_rate_bp) }}%</native:text>
                                @else
                                    <native:text class="text-xs text-theme-secondary">Belum ada profil</native:text>
                                @endif
                            </native:column>
                            <native:pressable class="rounded-full bg-theme-primary-soft px-3 py-2" @tap="{!! $openStoreProfileAction !!}">
                                <native:text class="text-xs text-theme-primary-text" font="body-medium">Atur</native:text>
                            </native:pressable>
                        </native:row>
                    @endforeach
                @endif
            </native:column>
        </native:column>
    </native:scroll-view>

    @include('native.partials.bottom-nav', ['active' => 'more'])
</native:column>
