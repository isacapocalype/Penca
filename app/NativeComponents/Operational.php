<?php

namespace App\NativeComponents;

use App\Models\OperationalExpense;
use App\Native\Concerns\HandlesFeedback;
use App\Support\Money;
use App\Support\Options;
use App\Support\Period;
use Illuminate\View\View;
use Native\Mobile\Edge\Element;
use Native\Mobile\Edge\NativeComponent;

class Operational extends NativeComponent
{
    use HandlesFeedback;

    public string $periodLabel = '';

    public string $storeFilterLabel = 'Semua catatan';

    public ?string $confirmDeleteId = null;

    public function mount(): void
    {
        $this->periodLabel = Options::monthLabel(now()->format('Y-m'));
    }

    public function render(): Element|View
    {
        $period = Options::periodFromMonthLabel($this->periodLabel);
        $start = Period::start($period)->toDateString();
        $end = Period::end($period)->toDateString();
        $storeId = $this->filterStoreId();

        $query = OperationalExpense::query()
            ->with('store:id,name')
            ->whereBetween('spent_at', [$start, $end])
            ->when($this->storeFilterLabel === 'Umum (tanpa toko)', fn ($builder) => $builder->whereNull('store_id'))
            ->when($storeId !== null, fn ($builder, string $value) => $builder->where('store_id', $value));

        $expenses = $query->orderByDesc('spent_at')->limit(200)->get();
        $byCategory = $expenses->groupBy('category')->map(fn ($group): int => (int) $group->sum('amount'));

        return view('native.operational', [
            'expenses' => $expenses,
            'total' => (int) $expenses->sum('amount'),
            'byCategory' => $byCategory,
            'monthOptions' => Options::monthOptions(),
            'filterOptions' => ['Semua catatan', ...Options::storeValues(), 'Umum (tanpa toko)'],
            'periodLabel' => $this->periodLabel,
            'storeFilterLabel' => $this->storeFilterLabel,
            'confirmDeleteId' => $this->confirmDeleteId,
            'categoryLabels' => OperationalExpense::CATEGORIES,
            'rupiah' => fn (int|float|null $value): string => Money::rupiah($value),
            'notice' => $this->notice,
            'error' => $this->error,
        ]);
    }

    public function create(): void
    {
        $this->navigate('/operational/create');
    }

    public function edit(string $id): void
    {
        $this->navigate('/operational/'.$id.'/edit');
    }

    public function askDelete(string $id): void
    {
        $this->confirmDeleteId = $id;
        $this->clearFeedback();
    }

    public function cancelDelete(): void
    {
        $this->confirmDeleteId = null;
        $this->clearFeedback();
    }

    public function deleteExpense(string $id): void
    {
        $this->clearFeedback();
        $expense = OperationalExpense::query()->find($id);

        if (! $expense) {
            $this->error = 'Biaya operasional tidak ditemukan.';

            return;
        }

        try {
            $expense->delete();
            $this->confirmDeleteId = null;
            $this->flashSuccess('Biaya operasional dihapus.');
        } catch (\Throwable $exception) {
            $this->captureFailure($exception, 'Biaya operasional gagal dihapus.');
        }
    }

    private function filterStoreId(): ?string
    {
        if ($this->storeFilterLabel === 'Semua catatan' || $this->storeFilterLabel === 'Umum (tanpa toko)') {
            return null;
        }

        return Options::storeIdFromLabel($this->storeFilterLabel);
    }
}
