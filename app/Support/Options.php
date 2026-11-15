<?php

namespace App\Support;

use App\Models\Marketplace;
use App\Models\MarketplaceFeeCategory;
use App\Models\OperationalExpense;
use App\Models\Order;
use App\Models\Store;
use App\Models\TaxEntry;
use App\Models\TaxProfile;
use Carbon\CarbonImmutable;

/**
 * Opsi label untuk kontrol native. Select native hanya mengirim label yang
 * terlihat, jadi label harus unik dan dapat dipetakan kembali ke ID secara
 * deterministik.
 */
final class Options
{
    public const PERIODS = [
        'today' => 'Hari ini',
        'yesterday' => 'Kemarin',
        '7d' => '7 hari terakhir',
        '30d' => '30 hari terakhir',
        'this_month' => 'Bulan ini',
        'last_month' => 'Bulan lalu',
        'custom' => 'Rentang khusus',
    ];

    public const PPN_MODES = [
        TaxProfile::PPN_NONE => 'Tidak memungut PPN',
        TaxProfile::PPN_INCLUDED => 'PPN termasuk harga',
        TaxProfile::PPN_ADDED => 'PPN ditambah di atas harga',
    ];

    public const PPH_BASIS = [
        'gross' => 'Omzet bruto',
        'net' => 'Pendapatan neto',
    ];

    public const TAX_STATUSES = [
        'draft' => 'Draft',
        'reported' => 'Dilaporkan',
        'paid' => 'Dibayar',
    ];

    public const AD_PLATFORMS = [
        'shopee' => 'Shopee',
        'tiktok' => 'TikTok Shop',
    ];

    public const FEE_BASES = [
        'gross' => 'Omzet bruto',
        'net' => 'Pendapatan neto',
        'hpp' => 'HPP',
        'fixed' => 'Nominal tetap',
    ];

    public const FEE_BORNE = [
        'seller' => 'Ditanggung penjual',
        'marketplace' => 'Ditanggung marketplace',
    ];

    public const STORE_STATUSES = [
        'active' => 'Aktif',
        'inactive' => 'Nonaktif',
        'archived' => 'Diarsipkan',
    ];

    /** @return array<string, string> */
    public static function stores(): array
    {
        return Store::query()
            ->with('marketplace:id,name')
            ->active()
            ->orderBy('name')
            ->get()
            ->mapWithKeys(fn (Store $store): array => [$store->id => self::storeLabel($store)])
            ->all();
    }

    public static function storeLabel(Store $store): string
    {
        $marketplace = $store->marketplace?->name ?? 'Marketplace';

        return trim($store->name.' · '.$marketplace.' ('.$store->code.')');
    }

    public static function storeIdFromLabel(?string $label): ?string
    {
        if ($label === null || $label === '') {
            return null;
        }

        $id = array_search($label, self::stores(), true);

        return $id === false ? null : (string) $id;
    }

    /** @return array<int, string> */
    public static function storeValues(): array
    {
        return array_values(self::stores());
    }

    /** @return array<int, string> */
    public static function storeFilterValues(): array
    {
        return ['Semua Toko', ...self::storeValues()];
    }

    public static function storeFilterId(?string $label): ?string
    {
        return $label === null || $label === 'Semua Toko' ? null : self::storeIdFromLabel($label);
    }

    /** @return array<int, string> */
    public static function marketplaces(): array
    {
        return Marketplace::query()
            ->where('active', true)
            ->orderBy('name')
            ->pluck('name')
            ->all();
    }

    public static function marketplaceIdFromLabel(?string $label): ?string
    {
        if ($label === null || $label === '') {
            return null;
        }

        return Marketplace::query()->where('name', $label)->value('id');
    }

    /** @return array<int, string> */
    public static function statuses(): array
    {
        return array_values(Order::STATUS_LABELS);
    }

