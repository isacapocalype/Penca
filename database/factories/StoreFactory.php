<?php

namespace Database\Factories;

use App\Models\Marketplace;
use App\Models\Store;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Store>
 */
class StoreFactory extends Factory
{
    protected $model = Store::class;

    public function definition(): array
    {
        $name = fake()->unique()->company();
        $slug = strtoupper(fake()->unique()->bothify('??###'));

        return [
            'marketplace_id' => Marketplace::query()->where('code', 'shopee')->value('id')
                ?? Marketplace::factory(),
            'name' => $name,
            'username' => fake()->userName(),
            'url' => 'https://shopee.co.id/'.$slug,
            'code' => $slug,
            'status' => Store::STATUS_ACTIVE,
            'notes' => null,
        ];
    }

    public function archived(): static
    {
        return $this->state(fn (): array => ['status' => Store::STATUS_ARCHIVED]);
    }
}
