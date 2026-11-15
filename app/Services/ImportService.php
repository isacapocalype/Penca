<?php

namespace App\Services;

use App\Data\ImportFields;
use App\Data\ImportPreview;
use App\Data\ImportResult;
use App\Models\ImportBatch;
use App\Models\ImportError;
use App\Models\Order;
use App\Models\Product;
use App\Support\Import\XlsxReader;
use App\Support\Money;
use Carbon\CarbonImmutable;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\Log;
use Illuminate\Validation\ValidationException;
use RuntimeException;
use Throwable;

class ImportService
{
    private const MAX_BYTES = 10 * 1024 * 1024;

    private const MAX_ROWS = 10000;

    public function __construct(private readonly OrderService $orders) {}

    public function analyze(string $storeId, string $path, string $fileName, array $mapping = []): ImportPreview
    {
        $inspection = $this->inspect($storeId, $path, $fileName, $mapping);

        $validGroups = [];

        foreach ($inspection['valid'] as $row) {
            $validGroups[$row['data']['marketplace_order_id']][] = $row;
        }

        $previewRows = [];

        foreach (array_slice($validGroups, 0, 10, true) as $orderId => $rows) {
            $previewRows[] = [
                'order_id' => $orderId,
                'ordered_at' => $rows[0]['data']['ordered_at'],
                'status' => $rows[0]['data']['status'],
                'items' => count($rows),
                'gross' => array_sum(array_map(
                    fn (array $row): int => $row['data']['qty'] * $row['data']['unit_price'],
                    $rows,
                )),
            ];
        }

        return new ImportPreview(
            fileName: $fileName,
            path: $path,
            headers: $inspection['headers'],
            mapping: $inspection['mapping'],
            rows: $previewRows,
            totalRows: count($inspection['rows']),
            orderCount: count($inspection['order_ids']),
            validRows: count($inspection['valid']),
            invalidRows: count($inspection['rows']) - count($inspection['valid']),
            errors: array_values($inspection['errors']),
        );
    }

