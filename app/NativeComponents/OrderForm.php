<?php

namespace App\NativeComponents;

use App\Models\Order;
use App\Models\Product;
use App\Models\Store;
use App\Native\Concerns\HandlesFeedback;
use App\Services\OrderService;
use App\Services\PeriodLockService;
use App\Support\Money;
use App\Support\Options;
use Illuminate\Support\Collection;
use Illuminate\View\View;
use Native\Mobile\Edge\Element;
use Native\Mobile\Edge\NativeComponent;

class OrderForm extends NativeComponent
{
    use HandlesFeedback;

    public ?string $orderId = null;

    public string $storeLabel = '';

    public string $marketplaceOrderId = '';

    public string $orderedAt = '';

    public string $completedAt = '';

    public string $statusLabel = 'Pending';

    public string $sellerDiscount = '0';

    public string $marketplaceDiscount = '0';

    public string $notes = '';

    /** @var array<int, array<string, mixed>> */
    public array $items = [];

    /** @var array<int, array<string, mixed>> */
    public array $fees = [];

    public string $itemProductLabel = '';

    public string $itemSku = '';

    public string $itemName = '';

    public string $itemQty = '1';

    public string $itemPrice = '';

    public string $itemHpp = '';

    public string $itemError = '';

    public string $feeDescription = '';

    public string $feeAmount = '';

    public string $feeBorneLabel = 'Ditanggung penjual';

    public bool $showFeeForm = false;

    public function mount(): void
    {
        $this->orderId = $this->param('id');
        $this->orderedAt = now()->toDateString();

        if ($this->orderId !== null) {
            $order = $this->order();

            if ($order) {
                $this->fillFromOrder($order);

                return;
            }
        }

        $stores = Store::query()->active()->with('marketplace:id,name')->orderBy('name')->get();

        if ($stores->count() === 1) {
            $this->storeLabel = Options::storeLabel($stores->first());
        }
    }

    public function render(): Element|View
    {
        $editing = $this->orderId !== null;
        $storeId = $this->currentStoreId();
        $products = $this->products($storeId);
        $locked = false;

        if ($editing && $this->orderId) {
            $order = $this->order();
            $locked = $order?->period()
                ? app(PeriodLockService::class)->isLocked((string) $order->period())
                : false;
        }

        return view('native.order-form', [
            'editing' => $editing,
            'locked' => $locked,
            'storeOptions' => Options::storeValues(),
            'statusOptions' => Options::statuses(),
            'feeBorneOptions' => Options::feeBorneValues(),
            'productOptions' => $products->map(fn (Product $product): string => $this->productLabel($product))->all(),
            'hasStore' => $storeId !== null,
            'hasProducts' => $products->isNotEmpty(),
            'draftGross' => $this->draftGross(),
            'draftHpp' => $this->draftHpp(),
            'rupiah' => fn (int|float|null $value): string => Money::rupiah($value),
            'notice' => $this->notice,
            'error' => $this->error,
        ]);
    }

    public function updatedStoreLabel(): void
    {
        if ($this->orderId !== null) {
            return;
        }

        $this->itemProductLabel = '';
        $this->itemError = '';

        if ($this->items !== []) {
            $this->items = [];
            $this->error = 'Toko berubah, item draft dikosongkan agar data tidak tercampur antar toko.';
        }
    }

    public function updatedOrderedAt(): void
    {
        $this->applyProductDefaults();
    }

    public function updatedItemProductLabel(): void
    {
        $this->applyProductDefaults();
    }

    public function addItem(): void
    {
        $this->clearFeedback();
        $this->itemError = '';

        $sku = trim($this->itemSku);
        $name = trim($this->itemName);
        $qty = (int) Money::parse($this->itemQty);
        $price = Money::parse($this->itemPrice);
        $hpp = Money::parse($this->itemHpp);

        if ($sku === '') {
            $this->itemError = 'SKU item wajib diisi.';

            return;
        }

        if ($name === '') {
            $this->itemError = 'Nama produk item wajib diisi.';

            return;
        }

        if ($qty <= 0) {
            $this->itemError = 'Jumlah item harus lebih dari nol.';

            return;
        }

        if ($price < 0 || $hpp < 0) {
            $this->itemError = 'Harga dan HPP tidak boleh negatif.';

            return;
        }

        if (trim($this->itemHpp) === '') {
            $this->itemError = 'HPP satuan wajib diisi. Gunakan riwayat HPP produk atau isi manual.';

            return;
        }

        $product = $this->productFromLabel($this->itemProductLabel);

        $this->items[] = [
            'product_id' => $product?->id,
            'sku' => $sku,
            'product_name' => $name,
            'qty' => $qty,
            'unit_price' => $price,
            'hpp_unit_snapshot' => $hpp,
        ];

        $this->itemProductLabel = '';
        $this->itemSku = '';
        $this->itemName = '';
        $this->itemQty = '1';
        $this->itemPrice = '';
        $this->itemHpp = '';
    }

    public function removeItem(int $index): void
    {
        if (! isset($this->items[$index])) {
            return;
        }

        unset($this->items[$index]);
        $this->items = array_values($this->items);
    }

    public function addFee(): void
    {
        $this->clearFeedback();

        $description = trim($this->feeDescription);
        $amount = Money::parse($this->feeAmount);

        if ($description === '') {
            $this->error = 'Keterangan fee wajib diisi.';

            return;
        }

        if ($amount <= 0) {
            $this->error = 'Nominal fee harus lebih dari nol.';

            return;
        }

        $this->fees[] = [
            'description' => $description,
            'basis' => 'fixed',
            'basis_amount' => 0,
            'rate_bp' => null,
            'amount' => $amount,
            'borne_by' => Options::feeBorneFromLabel($this->feeBorneLabel),
            'is_actual' => true,
        ];

        $this->feeDescription = '';
        $this->feeAmount = '';
        $this->showFeeForm = false;
    }

