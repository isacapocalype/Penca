<?php

namespace App\Models;

use App\Models\Concerns\HasAuditMetadata;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class AuditLog extends Model
{
    use HasUuids;

    public $timestamps = false;

    protected $fillable = [
        'auditable_type', 'auditable_id', 'store_id', 'event', 'summary',
        'before', 'after', 'created_at',
    ];

    protected function casts(): array
    {
        return [
            'before' => 'array',
            'after' => 'array',
            'created_at' => 'datetime',
        ];
    }

    public function store(): BelongsTo
    {
        return $this->belongsTo(Store::class);
    }

    public static function record(Model $model, string $event): void
    {
        if (! $model instanceof HasAuditMetadata) {
            return;
        }

        $attributes = $model->getAttributes();
        unset($attributes['updated_at'], $attributes['deleted_at']);

        $before = null;
        if ($event === 'updated') {
            $changes = array_keys($model->getChanges());
            $before = array_intersect_key($model->getOriginal(), array_flip($changes));
        }

        if ($event === 'deleted') {
            $before = $attributes;
            $attributes = null;
        }

        static::query()->create([
            'auditable_type' => $model::class,
            'auditable_id' => (string) $model->getKey(),
            'store_id' => $model->auditStoreId(),
            'event' => $event,
            'summary' => $model->auditSummary($event),
            'before' => $before,
            'after' => $attributes,
            'created_at' => now(),
        ]);
    }
}
