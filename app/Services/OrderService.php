<?php

namespace App\Services;

use App\Models\MarketplaceFee;
use App\Models\Order;
use App\Models\Product;
use App\Models\Refund;
use App\Models\Settlement;
use App\Support\FinancialCalculator;
use App\Support\Money;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\ValidationException;

class OrderService
{
    /**
     * Membuat pesanan beserta item dan fee dalam satu transaksi.
     *
     * @param  array<string, mixed>  $data
     * @param  array<int, array<string, mixed>>  $items
     * @param  array<int, array<string, mixed>>  $fees
     */
    public function create(string $storeId, array $data, array $items, array $fees = []): Order
    {
        $this->validatePayload($storeId, $data, $items);

        return DB::transaction(function () use ($storeId, $data, $items, $fees): Order {
            $resolvedItems = $this->resolveItems($storeId, (string) $data['ordered_at'], $items);
            $gross = $this->grossRevenue($resolvedItems);
            $hpp = $this->hppTotal($resolvedItems);

            $order = Order::query()->create([
                'store_id' => $storeId,
                'marketplace_order_id' => trim((string) $data['marketplace_order_id']),
                'ordered_at' => $data['ordered_at'],
                'completed_at' => $data['completed_at'] ?? null,
                'status' => $data['status'],
                'gross_revenue' => $gross,
                'seller_discount' => (int) ($data['seller_discount'] ?? 0),
                'marketplace_discount' => (int) ($data['marketplace_discount'] ?? 0),
                'hpp_total' => $hpp,
                'notes' => $data['notes'] ?? null,
            ]);

            $this->guardDiscount($order);
            $this->guardRefundLimit($order);

            $order->items()->createMany($resolvedItems);

            foreach ($fees as $fee) {
                $this->createFee($order, $fee);
            }

            $order->refresh()->recalculateTotals();

            return $order->refresh();
        });
    }

    /**
     * Memperbarui data pesanan dan mengganti item. Fee dikelola terpisah agar
     * nominal aktual dari marketplace tidak terhapus saat edit pesanan.
     *
     * @param  array<string, mixed>  $data
     * @param  array<int, array<string, mixed>>  $items
     */
    public function update(Order $order, array $data, array $items): Order
    {
        $this->validatePayload((string) $order->store_id, $data, $items, $order);

        return DB::transaction(function () use ($order, $data, $items): Order {
            $resolvedItems = $this->resolveItems(
                (string) $order->store_id,
                (string) $data['ordered_at'],
                $items,
            );

            $order->fill([
                'marketplace_order_id' => trim((string) $data['marketplace_order_id']),
                'ordered_at' => $data['ordered_at'],
                'completed_at' => $data['completed_at'] ?? null,
                'status' => $data['status'],
                'seller_discount' => (int) ($data['seller_discount'] ?? 0),
                'marketplace_discount' => (int) ($data['marketplace_discount'] ?? 0),
                'notes' => $data['notes'] ?? null,
            ]);
            $order->save();

            $order->items()->delete();
            $order->items()->createMany($resolvedItems);

            $order->refresh()->recalculateTotals();

            return $order->refresh();
        });
    }

    public function delete(Order $order): void
    {
        DB::transaction(function () use ($order): void {
            $order->delete();
        });
    }

    /**
     * @param  array<string, mixed>  $data
     */
    public function addFee(Order $order, array $data): MarketplaceFee
    {
        return DB::transaction(fn (): MarketplaceFee => $this->createFee($order, $data));
    }

    public function deleteFee(MarketplaceFee $fee): void
    {
        DB::transaction(function () use ($fee): void {
            $fee->delete();
        });
    }