    public function commit(string $storeId, string $path, string $fileName, array $mapping): ImportResult
    {
        $inspection = $this->inspect($storeId, $path, $fileName, $mapping);

        if ($inspection['missing'] !== []) {
            throw ValidationException::withMessages([
                'mapping' => 'Kolom wajib belum dipetakan: '.implode(', ', $inspection['missing']).'.',
            ]);
        }

        $hash = hash_file('sha256', $path);

        if ($hash === false) {
            throw new RuntimeException('File import tidak dapat dibaca untuk dihitung checksum-nya.');
        }

        $existingBatch = ImportBatch::query()
            ->where('store_id', $storeId)
            ->where('file_hash', $hash)
            ->first();

        if ($existingBatch && in_array($existingBatch->status, ['completed', 'completed_with_errors'], true)) {
            return new ImportResult(
                batchId: $existingBatch->id,
                status: $existingBatch->status,
                rowsTotal: (int) $existingBatch->rows_total,
                rowsImported: (int) $existingBatch->rows_imported,
                rowsFailed: (int) $existingBatch->rows_failed,
                rowsSkipped: (int) $existingBatch->rows_skipped,
                ordersImported: 0,
                duplicateFile: true,
                hadErrors: (int) $existingBatch->rows_failed > 0,
            );
        }

        $validGroups = [];

        foreach ($inspection['valid'] as $row) {
            $validGroups[$row['data']['marketplace_order_id']][] = $row;
        }

        try {
            return DB::transaction(function () use (
                $storeId,
                $fileName,
                $hash,
                $inspection,
                $validGroups,
            ): ImportResult {
                $batch = ImportBatch::query()->updateOrCreate(
                    ['store_id' => $storeId, 'file_hash' => $hash],
                    [
                        'file_name' => $fileName,
                        'status' => 'processing',
                        'column_mapping' => $inspection['mapping'],
                        'rows_total' => count($inspection['rows']),
                        'rows_imported' => 0,
                        'rows_failed' => 0,
                        'rows_skipped' => 0,
                    ],
                );

                $batch->errors()->delete();

                $failedRows = count($inspection['rows']) - count($inspection['valid']);
                $importedRows = 0;
                $skippedRows = 0;
                $ordersImported = 0;
                $extraErrors = [];
                $existingOrders = $this->existingOrders($storeId, array_keys($validGroups));

                foreach ($validGroups as $orderId => $rows) {
                    if (isset($existingOrders[$orderId])) {
                        $skippedRows += count($rows);

                        continue;
                    }

                    try {
                        DB::transaction(fn () => $this->importOrder($storeId, $rows[0]['data'], $rows));
                        $importedRows += count($rows);
                        $ordersImported++;
                    } catch (ValidationException $exception) {
                        foreach ($rows as $row) {
                            $extraErrors[] = [
                                'row' => $row['row'],
                                'messages' => array_values($exception->errors())[0] ?? ['Pesanan gagal divalidasi.'],
                                'row_data' => $this->rowData($inspection['headers'], $inspection['rows'][$row['row'] - 2] ?? []),
                            ];
                        }
                        $failedRows += count($rows);
                    }
                }

                foreach ($inspection['errors'] as $error) {
                    ImportError::query()->create([
                        'import_batch_id' => $batch->id,
                        'row_number' => $error['row'],
                        'message' => implode(' ', $error['messages']),
                        'row_data' => $this->rowData(
                            $inspection['headers'],
                            $inspection['rows'][$error['row'] - 2] ?? [],
                        ),
                    ]);
                }

                foreach ($extraErrors as $error) {
                    ImportError::query()->create([
                        'import_batch_id' => $batch->id,
                        'row_number' => $error['row'],
                        'message' => implode(' ', $error['messages']),
                        'row_data' => $error['row_data'],
                    ]);
                }

                $status = match (true) {
                    $importedRows === 0 => 'failed',
                    $failedRows > 0 => 'completed_with_errors',
                    default => 'completed',
                };

                $batch->fill([
                    'status' => $status,
                    'rows_imported' => $importedRows,
                    'rows_failed' => $failedRows,
                    'rows_skipped' => $skippedRows,
                ])->save();

                return new ImportResult(
                    batchId: $batch->id,
                    status: $status,
                    rowsTotal: count($inspection['rows']),
                    rowsImported: $importedRows,
                    rowsFailed: $failedRows,
                    rowsSkipped: $skippedRows,
                    ordersImported: $ordersImported,
                    duplicateFile: false,
                    hadErrors: $failedRows > 0,
                );
            });
        } catch (Throwable $exception) {
            Log::error('Import Penca gagal total.', [
                'store_id' => $storeId,
                'file' => $fileName,
                'exception' => $exception,
            ]);

            ImportBatch::query()->updateOrCreate(
                ['store_id' => $storeId, 'file_hash' => $hash],
                [
                    'file_name' => $fileName,
                    'status' => 'failed',
                    'column_mapping' => $inspection['mapping'],
                    'rows_total' => count($inspection['rows']),
                ],
            );

            throw $exception;
        }
    }

    /**
     * @return array{path: string, name: string, mime: string}
     */
    public function exportFailures(ImportBatch $batch): array
    {
        $directory = storage_path('app/exports');
        File::ensureDirectoryExists($directory);
        $path = $directory.'/penca-import-gagal-'.$batch->id.'.csv';
        $handle = fopen($path, 'wb');

        if ($handle === false) {
            throw new RuntimeException('File baris gagal tidak dapat dibuat.');
        }

        fwrite($handle, "\xEF\xBB\xBF");
        fputcsv($handle, ['Baris', 'Pesan', 'Data baris'], ',', '"', '');
        $batch->loadMissing('errors');

        foreach ($batch->errors->sortBy('row_number') as $error) {
            fputcsv($handle, [
                (string) $error->row_number,
                $error->message,
                json_encode($error->row_data, JSON_UNESCAPED_UNICODE),
            ], ',', '"', '');
        }

        fclose($handle);

        return ['path' => $path, 'name' => basename($path), 'mime' => 'text/csv'];
    }

