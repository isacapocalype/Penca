<?php

namespace App\Data;

final class ImportResult
{
    public function __construct(
        public readonly string $batchId,
        public readonly string $status,
        public readonly int $rowsTotal,
        public readonly int $rowsImported,
        public readonly int $rowsFailed,
        public readonly int $rowsSkipped,
        public readonly int $ordersImported,
        public readonly bool $duplicateFile = false,
        public readonly bool $hadErrors = false,
    ) {}

    public function summary(): string
    {
        if ($this->duplicateFile) {
            return 'File ini sudah pernah diimport. Tidak ada data baru yang dibuat.';
        }

        return "{$this->ordersImported} pesanan masuk, {$this->rowsFailed} baris gagal, {$this->rowsSkipped} baris dilewati.";
    }
}
