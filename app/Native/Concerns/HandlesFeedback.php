<?php

namespace App\Native\Concerns;

use App\Exceptions\PeriodLockedException;
use Illuminate\Support\Facades\Log;
use Illuminate\Validation\ValidationException;
use Throwable;

/**
 * Umpan balik layar yang jujur: pesan sukses hanya muncul setelah commit,
 * kesalahan validasi ditampilkan apa adanya, dan kegagalan tak terduga
 * dicatat ke log dengan pesan pengguna yang tidak membocorkan detail internal.
 */
trait HandlesFeedback
{
    public ?string $notice = null;

    public ?string $error = null;

    protected function clearFeedback(): void
    {
        $this->notice = null;
        $this->error = null;
    }

    protected function flashSuccess(string $message): void
    {
        $this->notice = $message;
        $this->error = null;
    }

    protected function captureFailure(Throwable $exception, string $fallback = 'Tindakan gagal. Periksa data lalu coba lagi.'): void
    {
        $this->notice = null;

        if ($exception instanceof ValidationException) {
            $messages = collect($exception->errors())->flatten()->unique()->values();

            $this->error = $messages->isEmpty()
                ? $exception->getMessage()
                : $messages->implode("\n");

            return;
        }

        if ($exception instanceof PeriodLockedException) {
            $this->error = $exception->getMessage();

            return;
        }

        if ($exception instanceof \DomainException) {
            $this->error = $exception->getMessage();

            return;
        }

        Log::error('Layar Penca gagal memproses tindakan.', [
            'screen' => static::class,
            'exception' => $exception,
        ]);

        $this->error = $fallback;
    }

    /** @return array<string, string> */
    protected function feedbackData(): array
    {
        return [
            'notice' => $this->notice,
            'error' => $this->error,
        ];
    }
}
