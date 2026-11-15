<?php

namespace App\Data;

use Carbon\CarbonImmutable;

final class FinancialSummary
{
    /**
     * @param  array<int, array<string, mixed>>  $daily
     * @param  array<int, array<string, mixed>>  $stores
     */
    public function __construct(
        public readonly string $start,
        public readonly string $end,
        public readonly ?string $storeId,
        public readonly string $storeName,
        public readonly int $grossRevenue = 0,
        public readonly int $sellerDiscount = 0,
        public readonly int $refunds = 0,
        public readonly int $netRevenue = 0,
        public readonly int $hpp = 0,
        public readonly int $grossProfit = 0,
        public readonly int $marketplaceFees = 0,
        public readonly int $advertising = 0,
        public readonly int $operational = 0,
        public readonly int $operatingProfit = 0,
        public readonly int $pphFinal = 0,
        public readonly int $netProfit = 0,
        public readonly int $marginBp = 0,
        public readonly int $ppnOutput = 0,
        public readonly int $ppnInput = 0,
        public readonly int $ppnPayable = 0,
        public readonly int $orderCount = 0,
        public readonly int $itemsSold = 0,
        public readonly int $settlementTotal = 0,
        public readonly array $daily = [],
        public readonly array $stores = [],
    ) {}

    public function periodLabel(): string
    {
        return $this->start === $this->end
            ? CarbonImmutable::parse($this->start)->translatedFormat('d F Y')
            : CarbonImmutable::parse($this->start)->translatedFormat('d M Y').' – '.CarbonImmutable::parse($this->end)->translatedFormat('d M Y');
    }

    public function hasSales(): bool
    {
        return $this->orderCount > 0;
    }

    /** @return array<string, mixed> */
    public function toArray(): array
    {
        return get_object_vars($this);
    }
}
