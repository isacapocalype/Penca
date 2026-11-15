<?php

namespace App\Services;

use App\Data\FinancialSummary;
use App\Models\AdvertisingExpense;
use App\Models\OperationalExpense;
use App\Models\Order;
use App\Models\Setting;
use App\Models\Settlement;
use App\Models\Store;
use App\Models\TaxEntry;
use App\Models\TaxProfile;
use App\Support\FinancialCalculator;
use Carbon\CarbonImmutable;

class FinancialSummaryService
{
    public function forRange(string $start, string $end, ?string $storeId = null): FinancialSummary
    {
        $startDate = CarbonImmutable::parse($start)->toDateString();
        $endDate = CarbonImmutable::parse($end)->toDateString();
        $store = $storeId ? Store::query()->find($storeId) : null;

        $orders = Order::query()
            ->with(['items:id,order_id,qty,unit_price,hpp_unit_snapshot', 'fees:id,order_id,amount,borne_by', 'refund:id,order_id,amount', 'store:id,name,marketplace_id', 'store.taxProfiles'])
            ->realized()
            ->whereBetween('ordered_at', [$startDate, $endDate])
            ->when($storeId, fn ($query) => $query->where('store_id', $storeId))
            ->get();

        $adsQuery = AdvertisingExpense::query()
            ->whereBetween('spent_at', [$startDate, $endDate])
            ->when($storeId, fn ($query) => $query->where('store_id', $storeId));

        $opQuery = OperationalExpense::query()
            ->whereBetween('spent_at', [$startDate, $endDate])
            ->when($storeId, fn ($query) => $query->where('store_id', $storeId));

        $adsByDate = (clone $adsQuery)->selectRaw('spent_at, SUM(amount) as total')->groupBy('spent_at')->pluck('total', 'spent_at');
        $opByDate = (clone $opQuery)->selectRaw('spent_at, SUM(amount) as total')->groupBy('spent_at')->pluck('total', 'spent_at');

        $totals = [
            'gross' => 0, 'seller_discount' => 0, 'refunds' => 0, 'hpp' => 0,
            'fees' => 0, 'pph' => 0, 'ppn_output' => 0, 'items' => 0,
        ];

        $daily = [];
        $stores = [];

        foreach ($orders as $order) {
            $gross = (int) $order->gross_revenue;
            $discount = (int) $order->seller_discount;
            $hpp = (int) $order->hpp_total;
            $refund = (int) ($order->refund?->amount ?? 0);
            $fees = (int) $order->fees->where('borne_by', 'seller')->sum('amount');
            $net = FinancialCalculator::netRevenue($gross, $discount, $refund);
            $profile = $order->store?->taxProfileOn($order->ordered_at);

            $ppnOutput = $this->outputPpn($profile, $net);
            $pph = $this->pphForOrder($profile, $gross, $net);
            $operating = FinancialCalculator::operatingProfit(
                FinancialCalculator::grossProfit($net, $hpp),
                $fees,
                0,
                0,
            );

            foreach (['gross' => $gross, 'seller_discount' => $discount, 'refunds' => $refund, 'hpp' => $hpp, 'fees' => $fees, 'pph' => $pph, 'ppn_output' => $ppnOutput] as $key => $value) {
                $totals[$key] += $value;
            }
            $totals['items'] += (int) $order->items->sum('qty');

            $date = CarbonImmutable::parse($order->ordered_at)->toDateString();
            $daily[$date] ??= ['date' => $date, 'gross' => 0, 'operating_profit' => 0, 'net_profit' => 0, 'orders' => 0];
            $daily[$date]['gross'] += $gross;
            $daily[$date]['operating_profit'] += $operating;
            $daily[$date]['net_profit'] += $operating - $pph;
            $daily[$date]['orders']++;

            $storeKey = $order->store_id;
            if (! isset($stores[$storeKey])) {
                $stores[$storeKey] = [
                    'store_id' => $storeKey,
                    'name' => $order->store?->name ?? 'Toko',
                    'marketplace' => $order->store?->marketplace?->name ?? '',
                    'gross' => 0,
                    'orders' => 0,
                    'ads' => 0,
                    'fees' => 0,
                    'hpp' => 0,
                    'refunds' => 0,
                    'operating_profit' => 0,
                    'net_profit' => 0,
                ];
            }
            $stores[$storeKey]['gross'] += $gross;
            $stores[$storeKey]['orders']++;
            $stores[$storeKey]['fees'] += $fees;
            $stores[$storeKey]['hpp'] += $hpp;
            $stores[$storeKey]['refunds'] += $refund;
            $stores[$storeKey]['operating_profit'] += $operating;
            $stores[$storeKey]['net_profit'] += $operating - $pph;
        }

        foreach ($adsQuery->with('campaign:id,name')->get() as $expense) {
            $date = CarbonImmutable::parse($expense->spent_at)->toDateString();
            $daily[$date] ??= ['date' => $date, 'gross' => 0, 'operating_profit' => 0, 'net_profit' => 0, 'orders' => 0];
            $daily[$date]['operating_profit'] -= (int) $expense->amount;
            $daily[$date]['net_profit'] -= (int) $expense->amount;

            if (isset($stores[$expense->store_id])) {
                $stores[$expense->store_id]['ads'] += (int) $expense->amount;
                $stores[$expense->store_id]['operating_profit'] -= (int) $expense->amount;
                $stores[$expense->store_id]['net_profit'] -= (int) $expense->amount;
            } else {
                $stores[$expense->store_id] ??= [
                    'store_id' => $expense->store_id,
                    'name' => $expense->store?->name ?? 'Toko',
                    'marketplace' => $expense->store?->marketplace?->name ?? '',
                    'gross' => 0, 'orders' => 0, 'ads' => 0, 'fees' => 0, 'hpp' => 0,
                    'refunds' => 0, 'operating_profit' => 0, 'net_profit' => 0,
                ];
                $stores[$expense->store_id]['ads'] += (int) $expense->amount;
                $stores[$expense->store_id]['operating_profit'] -= (int) $expense->amount;
                $stores[$expense->store_id]['net_profit'] -= (int) $expense->amount;
            }
        }

        foreach ($opQuery->get() as $expense) {
            $date = CarbonImmutable::parse($expense->spent_at)->toDateString();
            $daily[$date] ??= ['date' => $date, 'gross' => 0, 'operating_profit' => 0, 'net_profit' => 0, 'orders' => 0];
            $daily[$date]['operating_profit'] -= (int) $expense->amount;
            $daily[$date]['net_profit'] -= (int) $expense->amount;

            if ($expense->store_id && isset($stores[$expense->store_id])) {
                $stores[$expense->store_id]['operating_profit'] -= (int) $expense->amount;
                $stores[$expense->store_id]['net_profit'] -= (int) $expense->amount;
            }
        }

        ksort($daily);
        ksort($stores);

        $advertising = (int) (clone $adsQuery)->sum('amount');
        $operational = (int) (clone $opQuery)->sum('amount');
        $ppnInput = (int) TaxEntry::query()
            ->where('type', TaxEntry::PPN_INPUT)
            ->whereBetween('period', [substr($startDate, 0, 7), substr($endDate, 0, 7)])
            ->when($storeId, fn ($query) => $query->where('store_id', $storeId))
            ->sum('amount');

        $settlementTotal = (int) Settlement::query()
            ->whereBetween('settled_at', [$startDate, $endDate])
            ->when($storeId, fn ($query) => $query->where('store_id', $storeId))
            ->sum('amount');

        $netRevenue = FinancialCalculator::netRevenue($totals['gross'], $totals['seller_discount'], $totals['refunds']);
        $grossProfit = FinancialCalculator::grossProfit($netRevenue, $totals['hpp']);
        $operatingProfit = FinancialCalculator::operatingProfit($grossProfit, $totals['fees'], $advertising, $operational);
        $netProfit = FinancialCalculator::netProfit($operatingProfit, $totals['pph']);
        $ppnOutput = $totals['ppn_output'];

        return new FinancialSummary(
            start: $startDate,
            end: $endDate,
            storeId: $storeId,
            storeName: $store?->name ?? 'Semua Toko',
            grossRevenue: $totals['gross'],
            sellerDiscount: $totals['seller_discount'],
            refunds: $totals['refunds'],
            netRevenue: $netRevenue,
            hpp: $totals['hpp'],
            grossProfit: $grossProfit,
            marketplaceFees: $totals['fees'],
            advertising: $advertising,
            operational: $operational,
            operatingProfit: $operatingProfit,
            pphFinal: $totals['pph'],
            netProfit: $netProfit,
            marginBp: FinancialCalculator::marginBasisPoints($netProfit, $netRevenue),
            ppnOutput: $ppnOutput,
            ppnInput: $ppnInput,
            ppnPayable: $ppnOutput - $ppnInput,
            orderCount: $orders->count(),
            itemsSold: $totals['items'],
            settlementTotal: $settlementTotal,
            daily: array_values($daily),
            stores: array_values($stores),
        );
    }

    private function outputPpn(?TaxProfile $profile, int $netRevenue): int
    {
        if (! $profile || ! $profile->pkp || $profile->ppn_mode === TaxProfile::PPN_NONE) {
            return 0;
        }

        return $profile->ppn_mode === TaxProfile::PPN_INCLUDED
            ? FinancialCalculator::ppnIncluded($netRevenue, $profile->ppn_rate_bp)
            : FinancialCalculator::ppnAdded($netRevenue, $profile->ppn_rate_bp);
    }

    private function pphForOrder(?TaxProfile $profile, int $gross, int $net): int
    {
        $rate = $profile?->pph_rate_bp ?? Setting::integer('pph_default_bp', 50);
        $basis = ($profile?->pph_basis ?? 'gross') === 'net' ? $net : $gross;

        return FinancialCalculator::pphFinal(max(0, $basis), $rate);
    }
}
