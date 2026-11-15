<?php

namespace App\Models;

use App\Models\Concerns\HasAuditMetadata;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\SoftDeletes;

class Settlement extends Model implements HasAuditMetadata
{
    use HasUuids;
    use SoftDeletes;

    protected $fillable = ['store_id', 'order_id', 'amount', 'settled_at', 'reference', 'notes'];

    protected function casts(): array
    {
        return [
            'amount' => 'integer',
            'settled_at' => 'date:Y-m-d',
        ];
    }

    public function store(): BelongsTo
    {
        return $this->belongsTo(Store::class);
    }

    public function order(): BelongsTo
    {
        return $this->belongsTo(Order::class);
    }

    public function auditStoreId(): ?string
    {
        return $this->store_id;
    }

    public function auditSummary(string $event): string
    {
        return "Pencairan dana {$event}";
    }
}
