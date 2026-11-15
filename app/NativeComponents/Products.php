<?php

namespace App\NativeComponents;

use App\Models\Product;
use App\Native\Concerns\HandlesFeedback;
use App\Support\Money;
use App\Support\Options;
use Carbon\CarbonImmutable;
use Illuminate\View\View;
use Native\Mobile\Edge\Element;
use Native\Mobile\Edge\NativeComponent;

class Products extends NativeComponent
{
    use HandlesFeedback;

    public string $search = '';

    public string $storeFilterLabel = 'Semua Toko';

    public string $statusFilterLabel = 'Semua status';

    public function mount(): void
    {
        $storeId = $this->query('store_id');

        if (is_string($storeId) && $storeId !== '') {
            $label = array_search($storeId, Options::stores(), true);
            $this->storeFilterLabel = $label === false ? 'Semua Toko' : (string) $label;
        }
    }

    public function render(): Element|View
    {
        $search = trim($this->search);
        $storeId = Options::storeFilterId($this->storeFilterLabel);
        $active = match ($this->statusFilterLabel) {
            'Aktif' => true,
            'Nonaktif' => false,
            default => null,
        };
        $today = CarbonImmutable::today()->toDateString();

        $products = Product::query()
            ->with(['store:id,name', 'costs'])
            ->when($storeId, fn ($query, string $value) => $query->where('store_id', $value))
            ->when($active !== null, fn ($query) => $query->where('active', $active))
            ->when($search !== '', function ($query) use ($search): void {
                $query->where(function ($inner) use ($search): void {
                    $inner->where('sku', 'like', '%'.$search.'%')
                        ->orWhere('name', 'like', '%'.$search.'%');
                });
            })
            ->orderBy('name')
            ->limit(200)
            ->get()
            ->map(function (Product $product) use ($today): array {
                $activeCost = $product->costs->first(fn ($cost): bool => $cost->effective_from->toDateString() <= $today
                    && ($cost->effective_to === null || $cost->effective_to->toDateString() >= $today));

                return [
                    'product' => $product,
                    'hpp' => $activeCost?->hpp_unit,
                ];
            });

        return view('native.products', [
            'products' => $products,
            'storeOptions' => Options::storeFilterValues(),
            'statusOptions' => ['Semua status', 'Aktif', 'Nonaktif'],
            'storeFilterLabel' => $this->storeFilterLabel,
            'statusFilterLabel' => $this->statusFilterLabel,
            'search' => $this->search,
            'rupiah' => fn (int|float|null $value): string => Money::rupiah($value),
            'notice' => $this->notice,
            'error' => $this->error,
        ]);
    }

    public function open(string $id): void
    {
        $this->navigate('/products/'.$id);
    }

    public function create(): void
    {
        $this->navigate('/products/create');
    }
}
