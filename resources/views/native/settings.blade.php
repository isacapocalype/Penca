@use('App\Icons\Ios')
@use('App\Icons\Android')

<native:top-bar title="Pengaturan" subtitle="Operator, pajak, backup, dan periode" display-mode="large" back />

<native:column class="w-full h-full bg-theme-background">
    <native:scroll-view class="w-full flex-1" shows-indicators="false">
        <native:column class="w-full gap-4 p-4 pb-10">
            @include('native.partials.feedback', ['notice' => $notice, 'error' => $error])

            <native:column class="w-full gap-3 rounded-3xl bg-theme-surface border border-theme-outline p-4">
                <native:row class="items-center gap-2">
                    <native:icon :ios="Ios::PersonCropCircle" :android="Android::Person" :size="20" class="text-theme-primary" />
                    <native:text class="flex-1 text-base text-theme-on-surface" font="heading">Profil & tarif default</native:text>
                </native:row>
                <native:outlined-text-input native:model.blur="operatorName" label="Nama operator" placeholder="Nama Anda atau admin" />
                <native:row class="w-full gap-3">
                    <native:outlined-text-input native:model.blur="ppnDefault" label="PPN default (%)" placeholder="11" keyboard="number" class="flex-1" />
                    <native:outlined-text-input native:model.blur="pphDefault" label="PPh Final (%)" placeholder="0,5" keyboard="number" class="flex-1" />
                </native:row>
                <native:text class="text-xs text-theme-secondary">Tarif default dipakai saat membuat profil pajak toko baru. Profil tiap toko tetap dapat berbeda dan menang atas nilai default.</native:text>
                <native:button class="w-full" variant="primary" @tap="saveProfile">Simpan profil</native:button>
            </native:column>

            <native:column class="w-full gap-3 rounded-3xl bg-theme-surface border border-theme-outline p-4">
                <native:row class="items-center gap-2">
                    <native:icon :ios="Ios::Archivebox" :android="Android::Backup" :size="20" class="text-theme-primary" />
                    <native:text class="flex-1 text-base text-theme-on-surface" font="heading">Backup otomatis</native:text>
                </native:row>
                <native:toggle native:model="autoBackup" label="Buat backup otomatis sekali sehari saat aplikasi dibuka" />
                <native:outlined-text-input native:model.blur="backupRetention" label="Simpan berapa backup" placeholder="10" keyboard="number" />
                <native:text class="text-xs text-theme-secondary">Backup lama otomatis dipangkas saat jumlah melebihi retensi. Backup manual dan pengaman sebelum restore juga dihitung.</native:text>
                <native:text class="text-xs text-theme-muted">
                    Backup otomatis terakhir:
                    {{ $lastAutoBackupAt ? \App\Support\Options::dateTimeLabel($lastAutoBackupAt) : 'belum pernah' }}
                    @if ($lastBackup)
                        · backup terakhir {{ \App\Support\Options::dateTimeLabel($lastBackup->created_at?->toDateTimeString()) }}
                    @endif
                </native:text>
                <native:button class="w-full" variant="primary" @tap="saveBackup">Simpan pengaturan backup</native:button>
                <native:button class="w-full" variant="secondary" @tap="goBackup">Buka backup & restore</native:button>
            </native:column>

            <native:column class="w-full gap-3 rounded-3xl bg-theme-surface border border-theme-outline p-4">
                <native:row class="items-center gap-2">
                    <native:icon :ios="Ios::Lock" :android="Android::Lock" :size="20" class="text-theme-warning" />
                    <native:text class="flex-1 text-base text-theme-on-surface" font="heading">Kunci periode</native:text>
                </native:row>
                <native:text class="text-xs text-theme-secondary">Periode terkunci menolak perubahan pesanan, refund, pajak, dan HPP. Gunakan setelah laporan bulanan final agar angka tidak berubah diam-diam.</native:text>
                <native:select native:model="lockPeriodLabel" label="Periode yang dikunci" :options="$monthOptions" />
                <native:button class="w-full" variant="secondary" @tap="lockPeriod">Kunci periode</native:button>

                @if ($locks->isEmpty())
                    <native:text class="text-sm text-theme-secondary">Belum ada periode terkunci.</native:text>
                @else
                    @foreach ($locks as $lock)
                        @php($askUnlockAction = "askUnlock('".$lock->period."')")
                        @php($unlockPeriodAction = "unlockPeriod('".$lock->period."')")
                        <native:column native:key="lock-{{ $lock->id }}" class="w-full gap-2 rounded-2xl bg-theme-surface-variant p-3">
                            <native:row class="w-full items-center justify-between gap-2">
                                <native:column class="flex-1 gap-1">
                                    <native:text class="text-sm text-theme-on-surface" font="body-semibold">{{ \App\Support\Options::monthLabel($lock->period) }}</native:text>
                                    <native:text class="text-xs text-theme-secondary">Dikunci {{ \App\Support\Options::dateTimeLabel($lock->locked_at?->toDateTimeString()) }} oleh {{ $lock->locked_by ?: 'Operator' }}</native:text>
                                </native:column>
                                <native:badge label="Terkunci" variant="primary" />
                            </native:row>

                            @if ($confirmUnlockPeriod === $lock->period)
                                <native:column class="w-full gap-2 rounded-xl bg-theme-danger-soft p-3">
                                    <native:text class="text-xs text-theme-destructive">Buka kunci {{ \App\Support\Options::monthLabel($lock->period) }}? Data pada periode ini bisa diubah lagi dan tindakan tercatat di audit log.</native:text>
                                    <native:row class="w-full gap-2">
                                        <native:button class="flex-1" variant="secondary" @tap="cancelUnlock">Batal</native:button>
                                        <native:button class="flex-1" variant="destructive" @tap="{!! $unlockPeriodAction !!}">Buka kunci</native:button>
                                    </native:row>
                                </native:column>
                            @else
                                <native:pressable class="self-start rounded-full bg-theme-primary-soft px-3 py-2" @tap="{!! $askUnlockAction !!}">
                                    <native:text class="text-xs text-theme-primary-text" font="body-medium">Buka kunci</native:text>
                                </native:pressable>
                            @endif
                        </native:column>
                    @endforeach
                @endif
            </native:column>

            <native:column class="w-full gap-2 rounded-3xl bg-theme-surface border border-theme-outline p-4">
                <native:text class="text-base text-theme-on-surface" font="heading">Tentang aplikasi</native:text>
                <native:row class="w-full items-center justify-between">
                    <native:text class="text-sm text-theme-secondary">Versi aplikasi</native:text>
                    <native:text class="text-sm text-theme-on-surface" font="body-medium">{{ $appVersion }}</native:text>
                </native:row>
                <native:row class="w-full items-center justify-between">
                    <native:text class="text-sm text-theme-secondary">Versi skema data</native:text>
                    <native:text class="text-sm text-theme-on-surface" font="body-medium">{{ $schemaVersion }}</native:text>
                </native:row>
                <native:row class="w-full items-center justify-between">
                    <native:text class="text-sm text-theme-secondary">Penyimpanan</native:text>
                    <native:text class="text-sm text-theme-on-surface" font="body-medium">SQLite lokal</native:text>
                </native:row>
                <native:row class="w-full items-center justify-between">
                    <native:text class="text-sm text-theme-secondary">Zona waktu</native:text>
                    <native:text class="text-sm text-theme-on-surface" font="body-medium">Asia/Jakarta</native:text>
                </native:row>
                <native:row class="w-full items-center justify-between">
                    <native:text class="text-sm text-theme-secondary">Pesanan tersimpan</native:text>
                    <native:text class="text-sm text-theme-on-surface" font="body-medium">{{ number_format($orderCount, 0, ',', '.') }}</native:text>
                </native:row>
                <native:row class="w-full items-center justify-between">
                    <native:text class="text-sm text-theme-secondary">Catatan audit</native:text>
                    <native:text class="text-sm text-theme-on-surface" font="body-medium">{{ number_format($auditCount, 0, ',', '.') }}</native:text>
                </native:row>
                <native:pressable class="mt-1 self-start rounded-full bg-theme-surface-variant px-3 py-2" @tap="goAudit">
                    <native:text class="text-xs text-theme-on-surface" font="body-medium">Lihat audit log</native:text>
                </native:pressable>
                <native:text class="text-xs text-theme-muted">Penca · dashboard konveksi offline. Tidak ada akun, server, atau pengiriman data keluar perangkat.</native:text>
            </native:column>
        </native:column>
    </native:scroll-view>

    @include('native.partials.bottom-nav', ['active' => 'more'])
</native:column>
