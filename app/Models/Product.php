<?php

namespace App\Models;

use App\Models\Concerns\HasAuditMetadata;
use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class Product extends Model implements HasAuditMetadata
{
    use HasFactory;
    use HasUuids;
    use SoftDeletes;

    protected $fillable = ['store_id', 'sku', 'name', 'selling_price', 'active', 'notes'];

    protected function casts(): array
    {
        return [
            'active' => 'boolean',
            'selling_price' => 'integer',
        ];
    }

    public function store(): BelongsTo
    {
        return $this->belongsTo(Store::class);
    }

    public function costs(): HasMany
    {
        return $this->hasMany(ProductCost::class)->orderByDesc('effective_from');
    }

    public function orderItems(): HasMany
    {
        return $this->hasMany(OrderItem::class);
    }

    public function hppOn(string|CarbonImmutable $date): ?int
    {
        $day = $date instanceof CarbonImmutable ? $date->toDateString() : $date;

        $cost = $this->costs()
            ->where('effective_from', '<=', $day)
            ->where(fn ($query) => $query->whereNull('effective_to')->orWhere('effective_to', '>=', $day))
            ->orderByDesc('effective_from')
            ->first();

        return $cost?->hpp_unit;
    }

    public function currentHpp(): ?int
    {
        return $this->hppOn(now()->toDateString());
    }

    public function auditStoreId(): ?string
    {
        return $this->store_id;
    }

    public function auditSummary(string $event): string
    {
        return "Produk {$this->sku} {$event}";
    }
}
