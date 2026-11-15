<?php

namespace Database\Factories;

use App\Models\Marketplace;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Marketplace>
 */
class MarketplaceFactory extends Factory
{
    protected $model = Marketplace::class;

    public function definition(): array
    {
        $code = fake()->unique()->slug(2);

        return [
            'code' => $code,
            'name' => fake()->company(),
            'color' => '#FFA500',
            'active' => true,
        ];
    }
}
