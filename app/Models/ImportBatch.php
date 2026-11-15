<?php

namespace App\Models;

use App\Models\Concerns\HasAuditMetadata;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class ImportBatch extends Model implements HasAuditMetadata
{
    use HasUuids;

    protected $fillable = [
        'store_id', 'file_name', 'file_hash', 'status', 'column_mapping',
        'rows_total', 'rows_imported', 'rows_failed', 'rows_skipped',
    ];

    protected function casts(): array
    {
        return ['column_mapping' => 'array'];
    }

    public function store(): BelongsTo
    {
        return $this->belongsTo(Store::class);
    }

    public function errors(): HasMany
    {
        return $this->hasMany(ImportError::class);
    }

    public function auditStoreId(): ?string
    {
        return $this->store_id;
    }

    public function auditSummary(string $event): string
    {
        return "Import {$this->file_name} {$event}";
    }
}
