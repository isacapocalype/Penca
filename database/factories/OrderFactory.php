<?php

namespace Database\Factories;

use App\Models\Order;
use App\Models\Store;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Order>
 */
class OrderFactory extends Factory
{
    protected $model = Order::class;

    public function definition(): array
    {
        return [
            'store_id' => Store::factory(),
            'marketplace_order_id' => fake()->unique()->bothify('INV-########'),
            'ordered_at' => now()->toDateString(),
            'completed_at' => null,
            'status' => 'completed',
            'gross_revenue' => 0,
            'seller_discount' => 0,
            'marketplace_discount' => 0,
            'hpp_total' => 0,
            'notes' => null,
        ];
    }

    public function realized(): static
    {
        return $this->state(fn (): array => ['status' => 'completed']);
    }

    public function pending(): static
    {
        return $this->state(fn (): array => ['status' => 'pending']);
    }
}
