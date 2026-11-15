<?php

namespace App\NativeComponents;

use App\Models\AdCampaign;
use App\Models\AdvertisingExpense;
use App\Native\Concerns\HandlesFeedback;
use App\Support\Money;
use App\Support\Options;
use App\Support\Period;
use Illuminate\View\View;
use Native\Mobile\Edge\Element;
use Native\Mobile\Edge\NativeComponent;

class Ads extends NativeComponent
{
    use HandlesFeedback;

    public string $periodLabel = '';

    public string $storeFilterLabel = 'Semua Toko';

    public bool $showCampaignForm = false;

    public string $campaignStoreLabel = '';

    public string $campaignName = '';

    public string $campaignPlatformLabel = 'Shopee';

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
        $start = Period::start($period)->toDateString();
        $end = Period::end($period)->toDateString();

        $expenses = AdvertisingExpense::query()
            ->with(['store:id,name', 'campaign:id,name,platform,active'])
            ->whereBetween('spent_at', [$start, $end])
            ->when($storeId, fn ($query, string $value) => $query->where('store_id', $value))
            ->orderByDesc('spent_at')
            ->limit(200)
            ->get();

        $campaigns = AdCampaign::query()
            ->with('store:id,name')
            ->when($storeId, fn ($query, string $value) => $query->where('store_id', $value))
            ->orderBy('name')
            ->get();

        $campaignTotals = $expenses
            ->groupBy('ad_campaign_id')
            ->map(fn ($group): int => (int) $group->sum('amount'));

        return view('native.ads', [
            'expenses' => $expenses,
            'campaigns' => $campaigns,
            'campaignTotals' => $campaignTotals,
            'totalSpend' => (int) $expenses->sum('amount'),
            'totalAttributed' => (int) $expenses->sum('attributed_revenue'),
            'totalClicks' => (int) $expenses->sum('clicks'),
            'totalOrders' => (int) $expenses->sum('attributed_orders'),
            'platformOptions' => array_values(Options::AD_PLATFORMS),
            'monthOptions' => Options::monthOptions(),
            'storeFilterOptions' => Options::storeFilterValues(),
            'storeValues' => Options::storeValues(),
            'periodLabel' => $this->periodLabel,
            'storeFilterLabel' => $this->storeFilterLabel,
            'showCampaignForm' => $this->showCampaignForm,
            'confirmDeleteId' => $this->confirmDeleteId,
            'rupiah' => fn (int|float|null $value): string => Money::rupiah($value),
            'notice' => $this->notice,
            'error' => $this->error,
        ]);
    }

    public function create(): void
    {
        $this->navigate('/ads/create');
    }

    public function edit(string $id): void
    {
        $this->navigate('/ads/'.$id.'/edit');
    }

    public function toggleCampaignForm(): void
    {
        $this->showCampaignForm = ! $this->showCampaignForm;
        $this->confirmDeleteId = null;
        $this->clearFeedback();
    }

    public function addCampaign(): void
    {
        $this->clearFeedback();
        $storeId = Options::storeIdFromLabel($this->campaignStoreLabel);
        $name = trim($this->campaignName);

        if ($storeId === null) {
            $this->error = 'Pilih toko untuk kampanye iklan.';

            return;
        }

        if ($name === '') {
            $this->error = 'Nama kampanye wajib diisi.';

            return;
        }

        $platform = array_search($this->campaignPlatformLabel, Options::AD_PLATFORMS, true);

        try {
            AdCampaign::query()->create([
                'store_id' => $storeId,
                'name' => $name,
                'platform' => $platform === false ? 'shopee' : (string) $platform,
                'active' => true,
            ]);

            $this->campaignName = '';
            $this->showCampaignForm = false;
            $this->flashSuccess('Kampanye iklan ditambahkan.');
        } catch (\Throwable $exception) {
            $this->captureFailure($exception, 'Kampanye iklan gagal ditambahkan.');
        }
    }

    public function toggleCampaign(string $id): void
    {
        $this->clearFeedback();
        $campaign = AdCampaign::query()->find($id);

        if (! $campaign) {
            $this->error = 'Kampanye tidak ditemukan.';

            return;
        }

        try {
            $campaign->fill(['active' => ! $campaign->active])->save();
            $this->flashSuccess($campaign->active ? 'Kampanye diaktifkan.' : 'Kampanye dinonaktifkan. Biaya lama tetap tersimpan.');
        } catch (\Throwable $exception) {
            $this->captureFailure($exception, 'Status kampanye gagal diubah.');
        }
    }

    public function askDelete(string $id): void
    {
        $this->confirmDeleteId = $id;
        $this->showCampaignForm = false;
        $this->clearFeedback();
    }

    public function cancelDelete(): void
    {
        $this->confirmDeleteId = null;
        $this->clearFeedback();
    }

    public function deleteExpense(string $id): void
    {
        $this->clearFeedback();
        $expense = AdvertisingExpense::query()->find($id);

        if (! $expense) {
            $this->error = 'Biaya iklan tidak ditemukan.';

            return;
        }

        try {
            $expense->delete();
            $this->confirmDeleteId = null;
            $this->flashSuccess('Biaya iklan dihapus.');
        } catch (\Throwable $exception) {
            $this->captureFailure($exception, 'Biaya iklan gagal dihapus.');
        }
    }
}
