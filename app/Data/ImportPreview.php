<?php

namespace App\Data;

final class ImportPreview
{
    /**
     * @param  array<int, string>  $headers
     * @param  array<string, int>  $mapping
     * @param  array<int, array<string, mixed>>  $rows
     * @param  array<int, array{row: int, messages: array<int, string>}>  $errors
     */
    public function __construct(
        public readonly string $fileName,
        public readonly string $path,
        public readonly array $headers,
        public readonly array $mapping,
        public readonly array $rows,
        public readonly int $totalRows,
        public readonly int $orderCount,
        public readonly int $validRows,
        public readonly int $invalidRows,
        public readonly array $errors = [],
    ) {}

    public function canCommit(): bool
    {
        return $this->validRows > 0;
    }

    /**
     * @return array<int, string>
     */
    public function missingRequiredFields(): array
    {
        $missing = [];

        foreach (ImportFields::REQUIRED as $field) {
            if (! isset($this->mapping[$field]) || $this->mapping[$field] < 0) {
                $missing[] = ImportFields::LABELS[$field] ?? $field;
            }
        }

        return $missing;
    }
}
