@use('App\Icons\Ios')
@use('App\Icons\Android')

<native:top-bar title="Biaya iklan" subtitle="{{ $periodLabel }}" display-mode="large" />

<native:column class="w-full h-full bg-theme-background">
    <native:scroll-view class="w-full flex-1" shows-indicators="false">
        <native:column class="w-full gap-4 p-4 pb-8">
            @include('native.partials.feedback', ['notice' => $notice, 'error' => $error])

            <native:column class="w-full gap-2">
                <native:select native:model="periodLabel" label="Periode" :options="$monthOptions" />
                <native:select native:model="storeFilterLabel" label="Toko" :options="$storeFilterOptions" />
            </native:column>

            <native:row class="w-full gap-3">
                @include('native.partials.stat-card', ['label' => 'Total belanja iklan', 'value' => $rupiah($totalSpend), 'hint' => $expenses->count().' catatan'])
                @include('native.partials.stat-card', [
                    'label' => 'ROAS gabungan',
                    'value' => $totalSpend > 0 && $totalAttributed > 0 ? number_format($totalAttributed / $totalSpend, 2, ',', '.').'×' : '—',
                    'hint' => 'Omzet atribusi / biaya',
                ])
            </native:row>

            <native:row class="w-full gap-3">
                @include('native.partials.stat-card', ['label' => 'Omzet atribusi', 'value' => $rupiah($totalAttributed)])
                @include('native.partials.stat-card', ['label' => 'Klik', 'value' => number_format($totalClicks, 0, ',', '.'), 'hint' => $totalOrders.' pesanan atribusi'])
            </native:row>

            <native:column class="w-full gap-3 rounded-3xl bg-theme-surface border border-theme-outline p-4">
                <native:row class="w-full items-center justify-between">
                    <native:column class="flex-1 gap-1">
                        <native:text class="text-base text-theme-on-surface" font="heading">Kampanye</native:text>
                        <native:text class="text-xs text-theme-secondary">Kampanye membantu mengelompokkan belanja iklan.</native:text>
                    </native:column>
                    <native:pressable class="rounded-full bg-theme-primary-soft px-3 py-2" @tap="toggleCampaignForm">
                        <native:text class="text-xs text-theme-primary-text" font="body-medium">{{ $showCampaignForm ? 'Tutup' : 'Kampanye baru' }}</native:text>
                    </native:pressable>
                </native:row>

                @if ($showCampaignForm)
                    <native:column class="w-full gap-3 rounded-2xl bg-theme-surface-variant p-3">
                        <native:select native:model="campaignStoreLabel" label="Toko" :options="$storeValues" />
                        <native:outlined-text-input native:model.blur="campaignName" label="Nama kampanye" placeholder="Flash Sale November" />
                        <native:select native:model="campaignPlatformLabel" label="Platform" :options="$platformOptions" />
                        <native:button class="w-full" variant="primary" @tap="addCampaign">Simpan kampanye</native:button>
                    </native:column>
                @endif

                @if ($campaigns->isEmpty())
                    <native:text class="text-sm text-theme-secondary">Belum ada kampanye. Kampanye opsional; biaya iklan tetap bisa dicatat tanpa kampanye.</native:text>
                @else
                    @foreach ($campaigns as $campaign)
                        <native:row native:key="campaign-{{ $campaign->id }}" class="w-full items-center justify-between gap-2 rounded-2xl bg-theme-surface-variant p-3">
                            <native:column class="flex-1 gap-1">
                                <native:row class="items-center gap-2">
                                    <native:text class="text-sm text-theme-on-surface" font="body-medium">{{ $campaign->name }}</native:text>
                                    @if (! $campaign->active)
                                        <native:badge label="Nonaktif" variant="primary" />
                                    @endif
                                </native:row>
                                <native:text class="text-xs text-theme-secondary">{{ $campaign->store?->name }} · {{ \App\Support\Options::AD_PLATFORMS[$campaign->platform] ?? $campaign->platform }} · belanja {{ $rupiah($campaignTotals[$campaign->id] ?? 0) }}</native:text>
                            </native:column>
                            @php($toggleCampaignAction = "toggleCampaign('".$campaign->id."')")
                            <native:pressable class="rounded-full bg-theme-surface px-3 py-2" @tap="{!! $toggleCampaignAction !!}">
                                <native:text class="text-xs text-theme-primary-text" font="body-medium">{{ $campaign->active ? 'Nonaktifkan' : 'Aktifkan' }}</native:text>
                            </native:pressable>
                        </native:row>
                    @endforeach
                @endif
            </native:column>

            <native:column class="w-full gap-3">
                <native:text class="text-base text-theme-on-surface" font="heading">Catatan belanja</native:text>

                @if ($expenses->isEmpty())
                    @include('native.partials.empty-state', [
                        'title' => 'Belum ada biaya iklan',
                        'message' => 'Catat belanja iklan yang benar-benar keluar agar laba tidak terlihat lebih besar dari kenyataan.',
                        'ctaLabel' => 'Catat biaya iklan',
                        'ctaUrl' => '/ads/create',
                    ])
                @else
                    @foreach ($expenses as $expense)
                        <native:column native:key="expense-{{ $expense->id }}" class="w-full gap-2 rounded-2xl bg-theme-surface border border-theme-outline p-4">
                            <native:row class="w-full items-start justify-between gap-2">
                                <native:column class="flex-1 gap-1">
                                    <native:text class="text-base text-theme-on-surface" font="body-semibold">{{ $rupiah($expense->amount) }}</native:text>
                                    <native:text class="text-xs text-theme-secondary">{{ \App\Support\Options::dateLabel($expense->spent_at?->toDateString()) }} · {{ $expense->store?->name }}</native:text>
                                    <native:text class="text-xs text-theme-secondary">{{ $expense->campaign?->name ?? 'Tanpa kampanye' }} · {{ \App\Support\Options::AD_PLATFORMS[$expense->campaign?->platform ?? ''] ?? '—' }}</native:text>
                                </native:column>
                                <native:column class="items-end gap-1">
                                    @if ($expense->roas() !== null)
                                        <native:text class="text-sm text-theme-on-surface" font="body-semibold">{{ number_format($expense->roas(), 2, ',', '.') }}×</native:text>
                                        <native:text class="text-xs text-theme-secondary">ROAS · ACOS {{ number_format($expense->acos(), 1, ',', '.') }}%</native:text>
                                    @else
                                        <native:text class="text-xs text-theme-muted">ROAS belum ada</native:text>
                                    @endif
                                </native:column>
                            </native:row>

                            <native:text class="text-xs text-theme-secondary">Klik {{ $expense->clicks ?? 0 }} · impresi {{ $expense->impressions ?? 0 }} · {{ $expense->attributed_orders ?? 0 }} pesanan · omzet atribusi {{ $rupiah($expense->attributed_revenue ?? 0) }}</native:text>
                            @if ($expense->notes)
                                <native:text class="text-xs text-theme-muted">{{ $expense->notes }}</native:text>
                            @endif

                            @php($editExpenseAction = "edit('".$expense->id."')")
                            @php($deleteExpenseAction = "deleteExpense('".$expense->id."')")
                            @php($askDeleteExpenseAction = "askDelete('".$expense->id."')")

                            @if ($confirmDeleteId === $expense->id)
                                <native:column class="w-full gap-2 rounded-xl bg-theme-danger-soft p-3">
                                    <native:text class="text-xs text-theme-destructive">Hapus catatan biaya ini? Tindakan tercatat di audit log.</native:text>
                                    <native:row class="w-full gap-2">
                                        <native:button class="flex-1" variant="secondary" @tap="cancelDelete">Batal</native:button>
                                        <native:button class="flex-1" variant="destructive" @tap="{!! $deleteExpenseAction !!}">Hapus</native:button>
                                    </native:row>
                                </native:column>
                            @else
                                <native:row class="w-full gap-2">
                                    <native:button class="flex-1" variant="secondary" @tap="{!! $editExpenseAction !!}">Ubah</native:button>
                                    <native:pressable class="flex-1 items-center rounded-full bg-theme-danger-soft px-3 py-2" @tap="{!! $askDeleteExpenseAction !!}">
                                        <native:text class="text-center text-xs text-theme-destructive" font="body-medium">Hapus</native:text>
                                    </native:pressable>
                                </native:row>
                            @endif
                        </native:column>
                    @endforeach
                @endif
            </native:column>
        </native:column>
    </native:scroll-view>

    <native:fab icon="add" label="Catat biaya iklan" @tap="create" />
    @include('native.partials.bottom-nav', ['active' => 'more'])
</native:column>
