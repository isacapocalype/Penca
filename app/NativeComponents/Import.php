<?php

namespace App\NativeComponents;

use App\Data\ImportFields;
use App\Data\ImportPreview;
use App\Data\ImportResult;
use App\Models\ImportBatch;
use App\Models\Store;
use App\Native\Concerns\HandlesFeedback;
use App\Services\ImportService;
use App\Support\Options;
use Illuminate\Support\Facades\File;
use Illuminate\View\View;
use Native\Mobile\Attributes\On;
use Native\Mobile\Edge\Element;
use Native\Mobile\Edge\NativeComponent;
use Native\Mobile\Facades\Share;
use Smronju\NativephpDocumentPicker\Events\DocumentPicked;
use Smronju\NativephpDocumentPicker\Facades\DocumentPicker;

class Import extends NativeComponent
{
    use HandlesFeedback;

    public string $storeLabel = '';

    public string $stage = 'idle';

    public string $pickedName = '';

    public string $pickedPath = '';

    /** @var array<string, mixed> */
    public array $preview = [];

    /** @var array<string, string> */
    public array $mappingLabels = [];

    /** @var array<string, mixed> */
    public array $result = [];

    public bool $showMapping = false;

    public ?string $lastBatchId = null;

    public function mount(): void
    {
        $stores = Store::query()->active()->orderBy('name')->get();

        if ($stores->count() === 1) {
            $this->storeLabel = Options::storeLabel($stores->first());
        } elseif ($stores->isNotEmpty()) {
            $storeId = $this->query('store_id');

            if (is_string($storeId) && $storeId !== '') {
                $label = array_search($storeId, Options::stores(), true);
                $this->storeLabel = $label === false ? '' : (string) $label;
            }
        }
    }

    public function render(): Element|View
    {
        $stores = Store::query()->active()->orderBy('name')->get();
        $batches = ImportBatch::query()
            ->with('store:id,name')
            ->orderByDesc('created_at')
            ->limit(8)
            ->get();
        $mappingOptions = $this->preview !== []
            ? ImportFields::mappingOptions($this->preview['headers'] ?? [])
            : [];

        return view('native.import', [
            'hasStore' => $stores->isNotEmpty(),
            'storeOptions' => Options::storeValues(),
            'batches' => $batches,
            'mappingOptions' => $mappingOptions,
            'mappingFields' => ImportFields::LABELS,
            'requiredFields' => ImportFields::REQUIRED,
            'missingFields' => $this->missingFields(),
            'stage' => $this->stage,
            'storeLabel' => $this->storeLabel,
            'pickedName' => $this->pickedName,
            'preview' => $this->preview,
            'mappingLabels' => $this->mappingLabels,
            'showMapping' => $this->showMapping,
            'result' => $this->result,
            'lastBatchId' => $this->lastBatchId,
            'notice' => $this->notice,
            'error' => $this->error,
        ]);
    }

    public function updatedStoreLabel(): void
    {
        if ($this->stage === 'preview') {
            $this->resetFlow();
            $this->error = 'Toko berubah. Pilih ulang file agar data tidak masuk ke toko yang salah.';
        }
    }

    public function pickFile(): void
    {
        $this->clearFeedback();

        if (Options::storeIdFromLabel($this->storeLabel) === null) {
            $this->error = 'Pilih toko tujuan import terlebih dahulu.';

            return;
        }

        DocumentPicker::pick([
            'text/csv',
            'text/plain',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        ]);
    }

    #[On(DocumentPicked::class)]
    public function handleDocumentPicked(?string $path = null, ?string $name = null): void
    {
        $this->clearFeedback();

        if ($path === null || ! is_file($path)) {
            return;
        }

        $storeId = Options::storeIdFromLabel($this->storeLabel);

        if ($storeId === null) {
            $this->error = 'Pilih toko tujuan import terlebih dahulu.';

            return;
        }

        $displayName = basename((string) ($name ?? 'import.csv'));
        $extension = strtolower(pathinfo($displayName, PATHINFO_EXTENSION));

        if (! in_array($extension, ['csv', 'txt', 'xlsx'], true)) {
            $this->error = 'Format file harus CSV atau XLSX.';

            return;
        }

        try {
            $directory = storage_path('app/imports');
            File::ensureDirectoryExists($directory);
            $safeName = preg_replace('/[^A-Za-z0-9._-]/', '_', $displayName) ?: 'import.'.$extension;
            $copyPath = $directory.'/'.now()->format('YmdHis').'-'.substr(bin2hex(random_bytes(4)), 0, 8).'-'.$safeName;

            if (! copy($path, $copyPath)) {
                throw new \RuntimeException('File import tidak dapat disalin ke penyimpanan aplikasi.');
            }

            $this->pickedName = $displayName;
            $this->pickedPath = $copyPath;
            $this->analyze($storeId, true);
        } catch (\Throwable $exception) {
            $this->captureFailure($exception, 'File import gagal dibaca. Coba pilih ulang file.');
        }
    }

