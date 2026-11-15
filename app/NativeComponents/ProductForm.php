<?php

namespace App\NativeComponents;

use App\Models\Product;
use App\Models\Store;
use App\Native\Concerns\HandlesFeedback;
use App\Services\ProductService;
use App\Support\Money;
use App\Support\Options;
use Illuminate\Support\Facades\DB;
use Illuminate\View\View;
use Native\Mobile\Edge\Element;
use Native\Mobile\Edge\NativeComponent;

class ProductForm extends NativeComponent
{
    use HandlesFeedback;

    public ?string $productId = null;

    public string $storeLabel = '';

    public string $sku = '';

    public string $name = '';

    public string $sellingPrice = '0';

    public bool $active = true;

    public string $notes = '';

    public string $initialHpp = '';

    public string $hppEffectiveFrom = '';

    public function mount(): void
    {
        $this->productId = $this->param('id');
        $this->hppEffectiveFrom = now()->toDateString();

        if ($this->productId !== null) {
            $product = Product::query()->with('store.marketplace')->find($this->productId);

            if ($product) {
                $this->storeLabel = Options::storeLabel($product->store);
                $this->sku = $product->sku;
                $this->name = $product->name;
                $this->sellingPrice = (string) $product->selling_price;
                $this->active = (bool) $product->active;
                $this->notes = (string) ($product->notes ?? '');
            }

            return;
        }

        $storeId = $this->query('store_id');

        if (is_string($storeId) && $storeId !== '') {
            $label = array_search($storeId, Options::stores(), true);
            $this->storeLabel = $label === false ? '' : (string) $label;

            return;
        }

        $stores = Store::query()->active()->orderBy('name')->get();

        if ($stores->count() === 1) {
            $this->storeLabel = Options::storeLabel($stores->first());
        }
    }

    public function render(): Element|View
    {
        return view('native.product-form', [
            'editing' => $this->productId !== null,
            'storeOptions' => Options::storeValues(),
            'notice' => $this->notice,
            'error' => $this->error,
        ]);
    }

    public function save(): void
    {
        $this->clearFeedback();
        $storeId = $this->productId !== null
            ? Product::query()->whereKey($this->productId)->value('store_id')
            : Options::storeIdFromLabel($this->storeLabel);

        if ($storeId === null) {
            $this->error = 'Pilih toko terlebih dahulu.';

            return;
        }

        try {
            $product = DB::transaction(function () use ($storeId) {
                $product = app(ProductService::class)->save(
                    $this->productId !== null ? Product::query()->find($this->productId) : null,
                    [
                        'store_id' => $storeId,
                        'sku' => $this->sku,
                        'name' => $this->name,
                        'selling_price' => Money::parse($this->sellingPrice),
                        'active' => $this->active,
                        'notes' => $this->notes,
                    ],
                );

                if ($this->productId === null && trim($this->initialHpp) !== '') {
                    app(ProductService::class)->setHpp($product, [
                        'hpp_unit' => Money::parse($this->initialHpp),
                        'effective_from' => $this->hppEffectiveFrom !== '' ? $this->hppEffectiveFrom : now()->toDateString(),
                        'notes' => 'HPP awal saat produk dibuat.',
                    ]);
                }

                return $product;
            });

            $this->replace('/products/'.$product->id);
        } catch (\Throwable $exception) {
            $this->captureFailure($exception, 'Produk gagal disimpan. Periksa SKU dan data lalu coba lagi.');
        }
    }
}
