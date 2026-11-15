<?php

namespace App\Models\Concerns;

interface HasAuditMetadata
{
    public function auditStoreId(): ?string;

    public function auditSummary(string $event): string;
}