    /**
     * @param  array<string, mixed>  $data
     * @param  array<int, array<string, mixed>>  $rows
     */
    private function importOrder(string $storeId, array $data, array $rows): void
    {
        $items = array_map(fn (array $row): array => [
            'product_id' => $row['data']['product_id'],
            'sku' => $row['data']['sku'],
            'product_name' => $row['data']['product_name'],
            'qty' => $row['data']['qty'],
            'unit_price' => $row['data']['unit_price'],
            'hpp_unit_snapshot' => $row['data']['hpp_unit_snapshot'],
        ], $rows);

        $fees = [];

        if ($data['fee_amount'] !== null || $data['fee_rate_bp'] !== null) {
            $fees[] = [
                'description' => $data['fee_description'] ?: 'Fee marketplace (import)',
                'basis' => $data['fee_basis'],
                'basis_amount' => 0,
                'rate_bp' => $data['fee_rate_bp'],
                'amount' => $data['fee_amount'],
                'borne_by' => 'seller',
                'is_actual' => $data['fee_amount'] !== null,
            ];
        }

        $order = $this->orders->create($storeId, [
            'marketplace_order_id' => $data['marketplace_order_id'],
            'ordered_at' => $data['ordered_at'],
            'completed_at' => $data['completed_at'],
            'status' => $data['status'],
            'seller_discount' => $data['seller_discount'],
            'marketplace_discount' => $data['marketplace_discount'],
            'notes' => $data['notes'],
        ], $items, $fees);

        if ($data['refund_amount'] !== null && $data['refund_amount'] > 0) {
            $this->orders->addRefund($order, [
                'refunded_at' => $data['refunded_at'] ?? $data['ordered_at'],
                'amount' => $data['refund_amount'],
                'reason' => 'Import marketplace',
            ]);
        }
    }

    /**
     * @param  array<int, string>  $orderIds
     * @return array<string, true>
     */
    private function existingOrders(string $storeId, array $orderIds): array
    {
        if ($orderIds === []) {
            return [];
        }

        return Order::query()
            ->withTrashed()
            ->where('store_id', $storeId)
            ->whereIn('marketplace_order_id', $orderIds)
            ->pluck('marketplace_order_id')
            ->mapWithKeys(fn (string $id): array => [$id => true])
            ->all();
    }

    /**
     * @return array{
     *   headers: array<int, string>,
     *   rows: array<int, array<int, string>>,
     *   mapping: array<string, int>,
     *   valid: array<int, array{row: int, data: array<string, mixed>}>,
     *   errors: array<int, array{row: int, messages: array<int, string>}>,
     *   order_ids: array<int, string>,
     *   missing: array<int, string>
     * }
     */
    private function inspect(string $storeId, string $path, string $fileName, array $mapping): array
    {
        if (! File::exists($path)) {
            throw ValidationException::withMessages(['file' => 'File import tidak ditemukan. Pilih ulang file.']);
        }

        if (filesize($path) > self::MAX_BYTES) {
            throw ValidationException::withMessages(['file' => 'Ukuran file melebihi batas 10 MB.']);
        }

        $parsed = $this->read($path, $fileName);
        $headers = $parsed['headers'];
        $rows = $parsed['rows'];

        if (count($rows) > self::MAX_ROWS) {
            throw ValidationException::withMessages(['file' => 'Jumlah baris melebihi batas 10.000 baris.']);
        }

        if ($headers === []) {
            throw ValidationException::withMessages(['file' => 'File tidak memiliki baris judul kolom.']);
        }

        $mapping = $this->normalizeMapping($headers, $mapping);

        $missing = [];

        foreach (ImportFields::REQUIRED as $field) {
            if (! isset($mapping[$field]) || $mapping[$field] < 0) {
                $missing[] = ImportFields::LABELS[$field] ?? $field;
            }
        }

        $productSkus = [];

        foreach ($rows as $row) {
            $sku = $this->value($row, $mapping, 'sku');

            if ($sku !== '') {
                $productSkus[] = $sku;
            }
        }

        $products = Product::query()
            ->with('costs')
            ->where('store_id', $storeId)
            ->whereIn('sku', array_values(array_unique($productSkus)))
            ->get()
            ->keyBy('sku');

        $valid = [];
        $errors = [];
        $orderIds = [];

        foreach ($rows as $index => $row) {
            $orderId = $this->value($row, $mapping, 'marketplace_order_id');

            if ($orderId !== '') {
                $orderIds[] = $orderId;
            }

            [$data, $messages] = $this->validateRow($storeId, $row, $mapping, $products);

            if ($messages !== []) {
                $errors[$index] = ['row' => $index + 2, 'messages' => $messages];

                continue;
            }

            $valid[$index] = ['row' => $index + 2, 'data' => $data];
        }

        $this->enforceCompleteOrders($valid, $errors, $rows, $mapping);
        $this->enforceConsistentOrderData($valid, $errors);
        $this->enforceOrderTotals($valid, $errors);

        return [
            'headers' => $headers,
            'rows' => $rows,
            'mapping' => $mapping,
            'valid' => array_values($valid),
            'errors' => $errors,
            'order_ids' => array_values(array_unique($orderIds)),
            'missing' => $missing,
        ];
    }

