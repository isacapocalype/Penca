<?php

namespace App\NativeComponents;

use App\Models\Store;
use App\Models\TaxProfile;
use App\Native\Concerns\HandlesFeedback;
use App\Services\TaxService;
use App\Support\Options;
use Illuminate\View\View;
use Native\Mobile\Edge\Element;
use Native\Mobile\Edge\NativeComponent;

class TaxProfileForm extends NativeComponent
{
    use HandlesFeedback;

    public ?string $storeId = null;

    public bool $pkp = false;

    public string $ppnModeLabel = 'Tidak memungut PPN';

    public string $ppnRate = '11';

    public string $pphRate = '0,5';

    public string $pphBasisLabel = 'Omzet bruto';

    public string $effectiveFrom = '';

    public function mount(): void
    {
        $this->storeId = $this->param('store_id');
        $this->effectiveFrom = now()->toDateString();

        if ($this->storeId === null) {
            return;
        }

        $store = Store::query()->find($this->storeId);
        $profile = $store?->taxProfiles()->orderByDesc('effective_from')->first();

        if (! $profile) {
            return;
        }

        $this->pkp = (bool) $profile->pkp;
        $this->ppnModeLabel = Options::PPN_MODES[$profile->ppn_mode] ?? 'Tidak memungut PPN';
        $this->ppnRate = Options::basisPointsToPercent((int) $profile->ppn_rate_bp);
        $this->pphRate = Options::basisPointsToPercent((int) $profile->pph_rate_bp);
        $this->pphBasisLabel = Options::PPH_BASIS[$profile->pph_basis] ?? 'Omzet bruto';
    }

    public function render(): Element|View
    {
        $store = $this->storeId !== null
            ? Store::query()->with(['taxProfiles' => fn ($query) => $query->orderByDesc('effective_from')])->find($this->storeId)
            : null;

        return view('native.tax-profile-form', [
            'store' => $store,
            'profiles' => $store?->taxProfiles ?? collect(),
            'ppnModeOptions' => Options::ppnModes(),
            'pphBasisOptions' => Options::pphBasisOptions(),
            'notice' => $this->notice,
            'error' => $this->error,
        ]);
    }

    public function save(): void
    {
        $this->clearFeedback();

        if ($this->storeId === null) {
            $this->error = 'Toko tidak ditemukan.';

            return;
        }

        $store = Store::query()->find($this->storeId);

        if (! $store) {
            $this->error = 'Toko tidak ditemukan.';

            return;
        }

        try {
            app(TaxService::class)->saveProfile($store, [
                'pkp' => $this->pkp,
                'ppn_mode' => Options::ppnModeFromLabel($this->ppnModeLabel) ?? TaxProfile::PPN_NONE,
                'ppn_rate_bp' => Options::percentToBasisPoints($this->ppnRate),
                'pph_rate_bp' => Options::percentToBasisPoints($this->pphRate),
                'pph_basis' => Options::pphBasisFromLabel($this->pphBasisLabel) ?? 'gross',
                'effective_from' => $this->effectiveFrom,
                'effective_to' => null,
            ]);

            $this->flashSuccess('Profil pajak disimpan. Tarif berlaku sesuai tanggal efektif dan histori lama tetap utuh.');
        } catch (\Throwable $exception) {
            $this->captureFailure($exception, 'Profil pajak gagal disimpan.');
        }
    }

    public function goTaxes(): void
    {
        $this->navigate('/taxes');
    }
}
