<?php

namespace App\Services;

use App\Models\AuditLog;
use App\Models\Backup;
use App\Models\Setting;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\Log;
use Illuminate\Validation\ValidationException;
use RuntimeException;
use Throwable;

class BackupService
{
    public const SCHEMA_VERSION = 1;

    /**
     * Urutan hapus mengikuti foreign key (anak lebih dulu), sedangkan insert
     * memakai urutan terbalik (induk lebih dulu).
     */
    private const TABLES = [
        'marketplaces',
        'marketplace_fee_categories',
        'stores',
        'tax_profiles',
        'settings',
        'period_locks',
        'products',
        'product_costs',
        'orders',
        'order_items',
        'marketplace_fees',
        'settlements',
        'ad_campaigns',
        'advertising_expenses',
        'operational_expenses',
        'refunds',
        'tax_entries',
        'import_batches',
        'import_errors',
        'audit_logs',
        'backups',
    ];

    /**
     * @return array<int, Backup>
     */
    public function history(int $limit = 20): array
    {
        return Backup::query()
            ->orderByDesc('created_at')
            ->limit($limit)
            ->get()
            ->all();
    }

    public function last(): ?Backup
    {
        return Backup::query()->orderByDesc('created_at')->first();
    }

    public function create(string $reason = 'manual'): Backup
    {
        $this->assertStorageWritable();

        $base = 'penca-'.now()->format('Ymd-His').'-'.$reason;
        $directory = storage_path('app/backups');
        $jsonPath = $directory.'/'.$base.'.json';
        $dbPath = $directory.'/'.$base.'.db';

        $payload = $this->payload();
        $json = json_encode($payload, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);

        if ($json === false) {
            throw new RuntimeException('Data backup gagal diubah menjadi JSON.');
        }

        if (file_put_contents($jsonPath, $json) === false) {
            throw new RuntimeException('File backup JSON tidak dapat ditulis.');
        }

        $dbCreated = false;

        try {
            $dbPath = $this->snapshotDatabase($dbPath);
            $dbCreated = $dbPath !== null;
        } catch (Throwable $exception) {
            @unlink($jsonPath);
            Log::error('Snapshot database gagal dibuat.', ['exception' => $exception]);

            throw new RuntimeException('Backup database gagal dibuat. Periksa ruang penyimpanan lalu coba lagi.', 0, $exception);
        }

        $size = (int) filesize($jsonPath) + ($dbCreated ? (int) filesize($dbPath) : 0);

        $backup = Backup::query()->create([
            'file_name' => $base,
            'json_path' => $jsonPath,
            'db_path' => $dbCreated ? $dbPath : null,
            'size' => $size,
            'schema_version' => self::SCHEMA_VERSION,
            'checksum' => hash_file('sha256', $jsonPath),
            'reason' => $reason,
            'created_at' => now(),
        ]);

        if ($reason === 'auto') {
            Setting::put('last_auto_backup_at', now()->toDateTimeString());
        }

        $this->prune();

        return $backup;
    }

    public function autoBackupIfDue(): ?Backup
    {
        if (! Setting::boolean('auto_backup_enabled', true)) {
            return null;
        }

        $last = Setting::value('last_auto_backup_at');

        if ($last && now()->toDateString() === substr($last, 0, 10)) {
            return null;
        }

        return $this->create('auto');
    }

    /**
     * Restore JSON Penca. Backup pengaman dibuat lebih dulu; bila pembuatan
     * backup pengaman gagal, restore dibatalkan.
     */
    public function restore(string $path): Backup
    {
        if (! is_file($path)) {
            throw ValidationException::withMessages(['file' => 'File backup tidak ditemukan.']);
        }

        $payload = $this->readPayload($path);

        $this->assertStorageWritable();
        $safety = $this->create('pre_restore');

        try {
            DB::transaction(function () use ($payload): void {
                $this->replaceData($payload);
            });
        } catch (Throwable $exception) {
            Log::error('Restore backup gagal.', ['exception' => $exception]);

            throw new RuntimeException(
                'Restore gagal dan data lama tidak diubah. Backup pengaman tersimpan di riwayat.',
                0,
                $exception,
            );
        }

        $matching = Backup::query()->where('checksum', hash_file('sha256', $path))->first();
        $matching?->forceFill(['restored_at' => now()])->save();

        AuditLog::query()->create([
            'auditable_type' => null,
            'auditable_id' => null,
            'store_id' => null,
            'event' => 'restored',
            'summary' => 'Data dipulihkan dari backup '.basename($path),
            'before' => null,
            'after' => ['file' => basename($path), 'restored_at' => now()->toDateTimeString()],
            'created_at' => now(),
        ]);

        return $safety;
    }

