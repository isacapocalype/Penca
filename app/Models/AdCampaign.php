<?php

namespace App\Models;

use App\Models\Concerns\HasAuditMetadata;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class AdCampaign extends Model implements HasAuditMetadata
{
    use HasUuids;
    use SoftDeletes;

    protected $fillable = ['store_id', 'name', 'platform', 'active'];

    protected function casts(): array
    {
        return ['active' => 'boolean'];
    }

    public function store(): BelongsTo
    {
        return $this->belongsTo(Store::class);
    }

    public function expenses(): HasMany
    {
        return $this->hasMany(AdvertisingExpense::class);
    }

    public function auditStoreId(): ?string
    {
        return $this->store_id;
    }

    public function auditSummary(string $event): string
    {
        return "Kampanye iklan {$this->name} {$event}";
    }
}
