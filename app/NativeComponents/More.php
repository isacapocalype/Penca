<?php

namespace App\NativeComponents;

use App\Models\Backup;
use App\Models\Product;
use App\Models\Store;
use App\Native\Concerns\HandlesFeedback;
use Illuminate\View\View;
use Native\Mobile\Edge\Element;
use Native\Mobile\Edge\NativeComponent;

class More extends NativeComponent
{
    use HandlesFeedback;

    public function render(): Element|View
    {
        return view('native.more', [
            'storeCount' => Store::query()->where('status', 'active')->count(),
            'productCount' => Product::query()->where('active', true)->count(),
            'lastBackup' => Backup::query()->orderByDesc('created_at')->first(),
            'notice' => $this->notice,
            'error' => $this->error,
        ]);
    }

    public function go(string $path): void
    {
        $this->navigate($path);
    }
}
