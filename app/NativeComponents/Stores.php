<?php

namespace App\NativeComponents;

use App\Models\Store;
use App\Native\Concerns\HandlesFeedback;
use App\Support\Options;
use Illuminate\View\View;
use Native\Mobile\Edge\Element;
use Native\Mobile\Edge\NativeComponent;

class Stores extends NativeComponent
{
    use HandlesFeedback;

    public string $search = '';

    public string $statusFilterLabel = 'Semua status';

    public function render(): Element|View
    {
        $search = trim($this->search);
        $status = $this->statusFilterLabel === 'Semua status' ? null : Options::storeStatusFromLabel($this->statusFilterLabel);

        $stores = Store::query()
            ->with('marketplace:id,name')
            ->withCount(['products', 'orders'])
            ->when($status, fn ($query, string $value) => $query->where('status', $value))
            ->when($search !== '', function ($query) use ($search): void {
                $query->where(function ($inner) use ($search): void {
                    $inner->where('name', 'like', '%'.$search.'%')
                        ->orWhere('code', 'like', '%'.$search.'%')
                        ->orWhere('username', 'like', '%'.$search.'%');
                });
            })
            ->orderBy('name')
            ->get();

        return view('native.stores', [
            'stores' => $stores,
            'statusOptions' => ['Semua status', ...Options::storeStatuses()],
            'statusFilterLabel' => $this->statusFilterLabel,
            'search' => $this->search,
            'notice' => $this->notice,
            'error' => $this->error,
        ]);
    }

    public function open(string $id): void
    {
        $this->navigate('/stores/'.$id);
    }

    public function create(): void
    {
        $this->navigate('/stores/create');
    }
}
