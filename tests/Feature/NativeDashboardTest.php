<?php

use App\Models\Order;
use App\Models\Product;
use App\Models\Store;
use App\NativeComponents\Dashboard;
use App\NativeComponents\More;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Native\Mobile\Testing\Native;

uses(RefreshDatabase::class);

it('renders an honest empty dashboard without inventing numbers', function () {
    Native::test(Dashboard::class)
        ->assertSee('Dashboard')
        ->assertSee('Laba bersih')
        ->assertSee('Rp 0')
        ->assertSee('Belum ada penjualan')
        ->assertSee('Tambah pesanan');
});

it('renders real totals after a realized order exists', function () {
    $store = Store::factory()->create(['name' => 'Konveksi Amanah', 'code' => 'AMANAH']);
    $order = Order::factory()->for($store)->create([
        'ordered_at' => now()->toDateString(),
        'status' => 'completed',
        'gross_revenue' => 200000,
        'seller_discount' => 5000,
        'hpp_total' => 80000,
    ]);
    $order->items()->create([
        'sku' => 'KA-01',
        'product_name' => 'Kaos Custom',
        'qty' => 2,
        'unit_price' => 100000,
        'hpp_unit_snapshot' => 40000,
    ]);

    Native::test(Dashboard::class)
        ->assertSee('Rp 195.000')
        ->assertSee('Konveksi Amanah')
        ->assertSee('1 pesanan')
        ->assertSee('2 produk terjual');
});

it('renders the more hub with real counts and no fabricated backup', function () {
    $store = Store::factory()->create(['status' => Store::STATUS_ACTIVE]);
    Store::factory()->archived()->create();
    Product::factory()->for($store)->create(['active' => true]);
    Product::factory()->for($store)->create(['active' => false]);

    Native::test(More::class)
        ->assertSee('Lainnya')
        ->assertSee('1 toko aktif')
        ->assertSee('1 produk aktif')
        ->assertSee('Belum pernah backup');
});
