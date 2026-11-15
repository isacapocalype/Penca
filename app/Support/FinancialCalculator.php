<?php

namespace App\Support;

use App\Models\Order;

final class FinancialCalculator
{
    /**
     * Laba operasional belum memperhitungkan PPh Final. PPN tidak pernah
     * mengurangi laba karena merupakan kewajiban/kredit terpisah.
     */
    public static function netRevenue(int $grossRevenue, int $sellerDiscount, int $refund): int
    {
        return $grossRevenue - $sellerDiscount - $refund;
    }

    public static function grossProfit(int $netRevenue, int $hppTotal): int
    {
        return $netRevenue - $hppTotal;
    }

    public static function operatingProfit(int $grossProfit, int $marketplaceFees, int $ads, int $operational): int
    {
        return $grossProfit - $marketplaceFees - $ads - $operational;
    }

    public static function netProfit(int $operatingProfit, int $pphFinal): int
    {
        return $operatingProfit - $pphFinal;
    }

    public static function marginBasisPoints(int $netProfit, int $netRevenue): int
    {
        if ($netRevenue === 0) {
            return 0;
        }

        return Money::divideHalfUp($netProfit * 10000, $netRevenue);
    }

    /** PPN sudah termasuk dalam harga. */
    public static function ppnIncluded(int $baseAmount, int $rateBasisPoints): int
    {
        return Money::divideHalfUp($baseAmount * $rateBasisPoints, 10000 + $rateBasisPoints);
    }

    /** PPN ditambahkan di atas harga. */
    public static function ppnAdded(int $baseAmount, int $rateBasisPoints): int
    {
        return Money::divideHalfUp($baseAmount * $rateBasisPoints, 10000);
    }

    public static function pphFinal(int $baseAmount, int $rateBasisPoints): int
    {
        return Money::divideHalfUp($baseAmount * $rateBasisPoints, 10000);
    }

    public static function orderRefundTotal(Order $order): int
    {
        return (int) ($order->refund?->amount ?? 0);
    }
}
