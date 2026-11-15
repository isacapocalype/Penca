<?php

namespace App\Observers;

use App\Exceptions\PeriodLockedException;
use App\Models\AdvertisingExpense;
use App\Models\MarketplaceFee;
use App\Models\OperationalExpense;
use App\Models\Order;
use App\Models\OrderItem;
use App\Models\PeriodLock;
use App\Models\ProductCost;
use App\Models\Refund;
use App\Models\Settlement;
use App\Models\TaxEntry;
use App\Services\PeriodLockService;
use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Model;

class PeriodLockObserver
{
    public function __construct(private readonly PeriodLockService $locks) {}

    public function saving(Model $model): void
    {
        $this->guard($model);
    }

    public function deleting(Model $model): void
    {
        if ($model instanceof PeriodLock) {
            return;
        }

        $this->guard($model);
    }

    private function guard(Model $model): void
    {
        foreach ($this->periodsFor($model) as $period) {
            if ($this->locks->isLocked($period)) {
                throw PeriodLockedException::forPeriod($period);
            }
        }
    }

    /** @return list<string> */
    private function periodsFor(Model $model): array
    {
        $periods = [];

        if ($model instanceof Order) {
            if ($model->ordered_at) {
                $periods[] = CarbonImmutable::parse($model->ordered_at)->format('Y-m');
            }
        }

        if ($model instanceof OrderItem || $model instanceof MarketplaceFee) {
            $order = $model->order;
            if ($order?->ordered_at) {
                $periods[] = CarbonImmutable::parse($order->ordered_at)->format('Y-m');
            }
        }

        if ($model instanceof Refund) {
            if ($model->refunded_at) {
                $periods[] = CarbonImmutable::parse($model->refunded_at)->format('Y-m');
            }
            $order = $model->order;
            if ($order?->ordered_at) {
                $periods[] = CarbonImmutable::parse($order->ordered_at)->format('Y-m');
            }
        }

        if ($model instanceof AdvertisingExpense || $model instanceof OperationalExpense) {
            if ($model->spent_at) {
                $periods[] = CarbonImmutable::parse($model->spent_at)->format('Y-m');
            }
        }

        if ($model instanceof Settlement) {
            if ($model->settled_at) {
                $periods[] = CarbonImmutable::parse($model->settled_at)->format('Y-m');
            }
            if ($model->order?->ordered_at) {
                $periods[] = CarbonImmutable::parse($model->order->ordered_at)->format('Y-m');
            }
        }

        if ($model instanceof ProductCost) {
            if ($model->effective_from) {
                $periods[] = CarbonImmutable::parse($model->effective_from)->format('Y-m');
            }
        }

        if ($model instanceof TaxEntry) {
            if ($model->period) {
                $periods[] = $model->period;
            }
        }

        return array_values(array_unique($periods));
    }
}
