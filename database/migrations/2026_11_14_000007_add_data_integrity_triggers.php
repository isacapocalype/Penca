<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * SQLite tidak mendukung ALTER TABLE ADD CHECK. Trigger menjaga integritas
     * nominal ketika data ditulis dari luar layanan aplikasi sekalipun.
     */
    public function up(): void
    {
        $triggers = [
            "CREATE TRIGGER IF NOT EXISTS order_items_qty_positive_insert BEFORE INSERT ON order_items
                WHEN NEW.qty <= 0 OR NEW.unit_price < 0 OR NEW.hpp_unit_snapshot < 0
                BEGIN SELECT RAISE(ABORT, 'qty dan nominal item pesanan tidak valid'); END",
            "CREATE TRIGGER IF NOT EXISTS order_items_qty_positive_update BEFORE UPDATE ON order_items
                WHEN NEW.qty <= 0 OR NEW.unit_price < 0 OR NEW.hpp_unit_snapshot < 0
                BEGIN SELECT RAISE(ABORT, 'qty dan nominal item pesanan tidak valid'); END",
            "CREATE TRIGGER IF NOT EXISTS orders_money_nonnegative_insert BEFORE INSERT ON orders
                WHEN NEW.gross_revenue < 0 OR NEW.seller_discount < 0 OR NEW.marketplace_discount < 0 OR NEW.hpp_total < 0
                BEGIN SELECT RAISE(ABORT, 'nominal pesanan tidak boleh negatif'); END",
            "CREATE TRIGGER IF NOT EXISTS orders_money_nonnegative_update BEFORE UPDATE ON orders
                WHEN NEW.gross_revenue < 0 OR NEW.seller_discount < 0 OR NEW.marketplace_discount < 0 OR NEW.hpp_total < 0
                BEGIN SELECT RAISE(ABORT, 'nominal pesanan tidak boleh negatif'); END",
            "CREATE TRIGGER IF NOT EXISTS fees_money_nonnegative_insert BEFORE INSERT ON marketplace_fees
                WHEN NEW.amount < 0 OR NEW.basis_amount < 0 OR (NEW.rate_bp IS NOT NULL AND (NEW.rate_bp < 0 OR NEW.rate_bp > 10000))
                BEGIN SELECT RAISE(ABORT, 'nominal atau tarif fee marketplace tidak valid'); END",
            "CREATE TRIGGER IF NOT EXISTS fees_money_nonnegative_update BEFORE UPDATE ON marketplace_fees
                WHEN NEW.amount < 0 OR NEW.basis_amount < 0 OR (NEW.rate_bp IS NOT NULL AND (NEW.rate_bp < 0 OR NEW.rate_bp > 10000))
                BEGIN SELECT RAISE(ABORT, 'nominal atau tarif fee marketplace tidak valid'); END",
            "CREATE TRIGGER IF NOT EXISTS ads_money_nonnegative_insert BEFORE INSERT ON advertising_expenses
                WHEN NEW.amount < 0
                BEGIN SELECT RAISE(ABORT, 'biaya iklan tidak boleh negatif'); END",
            "CREATE TRIGGER IF NOT EXISTS ads_money_nonnegative_update BEFORE UPDATE ON advertising_expenses
                WHEN NEW.amount < 0
                BEGIN SELECT RAISE(ABORT, 'biaya iklan tidak boleh negatif'); END",
            "CREATE TRIGGER IF NOT EXISTS operational_money_positive_insert BEFORE INSERT ON operational_expenses
                WHEN NEW.amount <= 0
                BEGIN SELECT RAISE(ABORT, 'biaya operasional harus lebih dari nol'); END",
            "CREATE TRIGGER IF NOT EXISTS operational_money_positive_update BEFORE UPDATE ON operational_expenses
                WHEN NEW.amount <= 0
                BEGIN SELECT RAISE(ABORT, 'biaya operasional harus lebih dari nol'); END",
            "CREATE TRIGGER IF NOT EXISTS refunds_amount_valid_insert BEFORE INSERT ON refunds
                WHEN NEW.amount <= 0 OR NEW.amount > (
                    SELECT MAX(0, gross_revenue - seller_discount) FROM orders WHERE id = NEW.order_id
                )
                BEGIN SELECT RAISE(ABORT, 'refund harus lebih dari nol dan tidak melebihi nilai pesanan'); END",
            "CREATE TRIGGER IF NOT EXISTS refunds_amount_valid_update BEFORE UPDATE ON refunds
                WHEN NEW.amount <= 0 OR NEW.amount > (
                    SELECT MAX(0, gross_revenue - seller_discount) FROM orders WHERE id = NEW.order_id
                )
                BEGIN SELECT RAISE(ABORT, 'refund harus lebih dari nol dan tidak melebihi nilai pesanan'); END",
            "CREATE TRIGGER IF NOT EXISTS product_costs_nonnegative_insert BEFORE INSERT ON product_costs
                WHEN NEW.hpp_unit < 0
                BEGIN SELECT RAISE(ABORT, 'HPP tidak boleh negatif'); END",
            "CREATE TRIGGER IF NOT EXISTS product_costs_nonnegative_update BEFORE UPDATE ON product_costs
                WHEN NEW.hpp_unit < 0
                BEGIN SELECT RAISE(ABORT, 'HPP tidak boleh negatif'); END",
        ];

        foreach ($triggers as $trigger) {
            DB::unprepared($trigger);
        }
    }

    public function down(): void
    {
        foreach ([
            'order_items_qty_positive_insert', 'order_items_qty_positive_update',
            'orders_money_nonnegative_insert', 'orders_money_nonnegative_update',
            'fees_money_nonnegative_insert', 'fees_money_nonnegative_update',
            'ads_money_nonnegative_insert', 'ads_money_nonnegative_update',
            'operational_money_positive_insert', 'operational_money_positive_update',
            'refunds_amount_valid_insert', 'refunds_amount_valid_update',
            'product_costs_nonnegative_insert', 'product_costs_nonnegative_update',
        ] as $trigger) {
            DB::unprepared("DROP TRIGGER IF EXISTS {$trigger}");
        }
    }
};
