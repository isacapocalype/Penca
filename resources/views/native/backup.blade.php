@use('App\Icons\Ios')
@use('App\Icons\Android')

<native:top-bar title="Backup & restore" subtitle="Data keuangan tetap milik Anda" display-mode="large" back />

<native:column class="w-full h-full bg-theme-background">
    <native:scroll-view class="w-full flex-1" shows-indicators="false">
        <native:column class="w-full gap-4 p-4 pb-10">
            @include('native.partials.feedback', ['notice' => $notice, 'error' => $error])

            <native:column class="w-full gap-3 rounded-3xl bg-theme-primary-soft border border-theme-primary/30 p-5">
                <native:row class="w-full items-center justify-between">
                    <native:column class="flex-1 gap-1">
                        <native:text class="text-sm text-theme-primary-text">Backup terakhir</native:text>
                        <native:text class="text-lg text-theme-on-surface" font="heading-bold">
                            {{ $last ? \App\Support\Options::dateTimeLabel($last->created_at?->toDateTimeString()) : 'Belum pernah backup' }}
                        </native:text>
                        @if ($last)
                            <native:text class="text-xs text-theme-secondary">{{ $last->file_name }} · {{ $sizeLabel((int) $last->size) }}</native:text>
                        @else
                            <native:text class="text-xs text-theme-secondary">Buat backup pertama sebelum mengisi data penting.</native:text>
                        @endif
                    </native:column>
                    <native:column class="h-12 w-12 items-center justify-center rounded-2xl bg-theme-primary">
                        <native:icon :ios="Ios::Archivebox" :android="Android::Backup" :size="24" class="text-theme-on-primary" />
                    </native:column>
                </native:row>

                <native:row class="w-full gap-2 pt-1">
                    <native:column class="flex-1 rounded-2xl bg-theme-surface/70 p-3">
                        <native:text class="text-sm text-theme-on-surface" font="body-semibold">{{ $autoBackup ? 'Aktif' : 'Nonaktif' }}</native:text>
                        <native:text class="text-xs text-theme-secondary">Backup otomatis saat aplikasi dibuka</native:text>
                    </native:column>
                    <native:column class="flex-1 rounded-2xl bg-theme-surface/70 p-3">
                        <native:text class="text-sm text-theme-on-surface" font="body-semibold">{{ $retention }} file</native:text>
                        <native:text class="text-xs text-theme-secondary">Disimpan sebelum dipangkas</native:text>
                    </native:column>
                </native:row>

                <native:button class="w-full" variant="primary" @tap="createBackup">Buat backup sekarang</native:button>
                <native:text class="text-xs text-theme-secondary">Backup berisi JSON lengkap dan snapshot database .db. Keduanya dibuat lokal di perangkat.</native:text>
            </native:column>

            <native:column class="w-full gap-3 rounded-3xl bg-theme-surface border border-theme-outline p-4">
                <native:row class="items-center gap-2">
                    <native:icon :ios="Ios::ArrowCounterclockwise" :android="Android::Restore" :size="20" class="text-theme-warning" />
                    <native:text class="flex-1 text-base text-theme-on-surface" font="heading">Restore dari backup</native:text>
                </native:row>
                <native:text class="text-xs text-theme-secondary">Restore memakai file JSON Penca. Sebelum data diganti, aplikasi membuat backup pengaman otomatis. File .db hanya untuk pemulihan darurat di luar aplikasi.</native:text>

                @if ($restorePath !== '')
                    <native:column class="w-full gap-1 rounded-2xl bg-theme-surface-variant p-3">
                        <native:text class="text-sm text-theme-on-surface" font="body-medium">{{ $restoreName }}</native:text>
                        <native:text class="text-xs text-theme-secondary">File dipilih. Periksa kembali sebelum memulihkan.</native:text>
                    </native:column>
                @endif

                @if ($confirmRestore)
                    <native:column class="w-full gap-2 rounded-2xl bg-theme-danger-soft border border-theme-destructive/30 p-3">
                        <native:text class="text-sm text-theme-destructive" font="body-semibold">Ganti seluruh data saat ini?</native:text>
                        <native:text class="text-xs text-theme-destructive">Semua toko, pesanan, produk, biaya, dan pajak akan diganti dengan isi backup {{ $restoreName }}. Tindakan ini tercatat di audit log.</native:text>
                        <native:row class="w-full gap-2">
                            <native:button class="flex-1" variant="secondary" @tap="cancelRestore">Batal</native:button>
                            <native:button class="flex-1" variant="destructive" @tap="restore">Ya, restore</native:button>
                        </native:row>
                    </native:column>
                @else
                    <native:row class="w-full gap-2">
                        <native:button class="flex-1" variant="secondary" @tap="pickRestore">Pilih file JSON</native:button>
                        @if ($restorePath !== '')
                            <native:button class="flex-1" variant="destructive" @tap="askRestore">Restore data</native:button>
                        @endif
                    </native:row>
                @endif
            </native:column>

            <native:column class="w-full gap-1 rounded-2xl bg-theme-warning-soft border border-theme-warning/30 p-4">
                <native:text class="text-sm text-theme-on-surface" font="body-semibold">Simpan di tempat aman</native:text>
                <native:text class="text-xs text-theme-secondary">File backup memuat seluruh data keuangan. Bagikan hanya ke penyimpanan pribadi seperti Google Drive atau komputer sendiri. Jangan kirim ke pihak yang tidak berwenang.</native:text>
            </native:column>

            <native:row class="w-full items-center justify-between">
                <native:text class="text-base text-theme-on-surface" font="heading">Riwayat backup</native:text>
                <native:pressable class="rounded-full bg-theme-surface border border-theme-outline px-3 py-2" @tap="goSettings">
                    <native:text class="text-xs text-theme-on-surface" font="body-medium">Pengaturan</native:text>
                </native:pressable>
            </native:row>

            @if ($history === [])
                @include('native.partials.empty-state', [
                    'title' => 'Belum ada backup',
                    'message' => 'Buat backup pertama agar data keuangan bisa dipulihkan bila perangkat hilang atau aplikasi dipasang ulang.',
                ])
            @else
                @foreach ($history as $backup)
                    @php($shareJsonAction = "share('".$backup->id."', 'json')")
                    @php($shareDbAction = "share('".$backup->id."', 'db')")
                    @php($saveJsonAction = "saveAs('".$backup->id."', 'json')")
                    @php($saveDbAction = "saveAs('".$backup->id."', 'db')")
                    <native:column native:key="backup-{{ $backup->id }}" class="w-full gap-2 rounded-2xl bg-theme-surface border border-theme-outline p-4">
                        <native:row class="w-full items-start justify-between gap-2">
                            <native:column class="flex-1 gap-1">
                                <native:row class="items-center gap-2">
                                    <native:text class="text-sm text-theme-on-surface" font="body-semibold">{{ $backup->file_name }}</native:text>
                                    <native:badge
                                        :label="$backup->reason === 'auto' ? 'Otomatis' : ($backup->reason === 'pre_restore' ? 'Pengaman' : 'Manual')"
                                        :variant="$backup->reason === 'pre_restore' ? 'primary' : 'success'"
                                    />
                                </native:row>
                                <native:text class="text-xs text-theme-secondary">{{ \App\Support\Options::dateTimeLabel($backup->created_at?->toDateTimeString()) }} · {{ $sizeLabel((int) $backup->size) }}</native:text>
                                <native:text class="text-xs text-theme-muted">SHA-256 {{ substr((string) $backup->checksum, 0, 16) }}… · skema {{ $backup->schema_version }}</native:text>
                                @if ($backup->restored_at)
                                    <native:text class="text-xs text-theme-success">Pernah dipulihkan {{ \App\Support\Options::dateTimeLabel($backup->restored_at?->toDateTimeString()) }}</native:text>
                                @endif
                            </native:column>
                        </native:row>

                        <native:row class="w-full gap-2">
                            <native:button class="flex-1" variant="secondary" @tap="{!! $shareJsonAction !!}">Bagikan JSON</native:button>
                            @if ($backup->db_path)
                                <native:button class="flex-1" variant="secondary" @tap="{!! $shareDbAction !!}">Bagikan DB</native:button>
                            @endif
                        </native:row>
                        <native:row class="w-full gap-2">
                            <native:pressable class="flex-1 items-center rounded-full bg-theme-surface-variant px-3 py-2" @tap="{!! $saveJsonAction !!}">
                                <native:text class="text-center text-xs text-theme-on-surface" font="body-medium">Simpan JSON</native:text>
                            </native:pressable>
                            @if ($backup->db_path)
                                <native:pressable class="flex-1 items-center rounded-full bg-theme-surface-variant px-3 py-2" @tap="{!! $saveDbAction !!}">
                                    <native:text class="text-center text-xs text-theme-on-surface" font="body-medium">Simpan DB</native:text>
                                </native:pressable>
                            @endif
                        </native:row>
                        @if ($backup->restored_at)
                            <native:text class="text-xs text-theme-secondary">File ini cocok dipakai restore ulang bila perlu.</native:text>
                        @endif
                    </native:column>
                @endforeach
            @endif

            <native:text class="px-1 text-xs text-theme-muted">Lokasi file: penyimpanan aplikasi Penca. Gunakan tombol bagikan atau simpan untuk menyalin ke tempat lain. Retensi dan backup otomatis diatur di Pengaturan.</native:text>
        </native:column>
    </native:scroll-view>

    @include('native.partials.bottom-nav', ['active' => 'more'])
</native:column>
