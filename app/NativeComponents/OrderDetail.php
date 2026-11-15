<?php

namespace App\NativeComponents;

use App\Models\AuditLog;
use App\Models\MarketplaceFee;
use App\Models\Order;
use App\Native\Concerns\HandlesFeedback;
use App\Services\OrderService;
use App\Services\PeriodLockService;
use App\Support\FinancialCalculator;
use App\Support\Money;
use App\Support\Options;
use Illuminate\View\View;
use Native\Mobile\Edge\Element;
use Native\Mobile\Edge\NativeComponent;

class OrderDetail extends NativeComponent
{
    use HandlesFeedback;

    public ?string $orderId = null;

    public bool $confirmDelete = false;

    public bool $confirmRefundDelete = false;

    public bool $showFeeForm = false;

    public string $feeCategoryLabel = '';

    public string $feeDescription = '';

    public string $feeAmount = '';

    public string $feeBorneLabel = 'Ditanggung penjual';

    public bool $showRefundForm = false;

    public string $refundDate = '';

    public string $refundAmount = '';

    public string $refundReason = '';

    public bool $showSettlementForm = false;

    public string $settlementDate = '';

    public string $settlementAmount = '';

    public string $settlementReference = '';

    public string $settlementNotes = '';

    public ?string $confirmSettlementDeleteId = null;

    public function mount(): void
    {
        $this->orderId = $this->param('id');
        $this->refundDate = now()->toDateString();
        $this->settlementDate = now()->toDateString();
    }

    public function render(): Element|View
    {
        $order = $this->order();
        $locked = false;

        if ($order) {
            $locked = $order->period()
                ? app(PeriodLockService::class)->isLocked((string) $order->period())
                : false;
        }

        $fees = $order?->fees ?? collect();
        $sellerFees = $fees->where('borne_by', MarketplaceFee::BORNE_SELLER)->sum('amount');
        $refund = $order?->refund;
        $settlements = $order?->settlements ?? collect();
        $settledTotal = (int) $settlements->sum('amount');
        $netRevenue = $order
            ? FinancialCalculator::netRevenue((int) $order->gross_revenue, (int) $order->seller_discount, (int) ($refund?->amount ?? 0))
            : 0;
        $grossProfit = $order ? (int) $order->gross_revenue - (int) $order->seller_discount - (int) ($refund?->amount ?? 0) - (int) $order->hpp_total : 0;
        $operatingProfit = $grossProfit - (int) $sellerFees;

        return view('native.order-detail', [
            'order' => $order,
            'items' => $order?->items ?? collect(),
            'fees' => $fees,
            'refund' => $refund,
            'settlements' => $settlements,
            'settledTotal' => $settledTotal,
            'remainingToSettle' => max(0, $netRevenue - $settledTotal),
            'locked' => $locked,
            'sellerFees' => (int) $sellerFees,
            'netRevenue' => $netRevenue,
            'grossProfit' => $grossProfit,
            'operatingProfit' => $operatingProfit,
            'feeCategoryOptions' => Options::feeCategoryValues(),
            'feeBorneOptions' => Options::feeBorneValues(),
            'auditLogs' => $order
                ? AuditLog::query()
                    ->where('auditable_type', Order::class)
                    ->where('auditable_id', $order->id)
                    ->orderByDesc('created_at')
                    ->limit(8)
                    ->get()
                : collect(),
            'rupiah' => fn (int|float|null $value): string => Money::rupiah($value),
            'notice' => $this->notice,
            'error' => $this->error,
        ]);
    }

    public function edit(): void
    {
        if ($this->orderId === null) {
            return;
        }

        $this->navigate('/orders/'.$this->orderId.'/edit');
    }

    public function toggleDelete(): void
    {
        $this->confirmDelete = ! $this->confirmDelete;
        $this->clearFeedback();
    }

    public function toggleFeeForm(): void
    {
        $this->showFeeForm = ! $this->showFeeForm;
        $this->clearFeedback();
    }

    public function toggleRefundForm(): void
    {
        $this->showRefundForm = ! $this->showRefundForm;
        $this->confirmRefundDelete = false;
        $this->clearFeedback();
    }

    public function toggleRefundDelete(): void
    {
        $this->confirmRefundDelete = ! $this->confirmRefundDelete;
        $this->showRefundForm = false;
        $this->clearFeedback();
    }

    public function addFee(): void
    {
        $this->clearFeedback();
        $order = $this->order();

        if (! $order) {
            $this->error = 'Pesanan tidak ditemukan.';

            return;
        }

        $categoryLabel = $this->feeCategoryLabel;
        $description = trim($this->feeDescription);
        $categoryId = Options::feeCategoryIdFromLabel($categoryLabel);

        if ($description === '' && $categoryLabel !== '') {
            $description = $categoryLabel;
        }

        try {
            app(OrderService::class)->addFee($order, [
                'category_id' => $categoryId,
                'description' => $description,
                'basis' => 'fixed',
                'basis_amount' => 0,
                'rate_bp' => null,
                'amount' => Money::parse($this->feeAmount),
                'borne_by' => Options::feeBorneFromLabel($this->feeBorneLabel),
                'is_actual' => true,
            ]);

            $this->feeCategoryLabel = '';
            $this->feeDescription = '';
            $this->feeAmount = '';
            $this->showFeeForm = false;
            $this->flashSuccess('Fee marketplace ditambahkan.');
        } catch (\Throwable $exception) {
            $this->captureFailure($exception, 'Fee gagal ditambahkan. Periksa nominal dan coba lagi.');
        }
    }

