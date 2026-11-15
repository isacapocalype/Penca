<?php

namespace App\NativeComponents;

use App\Models\Order;
use App\Models\OrderItem;
use App\Native\Concerns\FiltersDashboardRange;
use App\Native\Concerns\HandlesFeedback;
use App\Services\FinancialSummaryService;
use App\Services\ReportExporter;
use App\Support\Money;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\DB;
use Illuminate\View\View;
use Native\Mobile\Edge\Element;
use Native\Mobile\Edge\NativeComponent;
use Native\Mobile\Facades\Share;

class Reports extends NativeComponent
{
    use FiltersDashboardRange;
    use HandlesFeedback;

    public ?string $lastExport = null;

    public function mount(): void
    {
        if ($this->customStart === '') {
            $this->customStart = now()->startOfMonth()->toDateString();
        }

        if ($this->customEnd === '') {
            $this->customEnd = now()->endOfMonth()->toDateString();
        }
    }

    public function render(): Element|View
    {
        [$start, $end] = $this->range();
        $storeId = $this->selectedStoreId();
        $service = app(FinancialSummaryService::class);
        $summary = $service->forRange($start, $end, $storeId);
        [$previousStart, $previousEnd] = $this->previousRange($start, $end);
        $previous = $service->forRange($previousStart, $previousEnd, $storeId);

        $topProducts = OrderItem::query()
            ->select([
                'order_items.sku',
                'order_items.product_name',
                DB::raw('SUM(order_items.qty) as qty'),
                DB::raw('SUM(order_items.qty * order_items.unit_price) as revenue'),
                DB::raw('SUM(order_items.qty * order_items.hpp_unit_snapshot) as hpp'),
            ])
            ->join('orders', 'orders.id', '=', 'order_items.order_id')
            ->whereNull('orders.deleted_at')
            ->whereNull('order_items.deleted_at')
            ->whereIn('orders.status', Order::REALIZED_STATUSES)
            ->whereBetween('orders.ordered_at', [$start, $end])
            ->when($storeId, fn ($query, string $value) => $query->where('orders.store_id', $value))
            ->groupBy('order_items.sku', 'order_items.product_name')
            ->orderByDesc('revenue')
            ->limit(8)
            ->get();

        return view('native.reports', [
            'summary' => $summary,
            'previous' => $previous,
            'previousStart' => $previousStart,
            'previousEnd' => $previousEnd,
            'profitDelta' => $this->delta($summary->netProfit, $previous->netProfit),
            'revenueDelta' => $this->delta($summary->netRevenue, $previous->netRevenue),
            'topProducts' => $topProducts,
            'periodOptions' => $this->periodOptions(),
            'storeFilterOptions' => $this->storeFilterOptions(),
            'isCustomRange' => $this->isCustomRange(),
            'rupiah' => fn (int|float|null $value): string => Money::rupiah($value),
            'compact' => fn (int|float|null $value): string => Money::compact($value),
            'notice' => $this->notice,
            'error' => $this->error,
            'lastExport' => $this->lastExport,
        ]);
    }

    public function exportCsv(): void
    {
        $this->export('csv');
    }

    public function exportXlsx(): void
    {
        $this->export('xlsx');
    }

    public function exportPdf(): void
    {
        $this->export('pdf');
    }

    private function export(string $format): void
    {
        $this->clearFeedback();
        $this->lastExport = null;

        try {
            [$start, $end] = $this->range();
            $summary = app(FinancialSummaryService::class)->forRange($start, $end, $this->selectedStoreId());
            $file = app(ReportExporter::class)->export($summary, $format);

            Share::file(
                'Laporan Penca',
                'Laporan '.$summary->periodLabel().' · '.strtoupper($format),
                $file['path'],
            );

            $this->lastExport = 'File '.strtoupper($format).' siap dibagikan: '.$file['name'];
            $this->flashSuccess('Laporan '.strtoupper($format).' dibuat dan lembar berbagi dibuka.');
        } catch (\Throwable $exception) {
            $this->captureFailure($exception, 'Laporan gagal dibuat. Periksa ruang penyimpanan lalu coba lagi.');
        }
    }

    /** @return array{0: string, 1: string} */
    private function previousRange(string $start, string $end): array
    {
        $startDate = CarbonImmutable::parse($start);
        $endDate = CarbonImmutable::parse($end);
        $days = $startDate->diffInDays($endDate) + 1;

        return match ($this->periodKey()) {
            'this_month' => [
                $startDate->subMonthNoOverflow()->startOfMonth()->toDateString(),
                $startDate->subMonthNoOverflow()->endOfMonth()->toDateString(),
            ],
            'last_month' => [
                $startDate->subMonthNoOverflow()->startOfMonth()->toDateString(),
                $startDate->subMonthNoOverflow()->endOfMonth()->toDateString(),
            ],
            default => [
                $startDate->subDays($days)->toDateString(),
                $startDate->subDay()->toDateString(),
            ],
        };
    }

    private function delta(int $current, int $previous): ?int
    {
        if ($previous === 0) {
            return null;
        }

        return (int) round(($current - $previous) / abs($previous) * 10000);
    }
}
