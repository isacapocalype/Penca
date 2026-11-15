<?php

namespace App\Models;

use App\Models\Concerns\HasAuditMetadata;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;

class PeriodLock extends Model implements HasAuditMetadata
{
    use HasUuids;

    protected $fillable = ['period', 'locked_at', 'locked_by', 'notes'];

    protected function casts(): array
    {
        return ['locked_at' => 'datetime'];
    }

    public function auditStoreId(): ?string
    {
        return null;
    }

    public function auditSummary(string $event): string
    {
        return "Periode {$this->period} {$event}";
    }
}
