<?php

namespace App\Providers;

use App\Models\AdCampaign;
use App\Models\AdvertisingExpense;
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
use App\NativeComponents\Dashboard;
use App\Observers\AuditObserver;
use App\Observers\PeriodLockObserver;
use App\Services\BackupService;
use App\Services\PeriodLockService;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\Date;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\ServiceProvider;
use Native\Mobile\Events\Screen\ScreenMounted;
use Throwable;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        $this->app->singleton(PeriodLockService::class);
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        Date::use(CarbonImmutable::class);

        DB::prohibitDestructiveCommands(app()->isProduction());

        $this->registerObservers();
        $this->registerAutoBackupListener();
    }

    /**
     * Backup otomatis berjalan sekali sehari saat dashboard dibuka. Listener
     * tidak boleh menjatuhkan layar utama bila penyimpanan sedang bermasalah.
     */
    private function registerAutoBackupListener(): void
    {
        Event::listen(ScreenMounted::class, function (ScreenMounted $event): void {
            if ($event->component !== Dashboard::class) {
                return;
            }

            try {
                app(BackupService::class)->autoBackupIfDue();
            } catch (Throwable $exception) {
                Log::error('Backup otomatis harian gagal.', ['exception' => $exception]);
            }
        });
    }

    private function registerObservers(): void
    {
        $audited = [
            Store::class,
            TaxProfile::class,
            Product::class,
            ProductCost::class,
            Order::class,
            OrderItem::class,
            MarketplaceFee::class,
            Settlement::class,
            AdCampaign::class,
            AdvertisingExpense::class,
            OperationalExpense::class,
            Refund::class,
            TaxEntry::class,
            PeriodLock::class,
            ImportBatch::class,
        ];

        foreach ($audited as $model) {
            $model::observe(AuditObserver::class);
        }

        $periodGuarded = [
            Order::class,
            OrderItem::class,
            MarketplaceFee::class,
            Refund::class,
            AdvertisingExpense::class,
            OperationalExpense::class,
            Settlement::class,
            ProductCost::class,
            TaxEntry::class,
        ];

        $lockObserver = new PeriodLockObserver($this->app->make(PeriodLockService::class));

        foreach ($periodGuarded as $model) {
            $model::observe($lockObserver);
        }
    }
}
