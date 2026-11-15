<?php

namespace App\Native\Concerns;

use App\Support\Options;

/**
 * Filter periode dan toko yang dipakai Dashboard dan Laporan. Nilai select
 * native berupa label, jadi seluruh konversi ke ID/periode terjadi di sini.
 */
trait FiltersDashboardRange
{
    public string $periodLabel = 'Bulan ini';

    public string $storeLabel = 'Semua Toko';

    public string $customStart = '';

    public string $customEnd = '';

    public function updatedPeriodLabel(): void
    {
        if ($this->periodKey() !== 'custom') {
            $this->customStart = '';
            $this->customEnd = '';
        }
    }

    public function updatedStoreLabel(): void
    {
        // Re-render mengikuti pilihan toko.
    }

    protected function periodKey(): string
    {
        return Options::periodKeyFromLabel($this->periodLabel);
    }

    /** @return array{0: string, 1: string} */
    protected function range(): array
    {
        return Options::dateRange($this->periodKey(), $this->customStart, $this->customEnd);
    }

    protected function selectedStoreId(): ?string
    {
        return Options::storeFilterId($this->storeLabel);
    }

    protected function selectedStoreName(): string
    {
        if ($this->selectedStoreId() === null) {
            return 'Semua Toko';
        }

        return $this->storeLabel;
    }

    protected function isCustomRange(): bool
    {
        return $this->periodKey() === 'custom';
    }

    /** @return array<int, string> */
    protected function periodOptions(): array
    {
        return Options::periodOptions();
    }

    /** @return array<int, string> */
    protected function storeFilterOptions(): array
    {
        return Options::storeFilterValues();
    }
}
