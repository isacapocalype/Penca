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

class Store extends Model implements HasAuditMetadata
{
    use HasFactory;
    use HasUuids;
    use SoftDeletes;

    public const STATUS_ACTIVE = 'active';

    public const STATUS_INACTIVE = 'inactive';

    public const STATUS_ARCHIVED = 'archived';

    protected $fillable = [
        'marketplace_id', 'name', 'username', 'url', 'code', 'status', 'notes',
    ];

    protected static function booted(): void
    {
        static::created(function (Store $store): void {
            if ($store->taxProfiles()->exists()) {
                return;
            }

            $store->taxProfiles()->create([
                'pkp' => false,
                'ppn_mode' => 'none',
                'ppn_rate_bp' => Setting::integer('ppn_default_bp', 1100),
                'pph_rate_bp' => Setting::integer('pph_default_bp', 50),
                'pph_basis' => 'gross',
                'effective_from' => now()->toDateString(),
            ]);
        });
    }

    public function marketplace(): BelongsTo
    {
        return $this->belongsTo(Marketplace::class);
    }

    public function orders(): HasMany
    {
        return $this->hasMany(Order::class);
    }

    public function products(): HasMany
    {
        return $this->hasMany(Product::class);
    }

    public function taxProfiles(): HasMany
    {
        return $this->hasMany(TaxProfile::class)->orderByDesc('effective_from');
    }

    public function advertisingExpenses(): HasMany
    {
        return $this->hasMany(AdvertisingExpense::class);
    }

    public function operationalExpenses(): HasMany
    {
        return $this->hasMany(OperationalExpense::class);
    }

    public function settlements(): HasMany
    {
        return $this->hasMany(Settlement::class);
    }

    public function scopeActive($query)
    {
        return $query->whereIn('status', [self::STATUS_ACTIVE, self::STATUS_INACTIVE]);
    }

    public function taxProfileOn(string|CarbonImmutable $date): ?TaxProfile
    {
        $day = $date instanceof CarbonImmutable ? $date->toDateString() : $date;

        return $this->taxProfiles()
            ->where('effective_from', '<=', $day)
            ->where(fn ($query) => $query->whereNull('effective_to')->orWhere('effective_to', '>=', $day))
            ->orderByDesc('effective_from')
            ->first();
    }

    public function isArchived(): bool
    {
        return $this->status === self::STATUS_ARCHIVED;
    }

    public function auditStoreId(): ?string
    {
        return $this->id;
    }

    public function auditSummary(string $event): string
    {
        return "Toko {$this->name} {$event}";
    }
}
