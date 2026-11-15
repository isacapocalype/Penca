<?php

namespace App\Support;

use Carbon\CarbonImmutable;
use DateTimeInterface;
use InvalidArgumentException;

final class Period
{
    public static function fromDate(DateTimeInterface|string $date): string
    {
        return CarbonImmutable::parse($date)->format('Y-m');
    }

    public static function assertFormat(string $period): void
    {
        if (preg_match('/^\d{4}-(0[1-9]|1[0-2])$/', $period) !== 1) {
            throw new InvalidArgumentException('Periode harus dalam format YYYY-MM.');
        }
    }

    public static function start(string $period): CarbonImmutable
    {
        self::assertFormat($period);

        return CarbonImmutable::createFromFormat('Y-m-d', $period.'-01')->startOfDay();
    }

    public static function end(string $period): CarbonImmutable
    {
        return self::start($period)->endOfMonth()->startOfDay();
    }

    public static function label(string $period): string
    {
        $months = [
            1 => 'Januari', 2 => 'Februari', 3 => 'Maret', 4 => 'April',
            5 => 'Mei', 6 => 'Juni', 7 => 'Juli', 8 => 'Agustus',
            9 => 'September', 10 => 'Oktober', 11 => 'November', 12 => 'Desember',
        ];
        [$year, $month] = explode('-', $period);

        return ($months[(int) $month] ?? $month).' '.$year;
    }
}
