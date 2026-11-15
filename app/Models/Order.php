<?php

namespace App\Models;

use App\Models\Concerns\HasAuditMetadata;
use App\Support\FinancialCalculator;
use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Database\Eloquent\SoftDeletes;

class Order extends Model implements HasAuditMetadata
{
    use HasFactory;
    use HasUuids;
    use SoftDeletes;

    public const STATUSES = [
        'pending', 'processing', 'shipped', 'delivered', 'completed',
        'cancelled', 'returned', 'refunded',
    ];

    /** Pesanan yang sudah menghasilkan penjualan. Pembatalan tidak masuk. */
    public const REALIZED_STATUSES = ['delivered', 'completed'];

    public const STATUS_LABELS = [
        'pending' => 'Pending',
        'processing' => 'Diproses',
        'shipped' => 'Dikirim',
        'delivered' => 'Terkirim',
        'completed' => 'Selesai',
        'cancelled' => 'Batal',
        'returned' => 'Retur',
        'refunded' => 'Refund',
    ];

    protected $fillable = [
        'store_id', 'marketplace_order_id', 'ordered_at', 'completed_at',
        'status', 'gross_revenue', 'seller_discount', 'marketplace_discount',
        'hpp_total', 'notes',
    ];

    protected function casts(): array
    {
        return [
            'ordered_at' => 'date:Y-m-d',
            'completed_at' => 'date:Y-m-d',
            'gross_revenue' => 'integer',
            'seller_discount' => 'integer',
            'marketplace_discount' => 'integer',
            'hpp_total' => 'integer',
        ];
    }

    public function store(): BelongsTo
    {
        return $this->belongsTo(Store::class);
    }

    public function items(): HasMany
    {
        return $this->hasMany(OrderItem::class);
    }

    public function fees(): HasMany
    {
        return $this->hasMany(MarketplaceFee::class);
    }

    public function refund(): HasOne
    {
        return $this->hasOne(Refund::class);
    }

    public function settlements(): HasMany
    {
        return $this->hasMany(Settlement::class);
    }

    public function scopeRealized($query)
    {
        return $query->whereIn('status', self::REALIZED_STATUSES);
    }

    public function recalculateTotals(): void
    {
        $items = $this->items()->get();
        $gross = $items->sum(fn (OrderItem $item) => $item->qty * $item->unit_price);
        $hpp = $items->sum(fn (OrderItem $item) => $item->qty * $item->hpp_unit_snapshot);
        $discount = (int) $this->seller_discount;

        if ($discount > $gross) {
            throw new \DomainException('Diskon penjual tidak boleh melebihi omzet bruto pesanan.');
        }

        $this->forceFill([
            'gross_revenue' => $gross,
            'hpp_total' => $hpp,
        ])->save();
    }

    public function netRevenue(): int
    {
        return FinancialCalculator::netRevenue(
            (int) $this->gross_revenue,
            (int) $this->seller_discount,
            FinancialCalculator::orderRefundTotal($this),
        );
    }

    public function sellerFeesTotal(): int
    {
        return (int) $this->fees()->where('borne_by', 'seller')->sum('amount');
    }

    public function period(): ?string
    {
        return $this->ordered_at ? CarbonImmutable::parse($this->ordered_at)->format('Y-m') : null;
    }

    public function statusLabel(): string
    {
        return self::STATUS_LABELS[$this->status] ?? ucfirst($this->status);
    }

    public function auditStoreId(): ?string
    {
        return $this->store_id;
    }

    public function auditSummary(string $event): string
    {
        return "Pesanan {$this->marketplace_order_id} {$event}";
    }
}
