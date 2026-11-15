<?php

namespace App\NativeComponents;

use App\Models\AuditLog;
use App\Models\Backup;
use App\Models\Order;
use App\Models\Setting;
use App\Native\Concerns\HandlesFeedback;
use App\Services\PeriodLockService;
use App\Support\Options;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\ValidationException;
use Illuminate\View\View;
use Native\Mobile\Edge\Element;
use Native\Mobile\Edge\NativeComponent;

class Settings extends NativeComponent
{
    use HandlesFeedback;

    public string $operatorName = '';

    public string $ppnDefault = '';

    public string $pphDefault = '';

    public bool $autoBackup = true;

    public string $backupRetention = '10';

    public string $lockPeriodLabel = '';

    public ?string $confirmUnlockPeriod = null;

    public function mount(): void
    {
        $this->operatorName = (string) Setting::value('operator_name', '');
        $this->ppnDefault = Options::basisPointsToPercent(Setting::integer('ppn_default_bp', 1100));
        $this->pphDefault = Options::basisPointsToPercent(Setting::integer('pph_default_bp', 50));
        $this->autoBackup = Setting::boolean('auto_backup_enabled', true);
        $this->backupRetention = (string) max(1, Setting::integer('backup_retention', 10));
        $this->lockPeriodLabel = Options::monthLabel(now()->format('Y-m'));
    }

    public function render(): Element|View
    {
        $locks = app(PeriodLockService::class)->all();

        return view('native.settings', [
            'locks' => $locks,
            'monthOptions' => Options::monthOptions(),
            'lastAutoBackupAt' => Setting::value('last_auto_backup_at'),
            'lastBackup' => Backup::query()->orderByDesc('created_at')->first(),
            'appVersion' => (string) config('nativephp.app_version', '1.0.0'),
            'schemaVersion' => (string) Setting::value('schema_version', '1'),
            'orderCount' => Order::query()->count(),
            'auditCount' => AuditLog::query()->count(),
            'confirmUnlockPeriod' => $this->confirmUnlockPeriod,
            'notice' => $this->notice,
            'error' => $this->error,
        ]);
    }

    public function saveProfile(): void
    {
        $this->clearFeedback();
        $data = [
            'operator_name' => trim($this->operatorName),
            'ppn_default' => Options::percentToBasisPoints($this->ppnDefault),
            'pph_default' => Options::percentToBasisPoints($this->pphDefault),
        ];

        $validator = Validator::make($data, [
            'operator_name' => ['nullable', 'string', 'max:100'],
            'ppn_default' => ['required', 'integer', 'min:0', 'max:10000'],
            'pph_default' => ['required', 'integer', 'min:0', 'max:10000'],
        ], [
            'ppn_default.max' => 'Tarif PPN tidak boleh lebih dari 100%.',
            'pph_default.max' => 'Tarif PPh tidak boleh lebih dari 100%.',
        ]);

        if ($validator->fails()) {
            $this->captureFailure(new ValidationException($validator));

            return;
        }

        try {
            Setting::put('operator_name', $data['operator_name']);
            Setting::put('ppn_default_bp', $data['ppn_default']);
            Setting::put('pph_default_bp', $data['pph_default']);
            $this->flashSuccess('Pengaturan profil dan tarif default disimpan.');
        } catch (\Throwable $exception) {
            $this->captureFailure($exception, 'Pengaturan gagal disimpan.');
        }
    }

    public function saveBackup(): void
    {
        $this->clearFeedback();
        $retention = (int) trim($this->backupRetention);

        if ($retention < 1 || $retention > 100) {
            $this->error = 'Retensi backup harus antara 1 dan 100 file.';

            return;
        }

        try {
            Setting::put('backup_retention', $retention);
            Setting::put('auto_backup_enabled', $this->autoBackup);
            $this->backupRetention = (string) $retention;
            $this->flashSuccess('Pengaturan backup disimpan. Pangkas otomatis berlaku saat backup berikutnya dibuat.');
        } catch (\Throwable $exception) {
            $this->captureFailure($exception, 'Pengaturan backup gagal disimpan.');
        }
    }

    public function lockPeriod(): void
    {
        $this->clearFeedback();
        $period = Options::periodFromMonthLabel($this->lockPeriodLabel);
        $actor = trim($this->operatorName) !== '' ? trim($this->operatorName) : 'Operator';

        try {
            app(PeriodLockService::class)->lock($period, $actor, 'Dikunci dari Pengaturan');
            $this->confirmUnlockPeriod = null;
            $this->flashSuccess('Periode '.Options::monthLabel($period).' dikunci. Pesanan dan pajak pada periode ini tidak dapat diubah.');
        } catch (\Throwable $exception) {
            $this->captureFailure($exception, 'Periode gagal dikunci.');
        }
    }

    public function askUnlock(string $period): void
    {
        $this->confirmUnlockPeriod = $period;
        $this->clearFeedback();
    }

    public function cancelUnlock(): void
    {
        $this->confirmUnlockPeriod = null;
        $this->clearFeedback();
    }

    public function unlockPeriod(string $period): void
    {
        $this->clearFeedback();

        try {
            app(PeriodLockService::class)->unlock($period);
            $this->confirmUnlockPeriod = null;
            $this->flashSuccess('Kunci periode '.Options::monthLabel($period).' dibuka. Tindakan ini tercatat di audit log.');
        } catch (\Throwable $exception) {
            $this->captureFailure($exception, 'Kunci periode gagal dibuka.');
        }
    }

    public function goBackup(): void
    {
        $this->navigate('/backup');
    }

    public function goAudit(): void
    {
        $this->navigate('/audit');
    }
}
