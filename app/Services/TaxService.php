<?php

namespace App\Services;

use App\Data\TaxRecap;
use App\Models\Order;
use App\Models\Setting;
use App\Models\Store;
use App\Models\TaxEntry;
use App\Models\TaxProfile;
use App\Support\FinancialCalculator;
use App\Support\Period;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;

class TaxService
{
    public function __construct(private readonly PeriodLockService $locks) {}

    public function recap(string $period, ?string $storeId = null): TaxRecap
    {
        Period::assertFormat($period);
        $start = Period::start($period)->toDateString();
        $end = Period::end($period)->toDateString();

        $orders = Order::query()
            ->with(['refund:id,order_id,amount', 'store:id,name', 'store.taxProfiles'])
            ->realized()
            ->whereBetween('ordered_at', [$start, $end])
            ->when($storeId, fn ($query) => $query->where('store_id', $storeId))
            ->get();

        $stores = [];

        foreach ($orders as $order) {
            $key = (string) $order->store_id;
            $stores[$key] ??= [
                'store_id' => $key,
                'store_name' => $order->store?->name ?? 'Toko',
                'pkp' => false,
                'ppn_mode' => TaxProfile::PPN_NONE,
                'ppn_rate_bp' => 0,
                'pph_rate_bp' => 0,
                'pph_basis' => 'gross',
                'gross' => 0,
                'net' => 0,
                'ppn_output' => 0,
                'pph_final' => 0,
                'orders' => 0,
            ];

            $gross = (int) $order->gross_revenue;
            $net = FinancialCalculator::netRevenue(
                $gross,
                (int) $order->seller_discount,
                FinancialCalculator::orderRefundTotal($order),
            );
            $profile = $order->store?->taxProfileOn($order->ordered_at);
            $ppn = $this->outputPpn($profile, $net);
            $pph = $this->pphFinal($profile, $gross, $net);

            $stores[$key]['gross'] += $gross;
            $stores[$key]['net'] += $net;
            $stores[$key]['ppn_output'] += $ppn;
            $stores[$key]['pph_final'] += $pph;
            $stores[$key]['orders']++;

            if ($profile) {
                $stores[$key]['pkp'] = (bool) $profile->pkp;
                $stores[$key]['ppn_mode'] = $profile->ppn_mode;
                $stores[$key]['ppn_rate_bp'] = (int) $profile->ppn_rate_bp;
                $stores[$key]['pph_rate_bp'] = (int) $profile->pph_rate_bp;
                $stores[$key]['pph_basis'] = $profile->pph_basis;
            }
        }

        if ($storeId) {
            $store = Store::query()->find($storeId);

            if ($store && ! isset($stores[$storeId])) {
                $profile = $store->taxProfileOn(CarbonImmutable::now());

                $stores[$storeId] = [
                    'store_id' => $storeId,
                    'store_name' => $store->name,
                    'pkp' => (bool) ($profile?->pkp ?? false),
                    'ppn_mode' => $profile?->ppn_mode ?? TaxProfile::PPN_NONE,
                    'ppn_rate_bp' => (int) ($profile?->ppn_rate_bp ?? 0),
                    'pph_rate_bp' => (int) ($profile?->pph_rate_bp ?? 0),
                    'pph_basis' => $profile?->pph_basis ?? 'gross',
                    'gross' => 0,
                    'net' => 0,
                    'ppn_output' => 0,
                    'pph_final' => 0,
                    'orders' => 0,
                ];
            }
        }

        $entries = TaxEntry::query()
            ->with('store:id,name')
            ->where('period', $period)
            ->when($storeId, fn ($query) => $query->where('store_id', $storeId))
            ->orderBy('type')
            ->orderBy('created_at')
            ->get();

        foreach ($entries as $entry) {
            $key = (string) $entry->store_id;

            if (! isset($stores[$key])) {
                $stores[$key] = [
                    'store_id' => $key,
                    'store_name' => $entry->store?->name ?? 'Toko',
                    'pkp' => false,
                    'ppn_mode' => TaxProfile::PPN_NONE,
                    'ppn_rate_bp' => 0,
                    'pph_rate_bp' => 0,
                    'pph_basis' => 'gross',
                    'gross' => 0,
                    'net' => 0,
                    'ppn_output' => 0,
                    'pph_final' => 0,
                    'orders' => 0,
                ];
            }

            if ($entry->type === TaxEntry::PPN_INPUT) {
                $stores[$key]['ppn_input'] = ($stores[$key]['ppn_input'] ?? 0) + (int) $entry->amount;
            }
        }

        foreach ($stores as $key => $store) {
            $stores[$key]['ppn_input'] = (int) ($store['ppn_input'] ?? 0);
            $stores[$key]['ppn_payable'] = $stores[$key]['ppn_output'] - $stores[$key]['ppn_input'];
        }

        ksort($stores);

        return new TaxRecap(
            period: $period,
            periodLabel: Period::label($period),
            storeId: $storeId,
            grossRevenue: array_sum(array_column($stores, 'gross')),
            netRevenue: array_sum(array_column($stores, 'net')),
            ppnOutput: array_sum(array_column($stores, 'ppn_output')),
            ppnInput: array_sum(array_column($stores, 'ppn_input')),
            ppnPayable: array_sum(array_column($stores, 'ppn_payable')),
            pphFinal: array_sum(array_column($stores, 'pph_final')),
            stores: array_values($stores),
            entries: $entries->map(fn (TaxEntry $entry): array => [
                'id' => $entry->id,
                'store_id' => $entry->store_id,
                'store_name' => $entry->store?->name ?? 'Toko',
                'type' => $entry->type,
                'type_label' => TaxEntry::TYPES[$entry->type] ?? $entry->type,
                'base_amount' => (int) $entry->base_amount,
                'rate_bp' => (int) $entry->rate_bp,
                'amount' => (int) $entry->amount,
                'status' => $entry->status,
                'reference' => $entry->reference,
                'notes' => $entry->notes,
            ])->all(),
        );
    }

