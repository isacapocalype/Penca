<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Marketplace extends Model
{
    use HasFactory;
    use HasUuids;

    protected $fillable = ['code', 'name', 'color', 'active'];

    protected function casts(): array
    {
        return ['active' => 'boolean'];
    }

    public function stores(): HasMany
    {
        return $this->hasMany(Store::class);
    }
}
