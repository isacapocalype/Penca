<?php

use App\Models\Product;
use App\Models\Store;
use App\NativeComponents\ProductDetail;
use App\NativeComponents\ProductForm;
use App\NativeComponents\Products;
use App\NativeComponents\Reports;
use App\NativeComponents\StoreDetail;
use App\NativeComponents\StoreForm;
use App\NativeComponents\Stores;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Native\Mobile\Testing\Native;

uses(RefreshDatabase::class);

it('renders the stores list and form', function () {
    Native::test(Stores::class)
        ->assertSee('Toko')
        ->assertSee('Belum ada toko');

    Native::test(StoreForm::class)
        ->assertSee('Toko baru')
        ->assertSee('Nama toko')
        ->assertSee('Simpan toko');
});

it('renders store detail with lifetime totals', function () {
    $store = Store::factory()->create(['name' => 'Konveksi Amanah', 'code' => 'AMANAH']);

    Native::test(StoreDetail::class, ['id' => $store->id])
        ->assertSee('Konveksi Amanah')
        ->assertSee('Profil pajak aktif')
        ->assertSee('Belum ada produk untuk toko ini.');
});

it('renders the products list and form', function () {
    $store = Store::factory()->create(['name' => 'Konveksi Amanah']);

    Native::test(Products::class)
        ->assertSee('Produk & HPP')
        ->assertSee('Belum ada produk');

    Native::test(ProductForm::class)
        ->assertSee('Produk baru')
        ->assertSee('SKU')
        ->assertSee('HPP awal');

    expect($store->id)->toBeString();
});

it('renders product detail with hpp history', function () {
    $store = Store::factory()->create(['name' => 'Konveksi Amanah']);
    $product = Product::factory()->for($store)->create([
        'sku' => 'KA-01',
        'name' => 'Kaos Custom',
        'selling_price' => 100000,
    ]);

    $product->costs()->create([
        'hpp_unit' => 40000,
        'effective_from' => now()->toDateString(),
        'effective_to' => null,
    ]);

    Native::test(ProductDetail::class, ['id' => $product->id])
        ->assertSee('Kaos Custom')
        ->assertSee('Rp 40.000')
        ->assertSee('Riwayat HPP')
        ->assertSee('Ubah HPP');
});

it('renders the reports screen with an honest empty state', function () {
    Native::test(Reports::class)
        ->assertSee('Laporan')
        ->assertSee('Laba bersih')
        ->assertSee('Rp 0')
        ->assertSee('Belum ada transaksi pada periode ini.')
        ->assertSee('Ekspor laporan');
});