    public function removeFee(int $index): void
    {
        if (! isset($this->fees[$index])) {
            return;
        }

        unset($this->fees[$index]);
        $this->fees = array_values($this->fees);
    }

    public function save(): void
    {
        $this->clearFeedback();

        if ($this->items === []) {
            $this->error = 'Pesanan harus memiliki minimal satu item.';

            return;
        }

        $storeId = $this->currentStoreId();

        if ($storeId === null) {
            $this->error = 'Pilih toko terlebih dahulu.';

            return;
        }

        $data = [
            'marketplace_order_id' => trim($this->marketplaceOrderId),
            'ordered_at' => $this->orderedAt,
            'completed_at' => trim($this->completedAt) !== '' ? $this->completedAt : null,
            'status' => Options::statusFromLabel($this->statusLabel) ?? 'pending',
            'seller_discount' => Money::parse($this->sellerDiscount),
            'marketplace_discount' => Money::parse($this->marketplaceDiscount),
            'notes' => trim($this->notes) !== '' ? trim($this->notes) : null,
        ];

        try {
            $service = app(OrderService::class);

            if ($this->orderId !== null) {
                $order = $this->order();

                if (! $order) {
                    throw new \RuntimeException('Pesanan tidak ditemukan.');
                }

                $service->update($order, $data, $this->cleanItems());

                $this->replace('/orders/'.$order->id);

                return;
            }

            $order = $service->create($storeId, $data, $this->cleanItems(), $this->fees);

            $this->replace('/orders/'.$order->id);
        } catch (\Throwable $exception) {
            $this->captureFailure($exception, 'Pesanan gagal disimpan. Periksa data lalu coba lagi.');
        }
    }

    private function order(): ?Order
    {
        if ($this->orderId === null) {
            return null;
        }

        return Order::query()->with('store.marketplace')->find($this->orderId);
    }

    private function fillFromOrder(Order $order): void
    {
        $this->storeLabel = Options::storeLabel($order->store);
        $this->marketplaceOrderId = $order->marketplace_order_id;
        $this->orderedAt = $order->ordered_at?->toDateString() ?? now()->toDateString();
        $this->completedAt = $order->completed_at?->toDateString() ?? '';
        $this->statusLabel = $order->statusLabel();
        $this->sellerDiscount = (string) $order->seller_discount;
        $this->marketplaceDiscount = (string) $order->marketplace_discount;
        $this->notes = (string) ($order->notes ?? '');
        $this->items = $order->items()
            ->orderBy('created_at')
            ->get()
            ->map(fn ($item): array => [
                'product_id' => $item->product_id,
                'sku' => $item->sku,
                'product_name' => $item->product_name,
                'qty' => (int) $item->qty,
                'unit_price' => (int) $item->unit_price,
                'hpp_unit_snapshot' => (int) $item->hpp_unit_snapshot,
            ])
            ->all();
    }

    private function currentStoreId(): ?string
    {
        if ($this->orderId !== null) {
            return $this->order()?->store_id;
        }

        return Options::storeIdFromLabel($this->storeLabel);
    }

    /** @return Collection<int, Product> */
    private function products(?string $storeId): Collection
    {
        if ($storeId === null) {
            return collect();
        }

        return Product::query()
            ->where('store_id', $storeId)
            ->where('active', true)
            ->with('costs')
            ->orderBy('name')
            ->get();
    }

    private function productLabel(Product $product): string
    {
        $hpp = $product->hppOn($this->orderedAt !== '' ? $this->orderedAt : now()->toDateString());

        return $product->sku.' · '.$product->name.' · HPP '.($hpp === null ? 'belum ada' : Money::rupiah($hpp));
    }

    private function productFromLabel(?string $label): ?Product
    {
        if ($label === null || $label === '') {
            return null;
        }

        return $this->products($this->currentStoreId())
            ->first(fn (Product $product): bool => $this->productLabel($product) === $label);
    }

    private function applyProductDefaults(): void
    {
        $this->itemError = '';
        $product = $this->productFromLabel($this->itemProductLabel);

        if (! $product) {
            return;
        }

        $hpp = $product->hppOn($this->orderedAt !== '' ? $this->orderedAt : now()->toDateString());

        $this->itemSku = $product->sku;
        $this->itemName = $product->name;
        $this->itemPrice = (string) $product->selling_price;
        $this->itemHpp = $hpp !== null ? (string) $hpp : '';

        if ($hpp === null) {
            $this->itemError = 'Produk ini belum punya HPP pada tanggal pesanan. Isi HPP satuan secara manual.';
        }
    }

    /** @return array<int, array<string, mixed>> */
    private function cleanItems(): array
    {
        return array_map(fn (array $item): array => [
            'product_id' => $item['product_id'] ?? null,
            'sku' => (string) ($item['sku'] ?? ''),
            'product_name' => (string) ($item['product_name'] ?? ''),
            'qty' => (int) ($item['qty'] ?? 0),
            'unit_price' => (int) ($item['unit_price'] ?? 0),
            'hpp_unit_snapshot' => (int) ($item['hpp_unit_snapshot'] ?? 0),
        ], $this->items);
    }

    private function draftGross(): int
    {
        return array_sum(array_map(
            fn (array $item): int => (int) ($item['qty'] ?? 0) * (int) ($item['unit_price'] ?? 0),
            $this->items,
        ));
    }

    private function draftHpp(): int
    {
        return array_sum(array_map(
            fn (array $item): int => (int) ($item['qty'] ?? 0) * (int) ($item['hpp_unit_snapshot'] ?? 0),
            $this->items,
        ));
    }
}