    /**
     * @param  array<string, mixed>  $data
     */
    public function addRefund(Order $order, array $data): Refund
    {
        $validator = Validator::make($data, [
            'refunded_at' => ['required', 'date'],
            'amount' => ['required', 'integer', 'min:1'],
            'reason' => ['nullable', 'string', 'max:255'],
        ]);

        $validator->after(function ($validator) use ($order, $data): void {
            $net = FinancialCalculator::netRevenue(
                (int) $order->gross_revenue,
                (int) $order->seller_discount,
                0,
            );

            if ((int) ($data['amount'] ?? 0) > $net) {
                $validator->errors()->add(
                    'amount',
                    'Refund tidak boleh melebihi pendapatan neto pesanan ('.Money::rupiah($net).').',
                );
            }

            if ($order->refund()->exists()) {
                $validator->errors()->add('amount', 'Pesanan ini sudah memiliki refund. Satu pesanan hanya boleh direfund satu kali.');
            }
        });

        $validator->validate();

        return DB::transaction(function () use ($order, $data): Refund {
            return $order->refund()->create([
                'refunded_at' => $data['refunded_at'],
                'amount' => (int) $data['amount'],
                'reason' => $data['reason'] ?? null,
            ]);
        });
    }

    public function deleteRefund(Refund $refund): void
    {
        DB::transaction(function () use ($refund): void {
            $refund->delete();
        });
    }

    /**
     * Mencatat dana yang benar-benar dicairkan marketplace untuk satu pesanan.
     *
     * @param  array<string, mixed>  $data
     */
    public function addSettlement(Order $order, array $data): Settlement
    {
        $validator = Validator::make($data, [
            'settled_at' => ['required', 'date'],
            'amount' => ['required', 'integer', 'min:1'],
            'reference' => ['nullable', 'string', 'max:120'],
            'notes' => ['nullable', 'string', 'max:500'],
        ]);

        $validator->after(function ($validator) use ($order, $data): void {
            if (! in_array($order->status, Order::REALIZED_STATUSES, true)) {
                $validator->errors()->add(
                    'amount',
                    'Pencairan hanya dapat dicatat untuk pesanan berstatus Terkirim atau Selesai.',
                );

                return;
            }

            $net = $order->netRevenue();
            $alreadySettled = (int) $order->settlements()->sum('amount');

            if ($alreadySettled + (int) ($data['amount'] ?? 0) > $net) {
                $validator->errors()->add(
                    'amount',
                    'Total pencairan tidak boleh melebihi pendapatan neto pesanan ('.Money::rupiah($net).').',
                );
            }
        });

        $validator->validate();

        return DB::transaction(fn (): Settlement => $order->settlements()->create([
            'store_id' => $order->store_id,
            'settled_at' => $data['settled_at'],
            'amount' => (int) $data['amount'],
            'reference' => $data['reference'] ?? null,
            'notes' => $data['notes'] ?? null,
        ]));
    }

    public function deleteSettlement(Settlement $settlement): void
    {
        DB::transaction(function () use ($settlement): void {
            $settlement->delete();
        });
    }

