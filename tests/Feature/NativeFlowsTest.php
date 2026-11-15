<?php

use App\Data\ImportFields;
use App\Exceptions\PeriodLockedException;
use App\Models\AdCampaign;
use App\Models\AdvertisingExpense;
use App\Models\AuditLog;
use App\Models\Backup;
use App\Models\ImportBatch;
use App\Models\OperationalExpense;
use App\Models\Order;
use App\Models\PeriodLock;
use App\Models\Product;
use App\Models\ProductCost;
use App\Models\Setting;
use App\Models\Store;
use App\Models\TaxEntry;
use App\NativeComponents\AdForm;
use App\NativeComponents\Ads;
use App\NativeComponents\BackupScreen;
use App\NativeComponents\Dashboard;
use App\NativeComponents\Import;
use App\NativeComponents\OperationalForm;
use App\NativeComponents\Settings;
use App\NativeComponents\Taxes;
use App\Services\BackupService;
use App\Services\ImportService;
use App\Services\ProductService;
use App\Support\Options;
use Carbon\CarbonImmutable;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\File;
use Illuminate\Validation\ValidationException;
use Native\Mobile\Events\Screen\ScreenMounted;
use Native\Mobile\Testing\Native;

uses(RefreshDatabase::class);

it('creates, edits, and deletes advertising costs through native forms', function () {
    $store = Store::factory()->create(['name' => 'Konveksi Amanah']);

    Native::test(Ads::class)
        ->set('campaignStoreLabel', Options::storeLabel($store))
        ->set('campaignName', 'Flash Sale November')
        ->set('campaignPlatformLabel', 'Shopee')
        ->call('addCampaign')
        ->assertSee('Kampanye iklan ditambahkan.')
        ->assertSee('Flash Sale November');

    $campaign = AdCampaign::query()->firstOrFail();

    Native::test(AdForm::class)
        ->set('storeLabel', Options::storeLabel($store))
        ->set('campaignLabel', $campaign->name.' · Shopee')
        ->set('spentAt', now()->toDateString())
        ->set('amount', '250.000')
        ->set('clicks', '120')
        ->set('attributedRevenue', '1.000.000')
        ->call('save')
        ->assertReplacedWith('/ads');

    $expense = AdvertisingExpense::query()->firstOrFail();
    expect($expense->amount)->toBe(250_000)
        ->and($expense->clicks)->toBe(120)
        ->and($expense->attributed_revenue)->toBe(1_000_000)
        ->and($expense->ad_campaign_id)->toBe($campaign->id);

    Native::test(AdForm::class, ['id' => $expense->id])
        ->set('amount', '300000')
        ->call('save')
        ->assertReplacedWith('/ads');

    expect($expense->fresh()->amount)->toBe(300_000);

    Native::test(Ads::class)
        ->call('askDelete', $expense->id)
        ->assertSee('Hapus catatan biaya ini?')
        ->call('deleteExpense', $expense->id)
        ->assertSee('Biaya iklan dihapus.');

    expect(AdvertisingExpense::query()->count())->toBe(0);
});

it('creates general and store operational costs and rejects zero amounts', function () {
    $store = Store::factory()->create(['name' => 'Konveksi Amanah']);

    Native::test(OperationalForm::class)
        ->set('storeLabel', OperationalForm::GENERAL_STORE)
        ->set('categoryLabel', 'Gaji karyawan')
        ->set('spentAt', now()->toDateString())
        ->set('amount', '2.000.000')
        ->set('notes', 'Gaji admin')
        ->call('save')
        ->assertReplacedWith('/operational');

    $general = OperationalExpense::query()->firstOrFail();
    expect($general->store_id)->toBeNull()
        ->and($general->amount)->toBe(2_000_000)
        ->and($general->category)->toBe('salary');

    Native::test(OperationalForm::class, ['id' => $general->id])
        ->set('storeLabel', Options::storeLabel($store))
        ->set('categoryLabel', 'Packing tambahan')
        ->set('amount', '0')
        ->call('save')
        ->assertSee('Nominal biaya harus lebih dari nol.');

    expect($general->fresh()->store_id)->toBeNull();

    Native::test(OperationalForm::class, ['id' => $general->id])
        ->set('storeLabel', Options::storeLabel($store))
        ->set('categoryLabel', 'Packing tambahan')
        ->set('amount', '150000')
        ->call('save')
        ->assertReplacedWith('/operational');

    $updated = $general->fresh();
    expect($updated->store_id)->toBe($store->id)
        ->and($updated->category)->toBe('packing')
        ->and($updated->amount)->toBe(150_000);
});