    /**
     * Satu order dengan beberapa baris tidak boleh diimpor sebagian.
     *
     * @param  array<int, array{row: int, data: array<string, mixed>}>  $valid
     * @param  array<int, array{row: int, messages: array<int, string>}>  $errors
     */
    private function enforceCompleteOrders(array &$valid, array &$errors, array $rows, array $mapping): void
    {
        $groups = [];

        foreach ($rows as $index => $row) {
            $orderId = $this->value($row, $mapping, 'marketplace_order_id');

            if ($orderId !== '') {
                $groups[$orderId][] = $index;
            }
        }

        foreach ($groups as $orderId => $indexes) {
            $hasError = false;

            foreach ($indexes as $index) {
                if (isset($errors[$index])) {
                    $hasError = true;
                    break;
                }
            }

            if (! $hasError) {
                continue;
            }

            foreach ($indexes as $index) {
                if (! isset($valid[$index])) {
                    continue;
                }

                $errors[$index] = [
                    'row' => $index + 2,
                    'messages' => ["Order {$orderId} tidak diimpor karena ada baris lain pada order ini yang gagal."],
                ];
                unset($valid[$index]);
            }
        }
    }

    /**
     * Nilai level order dan fee/refund harus sama pada semua baris order.
     *
     * @param  array<int, array{row: int, data: array<string, mixed>}>  $valid
     * @param  array<int, array{row: int, messages: array<int, string>}>  $errors
     */
    private function enforceConsistentOrderData(array &$valid, array &$errors): void
    {
        $groups = [];

        foreach ($valid as $index => $row) {
            $groups[$row['data']['marketplace_order_id']][] = $index;
        }

        foreach ($groups as $orderId => $indexes) {
            $conflict = false;

            foreach (['ordered_at', 'completed_at', 'status', 'seller_discount', 'marketplace_discount', 'fee_description', 'fee_amount', 'fee_basis', 'fee_rate_bp', 'refund_amount', 'refunded_at', 'notes'] as $field) {
                $values = array_unique(array_map(
                    fn (int $index): string => (string) ($valid[$index]['data'][$field] ?? ''),
                    $indexes,
                ));

                if (count($values) > 1) {
                    $conflict = true;
                    break;
                }
            }

            if (! $conflict) {
                continue;
            }

            foreach ($indexes as $index) {
                $errors[$index] = [
                    'row' => $valid[$index]['row'],
                    'messages' => ["Data order {$orderId} berbeda antar baris (tanggal/status/diskon/fee/refund). Samakan nilainya."],
                ];
                unset($valid[$index]);
            }
        }
    }

    /**
     * Diskon dan refund divalidasi terhadap total order, bukan per baris.
     *
     * @param  array<int, array{row: int, data: array<string, mixed>}>  $valid
     * @param  array<int, array{row: int, messages: array<int, string>}>  $errors
     */
    private function enforceOrderTotals(array &$valid, array &$errors): void
    {
        $groups = [];

        foreach ($valid as $index => $row) {
            $groups[$row['data']['marketplace_order_id']][] = $index;
        }

        foreach ($groups as $orderId => $indexes) {
            $first = $valid[$indexes[0]]['data'];
            $gross = 0;

            foreach ($indexes as $index) {
                $gross += $valid[$index]['data']['qty'] * $valid[$index]['data']['unit_price'];
            }

            $net = $gross - (int) $first['seller_discount'];
            $refund = $first['refund_amount'];

            if ($net < 0) {
                $this->failGroup($valid, $errors, $indexes, "Diskon penjual order {$orderId} melebihi omzet bruto.");
            } elseif ($refund !== null && $refund > $net) {
                $this->failGroup(
                    $valid,
                    $errors,
                    $indexes,
                    "Refund order {$orderId} melebihi nilai pesanan setelah diskon.",
                );
            }
        }
    }

