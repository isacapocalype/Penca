<?php

namespace App\Models;

use App\Models\Concerns\HasAuditMetadata;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\SoftDeletes;

class OrderItem extends Model implements HasAuditMetadata
{
    use HasUuids;
    use SoftDeletes;

    protected $fillable = [
        'order_id', 'product_id', 'sku', 'product_name', 'qty',
        'unit_price', 'hpp_unit_snapshot',
    ];

    protected function casts(): array
    {
        return [
            'qty' => 'integer',
            'unit_price' => 'integer',
            'hpp_unit_snapshot' => 'integer',
        ];
    }

    public function order(): BelongsTo
    {
        return $this->belongsTo(Order::class);
    }

    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class);
    }

    public function lineRevenue(): int
    {
        return $this->qty * $this->unit_price;
    }

    public function lineHpp(): int
    {
        return $this->qty * $this->hpp_unit_snapshot;
    }

    public function auditStoreId(): ?string
    {
        return $this->order?->store_id;
    }

    public function auditSummary(string $event): string
    {
        return "Item pesanan {$this->sku} {$event}";
    }
}
