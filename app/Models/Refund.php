<?php

namespace App\Models;

use App\Models\Concerns\HasAuditMetadata;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\SoftDeletes;

class Refund extends Model implements HasAuditMetadata
{
    use HasUuids;
    use SoftDeletes;

    protected $fillable = ['order_id', 'refunded_at', 'amount', 'reason'];

    protected function casts(): array
    {
        return [
            'refunded_at' => 'date:Y-m-d',
            'amount' => 'integer',
        ];
    }

    public function order(): BelongsTo
    {
        return $this->belongsTo(Order::class);
    }

    public function auditStoreId(): ?string
    {
        return $this->order?->store_id;
    }

    public function auditSummary(string $event): string
    {
        return "Refund pesanan {$event}";
    }
}
