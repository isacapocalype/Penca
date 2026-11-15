<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;

class MarketplaceFeeCategory extends Model
{
    use HasUuids;

    public const BASIS_GROSS = 'gross';

    public const BASIS_NET = 'net';

    public const BASIS_HPP = 'hpp';

    public const BASIS_FIXED = 'fixed';

    protected $fillable = ['code', 'name', 'default_basis', 'active'];

    protected function casts(): array
    {
        return ['active' => 'boolean'];
    }
}