    public static function statusFromLabel(?string $label): ?string
    {
        $status = array_search($label, Order::STATUS_LABELS, true);

        return $status === false ? null : (string) $status;
    }

    /** @return array<int, string> */
    public static function orderFilterStatuses(): array
    {
        return ['Semua status', ...self::statuses()];
    }

    public static function orderFilterStatus(?string $label): ?string
    {
        return $label === null || $label === 'Semua status' ? null : self::statusFromLabel($label);
    }

    /** @return array<int, string> */
    public static function operationalCategories(): array
    {
        return array_values(OperationalExpense::CATEGORIES);
    }

    public static function operationalCategoryFromLabel(?string $label): ?string
    {
        $category = array_search($label, OperationalExpense::CATEGORIES, true);

        return $category === false ? null : (string) $category;
    }

    /** @return array<int, string> */
    public static function taxTypes(): array
    {
        return array_values(TaxEntry::TYPES);
    }

    public static function taxTypeFromLabel(?string $label): ?string
    {
        $type = array_search($label, TaxEntry::TYPES, true);

        return $type === false ? null : (string) $type;
    }

    /** @return array<int, string> */
    public static function taxStatuses(): array
    {
        return array_values(self::TAX_STATUSES);
    }

    public static function taxStatusFromLabel(?string $label): ?string
    {
        $status = array_search($label, self::TAX_STATUSES, true);

        return $status === false ? null : (string) $status;
    }

    /** @return array<int, string> */
    public static function ppnModes(): array
    {
        return array_values(self::PPN_MODES);
    }

    public static function ppnModeFromLabel(?string $label): ?string
    {
        $mode = array_search($label, self::PPN_MODES, true);

        return $mode === false ? null : (string) $mode;
    }

    /** @return array<int, string> */
    public static function pphBasisOptions(): array
    {
        return array_values(self::PPH_BASIS);
    }

    public static function pphBasisFromLabel(?string $label): ?string
    {
        $basis = array_search($label, self::PPH_BASIS, true);

        return $basis === false ? null : (string) $basis;
    }

    /** @return array<int, string> */
    public static function periodOptions(): array
    {
        return array_values(self::PERIODS);
    }

    public static function periodKeyFromLabel(?string $label): string
    {
        $key = array_search($label, self::PERIODS, true);

        return $key === false ? 'this_month' : (string) $key;
    }

    /**
     * @return array{0: string, 1: string}
     */
    public static function dateRange(string $key, ?string $customStart = null, ?string $customEnd = null): array
    {
        $today = CarbonImmutable::today();

        return match ($key) {
            'today' => [$today->toDateString(), $today->toDateString()],
            'yesterday' => [$today->subDay()->toDateString(), $today->subDay()->toDateString()],
            '7d' => [$today->subDays(6)->toDateString(), $today->toDateString()],
            '30d' => [$today->subDays(29)->toDateString(), $today->toDateString()],
            'last_month' => [
                $today->subMonthNoOverflow()->startOfMonth()->toDateString(),
                $today->subMonthNoOverflow()->endOfMonth()->toDateString(),
            ],
            'custom' => self::safeCustomRange($customStart, $customEnd, $today),
            default => [$today->startOfMonth()->toDateString(), $today->endOfMonth()->toDateString()],
        };
    }

    /**
     * @return array{0: string, 1: string}
     */
    private static function safeCustomRange(?string $start, ?string $end, CarbonImmutable $fallback): array
    {
        try {
            $startDate = $start ? CarbonImmutable::parse($start) : $fallback->startOfMonth();
            $endDate = $end ? CarbonImmutable::parse($end) : $fallback->endOfMonth();
        } catch (\Throwable) {
            return [$fallback->startOfMonth()->toDateString(), $fallback->endOfMonth()->toDateString()];
        }

        if ($endDate->lt($startDate)) {
            [$startDate, $endDate] = [$endDate, $startDate];
        }

        return [$startDate->toDateString(), $endDate->toDateString()];
    }

