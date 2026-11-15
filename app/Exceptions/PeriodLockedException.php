<?php

namespace App\Exceptions;

use DomainException;

class PeriodLockedException extends DomainException
{
    public static function forPeriod(string $period): self
    {
        return new self("Periode {$period} sudah dikunci. Buka kunci melalui Laporan sebelum mengubah data.");
    }
}
