<?php

namespace App\Services;

use App\Exceptions\PeriodLockedException;
use App\Models\PeriodLock;
use App\Support\Period;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

class PeriodLockService
{
    public function isLocked(string $period): bool
    {
        return PeriodLock::query()->where('period', $period)->exists();
    }

    public function assertUnlocked(string $period): void
    {
        if ($this->isLocked($period)) {
            throw PeriodLockedException::forPeriod($period);
        }
    }

    public function lock(string $period, string $actor, ?string $notes = null): PeriodLock
    {
        Period::assertFormat($period);

        return DB::transaction(function () use ($period, $actor, $notes): PeriodLock {
            return PeriodLock::query()->firstOrCreate(
                ['period' => $period],
                ['locked_at' => now(), 'locked_by' => $actor, 'notes' => $notes],
            );
        });
    }

    public function unlock(string $period): void
    {
        DB::transaction(function () use ($period): void {
            PeriodLock::query()->where('period', $period)->delete();
        });
    }

    /** @return Collection<int, PeriodLock> */
    public function all(): Collection
    {
        return PeriodLock::query()->orderByDesc('period')->get();
    }
}
