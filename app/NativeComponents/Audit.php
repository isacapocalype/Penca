<?php

namespace App\NativeComponents;

use App\Models\AdCampaign;
use App\Models\AdvertisingExpense;
use App\Models\AuditLog;
use App\Models\ImportBatch;
use App\Models\MarketplaceFee;
use App\Models\OperationalExpense;
use App\Models\Order;
use App\Models\OrderItem;
use App\Models\PeriodLock;
use App\Models\Product;
use App\Models\ProductCost;
use App\Models\Refund;
use App\Models\Settlement;
use App\Models\Store;
use App\Models\TaxEntry;
use App\Models\TaxProfile;
use App\Native\Concerns\HandlesFeedback;
use App\Support\Options;
use Illuminate\View\View;
use Native\Mobile\Edge\Element;
use Native\Mobile\Edge\NativeComponent;

class Audit extends NativeComponent
{
    use HandlesFeedback;

    public const EVENT_LABELS = [
        'created' => 'Dibuat',
        'updated' => 'Diubah',
        'deleted' => 'Dihapus',
        'restored' => 'Restore',
    ];

    public string $storeFilterLabel = 'Semua Toko';

    public string $eventFilterLabel = 'Semua peristiwa';

    public string $search = '';

    public ?string $expandedId = null;

    public int $limit = 50;

    public function render(): Element|View
    {
        $storeId = Options::storeFilterId($this->storeFilterLabel);
        $event = array_search($this->eventFilterLabel, self::EVENT_LABELS, true);
        $query = AuditLog::query()->with('store:id,name');

        if (is_string($event)) {
            $query->where('event', $event);
        }

        if ($storeId !== null) {
            $query->where('store_id', $storeId);
        }

        $search = trim($this->search);

        if ($search !== '') {
            $query->where(function ($builder) use ($search): void {
                $builder->where('summary', 'like', '%'.$search.'%')
                    ->orWhere('auditable_id', 'like', '%'.$search.'%')
                    ->orWhere('auditable_type', 'like', '%'.$search.'%');
            });
        }

        $total = (clone $query)->count();
        $logs = $query->orderByDesc('created_at')->limit($this->limit)->get();

        return view('native.audit', [
            'logs' => $logs,
            'total' => $total,
            'hasMore' => $total > $logs->count(),
            'eventOptions' => ['Semua peristiwa', ...array_values(self::EVENT_LABELS)],
            'storeFilterOptions' => Options::storeFilterValues(),
            'eventLabels' => self::EVENT_LABELS,
            'storeFilterLabel' => $this->storeFilterLabel,
            'eventFilterLabel' => $this->eventFilterLabel,
            'search' => $this->search,
            'expandedId' => $this->expandedId,
            'formatKey' => fn (string $key): string => $this->formatKey($key),
            'formatValue' => fn (mixed $value): string => $this->formatValue($value),
            'modelLabel' => fn (?string $type): string => $this->modelLabel($type),
            'notice' => $this->notice,
            'error' => $this->error,
        ]);
    }

    public function toggle(string $id): void
    {
        $this->expandedId = $this->expandedId === $id ? null : $id;
    }

    public function loadMore(): void
    {
        $this->limit += 50;
    }

    public function resetFilters(): void
    {
        $this->storeFilterLabel = 'Semua Toko';
        $this->eventFilterLabel = 'Semua peristiwa';
        $this->search = '';
        $this->expandedId = null;
        $this->limit = 50;
        $this->clearFeedback();
    }

    private function formatKey(string $key): string
    {
        return match ($key) {
            'id' => 'ID',
            'store_id' => 'Toko',
            'order_id' => 'Pesanan',
            'product_id' => 'Produk',
            'package_details' => 'Rincian paket',
            'raw_data' => 'Data mentah',
            'created_at' => 'Dibuat',
            'updated_at' => 'Diubah',
            default => ucwords(str_replace('_', ' ', $key)),
        };
    }

    private function formatValue(mixed $value): string
    {
        if ($value === null) {
            return '—';
        }

        if (is_bool($value)) {
            return $value ? 'Ya' : 'Tidak';
        }

        if (is_array($value)) {
            return json_encode($value, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) ?: '—';
        }

        if ($value === '') {
            return '(kosong)';
        }

        return (string) $value;
    }

    private function modelLabel(?string $type): string
    {
        if (! $type) {
            return 'Sistem';
        }

        return match ($type) {
            Store::class => 'Toko',
            TaxProfile::class => 'Profil pajak',
            Product::class => 'Produk',
            ProductCost::class => 'HPP',
            Order::class => 'Pesanan',
            OrderItem::class => 'Item pesanan',
            MarketplaceFee::class => 'Fee marketplace',
            Settlement::class => 'Pencairan',
            AdCampaign::class => 'Kampanye iklan',
            AdvertisingExpense::class => 'Biaya iklan',
            OperationalExpense::class => 'Biaya operasional',
            Refund::class => 'Refund',
            TaxEntry::class => 'Entri pajak',
            PeriodLock::class => 'Kunci periode',
            ImportBatch::class => 'Batch import',
            default => class_basename($type),
        };
    }
}
