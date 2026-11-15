<?php

namespace App\Data;

final class TaxRecap
{
    /**
     * @param  array<int, array<string, mixed>>  $stores
     * @param  array<int, array<string, mixed>>  $entries
     */
    public function __construct(
        public readonly string $period,
        public readonly string $periodLabel,
        public readonly ?string $storeId,
        public readonly int $grossRevenue = 0,
        public readonly int $netRevenue = 0,
        public readonly int $ppnOutput = 0,
        public readonly int $ppnInput = 0,
        public readonly int $ppnPayable = 0,
        public readonly int $pphFinal = 0,
        public readonly array $stores = [],
        public readonly array $entries = [],
    ) {}

    public function hasData(): bool
    {
        return $this->grossRevenue > 0 || $this->ppnInput > 0 || $this->entries !== [];
    }
}
