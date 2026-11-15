<?php

namespace App\Models;

use App\Models\Concerns\HasAuditMetadata;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\SoftDeletes;

class AdvertisingExpense extends Model implements HasAuditMetadata
{
    use HasUuids;
    use SoftDeletes;

    protected $fillable = [
        'store_id', 'ad_campaign_id', 'spent_at', 'amount', 'clicks',
        'impressions', 'attributed_orders', 'attributed_revenue', 'notes',
    ];

    protected function casts(): array
    {
        return [
            'spent_at' => 'date:Y-m-d',
            'amount' => 'integer',
            'clicks' => 'integer',
            'impressions' => 'integer',
            'attributed_orders' => 'integer',
            'attributed_revenue' => 'integer',
        ];
    }

    public function store(): BelongsTo
    {
        return $this->belongsTo(Store::class);
    }

    public function campaign(): BelongsTo
    {
        return $this->belongsTo(AdCampaign::class, 'ad_campaign_id');
    }

    public function roas(): ?float
    {
        if (! $this->attributed_revenue || $this->amount <= 0) {
            return null;
        }

        return round($this->attributed_revenue / $this->amount, 3);
    }

    public function acos(): ?float
    {
        if (! $this->attributed_revenue || $this->amount <= 0) {
            return null;
        }

        return round($this->amount / $this->attributed_revenue * 100, 2);
    }

    public function auditStoreId(): ?string
    {
        return $this->store_id;
    }

    public function auditSummary(string $event): string
    {
        return "Biaya iklan {$event}";
    }
}