    public static function periodFromDate(?string $date): string
    {
        try {
            return CarbonImmutable::parse((string) $date)->format('Y-m');
        } catch (\Throwable) {
            return CarbonImmutable::today()->format('Y-m');
        }
    }

    /** @return array<string, string> label => period */
    public static function months(int $back = 18): array
    {
        $months = [];
        $cursor = CarbonImmutable::today()->startOfMonth();

        for ($i = 0; $i < $back; $i++) {
            $period = $cursor->format('Y-m');
            $months[Period::label($period)] = $period;
            $cursor = $cursor->subMonthNoOverflow();
        }

        return $months;
    }

    /** @return array<int, string> */
    public static function monthOptions(int $back = 18): array
    {
        return array_keys(self::months($back));
    }

    public static function periodFromMonthLabel(?string $label): string
    {
        return self::months()[$label ?? ''] ?? CarbonImmutable::today()->format('Y-m');
    }

    public static function monthLabel(?string $period): string
    {
        if ($period === null || preg_match('/^\d{4}-\d{2}$/', $period) !== 1) {
            return '—';
        }

        return Period::label($period);
    }

    /** @return array<string, string> label => id */
    public static function feeCategories(): array
    {
        return MarketplaceFeeCategory::query()
            ->where('active', true)
            ->orderBy('id')
            ->get()
            ->sortBy('name')
            ->mapWithKeys(fn (MarketplaceFeeCategory $category): array => [$category->name => $category->id])
            ->all();
    }

    /** @return array<int, string> */
    public static function feeCategoryValues(): array
    {
        return array_keys(self::feeCategories());
    }

    public static function feeCategoryIdFromLabel(?string $label): ?string
    {
        if ($label === null || $label === '') {
            return null;
        }

        return self::feeCategories()[$label] ?? null;
    }

    /** @return array<int, string> */
    public static function feeBases(): array
    {
        return array_values(self::FEE_BASES);
    }

    public static function feeBasisFromLabel(?string $label): ?string
    {
        $basis = array_search($label, self::FEE_BASES, true);

        return $basis === false ? null : (string) $basis;
    }

    /** @return array<int, string> */
    public static function feeBorneValues(): array
    {
        return array_values(self::FEE_BORNE);
    }

    public static function feeBorneFromLabel(?string $label): string
    {
        $key = array_search($label, self::FEE_BORNE, true);

        return $key === false ? 'seller' : (string) $key;
    }

    /** @return array<int, string> */
    public static function storeStatuses(): array
    {
        return array_values(self::STORE_STATUSES);
    }

    public static function storeStatusFromLabel(?string $label): string
    {
        $status = array_search($label, self::STORE_STATUSES, true);

        return $status === false ? 'active' : (string) $status;
    }

    public static function storeStatusLabel(string $status): string
    {
        return self::STORE_STATUSES[$status] ?? ucfirst($status);
    }

    public static function dateLabel(?string $date): string
    {
        if (! $date) {
            return '—';
        }

        try {
            return CarbonImmutable::parse($date)->translatedFormat('d M Y');
        } catch (\Throwable) {
            return $date;
        }
    }

    public static function dateTimeLabel(?string $date): string
    {
        if (! $date) {
            return '—';
        }

        try {
            return CarbonImmutable::parse($date)->translatedFormat('d M Y H:i');
        } catch (\Throwable) {
            return $date;
        }
    }

    public static function percentToBasisPoints(string $value): int
    {
        $clean = trim(str_replace(['%', ' '], '', $value));
        $clean = str_replace(',', '.', $clean);

        if ($clean === '' || ! is_numeric($clean)) {
            return 0;
        }

        return (int) round(((float) $clean) * 100);
    }

    public static function basisPointsToPercent(int $basisPoints): string
    {
        $value = number_format($basisPoints / 100, 2, ',', '.');

        return rtrim(rtrim($value, '0'), ',');
    }
}