    /**
     * @param  array<string, mixed>  $data
     * @param  array<int, array<string, mixed>>  $items
     */
    private function validatePayload(string $storeId, array $data, array $items, ?Order $order = null): void
    {
        $validator = Validator::make(
            ['store_id' => $storeId, ...$data],
            [
                'store_id' => ['required', 'uuid', 'exists:stores,id'],
                'marketplace_order_id' => ['required', 'string', 'max:120'],
                'ordered_at' => ['required', 'date'],
                'completed_at' => ['nullable', 'date', 'after_or_equal:ordered_at'],
                'status' => ['required', 'in:'.implode(',', Order::STATUSES)],
                'seller_discount' => ['nullable', 'integer', 'min:0'],
                'marketplace_discount' => ['nullable', 'integer', 'min:0'],
                'notes' => ['nullable', 'string', 'max:2000'],
            ],
            [
                'marketplace_order_id.required' => 'Order ID marketplace wajib diisi.',
                'marketplace_order_id.max' => 'Order ID marketplace maksimal 120 karakter.',
                'ordered_at.required' => 'Tanggal pesanan wajib diisi.',
                'completed_at.after_or_equal' => 'Tanggal selesai tidak boleh sebelum tanggal pesanan.',
                'status.in' => 'Status pesanan tidak dikenal.',
                'seller_discount.min' => 'Diskon penjual tidak boleh negatif.',
                'marketplace_discount.min' => 'Diskon marketplace tidak boleh negatif.',
            ],
        );

        $validator->after(function ($validator) use ($storeId, $data, $items, $order): void {
            $duplicate = Order::query()
                ->where('store_id', $storeId)
                ->where('marketplace_order_id', trim((string) ($data['marketplace_order_id'] ?? '')))
                ->when($order, fn ($query) => $query->whereKeyNot($order->getKey()))
                ->exists();

            if ($duplicate) {
                $validator->errors()->add(
                    'marketplace_order_id',
                    'Order ID ini sudah ada di toko yang sama. Gunakan ID marketplace yang unik.',
                );
            }

            if (! is_array($items) || $items === []) {
                $validator->errors()->add('items', 'Pesanan harus memiliki minimal satu item.');

                return;
            }

            foreach ($items as $index => $item) {
                $line = $index + 1;

                if (empty($item['sku'])) {
                    $validator->errors()->add("items.{$index}.sku", "SKU item {$line} wajib diisi.");
                }
                if (empty($item['product_name'])) {
                    $validator->errors()->add("items.{$index}.product_name", "Nama produk item {$line} wajib diisi.");
                }
                if ((int) ($item['qty'] ?? 0) <= 0) {
                    $validator->errors()->add("items.{$index}.qty", "Jumlah item {$line} harus lebih dari nol.");
                }
                if ((int) ($item['unit_price'] ?? -1) < 0) {
                    $validator->errors()->add("items.{$index}.unit_price", "Harga item {$line} tidak boleh negatif.");
                }
                if (! empty($item['product_id'])) {
                    $product = Product::query()
                        ->whereKey($item['product_id'])
                        ->where('store_id', $storeId)
                        ->first();

                    if (! $product) {
                        $validator->errors()->add(
                            "items.{$index}.product_id",
                            "Produk item {$line} tidak ditemukan pada toko ini.",
                        );
                    }
                }
            }

            $gross = 0;
            foreach ($items as $item) {
                $gross += (int) ($item['qty'] ?? 0) * (int) ($item['unit_price'] ?? 0);
            }

            if ((int) ($data['seller_discount'] ?? 0) > $gross) {
                $validator->errors()->add(
                    'seller_discount',
                    'Diskon penjual tidak boleh melebihi omzet bruto pesanan.',
                );
            }

            if ($order?->refund && (int) $order->refund->amount > $gross - (int) ($data['seller_discount'] ?? 0)) {
                $validator->errors()->add(
                    'seller_discount',
                    'Perubahan ini membuat nilai pesanan lebih kecil dari refund yang sudah tercatat.',
                );
            }
        });

        if ($validator->fails()) {
            throw new ValidationException($validator);
        }
    }

    /**
     * @param  array<int, array<string, mixed>>  $items
     * @return array<int, array<string, mixed>>
     */
    private function resolveItems(string $storeId, string $orderedAt, array $items): array
    {
        $date = CarbonImmutable::parse($orderedAt)->toDateString();

        return array_map(function (array $item) use ($storeId, $date): array {
            $product = null;

            if (! empty($item['product_id'])) {
                $product = Product::query()
                    ->whereKey($item['product_id'])
                    ->where('store_id', $storeId)
                    ->first();
            }

            $snapshot = $item['hpp_unit_snapshot'] ?? null;

            if (($snapshot === null || $snapshot === '') && $product) {
                $snapshot = $product->hppOn($date);
            }

            if ($snapshot === null || $snapshot === '') {
                throw ValidationException::withMessages([
                    'items' => 'HPP item belum diisi dan produk belum memiliki riwayat HPP pada tanggal pesanan.',
                ]);
            }

            if ((int) $snapshot < 0) {
                throw ValidationException::withMessages([
                    'items' => 'HPP item tidak boleh negatif.',
                ]);
            }

            return [
                'product_id' => $product?->id,
                'sku' => trim((string) $item['sku']),
                'product_name' => trim((string) $item['product_name']),
                'qty' => (int) $item['qty'],
                'unit_price' => (int) $item['unit_price'],
                'hpp_unit_snapshot' => (int) $snapshot,
            ];
        }, $items);
    }