    /**
     * @param  array<int, array{row: int, data: array<string, mixed>}>  $valid
     * @param  array<int, array{row: int, messages: array<int, string>}>  $errors
     * @param  array<int, int>  $indexes
     */
    private function failGroup(array &$valid, array &$errors, array $indexes, string $message): void
    {
        foreach ($indexes as $index) {
            $errors[$index] = ['row' => $valid[$index]['row'], 'messages' => [$message]];
            unset($valid[$index]);
        }
    }

    /**
     * @param  array<int, string>  $row
     * @param  array<string, int>  $mapping
     * @param  Collection<string, Product>  $products
     * @return array{0: array<string, mixed>, 1: array<int, string>}
     */
    private function validateRow(string $storeId, array $row, array $mapping, $products): array
    {
        $messages = [];

        $orderId = $this->value($row, $mapping, 'marketplace_order_id');
        $orderedAtRaw = $this->value($row, $mapping, 'ordered_at');
        $statusRaw = $this->value($row, $mapping, 'status');
        $sku = $this->value($row, $mapping, 'sku');
        $productName = $this->value($row, $mapping, 'product_name');
        $qtyRaw = $this->value($row, $mapping, 'qty');
        $unitPriceRaw = $this->value($row, $mapping, 'unit_price');

        if ($orderId === '') {
            $messages[] = 'Order ID wajib diisi.';
        } elseif (mb_strlen($orderId) > 120) {
            $messages[] = 'Order ID maksimal 120 karakter.';
        }

        $orderedAt = $this->parseDate($orderedAtRaw);

        if ($orderedAt === null) {
            $messages[] = 'Tanggal pesanan tidak valid. Gunakan format YYYY-MM-DD atau DD/MM/YYYY.';
        }

        $status = $this->normalizeStatus($statusRaw);

        if ($status === null) {
            $messages[] = 'Status pesanan tidak dikenal.';
        }

        if ($sku === '' || mb_strlen($sku) > 80) {
            $messages[] = 'SKU wajib diisi, maksimal 80 karakter.';
        }

        if ($productName === '' || mb_strlen($productName) > 160) {
            $messages[] = 'Nama produk wajib diisi, maksimal 160 karakter.';
        }

        $qty = $this->parseInteger($qtyRaw);

        if ($qty === null || $qty <= 0) {
            $messages[] = 'Jumlah harus bilangan bulat lebih dari nol.';
            $qty = 0;
        }

        $unitPrice = $this->parseMoney($unitPriceRaw);

        if ($unitPrice === null || $unitPrice < 0) {
            $messages[] = 'Harga satuan harus nominal tidak negatif.';
            $unitPrice = 0;
        }

        $completedRaw = $this->value($row, $mapping, 'completed_at');
        $completedAt = $completedRaw === '' ? null : $this->parseDate($completedRaw);

        if ($completedRaw !== '' && $completedAt === null) {
            $messages[] = 'Tanggal selesai tidak valid.';
        }

        if ($orderedAt && $completedAt && $completedAt < $orderedAt) {
            $messages[] = 'Tanggal selesai tidak boleh sebelum tanggal pesanan.';
        }

        $sellerDiscount = $this->parseMoney($this->value($row, $mapping, 'seller_discount')) ?? 0;
        $marketplaceDiscount = $this->parseMoney($this->value($row, $mapping, 'marketplace_discount')) ?? 0;

        if ($sellerDiscount < 0 || $marketplaceDiscount < 0) {
            $messages[] = 'Diskon tidak boleh negatif.';
        }

        $hppRaw = $this->value($row, $mapping, 'hpp_unit_snapshot');
        $hpp = $hppRaw === '' ? null : $this->parseMoney($hppRaw);

        if ($hppRaw !== '' && ($hpp === null || $hpp < 0)) {
            $messages[] = 'HPP satuan tidak valid.';
        }

        $product = $products->get($sku);

        if ($hpp === null && $product && $orderedAt) {
            $hpp = $this->costOn($product, $orderedAt);
        }

        if ($hpp === null) {
            $messages[] = "HPP untuk SKU {$sku} belum diatur pada tanggal pesanan. Tambahkan riwayat HPP atau isi kolom HPP.";
        }

        $feeAmountRaw = $this->value($row, $mapping, 'fee_amount');
        $feeAmount = $feeAmountRaw === '' ? null : $this->parseMoney($feeAmountRaw);

        if ($feeAmountRaw !== '' && ($feeAmount === null || $feeAmount < 0)) {
            $messages[] = 'Nominal fee tidak valid.';
        }

        $feeRateRaw = $this->value($row, $mapping, 'fee_rate_bp');
        $feeRate = $feeRateRaw === '' ? null : $this->parseInteger($feeRateRaw);

        if ($feeRateRaw !== '' && ($feeRate === null || $feeRate < 0 || $feeRate > 10000)) {
            $messages[] = 'Tarif fee (basis poin) harus antara 0 dan 10000.';
        }

        $feeBasis = strtolower($this->value($row, $mapping, 'fee_basis'));

        if ($feeBasis === '') {
            $feeBasis = $feeAmount !== null ? 'fixed' : 'gross';
        }

        if (! in_array($feeBasis, ['gross', 'net', 'hpp', 'fixed'], true)) {
            $messages[] = 'Dasar fee harus gross, net, hpp, atau fixed.';
        }

        $refundRaw = $this->value($row, $mapping, 'refund_amount');
        $refundAmount = $refundRaw === '' ? null : $this->parseMoney($refundRaw);

        if ($refundRaw !== '' && ($refundAmount === null || $refundAmount < 0)) {
            $messages[] = 'Nominal refund tidak valid.';
        }

        $refundedRaw = $this->value($row, $mapping, 'refunded_at');
        $refundedAt = $refundedRaw === '' ? null : $this->parseDate($refundedRaw);

        if ($refundedRaw !== '' && $refundedAt === null) {
            $messages[] = 'Tanggal refund tidak valid.';
        }

        return [[
            'marketplace_order_id' => $orderId,
            'ordered_at' => $orderedAt,
            'completed_at' => $completedAt,
            'status' => $status,
            'seller_discount' => $sellerDiscount,
            'marketplace_discount' => $marketplaceDiscount,
            'notes' => $this->value($row, $mapping, 'notes') ?: null,
            'product_id' => $product?->id,
            'sku' => $sku,
            'product_name' => $productName,
            'qty' => $qty,
            'unit_price' => $unitPrice,
            'hpp_unit_snapshot' => $hpp,
            'fee_description' => $this->value($row, $mapping, 'fee_description') ?: null,
            'fee_amount' => $feeAmount,
            'fee_basis' => $feeBasis,
            'fee_rate_bp' => $feeRate,
            'refund_amount' => $refundAmount,
            'refunded_at' => $refundedAt,
        ], $messages];
    }

