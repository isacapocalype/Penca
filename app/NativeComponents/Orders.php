<?php

namespace App\NativeComponents;

use App\Models\Order;
use App\Native\Concerns\HandlesFeedback;
use App\Support\Money;
use App\Support\Options;
use Illuminate\View\View;
use Native\Mobile\Edge\Element;
use Native\Mobile\Edge\NativeComponent;

class Orders extends NativeComponent
{
    use HandlesFeedback;

    public string $search = '';

    public string $statusFilterLabel = 'Semua status';

    public string $storeFilterLabel = 'Semua Toko';

    public function mount(): void
    {
        $storeId = $this->query('store_id');

        if (is_string($storeId) && $storeId !== '') {
            $label = array_search($storeId, Options::stores(), true);

            if ($label !== false) {
                $this->storeFilterLabel = (string) $label;
            }
        }

        $status = $this->query('status');

        if (is_string($status) && $status !== '') {
            $label = array_search($status, Options::orderFilterStatuses(), true);

            if ($label !== false) {
                $this->statusFilterLabel = (string) $label;
            }
        }
    }

    public function render(): Element|View
    {
        $status = Options::orderFilterStatus($this->statusFilterLabel);
        $storeId = Options::storeFilterId($this->storeFilterLabel);
        $search = trim($this->search);

        $orders = Order::query()
            ->with([
                'store:id,name',
                'refund:id,order_id,amount',
                'fees:id,order_id,amount,borne_by',
                'items:id,order_id,qty',
            ])
            ->when($status, fn ($query, string $value) => $query->where('status', $value))
            ->when($storeId, fn ($query, string $value) => $query->where('store_id', $value))
            ->when($search !== '', function ($query) use ($search): void {
                $query->where(function ($inner) use ($search): void {
                    $inner->where('marketplace_order_id', 'like', '%'.$search.'%')
                        ->orWhereHas('store', fn ($store) => $store->where('name', 'like', '%'.$search.'%'));
                });
            })
            ->orderByDesc('ordered_at')
            ->orderByDesc('created_at')
            ->limit(150)
            ->get();

        return view('native.orders', [
            'orders' => $orders,
            'statusOptions' => Options::orderFilterStatuses(),
            'storeOptions' => Options::storeFilterValues(),
            'rupiah' => fn (int|float|null $value): string => Money::rupiah($value),
            'statusFilterLabel' => $this->statusFilterLabel,
            'storeFilterLabel' => $this->storeFilterLabel,
            'search' => $this->search,
            'notice' => $this->notice,
            'error' => $this->error,
        ]);
    }

    public function open(string $id): void
    {
        $this->navigate('/orders/'.$id);
    }

    public function create(): void
    {
        $this->navigate('/orders/create');
    }
}
