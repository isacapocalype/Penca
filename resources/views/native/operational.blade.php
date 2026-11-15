@use('App\Icons\Ios')
@use('App\Icons\Android')

<native:top-bar title="Biaya operasional" subtitle="{{ $periodLabel }}" display-mode="large" />

<native:column class="w-full h-full bg-theme-background">
    <native:scroll-view class="w-full flex-1" shows-indicators="false">
        <native:column class="w-full gap-4 p-4 pb-8">
            @include('native.partials.feedback', ['notice' => $notice, 'error' => $error])

            <native:column class="w-full gap-2">
                <native:select native:model="periodLabel" label="Periode" :options="$monthOptions" />
                <native:select native:model="storeFilterLabel" label="Catatan untuk" :options="$filterOptions" />
            </native:column>

            <native:column class="w-full gap-1 rounded-3xl bg-theme-primary-soft border border-theme-primary/30 p-5">
                <native:text class="text-sm text-theme-primary-text">Total biaya operasional</native:text>
                <native:text class="text-3xl text-theme-on-surface" font="heading-bold">{{ $rupiah($total) }}</native:text>
                <native:text class="text-xs text-theme-secondary">{{ $expenses->count() }} catatan pada periode ini. Biaya tanpa toko hanya masuk rekap "Semua Toko".</native:text>
            </native:column>

            @if ($byCategory->isNotEmpty())
                <native:column class="w-full gap-2 rounded-3xl bg-theme-surface border border-theme-outline p-4">
                    <native:text class="text-base text-theme-on-surface" font="heading">Per kategori</native:text>
                    @foreach ($byCategory as $category => $amount)
                        <native:row class="w-full items-center justify-between">
                            <native:text class="text-sm text-theme-secondary">{{ $categoryLabels[$category] ?? ucfirst($category) }}</native:text>
                            <native:text class="text-sm text-theme-on-surface" font="body-medium">{{ $rupiah($amount) }}</native:text>
                        </native:row>
                    @endforeach
                </native:column>
            @endif

            <native:column class="w-full gap-3">
                <native:text class="text-base text-theme-on-surface" font="heading">Catatan</native:text>

                @if ($expenses->isEmpty())
                    @include('native.partials.empty-state', [
                        'title' => 'Belum ada biaya operasional',
                        'message' => 'Catat gaji, packing, listrik, dan biaya nyata lain agar laba bersih tidak dilebihkan.',
                        'ctaLabel' => 'Catat biaya',
                        'ctaUrl' => '/operational/create',
                    ])
                @else
                    @foreach ($expenses as $expense)
                        <native:column native:key="op-{{ $expense->id }}" class="w-full gap-2 rounded-2xl bg-theme-surface border border-theme-outline p-4">
                            <native:row class="w-full items-start justify-between gap-2">
                                <native:column class="flex-1 gap-1">
                                    <native:text class="text-base text-theme-on-surface" font="body-semibold">{{ $expense->categoryLabel() }}</native:text>
                                    <native:text class="text-xs text-theme-secondary">{{ \App\Support\Options::dateLabel($expense->spent_at?->toDateString()) }} · {{ $expense->store?->name ?? 'Umum (tanpa toko)' }}</native:text>
                                    @if ($expense->notes)
                                        <native:text class="text-xs text-theme-muted">{{ $expense->notes }}</native:text>
                                    @endif
                                </native:column>
                                <native:text class="text-base text-theme-on-surface" font="heading-bold">{{ $rupiah($expense->amount) }}</native:text>
                            </native:row>

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

    <native:fab icon="add" label="Catat biaya" @tap="create" />
    @include('native.partials.bottom-nav', ['active' => 'more'])
</native:column>
