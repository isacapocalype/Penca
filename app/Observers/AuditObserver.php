<?php

namespace App\Observers;

use App\Models\AuditLog;
use App\Models\Concerns\HasAuditMetadata;
use Illuminate\Database\Eloquent\Model;

class AuditObserver
{
    public function created(Model $model): void
    {
        if ($model instanceof HasAuditMetadata) {
            AuditLog::record($model, 'created');
        }
    }

    public function updated(Model $model): void
    {
        if ($model instanceof HasAuditMetadata) {
            $changes = $model->getChanges();
            unset($changes['updated_at']);
            if ($changes !== []) {
                AuditLog::record($model, 'updated');
            }
        }
    }

    public function deleted(Model $model): void
    {
        if ($model instanceof HasAuditMetadata) {
            AuditLog::record($model, 'deleted');
        }
    }
}
