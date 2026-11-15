<?php

namespace App\NativeComponents;

use App\Models\Store;
use App\Models\TaxEntry;
use App\Native\Concerns\HandlesFeedback;
use App\Services\TaxService;
use App\Support\Money;
use App\Support\Options;
use App\Support\Period;
use Illuminate\View\View;
use Native\Mobile\Edge\Element;
use Native\Mobile\Edge\NativeComponent;

class Taxes extends NativeComponent
{
    use HandlesFeedback;

    public string $periodLabel = '';

    public string $storeFilterLabel = 'Semua Toko';

    public bool $showEntryForm = false;

    public string $entryStoreLabel = '';

    public string $entryTypeLabel = 'PPN Masukan';

    public string $entryBase = '';

    public string $entryRate = '';

    public string $entryAmount = '';

    public string $entryStatusLabel = 'Draft';

    public string $entryReference = '';

    public string $entryNotes = '';

    public ?string $confirmDeleteId = null;

    public function mount(): void
    {
        $this->periodLabel = Options::monthLabel(now()->format('Y-m'));

        $storeId = $this->query('store_id');

        if (is_string($storeId) && $storeId !== '') {
            $label = array_search($storeId, Options::stores(), true);
            $this->storeFilterLabel = $label === false ? 'Semua Toko' : (string) $label;
        }
    }

    public function render(): Element|View
    {
        $period = Options::periodFromMonthLabel($this->periodLabel);
        $storeId = Options::storeFilterId($this->storeFilterLabel);
        $recap = app(TaxService::class)->recap($period, $storeId);
        $stores = Store::query()->active()->with('taxProfiles')->orderBy('name')->get();

        return view('native.taxes', [
            'recap' => $recap,
            'stores' => $stores,
            'monthOptions' => Options::monthOptions(),
            'storeFilterOptions' => Options::storeFilterValues(),
            'storeValues' => Options::storeValues(),
            'typeOptions' => Options::taxTypes(),
            'statusOptions' => Options::taxStatuses(),
            'periodLabel' => $this->periodLabel,
            'storeFilterLabel' => $this->storeFilterLabel,
            'showEntryForm' => $this->showEntryForm,
            'confirmDeleteId' => $this->confirmDeleteId,
            'rupiah' => fn (int|float|null $value): string => Money::rupiah($value),
            'percent' => fn (int $bp): string => Options::basisPointsToPercent($bp).'%',
            'notice' => $this->notice,
            'error' => $this->error,
        ]);
    }

    public function generate(): void
    {
        $this->clearFeedback();
        $period = Options::periodFromMonthLabel($this->periodLabel);

        try {
            $written = app(TaxService::class)->generate($period, Options::storeFilterId($this->storeFilterLabel));

            $this->flashSuccess($written === 0
                ? 'Tidak ada entri baru. Nilai pajak nol atau periode belum punya transaksi.'
                : $written.' entri pajak dihitung ulang dari pesanan pada '.Period::label($period).'.');
        } catch (\Throwable $exception) {
            $this->captureFailure($exception, 'Rekap pajak gagal dibuat.');
        }
    }

    public function toggleEntryForm(): void
    {
        $this->showEntryForm = ! $this->showEntryForm;
        $this->confirmDeleteId = null;
        $this->clearFeedback();
    }

    public function addEntry(): void
    {
        $this->clearFeedback();
        $storeId = Options::storeIdFromLabel($this->entryStoreLabel);
        $type = Options::taxTypeFromLabel($this->entryTypeLabel);
        $period = Options::periodFromMonthLabel($this->periodLabel);
        $rateBp = Options::percentToBasisPoints($this->entryRate);
        $base = Money::parse($this->entryBase);
        $amount = Money::parse($this->entryAmount);

        if ($amount === 0 && $base > 0 && $rateBp > 0) {
            $amount = Money::divideHalfUp($base * $rateBp, 10000);
        }

        try {
            app(TaxService::class)->addEntry([
                'store_id' => $storeId,
                'period' => $period,
                'type' => $type,
                'base_amount' => $base,
                'rate_bp' => $rateBp,
                'amount' => $amount,
                'status' => Options::taxStatusFromLabel($this->entryStatusLabel) ?? 'draft',
                'reference' => trim($this->entryReference) !== '' ? trim($this->entryReference) : null,
                'notes' => trim($this->entryNotes) !== '' ? trim($this->entryNotes) : null,
            ]);

            $this->entryBase = '';
            $this->entryRate = '';
            $this->entryAmount = '';
            $this->entryReference = '';
            $this->entryNotes = '';
            $this->showEntryForm = false;
            $this->flashSuccess('Entri pajak manual ditambahkan.');
        } catch (\Throwable $exception) {
            $this->captureFailure($exception, 'Entri pajak gagal ditambahkan.');
        }
    }

    public function markStatus(string $id, string $status): void
    {
        $this->clearFeedback();

        if (! in_array($status, TaxEntry::STATUSES, true)) {
            $this->error = 'Status pajak tidak dikenal.';

            return;
        }

        $entry = TaxEntry::query()->find($id);

        if (! $entry) {
            $this->error = 'Entri pajak tidak ditemukan.';

            return;
        }

        try {
            $entry->fill(['status' => $status])->save();
            $this->flashSuccess('Status entri diubah menjadi '.(Options::TAX_STATUSES[$status] ?? $status).'.');
        } catch (\Throwable $exception) {
            $this->captureFailure($exception, 'Status entri pajak gagal diubah.');
        }
    }

    public function askDelete(string $id): void
    {
        $this->confirmDeleteId = $id;
        $this->showEntryForm = false;
        $this->clearFeedback();
    }

    public function cancelDelete(): void
    {
        $this->confirmDeleteId = null;
        $this->clearFeedback();
    }

    public function deleteEntry(string $id): void
    {
        $this->clearFeedback();
        $entry = TaxEntry::query()->find($id);

        if (! $entry) {
            $this->error = 'Entri pajak tidak ditemukan.';

            return;
        }

        try {
            app(TaxService::class)->deleteEntry($entry);
            $this->confirmDeleteId = null;
            $this->flashSuccess('Entri pajak dihapus.');
        } catch (\Throwable $exception) {
            $this->captureFailure($exception, 'Entri pajak gagal dihapus.');
        }
    }

    public function openProfile(string $storeId): void
    {
        $this->navigate('/taxes/profile/'.$storeId);
    }
}
