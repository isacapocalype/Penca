<?php

namespace App\Services;

use App\Models\Product;
use App\Models\ProductCost;
use App\Support\Money;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\ValidationException;

/**
 * Menjaga riwayat HPP tetap berurutan: satu harga aktif per tanggal,
 * tanpa periode yang tumpang tindih. Pesanan lama tetap memakai snapshot
 * HPP saat pesanan dibuat, sehingga koreksi harga tidak mengubah histori.
 */
class ProductService
{
    /**
     * @param  array<string, mixed>  $data
     */
    public function save(?Product $product, array $data): Product
    {
        $storeId = (string) ($product?->store_id ?? $data['store_id'] ?? '');

        $validator = Validator::make($data, [
            'store_id' => $product ? ['nullable'] : ['required', 'uuid', 'exists:stores,id'],
            'sku' => ['required', 'string', 'max:80'],
            'name' => ['required', 'string', 'max:160'],
            'selling_price' => ['required', 'integer', 'min:0'],
            'active' => ['required', 'boolean'],
            'notes' => ['nullable', 'string', 'max:1000'],
        ], [
            'sku.required' => 'SKU wajib diisi.',
            'name.required' => 'Nama produk wajib diisi.',
            'selling_price.min' => 'Harga jual tidak boleh negatif.',
        ]);

        $validator->validate();

        $sku = trim((string) $data['sku']);

        $duplicate = Product::query()
            ->withTrashed()
            ->where('store_id', $storeId)
            ->whereRaw('LOWER(sku) = ?', [mb_strtolower($sku)])
            ->when($product, fn ($query) => $query->whereKeyNot($product->id))
            ->exists();

        if ($duplicate) {
            $validator->errors()->add('sku', 'SKU ini sudah dipakai di toko yang sama, termasuk produk yang sudah dihapus.');
            throw new ValidationException($validator);
        }

        return DB::transaction(function () use ($product, $data, $storeId, $sku): Product {
            $payload = [
                'store_id' => $storeId,
                'sku' => $sku,
                'name' => trim((string) $data['name']),
                'selling_price' => (int) Money::parse($data['selling_price'] ?? 0),
                'active' => (bool) ($data['active'] ?? true),
                'notes' => isset($data['notes']) && trim((string) $data['notes']) !== '' ? trim((string) $data['notes']) : null,
            ];

            if ($product) {
                $product->fill($payload)->save();

                return $product->refresh();
            }

            return Product::query()->create($payload);
        });
    }

    /**
     * @param  array<string, mixed>  $data
     */
    public function setHpp(Product $product, array $data): ProductCost
    {
        $validator = Validator::make($data, [
            'hpp_unit' => ['required', 'integer', 'min:0'],
            'effective_from' => ['required', 'date'],
            'notes' => ['nullable', 'string', 'max:255'],
        ], [
            'hpp_unit.min' => 'HPP tidak boleh negatif.',
            'effective_from.required' => 'Tanggal berlaku HPP wajib diisi.',
        ]);

        $validator->validate();

        $date = CarbonImmutable::parse((string) $data['effective_from'])->toDateString();
        $hpp = (int) $data['hpp_unit'];
        $notes = isset($data['notes']) && trim((string) $data['notes']) !== '' ? trim((string) $data['notes']) : null;

        return DB::transaction(function () use ($product, $date, $hpp, $notes): ProductCost {
            $sameDay = $product->costs()->whereDate('effective_from', $date)->first();

            if ($sameDay) {
                $sameDay->fill(['hpp_unit' => $hpp, 'notes' => $notes])->save();

                return $sameDay->refresh();
            }

            $next = $product->costs()
                ->whereDate('effective_from', '>', $date)
                ->orderBy('effective_from')
                ->first();

            $previous = $product->costs()
                ->whereDate('effective_from', '<', $date)
                ->orderByDesc('effective_from')
                ->first();

            if ($previous && ($previous->effective_to === null || $previous->effective_to->toDateString() >= $date)) {
                $previous->fill([
                    'effective_to' => CarbonImmutable::parse($date)->subDay()->toDateString(),
                ])->save();
            }

            return $product->costs()->create([
                'hpp_unit' => $hpp,
                'effective_from' => $date,
                'effective_to' => $next
                    ? CarbonImmutable::parse($next->effective_from->toDateString())->subDay()->toDateString()
                    : null,
                'notes' => $notes,
            ]);
        });
    }

    public function delete(Product $product): void
    {
        DB::transaction(fn () => $product->delete());
    }
}
