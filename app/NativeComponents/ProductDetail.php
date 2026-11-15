<?php

namespace App\NativeComponents;

use App\Models\Order;
use App\Models\OrderItem;
use App\Models\Product;
use App\Native\Concerns\HandlesFeedback;
use App\Services\ProductService;
use App\Support\Money;
use Illuminate\Support\Facades\DB;
use Illuminate\View\View;
use Native\Mobile\Edge\Element;
use Native\Mobile\Edge\NativeComponent;

class ProductDetail extends NativeComponent
{
    use HandlesFeedback;

    public ?string $productId = null;

    public bool $showHppForm = false;

    public string $hppUnit = '';

    public string $hppEffectiveFrom = '';

    public string $hppNotes = '';

    public function mount(): void
    {
        $this->productId = $this->param('id');
        $this->hppEffectiveFrom = now()->toDateString();
    }

    public function render(): Element|View
    {
        $product = $this->product();

        $sales = null;
        $currentHpp = null;

        if ($product) {
            $currentHpp = $product->currentHpp();

            $sales = OrderItem::query()
                ->select([
                    DB::raw('COALESCE(SUM(order_items.qty), 0) as qty'),
                    DB::raw('COALESCE(SUM(order_items.qty * order_items.unit_price), 0) as revenue'),
                    DB::raw('COALESCE(SUM(order_items.qty * order_items.hpp_unit_snapshot), 0) as hpp'),
                ])
                ->join('orders', 'orders.id', '=', 'order_items.order_id')
                ->whereNull('orders.deleted_at')
                ->whereNull('order_items.deleted_at')
                ->whereIn('orders.status', Order::REALIZED_STATUSES)
                ->where('order_items.product_id', $product->id)
                ->first();
        }

        return view('native.product-detail', [
            'product' => $product,
            'costs' => $product?->costs ?? collect(),
            'currentHpp' => $currentHpp,
            'sales' => $sales,
            'showHppForm' => $this->showHppForm,
            'rupiah' => fn (int|float|null $value): string => Money::rupiah($value),
            'notice' => $this->notice,
            'error' => $this->error,
        ]);
    }

    public function edit(): void
    {
        if ($this->productId !== null) {
            $this->navigate('/products/'.$this->productId.'/edit');
        }
    }

    public function toggleHppForm(): void
    {
        $this->showHppForm = ! $this->showHppForm;
        $this->clearFeedback();
    }

    public function saveHpp(): void
    {
        $this->clearFeedback();
        $product = $this->product();

        if (! $product) {
            $this->error = 'Produk tidak ditemukan.';

            return;
        }

        try {
            app(ProductService::class)->setHpp($product, [
                'hpp_unit' => Money::parse($this->hppUnit),
                'effective_from' => $this->hppEffectiveFrom,
                'notes' => $this->hppNotes,
            ]);

            $this->hppUnit = '';
            $this->hppNotes = '';
            $this->showHppForm = false;
            $this->flashSuccess('HPP baru dicatat. Pesanan lama tetap memakai HPP snapshot-nya.');
        } catch (\Throwable $exception) {
            $this->captureFailure($exception, 'HPP gagal dicatat. Periksa nominal dan tanggal berlaku.');
        }
    }

    public function toggleActive(): void
    {
        $this->clearFeedback();
        $product = $this->product();

        if (! $product) {
            $this->error = 'Produk tidak ditemukan.';

            return;
        }

        try {
            $product->fill(['active' => ! $product->active])->save();
            $this->flashSuccess($product->active ? 'Produk diaktifkan kembali.' : 'Produk dinonaktifkan. Produk nonaktif tidak muncul saat membuat pesanan baru.');
        } catch (\Throwable $exception) {
            $this->captureFailure($exception, 'Status produk gagal diubah.');
        }
    }

    public function goProducts(): void
    {
        $this->navigate('/products');
    }

    private function product(): ?Product
    {
        if ($this->productId === null) {
            return null;
        }

        return Product::query()
            ->with(['store.marketplace', 'costs'])
            ->find($this->productId);
    }
}