    /**
     * Menyimpan rekap PPN keluaran dan PPh Final dari transaksi ke tabel pajak.
     * PPN masukan yang dicatat manual tidak dihapus.
     */
    public function generate(string $period, ?string $storeId = null): int
    {
        Period::assertFormat($period);
        $this->locks->assertUnlocked($period);

        $recap = $this->recap($period, $storeId);
        $written = 0;

        DB::transaction(function () use ($recap, $period, &$written): void {
            foreach ($recap->stores as $store) {
                foreach ([TaxEntry::PPN_OUTPUT, TaxEntry::PPH_FINAL] as $type) {
                    $amount = $type === TaxEntry::PPN_OUTPUT
                        ? (int) $store['ppn_output']
                        : (int) $store['pph_final'];
                    $base = $type === TaxEntry::PPN_OUTPUT
                        ? (int) $store['net']
                        : (int) $store['gross'];
                    $rate = $type === TaxEntry::PPN_OUTPUT
                        ? ($store['pkp'] ? (int) $store['ppn_rate_bp'] : 0)
                        : (int) $store['pph_rate_bp'];

                    $entry = TaxEntry::query()
                        ->where('store_id', $store['store_id'])
                        ->where('period', $period)
                        ->where('type', $type)
                        ->where('reference', 'auto')
                        ->first();

                    if (! $entry && $amount === 0) {
                        continue;
                    }

                    if ($entry) {
                        $entry->fill([
                            'base_amount' => $base,
                            'rate_bp' => $rate,
                            'amount' => $amount,
                            'notes' => 'Dihitung otomatis dari pesanan terkirim/selesai.',
                        ])->save();
                    } else {
                        TaxEntry::query()->create([
                            'store_id' => $store['store_id'],
                            'period' => $period,
                            'type' => $type,
                            'base_amount' => $base,
                            'rate_bp' => $rate,
                            'amount' => $amount,
                            'status' => 'draft',
                            'reference' => 'auto',
                            'notes' => 'Dihitung otomatis dari pesanan terkirim/selesai.',
                        ]);
                    }

                    $written++;
                }
            }
        });

        return $written;
    }

    /**
     * @param  array<string, mixed>  $data
     */
    public function addEntry(array $data): TaxEntry
    {
        $validator = Validator::make($data, [
            'store_id' => ['required', 'uuid', 'exists:stores,id'],
            'period' => ['required', 'regex:/^\d{4}-(0[1-9]|1[0-2])$/'],
            'type' => ['required', 'in:'.implode(',', array_keys(TaxEntry::TYPES))],
            'base_amount' => ['required', 'integer', 'min:0'],
            'rate_bp' => ['required', 'integer', 'min:0', 'max:10000'],
            'amount' => ['required', 'integer', 'min:0'],
            'status' => ['required', 'in:'.implode(',', TaxEntry::STATUSES)],
            'reference' => ['nullable', 'string', 'max:160'],
            'notes' => ['nullable', 'string', 'max:1000'],
        ], [
            'period.regex' => 'Periode harus berformat YYYY-MM.',
            'amount.min' => 'Nominal pajak tidak boleh negatif.',
        ]);

        $validator->validate();
        $this->locks->assertUnlocked((string) $data['period']);

        return DB::transaction(fn (): TaxEntry => TaxEntry::query()->create($data));
    }

