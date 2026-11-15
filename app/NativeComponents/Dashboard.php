<?php

namespace App\NativeComponents;

use App\Models\Order;
use App\Native\Concerns\FiltersDashboardRange;
use App\Native\Concerns\HandlesFeedback;
use App\Services\FinancialSummaryService;
use App\Support\Money;
use Carbon\CarbonImmutable;
use Illuminate\View\View;
use Native\Mobile\Edge\Element;
use Native\Mobile\Edge\NativeComponent;

class Dashboard extends NativeComponent
{
    use FiltersDashboardRange;
    use HandlesFeedback;

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
        $summary = app(FinancialSummaryService::class)->forRange($start, $end, $this->selectedStoreId());
        $daily = $this->fillDaily($summary->daily, $start, $end);
        $peak = max(1, ...array_map(fn (array $row): int => max(0, (int) $row['gross']), $daily ?: [['gross' => 0]]));

        $recentOrders = Order::query()
            ->with('store:id,name')
            ->when($this->selectedStoreId(), fn ($query, string $storeId) => $query->where('store_id', $storeId))
            ->orderByDesc('ordered_at')
            ->orderByDesc('created_at')
            ->limit(5)
            ->get();

        return view('native.dashboard', [
            'summary' => $summary,
            'daily' => $daily,
            'peak' => $peak,
            'recentOrders' => $recentOrders,
            'periodOptions' => $this->periodOptions(),
            'storeFilterOptions' => $this->storeFilterOptions(),
            'isCustomRange' => $this->isCustomRange(),
            'todayLabel' => CarbonImmutable::today()->translatedFormat('l, d F Y'),
            'rupiah' => fn (int|float|null $value): string => Money::rupiah($value),
            'compact' => fn (int|float|null $value): string => Money::compact($value),
            'notice' => $this->notice,
            'error' => $this->error,
            'periodLabel' => $this->periodLabel,
            'storeLabel' => $this->storeLabel,
            'customStart' => $this->customStart,
            'customEnd' => $this->customEnd,
        ]);
    }

    /**
     * Isi hari tanpa transaksi dengan nol agar grafik tidak menipu tentang
     * hari yang tidak memiliki penjualan.
     *
     * @param  array<int, array<string, mixed>>  $daily
     * @return array<int, array{date: string, label: string, gross: int, net_profit: int, orders: int}>
     */
    private function fillDaily(array $daily, string $start, string $end): array
    {
        $indexed = collect($daily)->keyBy('date');
        $cursor = CarbonImmutable::parse($start);
        $last = CarbonImmutable::parse($end);

        if ($cursor->diffInDays($last) > 62) {
            return collect($daily)
                ->sortBy('date')
                ->map(fn (array $row): array => [
                    'date' => (string) $row['date'],
                    'label' => CarbonImmutable::parse($row['date'])->translatedFormat('d M'),
                    'gross' => (int) $row['gross'],
                    'net_profit' => (int) $row['net_profit'],
                    'orders' => (int) $row['orders'],
                ])
                ->values()
                ->all();
        }

        $rows = [];

        while ($cursor->lte($last)) {
            $date = $cursor->toDateString();
            $row = $indexed->get($date);

            $rows[] = [
                'date' => $date,
                'label' => $cursor->translatedFormat('d M'),
                'gross' => (int) ($row['gross'] ?? 0),
                'net_profit' => (int) ($row['net_profit'] ?? 0),
                'orders' => (int) ($row['orders'] ?? 0),
            ];

            $cursor = $cursor->addDay();
        }

        return $rows;
    }

    public function openOrder(string $id): void
    {
        $this->navigate('/orders/'.$id);
    }

    public function openStore(string $id): void
    {
        $this->navigate('/stores/'.$id);
    }

    public function goOrders(): void
    {
        $this->navigate('/orders');
    }

    public function goReports(): void
    {
        $this->navigate('/reports');
    }
}