it('adds manual tax entries, marks them paid, and generates entries from orders', function () {
    $store = Store::factory()->create(['name' => 'Konveksi Amanah']);
    $store->taxProfiles()->firstOrFail()->fill([
        'pkp' => true,
        'ppn_mode' => 'included',
        'ppn_rate_bp' => 1100,
        'pph_rate_bp' => 50,
    ])->save();

    Native::test(Taxes::class)
        ->set('entryStoreLabel', Options::storeLabel($store))
        ->set('entryTypeLabel', 'PPN Masukan')
        ->set('entryBase', '1.000.000')
        ->set('entryRate', '11')
        ->set('entryReference', 'FK-001')
        ->call('addEntry')
        ->assertSee('Entri pajak manual ditambahkan.');

    $entry = TaxEntry::query()->where('type', TaxEntry::PPN_INPUT)->firstOrFail();
    expect($entry->amount)->toBe(110_000)
        ->and($entry->base_amount)->toBe(1_000_000)
        ->and($entry->status)->toBe('draft');

    Native::test(Taxes::class)
        ->call('markStatus', $entry->id, 'paid')
        ->assertSee('Status entri diubah menjadi Dibayar.');

    expect($entry->fresh()->status)->toBe('paid');

    Order::factory()->for($store)->create([
        'marketplace_order_id' => 'INV-TAX-2',
        'ordered_at' => now()->toDateString(),
        'completed_at' => now()->toDateString(),
        'status' => 'completed',
        'gross_revenue' => 1_110_000,
        'hpp_total' => 500_000,
    ]);

    Native::test(Taxes::class)
        ->call('generate')
        ->assertSee('entri pajak dihitung ulang');

    expect(TaxEntry::query()->where('reference', 'auto')->count())->toBe(2)
        ->and(TaxEntry::query()->where('type', TaxEntry::PPN_OUTPUT)->first()->amount)->toBe(110_000)
        ->and(TaxEntry::query()->where('type', TaxEntry::PPH_FINAL)->first()->amount)->toBe(5_550);
});

it('locks periods in settings and blocks tax recalculation and order edits', function () {
    $store = Store::factory()->create(['name' => 'Konveksi Amanah']);
    $order = Order::factory()->for($store)->create([
        'marketplace_order_id' => 'INV-LOCK-1',
        'ordered_at' => now()->toDateString(),
        'status' => 'completed',
    ]);

    Native::test(Settings::class)
        ->set('operatorName', 'Sari')
        ->set('ppnDefault', '11')
        ->set('pphDefault', '0,5')
        ->call('saveProfile')
        ->assertSee('Pengaturan profil dan tarif default disimpan.');

    expect(Setting::value('operator_name'))->toBe('Sari')
        ->and(Setting::integer('ppn_default_bp'))->toBe(1100)
        ->and(Setting::integer('pph_default_bp'))->toBe(50);

    Native::test(Settings::class)
        ->set('lockPeriodLabel', Options::monthLabel(now()->format('Y-m')))
        ->call('lockPeriod')
        ->assertSee('dikunci');

    expect(PeriodLock::query()->count())->toBe(1);

    Native::test(Taxes::class)
        ->call('generate')
        ->assertSee('sudah dikunci');

    $order->status = 'cancelled';

    expect(fn () => $order->save())->toThrow(PeriodLockedException::class);

    Native::test(Settings::class)
        ->call('askUnlock', now()->format('Y-m'))
        ->assertSee('Buka kunci')
        ->call('unlockPeriod', now()->format('Y-m'))
        ->assertSee('Kunci periode');

    expect(PeriodLock::query()->count())->toBe(0);
});

