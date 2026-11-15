<?php

namespace App\Models;

use App\Models\Concerns\HasAuditMetadata;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\SoftDeletes;

class MarketplaceFee extends Model implements HasAuditMetadata
{
    use HasUuids;
    use SoftDeletes;

    public const BORNE_SELLER = 'seller';

    public const BORNE_MARKETPLACE = 'marketplace';

    protected $fillable = [
        'order_id', 'category_id', 'description', 'basis', 'basis_amount',
        'rate_bp', 'amount', 'borne_by', 'is_actual',
    ];

    protected function casts(): array
    {
        return [
            'basis_amount' => 'integer',
            'rate_bp' => 'integer',
            'amount' => 'integer',
            'is_actual' => 'boolean',
        ];
    }

    public function order(): BelongsTo
    {
        return $this->belongsTo(Order::class);
    }

    public function category(): BelongsTo
    {
        return $this->belongsTo(MarketplaceFeeCategory::class, 'category_id');
    }

    public function auditStoreId(): ?string
    {
        return $this->order?->store_id;
    }

    public function auditSummary(string $event): string
    {
        return "Fee marketplace {$this->description} {$event}";
    }
}
