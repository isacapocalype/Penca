<?php

namespace App\NativeComponents;

use App\Models\Backup;
use App\Models\Setting;
use App\Native\Concerns\HandlesFeedback;
use App\Services\BackupService;
use Illuminate\View\View;
use Native\Mobile\Attributes\On;
use Native\Mobile\Edge\Element;
use Native\Mobile\Edge\NativeComponent;
use Native\Mobile\Facades\Share;
use Smronju\NativephpDocumentPicker\Events\DocumentPicked;
use Smronju\NativephpDocumentPicker\Events\DocumentSaved;
use Smronju\NativephpDocumentPicker\Facades\DocumentPicker;

class BackupScreen extends NativeComponent
{
    use HandlesFeedback;

    public string $restorePath = '';

    public string $restoreName = '';

    public bool $confirmRestore = false;

    public function render(): Element|View
    {
        $history = app(BackupService::class)->history(15);
        $last = $history[0] ?? null;

        return view('native.backup', [
            'history' => $history,
            'last' => $last,
            'retention' => max(1, Setting::integer('backup_retention', 10)),
            'autoBackup' => Setting::boolean('auto_backup_enabled', true),
            'lastAutoBackupAt' => Setting::value('last_auto_backup_at'),
            'restorePath' => $this->restorePath,
            'restoreName' => $this->restoreName,
            'confirmRestore' => $this->confirmRestore,
            'sizeLabel' => fn (int $bytes): string => $this->sizeLabel($bytes),
            'notice' => $this->notice,
            'error' => $this->error,
        ]);
    }

    public function createBackup(): void
    {
        $this->clearFeedback();

        try {
            $backup = app(BackupService::class)->create('manual');
            $this->flashSuccess('Backup dibuat: '.$backup->file_name.' ('.$this->sizeLabel((int) $backup->size).').');
        } catch (\Throwable $exception) {
            $this->captureFailure($exception, 'Backup gagal dibuat. Periksa ruang penyimpanan lalu coba lagi.');
        }
    }

    public function share(string $id, string $format = 'json'): void
    {
        $this->clearFeedback();
        $backup = Backup::query()->find($id);

        if (! $backup) {
            $this->error = 'Backup tidak ditemukan.';

            return;
        }

        try {
            $file = app(BackupService::class)->sharePath($backup, $format);
            Share::file(
                'Backup Penca',
                'Backup data keuangan Penca · '.$file['name'],
                $file['path'],
            );
            $this->flashSuccess('Lembar berbagi dibuka untuk '.$file['name'].'.');
        } catch (\Throwable $exception) {
            $this->captureFailure($exception, 'File backup tidak dapat dibagikan.');
        }
    }

    public function saveAs(string $id, string $format = 'json'): void
    {
        $this->clearFeedback();
        $backup = Backup::query()->find($id);

        if (! $backup) {
            $this->error = 'Backup tidak ditemukan.';

            return;
        }

        try {
            $file = app(BackupService::class)->sharePath($backup, $format);
            DocumentPicker::save($file['path'], $file['name'], $file['mime']);
            $this->flashSuccess('Pilih folder tujuan untuk menyimpan '.$file['name'].'.');
        } catch (\Throwable $exception) {
            $this->captureFailure($exception, 'File backup tidak dapat disimpan.');
        }
    }

    public function pickRestore(): void
    {
        $this->clearFeedback();
        $this->confirmRestore = false;
        DocumentPicker::pick(['application/json', 'text/plain']);
    }

    #[On(DocumentPicked::class)]
    public function handleRestorePicked(?string $path = null, ?string $name = null): void
    {
        $this->clearFeedback();

        if ($path === null) {
            return;
        }

        $displayName = basename((string) ($name ?? 'backup.json'));

        if (strtolower(pathinfo($displayName, PATHINFO_EXTENSION)) !== 'json' && strtolower(pathinfo($path, PATHINFO_EXTENSION)) !== 'json') {
            $this->error = 'Restore di aplikasi hanya mendukung file backup JSON Penca. File .db hanya untuk pemulihan darurat di luar aplikasi.';

            return;
        }

        $this->restorePath = $path;
        $this->restoreName = $displayName;
        $this->confirmRestore = false;
    }

    public function askRestore(): void
    {
        if ($this->restorePath === '') {
            $this->error = 'Pilih file backup JSON terlebih dahulu.';

            return;
        }

        $this->confirmRestore = true;
        $this->clearFeedback();
    }

    public function cancelRestore(): void
    {
        $this->confirmRestore = false;
        $this->restorePath = '';
        $this->restoreName = '';
        $this->clearFeedback();
    }

    public function restore(): void
    {
        $this->clearFeedback();

        if ($this->restorePath === '') {
            $this->error = 'File backup belum dipilih.';

            return;
        }

        try {
            app(BackupService::class)->restore($this->restorePath);
            $this->confirmRestore = false;
            $this->restorePath = '';
            $this->restoreName = '';
            $this->flashSuccess('Data berhasil dipulihkan. Backup pengaman sebelum restore tersimpan di riwayat.');
        } catch (\Throwable $exception) {
            $this->captureFailure($exception, 'Restore gagal. Data lama tidak diubah.');
        }
    }

    #[On(DocumentSaved::class)]
    public function handleDocumentSaved(?string $name = null): void
    {
        if ($name !== null) {
            $this->flashSuccess('File disimpan sebagai '.$name.'.');
        }
    }

    public function goSettings(): void
    {
        $this->navigate('/settings');
    }

    private function sizeLabel(int $bytes): string
    {
        if ($bytes >= 1_048_576) {
            return number_format($bytes / 1_048_576, 1, ',', '.').' MB';
        }

        if ($bytes >= 1024) {
            return number_format($bytes / 1024, 1, ',', '.').' KB';
        }

        return $bytes.' B';
    }
}
