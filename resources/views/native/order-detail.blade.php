@use('App\Icons\Ios')
@use('App\Icons\Android')

<native:top-bar title="Detail pesanan" subtitle="{{ $order?->marketplace_order_id ?? 'Pesanan tidak ditemukan' }}" back />

<native:column class="w-full h-full bg-theme-background">
    <native:scroll-view class="w-full flex-1" shows-indicators="false">
        <native:column class="w-full gap-4 p-4 pb-10">
            @include('native.partials.feedback', ['notice' => $notice, 'error' => $error])

            @if ($order === null)
                <native:column class="w-full gap-3 rounded-3xl bg-theme-surface border border-theme-outline p-6">
                    <native:text class="text-base text-theme-on-surface" font="heading">Pesanan tidak ditemukan</native:text>
                    <native:text class="text-sm text-theme-secondary">Data mungkin sudah dihapus atau tautan tidak lagi valid.</native:text>
                    <native:button class="mt-2 w-full" variant="primary" @tap="goOrders">Kembali ke daftar pesanan</native:button>
                </native:column>
            @else
                @if ($locked)
                    <native:column class="w-full gap-1 rounded-2xl bg-theme-warning-soft border border-theme-warning/30 p-4">
                        <native:text class="text-sm text-theme-on-warning" font="body-semibold">Periode terkunci</native:text>
                        <native:text class="text-xs text-theme-on-warning">Pesanan ini berada pada periode yang dikunci. Perubahan akan ditolak sampai periode dibuka.</native:text>
                    </native:column>
                @endif

                <native:column class="w-full gap-2 rounded-3xl bg-theme-surface border border-theme-outline p-4">
                    <native:row class="w-full items-start justify-between gap-3">
                        <native:column class="flex-1 gap-1">
                            <native:text class="text-xl text-theme-on-surface" font="heading-bold">{{ $order->marketplace_order_id }}</native:text>
                            <native:text class="text-sm text-theme-secondary">{{ $order->store?->name }} · {{ $order->store?->marketplace?->name }}</native:text>
                        </native:column>
                        <native:badge :label="$order->statusLabel()" variant="primary" />
                    </native:row>
                    <native:row class="mt-1 w-full gap-3">
                        <native:column class="flex-1 gap-1 rounded-2xl bg-theme-surface-variant p-3">
                            <native:text class="text-xs text-theme-secondary">Tanggal pesanan</native:text>
                            <native:text class="text-sm text-theme-on-surface" font="body-semibold">{{ \App\Support\Options::dateLabel($order->ordered_at?->toDateString()) }}</native:text>
                        </native:column>
                        <native:column class="flex-1 gap-1 rounded-2xl bg-theme-surface-variant p-3">
                            <native:text class="text-xs text-theme-secondary">Tanggal selesai</native:text>
                            <native:text class="text-sm text-theme-on-surface" font="body-semibold">{{ $order->completed_at ? \App\Support\Options::dateLabel($order->completed_at->toDateString()) : '—' }}</native:text>
                        </native:column>
                    </native:row>
                    @if (! empty($order->notes))
                        <native:text class="text-xs text-theme-secondary">Catatan: {{ $order->notes }}</native:text>
                    @endif
                </native:column>

                <native:column class="w-full gap-3 rounded-3xl bg-theme-primary-soft border border-theme-primary/30 p-4">
                    <native:text class="text-xs text-theme-primary-text">Laba operasional pesanan</native:text>
                    <native:text class="text-3xl text-theme-on-surface" font="heading-bold">{{ $rupiah($operatingProfit) }}</native:text>
                    <native:text class="text-xs text-theme-secondary">Pendapatan neto {{ $rupiah($netRevenue) }} · laba kotor {{ $rupiah($grossProfit) }}</native:text>
                    <native:text class="text-xs text-theme-secondary">PPN dan PPh Final dihitung pada level periode, bukan per pesanan.</native:text>
                </native:column>

                <native:column class="w-full gap-2 rounded-3xl bg-theme-surface border border-theme-outline p-4">
                    <native:text class="text-base text-theme-on-surface" font="heading">Rincian keuangan</native:text>

                    <native:row class="w-full items-center justify-between">
                        <native:text class="text-sm text-theme-secondary">Omzet bruto</native:text>
                        <native:text class="text-sm text-theme-on-surface" font="body-medium">{{ $rupiah($order->gross_revenue) }}</native:text>
                    </native:row>
                    <native:row class="w-full items-center justify-between">
                        <native:text class="text-sm text-theme-secondary">Diskon penjual</native:text>
                        <native:text class="text-sm text-theme-destructive" font="body-medium">−{{ $rupiah($order->seller_discount) }}</native:text>
                    </native:row>
                    <native:row class="w-full items-center justify-between">
                        <native:text class="text-sm text-theme-secondary">Diskon marketplace</native:text>
                        <native:text class="text-sm text-theme-secondary" font="body-medium">{{ $rupiah($order->marketplace_discount) }}</native:text>
                    </native:row>
                    <native:row class="w-full items-center justify-between">
                        <native:text class="text-sm text-theme-secondary">Refund</native:text>
                        <native:text class="text-sm text-theme-destructive" font="body-medium">−{{ $rupiah($refund?->amount ?? 0) }}</native:text>
                    </native:row>
                    <native:column class="w-full border-t border-theme-outline"></native:column>
                    <native:row class="w-full items-center justify-between">
                        <native:text class="text-sm text-theme-on-surface" font="body-semibold">Pendapatan neto</native:text>
                        <native:text class="text-sm text-theme-on-surface" font="body-semibold">{{ $rupiah($netRevenue) }}</native:text>
                    </native:row>
                    <native:row class="w-full items-center justify-between">
                        <native:text class="text-sm text-theme-secondary">HPP</native:text>
                        <native:text class="text-sm text-theme-destructive" font="body-medium">−{{ $rupiah($order->hpp_total) }}</native:text>
                    </native:row>
                    <native:row class="w-full items-center justify-between">
                        <native:text class="text-sm text-theme-secondary">Fee ditanggung penjual</native:text>
                        <native:text class="text-sm text-theme-destructive" font="body-medium">−{{ $rupiah($sellerFees) }}</native:text>
                    </native:row>
                    <native:row class="w-full items-center justify-between">
                        <native:text class="text-sm text-theme-on-surface" font="body-semibold">Laba operasional</native:text>
                        <native:text class="text-sm text-theme-on-surface" font="body-semibold">{{ $rupiah($operatingProfit) }}</native:text>
                    </native:row>
                    <native:text class="text-xs text-theme-secondary">Diskon marketplace bukan pengurang omzet penjual. Fee yang ditanggung marketplace tidak mengurangi laba.</native:text>
                </native:column>

                <native:column class="w-full gap-3 rounded-3xl bg-theme-surface border border-theme-outline p-4">
                    <native:row class="w-full items-center justify-between">
                        <native:text class="text-base text-theme-on-surface" font="heading">Item</native:text>
                        <native:text class="text-xs text-theme-secondary">{{ $items->count() }} item</native:text>
                    </native:row>

                    @foreach ($items as $item)
                        <native:column native:key="item-{{ $item->id }}" class="w-full gap-1 rounded-2xl bg-theme-surface-variant p-3">
                            <native:row class="w-full items-start justify-between gap-2">
                                <native:column class="flex-1 gap-1">
                                    <native:text class="text-sm text-theme-on-surface" font="body-semibold">{{ $item->sku }} · {{ $item->product_name }}</native:text>
                                    <native:text class="text-xs text-theme-secondary">{{ $item->qty }} × {{ $rupiah($item->unit_price) }} · HPP snapshot {{ $rupiah($item->hpp_unit_snapshot) }}/unit</native:text>
                                </native:column>
                                <native:text class="text-sm text-theme-on-surface" font="body-semibold">{{ $rupiah($item->lineRevenue()) }}</native:text>
                            </native:row>
                        </native:column>
                    @endforeach
                </native:column>

                <native:column class="w-full gap-3 rounded-3xl bg-theme-surface border border-theme-outline p-4">
                    <native:row class="w-full items-center justify-between">
                        <native:column class="gap-1">
                            <native:text class="text-base text-theme-on-surface" font="heading">Fee marketplace</native:text>
                            <native:text class="text-xs text-theme-secondary">Total ditanggung penjual {{ $rupiah($sellerFees) }}</native:text>
                        </native:column>
                        <native:pressable class="rounded-full bg-theme-primary-soft px-3 py-2" @tap="toggleFeeForm">
                            <native:text class="text-xs text-theme-primary-text" font="body-medium">{{ $showFeeForm ? 'Tutup' : 'Tambah' }}</native:text>
                        </native:pressable>
                    </native:row>

                    @if ($fees->isEmpty())
                        <native:text class="text-sm text-theme-secondary">Belum ada fee tercatat. Fee hanya diisi bila marketplace benar-benar memotong biaya.</native:text>
                    @else
                        @foreach ($fees as $fee)
                            @php($deleteFeeAction = "deleteFee('".$fee->id."')")
                            <native:row native:key="fee-{{ $fee->id }}" class="w-full items-center justify-between gap-2 rounded-2xl bg-theme-surface-variant p-3">
                                <native:column class="flex-1 gap-1">
                                    <native:text class="text-sm text-theme-on-surface" font="body-medium">{{ $fee->description }}</native:text>
                                    <native:text class="text-xs text-theme-secondary">{{ $fee->borne_by === 'seller' ? 'Ditanggung penjual' : 'Ditanggung marketplace' }}{{ $fee->category ? ' · '.$fee->category->name : '' }}</native:text>
                                </native:column>
                                <native:column class="items-end gap-1">
                                    <native:text class="text-sm text-theme-on-surface" font="body-semibold">{{ $rupiah($fee->amount) }}</native:text>
                                    <native:pressable class="rounded-full bg-theme-danger-soft px-3 py-1" @tap="{!! $deleteFeeAction !!}">
                                        <native:text class="text-xs text-theme-destructive" font="body-medium">Hapus</native:text>
                                    </native:pressable>
                                </native:column>
                            </native:row>
                        @endforeach
                    @endif

                    @if ($showFeeForm)
                        <native:column class="w-full gap-3 rounded-2xl bg-theme-surface-variant p-3">
                            <native:select native:model="feeCategoryLabel" label="Kategori" :options="$feeCategoryOptions" placeholder="Pilih kategori (opsional)" />
                            <native:outlined-text-input native:model.blur="feeDescription" label="Keterangan" placeholder="Biaya administrasi" />
                            <native:outlined-text-input native:model.blur="feeAmount" label="Nominal" placeholder="0" keyboard="number" />
                            <native:select native:model="feeBorneLabel" label="Ditanggung oleh" :options="$feeBorneOptions" />
                            <native:button class="w-full" variant="primary" @tap="addFee">Simpan fee</native:button>
                        </native:column>
                    @endif
                </native:column>

                <native:column class="w-full gap-3 rounded-3xl bg-theme-surface border border-theme-outline p-4">
                    <native:row class="w-full items-center justify-between">
                        <native:column class="gap-1">
                            <native:text class="text-base text-theme-on-surface" font="heading">Refund</native:text>
                            <native:text class="text-xs text-theme-secondary">Satu pesanan hanya boleh memiliki satu refund.</native:text>
                        </native:column>
                        @if ($refund === null)
                            <native:pressable class="rounded-full bg-theme-primary-soft px-3 py-2" @tap="toggleRefundForm">
                                <native:text class="text-xs text-theme-primary-text" font="body-medium">{{ $showRefundForm ? 'Tutup' : 'Catat' }}</native:text>
                            </native:pressable>
                        @endif
                    </native:row>

                    @if ($refund !== null)
                        <native:column class="w-full gap-2 rounded-2xl bg-theme-danger-soft p-4">
                            <native:row class="w-full items-center justify-between">
                                <native:text class="text-sm text-theme-destructive" font="body-semibold">Refund tercatat</native:text>
                                <native:text class="text-base text-theme-on-surface" font="heading-bold">−{{ $rupiah($refund->amount) }}</native:text>
                            </native:row>
                            <native:text class="text-xs text-theme-secondary">{{ \App\Support\Options::dateLabel($refund->refunded_at?->toDateString()) }}{{ $refund->reason ? ' · '.$refund->reason : '' }}</native:text>

                            @if ($confirmRefundDelete)
                                <native:row class="w-full gap-2 pt-1">
                                    <native:button class="flex-1" variant="secondary" @tap="toggleRefundDelete">Batal</native:button>
                                    <native:button class="flex-1" variant="destructive" @tap="deleteRefund">Hapus refund</native:button>
                                </native:row>
                            @else
                                <native:pressable class="mt-1 self-start rounded-full bg-theme-surface px-3 py-2" @tap="toggleRefundDelete">
                                    <native:text class="text-xs text-theme-destructive" font="body-medium">Hapus refund</native:text>
                                </native:pressable>
                            @endif
                        </native:column>
                    @elseif ($showRefundForm)
                        <native:column class="w-full gap-3 rounded-2xl bg-theme-surface-variant p-3">
                            <native:date-picker native:model="refundDate" label="Tanggal refund" mode="date" timezone="Asia/Jakarta" locale="id-ID" />
                            <native:outlined-text-input native:model.blur="refundAmount" label="Nominal refund" placeholder="0" keyboard="number" />
                            <native:outlined-text-input native:model.blur="refundReason" label="Alasan" placeholder="Opsional" />
                            <native:button class="w-full" variant="primary" @tap="addRefund">Simpan refund</native:button>
                        </native:column>
                    @endif
                </native:column>

                <native:column class="w-full gap-3 rounded-3xl bg-theme-surface border border-theme-outline p-4">
                    <native:row class="w-full items-center justify-between">
                        <native:column class="flex-1 gap-1">
                            <native:text class="text-base text-theme-on-surface" font="heading">Pencairan marketplace</native:text>
                            <native:text class="text-xs text-theme-secondary">Dana aktual yang diterima dari marketplace. Pencairan adalah kas masuk, bukan tambahan laba.</native:text>
                        </native:column>
                        @if (! $locked)
                            <native:pressable class="rounded-full bg-theme-primary-soft px-3 py-2" @tap="toggleSettlementForm">
                                <native:text class="text-xs text-theme-primary-text" font="body-medium">{{ $showSettlementForm ? 'Tutup' : 'Catat' }}</native:text>
                            </native:pressable>
                        @endif
                    </native:row>

                    @if ($settlements->isEmpty())
                        <native:text class="text-sm text-theme-secondary">Belum ada pencairan tercatat untuk pesanan ini.</native:text>
                    @else
                        @foreach ($settlements as $settlement)
                            @php($askDeleteSettlementAction = "askDeleteSettlement('".$settlement->id."')")
                            @php($deleteSettlementAction = "deleteSettlement('".$settlement->id."')")
                            <native:column native:key="settlement-{{ $settlement->id }}" class="w-full gap-2 rounded-2xl bg-theme-surface-variant p-3">
                                <native:row class="w-full items-center justify-between gap-2">
                                    <native:text class="text-sm text-theme-on-surface" font="body-medium">{{ \App\Support\Options::dateLabel($settlement->settled_at?->toDateString()) }}</native:text>
                                    <native:text class="text-sm text-theme-on-surface" font="body-semibold">{{ $rupiah($settlement->amount) }}</native:text>
                                </native:row>
                                @if ($settlement->reference || $settlement->notes)
                                    <native:text class="text-xs text-theme-secondary">{{ $settlement->reference ?: 'Tanpa referensi' }}{{ $settlement->notes ? ' · '.$settlement->notes : '' }}</native:text>
                                @endif

                                @if ($confirmSettlementDeleteId === $settlement->id)
                                    <native:row class="w-full gap-2 pt-1">
                                        <native:button class="flex-1" variant="secondary" @tap="cancelDeleteSettlement">Batal</native:button>
                                        <native:button class="flex-1" variant="destructive" @tap="{!! $deleteSettlementAction !!}">Hapus</native:button>
                                    </native:row>
                                @elseif (! $locked)
                                    <native:pressable class="self-start rounded-full bg-theme-danger-soft px-3 py-1" @tap="{!! $askDeleteSettlementAction !!}">
                                        <native:text class="text-xs text-theme-destructive" font="body-medium">Hapus pencairan</native:text>
                                    </native:pressable>
                                @endif
                            </native:column>
                        @endforeach
                    @endif

                    <native:column class="w-full border-t border-theme-outline"></native:column>
                    <native:row class="w-full items-center justify-between">
                        <native:text class="text-sm text-theme-secondary">Sudah dicairkan</native:text>
                        <native:text class="text-sm text-theme-on-surface" font="body-semibold">{{ $rupiah($settledTotal) }}</native:text>
                    </native:row>
                    <native:row class="w-full items-center justify-between">
                        <native:text class="text-sm text-theme-secondary">Belum dicairkan</native:text>
                        <native:text class="text-sm text-theme-on-surface" font="body-medium">{{ $rupiah($remainingToSettle) }}</native:text>
                    </native:row>
                    @if ($settledTotal > $netRevenue)
                        <native:text class="text-xs text-theme-destructive">Pencairan melebihi pendapatan neto saat ini. Periksa refund atau koreksi pesanan.</native:text>
                    @endif

                    @if ($showSettlementForm && ! $locked)
                        <native:column class="w-full gap-3 rounded-2xl bg-theme-surface-variant p-3">
                            <native:date-picker native:model="settlementDate" label="Tanggal pencairan" mode="date" timezone="Asia/Jakarta" locale="id-ID" />
                            <native:outlined-text-input native:model.blur="settlementAmount" label="Nominal dicairkan" placeholder="0" keyboard="number" />
                            <native:outlined-text-input native:model.blur="settlementReference" label="Referensi pencairan" placeholder="Opsional" />
                            <native:outlined-text-input native:model.blur="settlementNotes" label="Catatan" placeholder="Opsional" />
                            <native:button class="w-full" variant="primary" @tap="addSettlement">Simpan pencairan</native:button>
                        </native:column>
                    @endif
                </native:column>

                @if ($auditLogs->isNotEmpty())
                    <native:column class="w-full gap-2 rounded-3xl bg-theme-surface border border-theme-outline p-4">
                        <native:text class="text-base text-theme-on-surface" font="heading">Riwayat perubahan</native:text>
                        @foreach ($auditLogs as $log)
                            <native:row native:key="audit-{{ $log->id }}" class="w-full items-start justify-between gap-2">
                                <native:text class="flex-1 text-xs text-theme-secondary">{{ $log->summary }}</native:text>
                                <native:text class="text-xs text-theme-muted">{{ \App\Support\Options::dateTimeLabel($log->created_at?->toDateTimeString()) }}</native:text>
                            </native:row>
                        @endforeach
                    </native:column>
                @endif

                <native:row class="w-full gap-3">
                    <native:button class="flex-1" variant="secondary" @tap="edit">Ubah pesanan</native:button>
                    <native:button class="flex-1" variant="destructive" @tap="toggleDelete">{{ $confirmDelete ? 'Batal hapus' : 'Hapus' }}</native:button>
                </native:row>

                @if ($confirmDelete)
                    <native:column class="w-full gap-2 rounded-2xl bg-theme-danger-soft p-4">
                        <native:text class="text-sm text-theme-destructive" font="body-semibold">Hapus pesanan ini?</native:text>
                        <native:text class="text-xs text-theme-secondary">Pesanan dihapus secara lunak dan tercatat di audit log. Refund dan fee terkait juga tidak lagi dihitung.</native:text>
                        <native:button class="w-full" variant="destructive" @tap="deleteOrder">Ya, hapus pesanan</native:button>
                    </native:column>
                @endif
            @endif
        </native:column>
    </native:scroll-view>
</native:column>