    public function deleteEntry(TaxEntry $entry): void
    {
        DB::transaction(function () use ($entry): void {
            $entry->delete();
        });
    }

    /**
     * Menyimpan profil pajak baru. Profil lama ditutup sehari sebelum tanggal
     * efektif agar tidak ada dua tarif aktif pada tanggal yang sama.
     *
     * @param  array<string, mixed>  $data
     */
    public function saveProfile(Store $store, array $data): TaxProfile
    {
        $validator = Validator::make($data, [
            'pkp' => ['required', 'boolean'],
            'ppn_mode' => ['required', 'in:none,included,added'],
            'ppn_rate_bp' => ['required', 'integer', 'min:0', 'max:10000'],
            'pph_rate_bp' => ['required', 'integer', 'min:0', 'max:10000'],
            'pph_basis' => ['required', 'in:gross,net'],
            'effective_from' => ['required', 'date'],
            'effective_to' => ['nullable', 'date', 'after_or_equal:effective_from'],
            'notes' => ['nullable', 'string', 'max:255'],
        ], [
            'ppn_rate_bp.max' => 'Tarif PPN maksimal 100%.',
            'pph_rate_bp.max' => 'Tarif PPh maksimal 100%.',
            'effective_to.after_or_equal' => 'Tanggal berakhir tidak boleh sebelum tanggal berlaku.',
        ]);

        $validator->validate();

        $effectiveFrom = CarbonImmutable::parse($data['effective_from'])->toDateString();

        return DB::transaction(function () use ($store, $data, $effectiveFrom): TaxProfile {
            $existing = $store->taxProfiles()
                ->whereDate('effective_from', $effectiveFrom)
                ->first();

            if ($existing) {
                $existing->fill([
                    'pkp' => (bool) $data['pkp'],
                    'ppn_mode' => $data['ppn_mode'],
                    'ppn_rate_bp' => (int) $data['ppn_rate_bp'],
                    'pph_rate_bp' => (int) $data['pph_rate_bp'],
                    'pph_basis' => $data['pph_basis'],
                    'effective_to' => $data['effective_to'] ?? null,
                ])->save();

                return $existing->refresh();
            }

            $previous = $store->taxProfiles()
                ->whereDate('effective_from', '<', $effectiveFrom)
                ->where(function ($query) use ($effectiveFrom): void {
                    $query->whereNull('effective_to')
                        ->orWhereDate('effective_to', '>=', $effectiveFrom);
                })
                ->orderByDesc('effective_from')
                ->first();

            if ($previous) {
                $previous->fill([
                    'effective_to' => CarbonImmutable::parse($effectiveFrom)->subDay()->toDateString(),
                ])->save();
            }

            return $store->taxProfiles()->create([
                'pkp' => (bool) $data['pkp'],
                'ppn_mode' => $data['ppn_mode'],
                'ppn_rate_bp' => (int) $data['ppn_rate_bp'],
                'pph_rate_bp' => (int) $data['pph_rate_bp'],
                'pph_basis' => $data['pph_basis'],
                'effective_from' => $effectiveFrom,
                'effective_to' => $data['effective_to'] ?? null,
            ]);
        });
    }

    public function deleteProfile(TaxProfile $profile): void
    {
        DB::transaction(function () use ($profile): void {
            $profile->delete();
        });
    }

    private function outputPpn(?TaxProfile $profile, int $netRevenue): int
    {
        if (! $profile || ! $profile->pkp || $profile->ppn_mode === TaxProfile::PPN_NONE) {
            return 0;
        }

        return $profile->ppn_mode === TaxProfile::PPN_INCLUDED
            ? FinancialCalculator::ppnIncluded($netRevenue, (int) $profile->ppn_rate_bp)
            : FinancialCalculator::ppnAdded($netRevenue, (int) $profile->ppn_rate_bp);
    }

    private function pphFinal(?TaxProfile $profile, int $gross, int $net): int
    {
        $rate = $profile?->pph_rate_bp ?? Setting::integer('pph_default_bp', 50);
        $basis = ($profile?->pph_basis ?? 'gross') === 'net' ? $net : $gross;

        return FinancialCalculator::pphFinal(max(0, $basis), (int) $rate);
    }
}
