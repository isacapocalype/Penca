<?php

namespace App\NativeComponents;

use App\Models\OperationalExpense;
use App\Models\Store;
use App\Native\Concerns\HandlesFeedback;
use App\Support\Money;
use App\Support\Options;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\ValidationException;
use Illuminate\View\View;
use Native\Mobile\Edge\Element;
use Native\Mobile\Edge\NativeComponent;

class OperationalForm extends NativeComponent
{
    use HandlesFeedback;

    public const GENERAL_STORE = 'Tanpa toko (umum)';

    public ?string $expenseId = null;

    public string $storeLabel = self::GENERAL_STORE;

    public string $categoryLabel = 'Lain-lain';

    public string $spentAt = '';

    public string $amount = '';

    public string $notes = '';

    public function mount(): void
    {
        $this->expenseId = $this->param('id');
        $this->spentAt = now()->toDateString();

        if ($this->expenseId === null) {
            return;
        }

        $expense = OperationalExpense::query()->find($this->expenseId);

        if (! $expense) {
            return;
        }

        if ($expense->store_id) {
            $store = Store::query()->with('marketplace:id,name')->find($expense->store_id);
            $this->storeLabel = $store ? Options::storeLabel($store) : self::GENERAL_STORE;
        }

        $this->categoryLabel = OperationalExpense::CATEGORIES[$expense->category] ?? 'Lain-lain';
        $this->spentAt = $expense->spent_at?->toDateString() ?? now()->toDateString();
        $this->amount = (string) $expense->amount;
        $this->notes = (string) ($expense->notes ?? '');
    }

    public function render(): Element|View
    {
        return view('native.operational-form', [
            'editing' => $this->expenseId !== null,
            'storeOptions' => [self::GENERAL_STORE, ...Options::storeValues()],
            'categoryOptions' => Options::operationalCategories(),
            'notice' => $this->notice,
            'error' => $this->error,
        ]);
    }

    public function save(): void
    {
        $this->clearFeedback();
        $storeId = $this->storeLabel === self::GENERAL_STORE ? null : Options::storeIdFromLabel($this->storeLabel);

        $data = [
            'store_id' => $storeId,
            'spent_at' => $this->spentAt,
            'category' => Options::operationalCategoryFromLabel($this->categoryLabel) ?? 'other',
            'amount' => Money::parse($this->amount),
            'notes' => trim($this->notes) !== '' ? trim($this->notes) : null,
        ];

        $validator = Validator::make($data, [
            'store_id' => ['nullable', 'uuid', 'exists:stores,id'],
            'spent_at' => ['required', 'date'],
            'category' => ['required', 'in:'.implode(',', array_keys(OperationalExpense::CATEGORIES))],
            'amount' => ['required', 'integer', 'min:1'],
            'notes' => ['nullable', 'string', 'max:1000'],
        ], [
            'amount.min' => 'Nominal biaya harus lebih dari nol.',
            'spent_at.required' => 'Tanggal biaya wajib diisi.',
        ]);

        if ($validator->fails()) {
            $this->captureFailure(new ValidationException($validator));

            return;
        }

        try {
            if ($this->expenseId !== null) {
                $expense = OperationalExpense::query()->find($this->expenseId);

                if (! $expense) {
                    throw new \RuntimeException('Biaya operasional tidak ditemukan.');
                }

                $expense->fill($data)->save();
            } else {
                OperationalExpense::query()->create($data);
            }

            $this->replace('/operational');
        } catch (\Throwable $exception) {
            $this->captureFailure($exception, 'Biaya operasional gagal disimpan.');
        }
    }
}