    private function costOn(Product $product, string $date): ?int
    {
        $cost = $product->costs
            ->filter(fn ($cost): bool => $cost->effective_from->toDateString() <= $date
                && ($cost->effective_to === null || $cost->effective_to->toDateString() >= $date))
            ->sortByDesc(fn ($cost): string => $cost->effective_from->toDateString())
            ->first();

        return $cost?->hpp_unit;
    }

    /**
     * @return array{headers: array<int, string>, rows: array<int, array<int, string>>}
     */
    private function read(string $path, string $fileName): array
    {
        $extension = strtolower(pathinfo($fileName, PATHINFO_EXTENSION));

        if ($extension === 'xlsx') {
            return (new XlsxReader)->read($path);
        }

        if (! in_array($extension, ['csv', 'txt'], true)) {
            throw ValidationException::withMessages([
                'file' => 'Format file harus CSV atau XLSX.',
            ]);
        }

        $handle = fopen($path, 'rb');

        if ($handle === false) {
            throw ValidationException::withMessages(['file' => 'File import tidak dapat dibaca.']);
        }

        $firstLine = (string) fgets($handle);
        rewind($handle);
        $delimiter = $this->detectDelimiter($firstLine);

        $headers = [];
        $rows = [];
        $line = 0;

        while (($values = fgetcsv($handle, 0, $delimiter, '"', '')) !== false) {
            $line++;

            if ($line === 1) {
                $headers = array_map(function (string $value): string {
                    $value = preg_replace('/^\xEF\xBB\xBF/', '', $value);

                    return trim($value);
                }, $values);

                continue;
            }

            if ($this->rowIsEmpty($values)) {
                continue;
            }

            $rows[] = array_map(fn (mixed $value): string => trim((string) $value), $values);
        }

        fclose($handle);

        return ['headers' => $headers, 'rows' => $rows];
    }