it('creates a real backup and restores it atomically from json', function () {
    $existingFiles = glob(storage_path('app/backups/*')) ?: [];

    try {
        $store = Store::factory()->create(['name' => 'Konveksi Amanah']);
        Order::factory()->for($store)->create([
            'marketplace_order_id' => 'INV-BACKUP-1',
            'ordered_at' => now()->toDateString(),
            'status' => 'completed',
            'gross_revenue' => 250_000,
        ]);

        $service = app(BackupService::class);
        $backup = $service->create('manual');

        expect(is_file($backup->json_path))->toBeTrue()
            ->and(hash_file('sha256', $backup->json_path))->toBe($backup->checksum)
            ->and($backup->schema_version)->toBe(BackupService::SCHEMA_VERSION);

        $payload = json_decode((string) file_get_contents($backup->json_path), true);
        expect($payload['app'])->toBe('Penca')
            ->and($payload['tables']['orders'])->toHaveCount(1);

        Order::query()->forceDelete();
        expect(Order::query()->count())->toBe(0);

        Native::test(BackupScreen::class)
            ->set('restorePath', $backup->json_path)
            ->set('restoreName', basename($backup->json_path))
            ->call('askRestore')
            ->assertSee('Ganti seluruh data saat ini?')
            ->call('restore')
            ->assertSee('Data berhasil dipulihkan.');

        expect(Order::query()->count())->toBe(1)
            ->and(Order::query()->first()->marketplace_order_id)->toBe('INV-BACKUP-1')
            ->and(AuditLog::query()->where('event', 'restored')->count())->toBe(1);
    } finally {
        foreach (array_diff(glob(storage_path('app/backups/*')) ?: [], $existingFiles) as $file) {
            @unlink($file);
        }
    }
});

it('rejects a tampered backup without changing data', function () {
    $existingFiles = glob(storage_path('app/backups/*')) ?: [];

    try {
        $backup = app(BackupService::class)->create('manual');
        $tampered = storage_path('app/backups/tampered-'.uniqid().'.json');
        $contents = (string) file_get_contents($backup->json_path);
        file_put_contents($tampered, str_replace('Penca', 'PencaX', $contents));

        expect(fn () => app(BackupService::class)->restore($tampered))
            ->toThrow(ValidationException::class);

        @unlink($tampered);
    } finally {
        foreach (array_diff(glob(storage_path('app/backups/*')) ?: [], $existingFiles) as $file) {
            @unlink($file);
        }
    }
});

it('runs the daily auto backup once when the dashboard mounts', function () {
    $existingFiles = glob(storage_path('app/backups/*')) ?: [];

    try {
        Event::dispatch(new ScreenMounted(Dashboard::class, '/'));

        $backup = Backup::query()->firstOrFail();
        expect($backup->reason)->toBe('auto')
            ->and(Setting::value('last_auto_backup_at'))->not->toBeEmpty();

        Event::dispatch(new ScreenMounted(Dashboard::class, '/'));

        expect(Backup::query()->where('reason', 'auto')->count())->toBe(1);

        Setting::put('last_auto_backup_at', now()->subDay()->toDateTimeString());
        Setting::put('auto_backup_enabled', false);
        Event::dispatch(new ScreenMounted(Dashboard::class, '/'));

        expect(Backup::query()->where('reason', 'auto')->count())->toBe(1);
    } finally {
        Setting::put('auto_backup_enabled', true);
        Setting::put('last_auto_backup_at', '');

        foreach (array_diff(glob(storage_path('app/backups/*')) ?: [], $existingFiles) as $file) {
            @unlink($file);
        }
    }
});

