<?php

namespace App\Models;

use App\Models\Concerns\HasAuditMetadata;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class TaxProfile extends Model implements HasAuditMetadata
{
    use HasUuids;

    public const PPN_NONE = 'none';

    public const PPN_INCLUDED = 'included';

    public const PPN_ADDED = 'added';

    protected $fillable = [
        'store_id', 'pkp', 'ppn_mode', 'ppn_rate_bp', 'pph_rate_bp',
        'pph_basis', 'effective_from', 'effective_to',
    ];

    protected function casts(): array
    {
        return [
            'pkp' => 'boolean',
            'effective_from' => 'date:Y-m-d',
            'effective_to' => 'date:Y-m-d',
            'ppn_rate_bp' => 'integer',
            'pph_rate_bp' => 'integer',
        ];
    }

    public function store(): BelongsTo
    {
        return $this->belongsTo(Store::class);
    }

    public function auditStoreId(): ?string
    {
        return $this->store_id;
    }

    public function auditSummary(string $event): string
    {
        return "Profil pajak toko {$event}";
    }
}
