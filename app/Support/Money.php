<?php

namespace App\Support;

use InvalidArgumentException;

final class Money
{
    /** Pembulatan half-up untuk pembagian bilangan bulat. */
    public static function divideHalfUp(int $numerator, int $denominator): int
    {
        if ($denominator <= 0) {
            throw new InvalidArgumentException('Pembagi harus lebih dari nol.');
        }

        if ($numerator >= 0) {
            return intdiv($numerator + intdiv($denominator, 2), $denominator);
        }

        return -intdiv(abs($numerator) + intdiv($denominator, 2), $denominator);
    }

    /** Format rupiah penuh: Rp 1.250.000 */
    public static function rupiah(int|float|null $amount): string
    {
        return 'Rp '.number_format((int) ($amount ?? 0), 0, ',', '.');
    }

    /** Format ringkas untuk kartu: Rp 1,25 jt */
    public static function compact(int|float|null $amount): string
    {
        $value = (int) ($amount ?? 0);
        $absolute = abs($value);

        if ($absolute >= 1_000_000_000) {
            return 'Rp '.number_format($value / 1_000_000_000, 1, ',', '.').' M';
        }

        if ($absolute >= 1_000_000) {
            return 'Rp '.number_format($value / 1_000_000, 1, ',', '.').' jt';
        }

        if ($absolute >= 1_000) {
            return 'Rp '.number_format($value / 1_000, 0, ',', '.').' rb';
        }

        return self::rupiah($value);
    }

    /** Mengubah input pengguna ("1.250.000", "Rp 1 250 000") menjadi rupiah penuh. */
    public static function parse(string|int|float|null $value): int
    {
        if (is_int($value)) {
            return $value;
        }

        if (is_float($value)) {
            return (int) round($value);
        }

        $clean = preg_replace('/[^0-9-]/', '', (string) $value);

        return $clean === '' || $clean === '-' ? 0 : (int) $clean;
    }

    public static function percentFromBp(int $basisPoints): string
    {
        return number_format($basisPoints / 100, 2, ',', '.').'%';
    }
}