it('imports csv idempotently and exports failed rows', function () {
    $store = Store::factory()->create(['name' => 'Konveksi Amanah']);
    $product = Product::factory()->for($store)->create([
        'sku' => 'KA-01',
        'name' => 'Kaos Custom',
        'selling_price' => 100_000,
    ]);
    $product->costs()->create([
        'hpp_unit' => 40_000,
        'effective_from' => now()->subMonth()->toDateString(),
        'effective_to' => null,
    ]);

    $directory = storage_path('app/imports');
    File::ensureDirectoryExists($directory);
    $csvPath = $directory.'/test-'.uniqid().'.csv';
    $handle = fopen($csvPath, 'wb');
    fputcsv($handle, ['Order ID', 'Tanggal pesanan', 'Status', 'SKU', 'Nama produk', 'Jumlah', 'Harga satuan', 'HPP satuan', 'Diskon penjual'], ',', '"', '');
    fputcsv($handle, ['INV-IMPORT-1', now()->toDateString(), 'completed', 'KA-01', 'Kaos Custom', '2', '100000', '40000', '5000'], ',', '"', '');
    fclose($handle);

    Native::test(Import::class)
        ->set('storeLabel', Options::storeLabel($store))
        ->call('handleDocumentPicked', $csvPath, 'marketplace.csv')
        ->assertSee('Pratinjau import')
        ->assertSee('INV-IMPORT-1')
        ->call('commit')
        ->assertSee('Import selesai diproses');

    $order = Order::query()->where('marketplace_order_id', 'INV-IMPORT-1')->firstOrFail();
    expect($order->gross_revenue)->toBe(200_000)
        ->and($order->seller_discount)->toBe(5_000)
        ->and($order->hpp_total)->toBe(80_000)
        ->and($order->items()->first()->hpp_unit_snapshot)->toBe(40_000);

    $second = app(ImportService::class)->commit(
        $store->id,
        $csvPath,
        'marketplace.csv',
        ImportFields::autoMap(['Order ID', 'Tanggal pesanan', 'Status', 'SKU', 'Nama produk', 'Jumlah', 'Harga satuan', 'HPP satuan', 'Diskon penjual']),
    );

    expect($second->duplicateFile)->toBeTrue()
        ->and(Order::query()->where('marketplace_order_id', 'INV-IMPORT-1')->count())->toBe(1);

    $badPath = $directory.'/bad-'.uniqid().'.csv';
    $bad = fopen($badPath, 'wb');
    fputcsv($bad, ['Order ID', 'Tanggal pesanan', 'Status', 'SKU', 'Nama produk', 'Jumlah', 'Harga satuan', 'HPP satuan'], ',', '"', '');
    fputcsv($bad, ['INV-IMPORT-2', now()->toDateString(), 'completed', 'KA-01', 'Kaos Custom', '0', '100000', '40000'], ',', '"', '');
    fputcsv($bad, ['INV-IMPORT-3', now()->toDateString(), 'completed', 'KA-01', 'Kaos Custom', '1', '100000', '40000'], ',', '"', '');
    fclose($bad);

    $result = app(ImportService::class)->commit(
        $store->id,
        $badPath,
        'bad.csv',
        ImportFields::autoMap(['Order ID', 'Tanggal pesanan', 'Status', 'SKU', 'Nama produk', 'Jumlah', 'Harga satuan', 'HPP satuan']),
    );

    expect($result->rowsFailed)->toBe(1)
        ->and($result->ordersImported)->toBe(1);

    $batch = ImportBatch::query()->findOrFail($result->batchId);
    $export = app(ImportService::class)->exportFailures($batch);
    expect(is_file($export['path']))->toBeTrue();
    $failureCsv = (string) file_get_contents($export['path']);
    expect($failureCsv)->toContain('Jumlah harus bilangan bulat lebih dari nol');

    @unlink($csvPath);
    @unlink($badPath);
    @unlink($export['path']);
});

it('keeps hpp history contiguous with no overlapping periods', function () {
    $store = Store::factory()->create();
    $service = app(ProductService::class);
    $product = $service->save(null, [
        'store_id' => $store->id,
        'sku' => 'KA-02',
        'name' => 'Kaos Panjang',
        'selling_price' => 120_000,
        'active' => true,
    ]);

    $january = now()->startOfMonth()->addMonthsNoOverflow(1)->toDateString();
    $march = now()->startOfMonth()->addMonthsNoOverflow(3)->toDateString();
    $february = now()->startOfMonth()->addMonthsNoOverflow(2)->toDateString();

    $service->setHpp($product, ['hpp_unit' => 40_000, 'effective_from' => now()->startOfMonth()->toDateString()]);
    $service->setHpp($product, ['hpp_unit' => 50_000, 'effective_from' => $march]);
    $service->setHpp($product, ['hpp_unit' => 45_000, 'effective_from' => $february]);
    $service->setHpp($product, ['hpp_unit' => 55_000, 'effective_from' => $march]);

    $costs = ProductCost::query()
        ->where('product_id', $product->id)
        ->orderBy('effective_from')
        ->get();

    expect($costs)->toHaveCount(3)
        ->and($costs[0]->effective_to?->toDateString())->toBe(
            CarbonImmutable::parse($february)->subDay()->toDateString(),
        )
        ->and($costs[1]->hpp_unit)->toBe(45_000)
        ->and($costs[1]->effective_to?->toDateString())->toBe(
            CarbonImmutable::parse($march)->subDay()->toDateString(),
        )
        ->and($costs[2]->hpp_unit)->toBe(55_000)
        ->and($costs[2]->effective_to)->toBeNull();

    expect($january)->toBeString();
});