    /**
     * @return array{path: string, name: string, mime: string}
     */
    public function sharePath(Backup $backup, string $format = 'json'): array
    {
        $path = $format === 'db' ? $backup->db_path : $backup->json_path;

        if (! $path || ! is_file($path)) {
            throw new RuntimeException('File backup tidak ditemukan di penyimpanan.');
        }

        return [
            'path' => $path,
            'name' => basename($path),
            'mime' => $format === 'db' ? 'application/vnd.sqlite3' : 'application/json',
        ];
    }

    public function prune(): int
    {
        $retention = max(1, Setting::integer('backup_retention', 10));
        $backups = Backup::query()->orderByDesc('created_at')->get();
        $deleted = 0;

        foreach ($backups->slice($retention) as $backup) {
            @unlink($backup->json_path);

            if ($backup->db_path) {
                @unlink($backup->db_path);
            }

            $backup->delete();
            $deleted++;
        }

        return $deleted;
    }

    /**
     * @return array{app: string, schema_version: int, created_at: string, checksum: string, tables: array<string, array<int, array<string, mixed>>>}
     */
    private function payload(): array
    {
        $tables = [];

        foreach (self::TABLES as $table) {
            $tables[$table] = DB::table($table)->get()->map(fn (object $row): array => (array) $row)->all();
        }

        return [
            'app' => 'Penca',
            'schema_version' => self::SCHEMA_VERSION,
            'created_at' => now()->toDateTimeString(),
            'checksum' => hash('sha256', json_encode($tables, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES)),
            'tables' => $tables,
        ];
    }

    /**
     * @return array{app: string, schema_version: int, created_at: string, checksum: string, tables: array<string, array<int, array<string, mixed>>>}
     */
    private function readPayload(string $path): array
    {
        $contents = file_get_contents($path);

        if ($contents === false) {
            throw ValidationException::withMessages(['file' => 'File backup tidak dapat dibaca.']);
        }

        try {
            $payload = json_decode($contents, true, 512, JSON_THROW_ON_ERROR);
        } catch (Throwable) {
            throw ValidationException::withMessages(['file' => 'File bukan backup JSON Penca yang valid.']);
        }

        if (! is_array($payload) || ($payload['app'] ?? null) !== 'Penca') {
            throw ValidationException::withMessages(['file' => 'File bukan backup Penca.']);
        }

        if ((int) ($payload['schema_version'] ?? 0) > self::SCHEMA_VERSION) {
            throw ValidationException::withMessages([
                'file' => 'Backup dibuat oleh versi skema yang lebih baru. Perbarui aplikasi terlebih dahulu.',
            ]);
        }

        if (! isset($payload['tables']) || ! is_array($payload['tables'])) {
            throw ValidationException::withMessages(['file' => 'Struktur tabel backup tidak lengkap.']);
        }

        foreach (['stores', 'orders', 'order_items', 'products', 'settings'] as $required) {
            if (! array_key_exists($required, $payload['tables'])) {
                throw ValidationException::withMessages([
                    'file' => "Backup tidak memiliki tabel wajib {$required}.",
                ]);
            }
        }

        $checksum = hash(
            'sha256',
            json_encode($payload['tables'], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
        );

        if (! hash_equals((string) ($payload['checksum'] ?? ''), $checksum)) {
            throw ValidationException::withMessages([
                'file' => 'Checksum backup tidak cocok. File rusak atau diubah.',
            ]);
        }

        return $payload;
    }

    /**
     * @param  array{tables: array<string, array<int, array<string, mixed>>>}  $payload
     */
    private function replaceData(array $payload): void
    {
        foreach (array_reverse(self::TABLES) as $table) {
            DB::table($table)->delete();
        }

        foreach (self::TABLES as $table) {
            $rows = $payload['tables'][$table] ?? [];

            foreach (array_chunk($rows, 100) as $chunk) {
                if ($chunk !== []) {
                    DB::table($table)->insert($chunk);
                }
            }
        }
    }

    private function snapshotDatabase(string $path): ?string
    {
        $connection = DB::connection();

        if ($connection->getDriverName() !== 'sqlite') {
            throw new RuntimeException('Snapshot .db hanya didukung untuk SQLite.');
        }

        $database = (string) $connection->getDatabaseName();

        if ($database === ':memory:' || ! is_file($database)) {
            return null;
        }

        if (is_file($path)) {
            unlink($path);
        }

        $escaped = str_replace("'", "''", $path);
        DB::statement("VACUUM INTO '{$escaped}'");

        if (! is_file($path)) {
            throw new RuntimeException('Snapshot database tidak terbentuk.');
        }

        return $path;
    }

    private function assertStorageWritable(): void
    {
        $directory = storage_path('app/backups');
        File::ensureDirectoryExists($directory);

        if (! is_writable($directory)) {
            throw new RuntimeException('Folder backup tidak dapat ditulis. Periksa izin penyimpanan.');
        }
    }
}
