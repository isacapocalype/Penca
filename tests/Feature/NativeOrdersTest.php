<?php

use App\Models\Order;
use App\Models\Product;
use App\Models\Settlement;
use App\Models\Store;
use App\NativeComponents\OrderDetail;
use App\NativeComponents\OrderForm;
use App\NativeComponents\Orders;
use App\Services\FinancialSummaryService;
use App\Services\OrderService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Native\Mobile\Testing\Native;

uses(RefreshDatabase::class);

it('shows honest guidance when no store exists', function () {
    Native::test(OrderForm::class)
        ->assertSee('Pesanan baru')
        ->assertSee('Belum ada toko aktif')
        ->assertSee('Tambah toko');
});

it('renders an order list with real totals', function () {
    $store = Store::factory()->create(['name' => 'Konveksi Amanah']);
    Order::factory()->for($store)->create([
        'marketplace_order_id' => 'INV-001',
        'ordered_at' => now()->toDateString(),
        'status' => 'completed',
        'gross_revenue' => 150000,
        'seller_discount' => 0,
        'hpp_total' => 60000,
    ]);

    Native::test(Orders::class)
        ->assertSee('Pesanan')
        ->assertSee('INV-001')
        ->assertSee('Rp 150.000')
        ->assertSee('Konveksi Amanah');
});

it('renders order detail with fee and refund actions', function () {
    $store = Store::factory()->create(['name' => 'Konveksi Amanah']);
    $product = Product::factory()->for($store)->create([
        'sku' => 'KA-01',
        'name' => 'Kaos Custom',
        'selling_price' => 100000,
    ]);

    $order = app(OrderService::class)->create($store->id, [
        'marketplace_order_id' => 'INV-002',
        'ordered_at' => now()->toDateString(),
        'completed_at' => now()->toDateString(),
        'status' => 'completed',
        'seller_discount' => 5000,
        'marketplace_discount' => 0,
        'notes' => null,
    ], [[
        'product_id' => $product->id,
        'sku' => 'KA-01',
        'product_name' => 'Kaos Custom',
        'qty' => 2,
        'unit_price' => 100000,
        'hpp_unit_snapshot' => 40000,
    ]]);

    app(OrderService::class)->addFee($order, [
        'description' => 'Biaya administrasi',
        'basis' => 'fixed',
        'amount' => 4000,
        'borne_by' => 'seller',
    ]);

    Native::test(OrderDetail::class, ['id' => $order->id])
        ->assertSee('INV-002')
        ->assertSee('Rp 195.000')
        ->assertSee('Rp 111.000')
        ->assertSee('Kaos Custom')
        ->assertSee('Biaya administrasi')
        ->assertSee('Catat');
});

it('records and deletes marketplace settlements without changing profit', function () {
    $store = Store::factory()->create(['name' => 'Konveksi Amanah']);
    $order = Order::factory()->for($store)->create([
        'marketplace_order_id' => 'INV-003',
        'ordered_at' => now()->toDateString(),
        'status' => 'completed',
        'gross_revenue' => 200000,
        'seller_discount' => 0,
        'hpp_total' => 80000,
    ]);

    $summaryBefore = app(FinancialSummaryService::class)->forRange(
        now()->toDateString(),
        now()->toDateString(),
    );

    Native::test(OrderDetail::class, ['id' => $order->id])
        ->assertSee('Belum ada pencairan tercatat')
        ->set('settlementDate', now()->toDateString())
        ->set('settlementAmount', '150.000')
        ->set('settlementReference', 'TRX-001')
        ->call('addSettlement')
        ->assertSee('Pencairan marketplace dicatat.')
        ->assertSee('TRX-001')
        ->assertSee('Rp 150.000')
        ->assertSee('Belum dicairkan')
        ->assertSee('Rp 50.000');

    $settlement = Settlement::query()->firstOrFail();

    expect($settlement->order_id)->toBe($order->id)
        ->and($settlement->store_id)->toBe($store->id)
        ->and($settlement->amount)->toBe(150_000)
        ->and($settlement->reference)->toBe('TRX-001');

    $summaryAfter = app(FinancialSummaryService::class)->forRange(
        now()->toDateString(),
        now()->toDateString(),
    );

    expect($summaryAfter->settlementTotal)->toBe(150_000)
        ->and($summaryAfter->netProfit)->toBe($summaryBefore->netProfit);

    Native::test(OrderDetail::class, ['id' => $order->id])
        ->set('settlementAmount', '60.000')
        ->call('addSettlement')
        ->assertSee('tidak boleh melebihi pendapatan neto');

    expect(Settlement::query()->count())->toBe(1);

    Native::test(OrderDetail::class, ['id' => $order->id])
        ->call('askDeleteSettlement', $settlement->id)
        ->assertSee('Hapus')
        ->call('deleteSettlement', $settlement->id)
        ->assertSee('Pencairan dihapus.');

    expect(Settlement::query()->count())->toBe(0)
        ->and(Settlement::withTrashed()->count())->toBe(1);
});
