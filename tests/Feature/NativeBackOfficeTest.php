<?php

use App\Models\AdCampaign;
use App\Models\AdvertisingExpense;
use App\Models\AuditLog;
use App\Models\Backup;
use App\Models\OperationalExpense;
use App\Models\Order;
use App\Models\Store;
use App\NativeComponents\AdForm;
use App\NativeComponents\Ads;
use App\NativeComponents\Audit;
use App\NativeComponents\BackupScreen;
use App\NativeComponents\Import;
use App\NativeComponents\Operational;
use App\NativeComponents\OperationalForm;
use App\NativeComponents\Settings;
use App\NativeComponents\Taxes;
use App\NativeComponents\TaxProfileForm;
use App\Services\TaxService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Native\Mobile\Testing\Native;

uses(RefreshDatabase::class);

it('renders the back-office screens with honest empty states', function () {
    Native::test(Taxes::class)
        ->assertSee('Pajak')
        ->assertSee('PPN keluaran')
        ->assertSee('Hitung ulang');

    Native::test(Ads::class)
        ->assertSee('Biaya iklan')
        ->assertSee('Belum ada biaya iklan')
        ->assertSee('Kampanye');

    Native::test(AdForm::class)
        ->assertSee('Biaya iklan baru')
        ->assertSee('Nominal belanja');

    Native::test(Operational::class)
        ->assertSee('Biaya operasional')
        ->assertSee('Belum ada biaya operasional');

    Native::test(OperationalForm::class)
        ->assertSee('Biaya operasional baru')
        ->assertSee('Tanpa toko (umum)');

    Native::test(Import::class)
        ->assertSee('Import pesanan')
        ->assertSee('Belum ada toko');

    Native::test(BackupScreen::class)
        ->assertSee('Backup & restore')
        ->assertSee('Belum pernah backup')
        ->assertSee('Belum ada backup')
        ->assertSee('Pilih file JSON');

    Native::test(Settings::class)
        ->assertSee('Pengaturan')
        ->assertSee('Profil & tarif default')
        ->assertSee('Kunci periode')
        ->assertSee('Tentang aplikasi');

    Native::test(Audit::class)
        ->assertSee('Audit log')
        ->assertSee('Tidak ada catatan audit');
});

it('renders a tax profile and generates entries from realized orders', function () {
    $store = Store::factory()->create(['name' => 'Konveksi Amanah']);
    $profile = $store->taxProfiles()->firstOrFail();
    $profile->fill([
        'pkp' => true,
        'ppn_mode' => 'included',
        'ppn_rate_bp' => 1100,
        'pph_rate_bp' => 50,
        'pph_basis' => 'gross',
    ])->save();

    Order::factory()->for($store)->create([
        'marketplace_order_id' => 'INV-TAX-1',
        'ordered_at' => now()->toDateString(),
        'completed_at' => now()->toDateString(),
        'status' => 'completed',
        'gross_revenue' => 1_110_000,
        'hpp_total' => 500_000,
    ]);

    $written = app(TaxService::class)->generate(now()->format('Y-m'));
    expect($written)->toBe(2);

    Native::test(Taxes::class)
        ->assertSee('Konveksi Amanah')
        ->assertSee('PPN keluaran')
        ->assertSee('Rp 110.000')
        ->assertSee('PPh Final')
        ->assertSee('Rp 5.550');

    Native::test(TaxProfileForm::class, ['store_id' => $store->id])
        ->assertSee('Profil pajak')
        ->assertSee('Konveksi Amanah')
        ->assertSee('Riwayat profil')
        ->assertSee('PPN 11%');
});

it('renders ads with real campaign and expense totals', function () {
    $store = Store::factory()->create(['name' => 'Konveksi Amanah']);
    $campaign = AdCampaign::query()->create([
        'store_id' => $store->id,
        'name' => 'Flash Sale',
        'platform' => 'shopee',
        'active' => true,
    ]);
    AdvertisingExpense::query()->create([
        'store_id' => $store->id,
        'ad_campaign_id' => $campaign->id,
        'spent_at' => now()->toDateString(),
        'amount' => 200_000,
        'clicks' => 120,
        'attributed_orders' => 8,
        'attributed_revenue' => 1_000_000,
    ]);

    Native::test(Ads::class)
        ->assertSee('Flash Sale')
        ->assertSee('Rp 200.000')
        ->assertSee('5,00×')
        ->assertSee('ROAS')
        ->tap('Nonaktifkan')
        ->assertSee('Kampanye dinonaktifkan');

    expect($campaign->fresh()->active)->toBeFalse();

    Native::test(AdForm::class)
        ->assertSee('Biaya iklan baru')
        ->assertSee('Konveksi Amanah');
});

it('renders operational expenses including general costs', function () {
    $store = Store::factory()->create(['name' => 'Konveksi Amanah']);
    OperationalExpense::query()->create([
        'store_id' => $store->id,
        'spent_at' => now()->toDateString(),
        'category' => 'packing',
        'amount' => 150_000,
        'notes' => 'Bubble wrap',
    ]);
    OperationalExpense::query()->create([
        'store_id' => null,
        'spent_at' => now()->toDateString(),
        'category' => 'salary',
        'amount' => 2_000_000,
        'notes' => 'Gaji admin',
    ]);

    Native::test(Operational::class)
        ->assertSee('Rp 2.150.000')
        ->assertSee('Packing tambahan')
        ->assertSee('Gaji karyawan')
        ->assertSee('Umum (tanpa toko)');

    Native::test(OperationalForm::class)
        ->assertSee('Biaya operasional baru')
        ->assertSee('Tanpa toko (umum)');
});

it('renders import history, backup creation, settings, and audit details', function () {
    $store = Store::factory()->create(['name' => 'Konveksi Amanah']);
    Order::factory()->for($store)->create([
        'marketplace_order_id' => 'INV-AUDIT-1',
        'ordered_at' => now()->toDateString(),
        'status' => 'completed',
        'gross_revenue' => 300_000,
    ]);

    Native::test(Import::class)
        ->assertSee('Import pesanan')
        ->assertSee('Konveksi Amanah')
        ->assertSee('Riwayat import');

    Native::test(BackupScreen::class)
        ->call('createBackup')
        ->assertSee('Backup dibuat')
        ->assertSee('Bagikan JSON');

    Native::test(Settings::class)
        ->assertSee('Profil & tarif default')
        ->assertSee('Asia/Jakarta');

    Native::test(Audit::class)
        ->assertSee('Pesanan INV-AUDIT-1 created')
        ->assertSee('Konveksi Amanah')
        ->call('toggle', AuditLog::query()->first()->id)
        ->assertSee('Sesudah');

    $backup = Backup::query()->first();
    @unlink($backup->json_path);
    if ($backup->db_path) {
        @unlink($backup->db_path);
    }
});
