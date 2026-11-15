<?php

namespace App\Models;

use App\Models\Concerns\HasAuditMetadata;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\SoftDeletes;

class OperationalExpense extends Model implements HasAuditMetadata
{
    use HasUuids;
    use SoftDeletes;

    public const CATEGORIES = [
        'salary' => 'Gaji karyawan',
        'packing' => 'Packing tambahan',
        'transport' => 'Transportasi',
        'electricity' => 'Listrik',
        'warehouse' => 'Gudang',
        'other' => 'Lain-lain',
    ];

    protected $fillable = ['store_id', 'spent_at', 'category', 'amount', 'notes'];

    protected function casts(): array
    {
        return [
            'spent_at' => 'date:Y-m-d',
            'amount' => 'integer',
        ];
    }

    public function store(): BelongsTo
    {
        return $this->belongsTo(Store::class);
    }

    public function categoryLabel(): string
    {
        return self::CATEGORIES[$this->category] ?? ucfirst($this->category);
    }

    public function auditStoreId(): ?string
    {
        return $this->store_id;
    }

    public function auditSummary(string $event): string
    {
        return "Biaya operasional {$event}";
    }
}
