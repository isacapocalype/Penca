<?php

namespace App\NativeComponents;

use App\Models\Order;
use App\Models\Product;
use App\Models\Store;
use App\Native\Concerns\HandlesFeedback;
use App\Services\FinancialSummaryService;
use App\Support\Money;
use Carbon\CarbonImmutable;
use Illuminate\View\View;
use Native\Mobile\Edge\Element;
use Native\Mobile\Edge\NativeComponent;

class StoreDetail extends NativeComponent
{
    use HandlesFeedback;

    public ?string $storeId = null;

    public bool $confirmArchive = false;

    public function mount(): void
    {
        $this->storeId = $this->param('id');
    }

    public function render(): Element|View
    {
        $store = $this->store();
        $lifetime = null;
        $products = collect();
        $profile = null;

        if ($store) {
            $firstOrder = Order::query()->where('store_id', $store->id)->min('ordered_at');
            $start = $firstOrder ? CarbonImmutable::parse($firstOrder)->toDateString() : now()->startOfMonth()->toDateString();
            $end = now()->toDateString();

            if ($start > $end) {
                $start = $end;
            }

            $lifetime = app(FinancialSummaryService::class)->forRange($start, $end, $store->id);
            $products = Product::query()
                ->where('store_id', $store->id)
                ->with('costs')
                ->orderBy('name')
                ->limit(6)
                ->get();
            $profile = $store->taxProfileOn(now()->toDateString());
        }

        return view('native.store-detail', [
            'store' => $store,
            'lifetime' => $lifetime,
            'products' => $products,
            'profile' => $profile,
            'confirmArchive' => $this->confirmArchive,
            'rupiah' => fn (int|float|null $value): string => Money::rupiah($value),
            'notice' => $this->notice,
            'error' => $this->error,
        ]);
    }

    public function edit(): void
    {
        if ($this->storeId !== null) {
            $this->navigate('/stores/'.$this->storeId.'/edit');
        }
    }

    public function openProducts(): void
    {
        if ($this->storeId !== null) {
            $this->navigate('/products?store_id='.$this->storeId);
        }
    }

    public function openOrders(): void
    {
        if ($this->storeId !== null) {
            $this->navigate('/orders?store_id='.$this->storeId);
        }
    }

    public function openTaxes(): void
    {
        if ($this->storeId !== null) {
            $this->navigate('/taxes?store_id='.$this->storeId);
        }
    }

    public function toggleArchive(): void
    {
        $this->confirmArchive = ! $this->confirmArchive;
        $this->clearFeedback();
    }

    public function toggleStatus(): void
    {
        $this->clearFeedback();
        $store = $this->store();

        if (! $store) {
            $this->error = 'Toko tidak ditemukan.';

            return;
        }

        try {
            $newStatus = $store->status === Store::STATUS_ARCHIVED ? Store::STATUS_ACTIVE : Store::STATUS_ARCHIVED;
            $store->fill(['status' => $newStatus])->save();
            $this->confirmArchive = false;
            $this->flashSuccess($newStatus === Store::STATUS_ARCHIVED
                ? 'Toko diarsipkan. Data historis tetap tersimpan.'
                : 'Toko diaktifkan kembali.');
        } catch (\Throwable $exception) {
            $this->captureFailure($exception, 'Status toko gagal diubah.');
        }
    }

    public function goStores(): void
    {
        $this->navigate('/stores');
    }

    private function store(): ?Store
    {
        if ($this->storeId === null) {
            return null;
        }

        return Store::query()
            ->with('marketplace:id,name')
            ->withCount(['orders', 'products'])
            ->find($this->storeId);
    }
}
