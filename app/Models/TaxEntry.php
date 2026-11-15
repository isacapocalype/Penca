<?php

namespace App\Models;

use App\Models\Concerns\HasAuditMetadata;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\SoftDeletes;

class TaxEntry extends Model implements HasAuditMetadata
{
    use HasUuids;
    use SoftDeletes;

    public const PPN_OUTPUT = 'ppn_keluaran';

    public const PPN_INPUT = 'ppn_masukan';

    public const PPH_FINAL = 'pph_final';

    public const TYPES = [
        self::PPN_OUTPUT => 'PPN Keluaran',
        self::PPN_INPUT => 'PPN Masukan',
        self::PPH_FINAL => 'PPh Final',
    ];

    public const STATUSES = ['draft', 'reported', 'paid'];

    protected $fillable = [
        'store_id', 'period', 'type', 'base_amount', 'rate_bp',
        'amount', 'status', 'reference', 'notes',
    ];

    protected function casts(): array
    {
        return [
            'base_amount' => 'integer',
            'rate_bp' => 'integer',
            'amount' => 'integer',
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
        return "Entri pajak {$this->period} {$event}";
    }
}
