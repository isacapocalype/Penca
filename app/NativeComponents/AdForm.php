<?php

namespace App\NativeComponents;

use App\Models\AdCampaign;
use App\Models\AdvertisingExpense;
use App\Models\Store;
use App\Native\Concerns\HandlesFeedback;
use App\Support\Money;
use App\Support\Options;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\ValidationException;
use Illuminate\View\View;
use Native\Mobile\Edge\Element;
use Native\Mobile\Edge\NativeComponent;

class AdForm extends NativeComponent
{
    use HandlesFeedback;

    public ?string $expenseId = null;

    public string $storeLabel = '';

    public string $campaignLabel = '';

    public string $spentAt = '';

    public string $amount = '';

    public string $clicks = '';

    public string $impressions = '';

    public string $attributedOrders = '';

    public string $attributedRevenue = '';

    public string $notes = '';

    public function mount(): void
    {
        $this->expenseId = $this->param('id');
        $this->spentAt = now()->toDateString();

        if ($this->expenseId !== null) {
            $expense = AdvertisingExpense::query()->with('campaign')->find($this->expenseId);

            if ($expense) {
                $store = Store::query()->with('marketplace:id,name')->find($expense->store_id);
                $this->storeLabel = $store ? Options::storeLabel($store) : '';
                $this->campaignLabel = $expense->campaign ? $this->labelForCampaignId($expense->ad_campaign_id) : '';
                $this->spentAt = $expense->spent_at?->toDateString() ?? now()->toDateString();
                $this->amount = (string) $expense->amount;
                $this->clicks = $expense->clicks !== null ? (string) $expense->clicks : '';
                $this->impressions = $expense->impressions !== null ? (string) $expense->impressions : '';
                $this->attributedOrders = $expense->attributed_orders !== null ? (string) $expense->attributed_orders : '';
                $this->attributedRevenue = $expense->attributed_revenue !== null ? (string) $expense->attributed_revenue : '';
                $this->notes = (string) ($expense->notes ?? '');
            }

            return;
        }

        $stores = Store::query()->active()->orderBy('name')->get();

        if ($stores->count() === 1) {
            $this->storeLabel = Options::storeLabel($stores->first());
        } else {
            $storeId = $this->query('store_id');

            if (is_string($storeId) && $storeId !== '') {
                $label = array_search($storeId, Options::stores(), true);
                $this->storeLabel = $label === false ? '' : (string) $label;
            }
        }
    }

    public function render(): Element|View
    {
        $campaigns = $this->campaignMap();

        return view('native.ad-form', [
            'editing' => $this->expenseId !== null,
            'storeOptions' => Options::storeValues(),
            'campaignOptions' => array_keys($campaigns),
            'notice' => $this->notice,
            'error' => $this->error,
        ]);
    }

    public function updatedStoreLabel(): void
    {
        $this->campaignLabel = '';
    }

    public function save(): void
    {
        $this->clearFeedback();
        $storeId = Options::storeIdFromLabel($this->storeLabel);
        $campaign = $this->campaignMap()[$this->campaignLabel] ?? null;

        $data = [
            'store_id' => $storeId,
            'ad_campaign_id' => $campaign?->id,
            'spent_at' => $this->spentAt,
            'amount' => Money::parse($this->amount),
            'clicks' => trim($this->clicks) !== '' ? Money::parse($this->clicks) : null,
            'impressions' => trim($this->impressions) !== '' ? Money::parse($this->impressions) : null,
            'attributed_orders' => trim($this->attributedOrders) !== '' ? Money::parse($this->attributedOrders) : null,
            'attributed_revenue' => trim($this->attributedRevenue) !== '' ? Money::parse($this->attributedRevenue) : null,
            'notes' => trim($this->notes) !== '' ? trim($this->notes) : null,
        ];

        $validator = Validator::make($data, [
            'store_id' => ['required', 'uuid', 'exists:stores,id'],
            'ad_campaign_id' => ['nullable', 'uuid', 'exists:ad_campaigns,id'],
            'spent_at' => ['required', 'date'],
            'amount' => ['required', 'integer', 'min:1'],
            'clicks' => ['nullable', 'integer', 'min:0'],
            'impressions' => ['nullable', 'integer', 'min:0'],
            'attributed_orders' => ['nullable', 'integer', 'min:0'],
            'attributed_revenue' => ['nullable', 'integer', 'min:0'],
            'notes' => ['nullable', 'string', 'max:1000'],
        ], [
            'store_id.required' => 'Pilih toko terlebih dahulu.',
            'amount.min' => 'Nominal belanja iklan harus lebih dari nol.',
        ]);

        if ($validator->fails()) {
            $this->captureFailure(new ValidationException($validator));

            return;
        }

        try {
            if ($this->expenseId !== null) {
                $expense = AdvertisingExpense::query()->find($this->expenseId);

                if (! $expense) {
                    throw new \RuntimeException('Biaya iklan tidak ditemukan.');
                }

                $expense->fill($data)->save();
            } else {
                AdvertisingExpense::query()->create($data);
            }

            $this->replace('/ads');
        } catch (\Throwable $exception) {
            $this->captureFailure($exception, 'Biaya iklan gagal disimpan.');
        }
    }

    /** @return Collection<int, AdCampaign> */
    private function campaigns(): Collection
    {
        $storeId = Options::storeIdFromLabel($this->storeLabel);

        if ($storeId === null) {
            return collect();
        }

        return AdCampaign::query()
            ->where('store_id', $storeId)
            ->orderBy('name')
            ->get();
    }

    private function campaignLabelFor(AdCampaign $campaign): string
    {
        return $campaign->name.' · '.(Options::AD_PLATFORMS[$campaign->platform] ?? ucfirst($campaign->platform));
    }

    /** @return array<string, AdCampaign> */
    private function campaignMap(): array
    {
        $map = [];
        $used = [];

        foreach ($this->campaigns() as $campaign) {
            $base = $this->campaignLabelFor($campaign);
            $label = $base;
            $suffix = 2;

            while (in_array($label, $used, true)) {
                $label = $base.' ('.$suffix.')';
                $suffix++;
            }

            $used[] = $label;
            $map[$label] = $campaign;
        }

        return $map;
    }

    private function labelForCampaignId(?string $id): string
    {
        foreach ($this->campaignMap() as $label => $campaign) {
            if ((string) $campaign->id === (string) $id) {
                return $label;
            }
        }

        return '';
    }
}