    public function deleteFee(string $id): void
    {
        $this->clearFeedback();
        $fee = MarketplaceFee::query()->where('order_id', $this->orderId)->find($id);

        if (! $fee) {
            $this->error = 'Fee tidak ditemukan.';

            return;
        }

        try {
            app(OrderService::class)->deleteFee($fee);
            $this->flashSuccess('Fee marketplace dihapus.');
        } catch (\Throwable $exception) {
            $this->captureFailure($exception, 'Fee gagal dihapus.');
        }
    }

    public function addRefund(): void
    {
        $this->clearFeedback();
        $order = $this->order();

        if (! $order) {
            $this->error = 'Pesanan tidak ditemukan.';

            return;
        }

        try {
            app(OrderService::class)->addRefund($order, [
                'refunded_at' => $this->refundDate,
                'amount' => Money::parse($this->refundAmount),
                'reason' => trim($this->refundReason) !== '' ? trim($this->refundReason) : null,
            ]);

            $this->refundAmount = '';
            $this->refundReason = '';
            $this->showRefundForm = false;
            $this->flashSuccess('Refund dicatat. Refund hanya boleh satu kali per pesanan.');
        } catch (\Throwable $exception) {
            $this->captureFailure($exception, 'Refund gagal dicatat. Periksa nominal lalu coba lagi.');
        }
    }

    public function deleteRefund(): void
    {
        $this->clearFeedback();
        $refund = $this->order()?->refund;

        if (! $refund) {
            $this->error = 'Refund tidak ditemukan.';

            return;
        }

        try {
            app(OrderService::class)->deleteRefund($refund);
            $this->confirmRefundDelete = false;
            $this->flashSuccess('Refund dihapus.');
        } catch (\Throwable $exception) {
            $this->captureFailure($exception, 'Refund gagal dihapus.');
        }
    }

    public function toggleSettlementForm(): void
    {
        $this->showSettlementForm = ! $this->showSettlementForm;
        $this->confirmSettlementDeleteId = null;
        $this->clearFeedback();
    }

    public function askDeleteSettlement(string $id): void
    {
        $this->confirmSettlementDeleteId = $id;
        $this->showSettlementForm = false;
        $this->clearFeedback();
    }

    public function cancelDeleteSettlement(): void
    {
        $this->confirmSettlementDeleteId = null;
        $this->clearFeedback();
    }

    public function addSettlement(): void
    {
        $this->clearFeedback();
        $order = $this->order();

        if (! $order) {
            $this->error = 'Pesanan tidak ditemukan.';

            return;
        }

        try {
            app(OrderService::class)->addSettlement($order, [
                'settled_at' => $this->settlementDate,
                'amount' => Money::parse($this->settlementAmount),
                'reference' => trim($this->settlementReference) !== '' ? trim($this->settlementReference) : null,
                'notes' => trim($this->settlementNotes) !== '' ? trim($this->settlementNotes) : null,
            ]);

            $this->settlementAmount = '';
            $this->settlementReference = '';
            $this->settlementNotes = '';
            $this->showSettlementForm = false;
            $this->flashSuccess('Pencairan marketplace dicatat.');
        } catch (\Throwable $exception) {
            $this->captureFailure($exception, 'Pencairan gagal dicatat. Periksa nominal lalu coba lagi.');
        }
    }

    public function deleteSettlement(string $id): void
    {
        $this->clearFeedback();
        $settlement = $this->order()?->settlements()->find($id);

        if (! $settlement) {
            $this->error = 'Pencairan tidak ditemukan.';

            return;
        }

        try {
            app(OrderService::class)->deleteSettlement($settlement);
            $this->confirmSettlementDeleteId = null;
            $this->flashSuccess('Pencairan dihapus.');
        } catch (\Throwable $exception) {
            $this->captureFailure($exception, 'Pencairan gagal dihapus.');
        }
    }

    public function deleteOrder(): void
    {
        $this->clearFeedback();
        $order = $this->order();

        if (! $order) {
            $this->error = 'Pesanan tidak ditemukan.';

            return;
        }

        try {
            app(OrderService::class)->delete($order);
            $this->replace('/orders');
        } catch (\Throwable $exception) {
            $this->captureFailure($exception, 'Pesanan gagal dihapus.');
        }
    }

    public function goOrders(): void
    {
        $this->navigate('/orders');
    }

    private function order(): ?Order
    {
        if ($this->orderId === null) {
            return null;
        }

        return Order::query()
            ->with([
                'store.marketplace',
                'store.taxProfiles',
                'items',
                'fees.category',
                'refund',
                'settlements',
            ])
            ->find($this->orderId);
    }
}