    /**
     * @param  array<string, mixed>  $data
     */
    private function createFee(Order $order, array $data): MarketplaceFee
    {
        $basis = (string) ($data['basis'] ?? 'gross');
        $basisAmount = (int) ($data['basis_amount'] ?? 0);
        $rate = isset($data['rate_bp']) && $data['rate_bp'] !== '' ? (int) $data['rate_bp'] : null;
        $amount = isset($data['amount']) && $data['amount'] !== '' ? (int) $data['amount'] : null;

        if ($basisAmount === 0) {
            $basisAmount = match ($basis) {
                'gross' => (int) $order->gross_revenue,
                'net' => FinancialCalculator::netRevenue(
                    (int) $order->gross_revenue,
                    (int) $order->seller_discount,
                    FinancialCalculator::orderRefundTotal($order),
                ),
                'hpp' => (int) $order->hpp_total,
                default => 0,
            };
        }

        if ($amount === null && $rate !== null && $basis !== 'fixed') {
            $amount = Money::divideHalfUp($basisAmount * $rate, 10000);
        }

        $data = [
            'category_id' => $data['category_id'] ?? null,
            'description' => trim((string) ($data['description'] ?? 'Biaya marketplace')),
            'basis' => $basis,
            'basis_amount' => $basisAmount,
            'rate_bp' => $rate,
            'amount' => $amount ?? 0,
            'borne_by' => $data['borne_by'] ?? MarketplaceFee::BORNE_SELLER,
            'is_actual' => (bool) ($data['is_actual'] ?? true),
        ];

        $validator = Validator::make($data, [
            'category_id' => ['nullable', 'uuid', 'exists:marketplace_fee_categories,id'],
            'description' => ['required', 'string', 'max:160'],
            'basis' => ['required', 'in:gross,net,hpp,fixed'],
            'basis_amount' => ['integer', 'min:0'],
            'rate_bp' => ['nullable', 'integer', 'min:0', 'max:10000'],
            'amount' => ['required', 'integer', 'min:0'],
            'borne_by' => ['required', 'in:seller,marketplace'],
            'is_actual' => ['boolean'],
        ], [
            'description.required' => 'Keterangan fee wajib diisi.',
            'amount.min' => 'Nominal fee tidak boleh negatif.',
            'rate_bp.max' => 'Persentase fee maksimal 100%.',
        ]);

        $validator->validate();

        return $order->fees()->create($data);
    }

    private function guardDiscount(Order $order): void
    {
        if ((int) $order->seller_discount > (int) $order->gross_revenue) {
            throw ValidationException::withMessages([
                'seller_discount' => 'Diskon penjual melebihi omzet bruto pesanan.',
            ]);
        }
    }

    private function guardRefundLimit(Order $order): void
    {
        if (! $order->refund) {
            return;
        }

        $net = FinancialCalculator::netRevenue(
            (int) $order->gross_revenue,
            (int) $order->seller_discount,
            0,
        );

        if ((int) $order->refund->amount > $net) {
            throw ValidationException::withMessages([
                'seller_discount' => 'Refund yang sudah tercatat melebihi nilai pesanan setelah diskon.',
            ]);
        }
    }

    /**
     * @param  array<int, array<string, mixed>>  $items
     */
    private function grossRevenue(array $items): int
    {
        return array_sum(array_map(
            fn (array $item): int => (int) $item['qty'] * (int) $item['unit_price'],
            $items,
        ));
    }

    /**
     * @param  array<int, array<string, mixed>>  $items
     */
    private function hppTotal(array $items): int
    {
        return array_sum(array_map(
            fn (array $item): int => (int) $item['qty'] * (int) $item['hpp_unit_snapshot'],
            $items,
        ));
    }
}