    public function reanalyze(): void
    {
        $this->clearFeedback();
        $storeId = Options::storeIdFromLabel($this->storeLabel);

        if ($storeId === null || $this->pickedPath === '') {
            $this->error = 'File atau toko belum dipilih.';

            return;
        }

        try {
            $this->analyze($storeId, false);
            $this->flashSuccess('Pemetaan kolom diterapkan ulang.');
        } catch (\Throwable $exception) {
            $this->captureFailure($exception, 'Pemetaan gagal diterapkan.');
        }
    }

    public function commit(): void
    {
        $this->clearFeedback();
        $storeId = Options::storeIdFromLabel($this->storeLabel);

        if ($storeId === null || $this->pickedPath === '') {
            $this->error = 'File atau toko belum dipilih.';

            return;
        }

        try {
            $result = app(ImportService::class)->commit(
                $storeId,
                $this->pickedPath,
                $this->pickedName,
                $this->buildMapping(),
            );

            $this->result = $this->resultArray($result);
            $this->lastBatchId = $result->batchId;
            $this->stage = 'done';
            $this->preview = [];
            $this->flashSuccess($result->summary());
        } catch (\Throwable $exception) {
            $this->captureFailure($exception, 'Import gagal diproses. Tidak ada data yang diubah.');
        }
    }

    public function exportFailures(): void
    {
        $this->clearFeedback();

        if ($this->lastBatchId === null) {
            $this->error = 'Tidak ada batch import untuk diekspor.';

            return;
        }

        $batch = ImportBatch::query()->find($this->lastBatchId);

        if (! $batch) {
            $this->error = 'Batch import tidak ditemukan.';

            return;
        }

        try {
            $file = app(ImportService::class)->exportFailures($batch);
            Share::file('Baris gagal import', 'Penca · '.$file['name'], $file['path']);
            $this->flashSuccess('File baris gagal dibuat dan lembar berbagi dibuka.');
        } catch (\Throwable $exception) {
            $this->captureFailure($exception, 'File baris gagal tidak dapat dibuat.');
        }
    }

    public function resetFlow(): void
    {
        $this->stage = 'idle';
        $this->preview = [];
        $this->mappingLabels = [];
        $this->result = [];
        $this->pickedName = '';
        $this->pickedPath = '';
        $this->showMapping = false;
        $this->lastBatchId = null;
        $this->clearFeedback();
    }

    public function toggleMapping(): void
    {
        $this->showMapping = ! $this->showMapping;
    }

    public function goOrders(): void
    {
        $this->navigate('/orders');
    }

    private function analyze(string $storeId, bool $resetMapping): void
    {
        $preview = app(ImportService::class)->analyze(
            $storeId,
            $this->pickedPath,
            $this->pickedName,
            $resetMapping ? [] : $this->buildMapping(),
        );

        $this->preview = $this->previewArray($preview);

        if ($resetMapping || $this->mappingLabels === []) {
            $this->mappingLabels = $this->labelsFromMapping($preview);
        }

        $this->showMapping = $preview->missingRequiredFields() !== [];
        $this->stage = 'preview';
    }

    /** @return array<string, mixed> */
    private function previewArray(ImportPreview $preview): array
    {
        return [
            'fileName' => $preview->fileName,
            'totalRows' => $preview->totalRows,
            'orderCount' => $preview->orderCount,
            'validRows' => $preview->validRows,
            'invalidRows' => $preview->invalidRows,
            'headers' => $preview->headers,
            'mapping' => $preview->mapping,
            'rows' => $preview->rows,
            'errors' => array_slice($preview->errors, 0, 8),
            'missing' => $preview->missingRequiredFields(),
            'canCommit' => $preview->canCommit(),
        ];
    }

    /** @return array<string, mixed> */
    private function resultArray(ImportResult $result): array
    {
        return [
            'status' => $result->status,
            'rowsTotal' => $result->rowsTotal,
            'rowsImported' => $result->rowsImported,
            'rowsFailed' => $result->rowsFailed,
            'rowsSkipped' => $result->rowsSkipped,
            'ordersImported' => $result->ordersImported,
            'duplicateFile' => $result->duplicateFile,
            'summary' => $result->summary(),
        ];
    }

    /** @return array<string, string> */
    private function labelsFromMapping(ImportPreview $preview): array
    {
        $options = ImportFields::mappingOptions($preview->headers);
        $labels = [];

        foreach (ImportFields::LABELS as $field => $label) {
            $index = $preview->mapping[$field] ?? null;
            $labels[$field] = $index !== null && isset($options[$index]) ? $options[$index] : '';
        }

        return $labels;
    }

    /** @return array<string, int> */
    private function buildMapping(): array
    {
        $mapping = [];

        foreach (ImportFields::LABELS as $field => $label) {
            $selected = $this->mappingLabels[$field] ?? '';

            if ($selected === '' || ! str_contains($selected, ':')) {
                continue;
            }

            [$index] = explode(':', $selected, 2);
            $mapping[$field] = (int) $index;
        }

        return $mapping;
    }

    /** @return array<int, string> */
    private function missingFields(): array
    {
        if ($this->preview === []) {
            return [];
        }

        $mapping = $this->buildMapping();
        $missing = [];

        foreach (ImportFields::REQUIRED as $field) {
            if (! isset($mapping[$field])) {
                $missing[] = ImportFields::LABELS[$field] ?? $field;
            }
        }

        return $missing;
    }
}