    private function detectDelimiter(string $line): string
    {
        $candidates = [',' => substr_count($line, ','), ';' => substr_count($line, ';'), "\t" => substr_count($line, "\t")];
        arsort($candidates);

        return array_key_first($candidates) ?: ',';
    }

    /**
     * @param  array<int, mixed>  $row
     */
    private function rowIsEmpty(array $row): bool
    {
        foreach ($row as $value) {
            if (trim((string) $value) !== '') {
                return false;
            }
        }

        return true;
    }

    /**
     * @param  array<int, string>  $headers
     * @return array<string, int>
     */
    private function normalizeMapping(array $headers, array $mapping): array
    {
        if ($mapping === []) {
            return ImportFields::autoMap($headers);
        }

        $normalized = [];

        foreach ($mapping as $field => $index) {
            if (! array_key_exists($field, ImportFields::LABELS)) {
                continue;
            }

            $index = (int) $index;

            if ($index >= 0 && $index < count($headers)) {
                $normalized[$field] = $index;
            }
        }

        return $normalized;
    }

    /**
     * @param  array<int, string>  $row
     * @param  array<string, int>  $mapping
     */
    private function value(array $row, array $mapping, string $field): string
    {
        if (! isset($mapping[$field])) {
            return '';
        }

        return trim((string) ($row[$mapping[$field]] ?? ''));
    }

    private function parseMoney(string $value): ?int
    {
        if (trim($value) === '') {
            return null;
        }

        if (! preg_match('/^-?[\d.,\sRp]+$/iu', $value)) {
            return null;
        }

        return Money::parse($value);
    }

    private function parseInteger(string $value): ?int
    {
        $value = trim(str_replace(' ', '', $value));

        if ($value === '' || ! preg_match('/^-?\d+$/', $value)) {
            return null;
        }

        return (int) $value;
    }

    private function parseDate(string $value): ?string
    {
        $value = trim($value);

        if ($value === '') {
            return null;
        }

        if (preg_match('/^\d{5}(\.\d+)?$/', $value)) {
            return XlsxReader::excelDate((int) $value);
        }

        foreach (['Y-m-d', 'd/m/Y', 'd-m-Y', 'Y/m/d', 'd M Y', 'd F Y'] as $format) {
            $date = CarbonImmutable::createFromFormat($format, $value);

            if ($date !== false && $date->format($format) === $value) {
                return $date->toDateString();
            }
        }

        try {
            return CarbonImmutable::parse($value)->toDateString();
        } catch (Throwable) {
            return null;
        }
    }

    private function normalizeStatus(string $value): ?string
    {
        $status = strtolower(trim($value));

        $aliases = [
            'pending' => 'pending',
            'menunggu' => 'pending',
            'processing' => 'processing',
            'diproses' => 'processing',
            'proses' => 'processing',
            'shipped' => 'shipped',
            'dikirim' => 'shipped',
            'delivered' => 'delivered',
            'terkirim' => 'delivered',
            'completed' => 'completed',
            'selesai' => 'completed',
            'cancelled' => 'cancelled',
            'canceled' => 'cancelled',
            'batal' => 'cancelled',
            'dibatalkan' => 'cancelled',
            'returned' => 'returned',
            'retur' => 'returned',
            'refunded' => 'refunded',
            'refund' => 'refunded',
            'dikembalikan' => 'refunded',
        ];

        return $aliases[$status] ?? null;
    }

    /**
     * @param  array<int, string>  $headers
     * @param  array<int, string>  $row
     * @return array<string, string>
     */
    private function rowData(array $headers, array $row): array
    {
        $data = [];

        foreach ($headers as $index => $header) {
            $data[$header !== '' ? $header : 'kolom_'.$index] = (string) ($row[$index] ?? '');
        }

        return $data;
    }
}
