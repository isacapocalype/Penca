<?php

namespace App\Models;

use App\Models\Concerns\HasAuditMetadata;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ProductCost extends Model implements HasAuditMetadata
{
    use HasUuids;

    protected $fillable = ['product_id', 'hpp_unit', 'effective_from', 'effective_to', 'notes'];

    protected function casts(): array
    {
        return [
            'hpp_unit' => 'integer',
            'effective_from' => 'date:Y-m-d',
            'effective_to' => 'date:Y-m-d',
        ];
    }

    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class);
    }

    public function auditStoreId(): ?string
    {
        return $this->product?->store_id;
    }

    public function auditSummary(string $event): string
    {
        return "HPP produk {$event}";
    }
}
