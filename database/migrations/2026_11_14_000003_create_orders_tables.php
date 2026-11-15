<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('orders', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('store_id')->constrained('stores')->restrictOnDelete();
            $table->string('marketplace_order_id', 120);
            $table->date('ordered_at');
            $table->date('completed_at')->nullable();
            $table->string('status', 20)->default('pending');
            $table->integer('gross_revenue')->default(0);
            $table->integer('seller_discount')->default(0);
            $table->integer('marketplace_discount')->default(0);
            $table->integer('hpp_total')->default(0);
            $table->text('notes')->nullable();
            $table->timestamps();
            $table->softDeletes();
            $table->unique(['store_id', 'marketplace_order_id']);
            $table->index(['store_id', 'ordered_at']);
            $table->index(['status', 'ordered_at']);
        });

        Schema::create('order_items', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('order_id')->constrained('orders')->cascadeOnDelete();
            $table->foreignUuid('product_id')->nullable()->constrained('products')->nullOnDelete();
            $table->string('sku', 80);
            $table->string('product_name', 160);
            $table->integer('qty');
            $table->integer('unit_price');
            $table->integer('hpp_unit_snapshot');
            $table->timestamps();
            $table->softDeletes();
            $table->index('order_id');
        });

        Schema::create('marketplace_fee_categories', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('code', 50)->unique();
            $table->string('name', 100);
            $table->string('default_basis', 20)->default('gross');
            $table->boolean('active')->default(true);
            $table->timestamps();
        });

        Schema::create('marketplace_fees', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('order_id')->constrained('orders')->cascadeOnDelete();
            $table->foreignUuid('category_id')->nullable()->constrained('marketplace_fee_categories')->nullOnDelete();
            $table->string('description', 160);
            $table->string('basis', 20)->default('gross');
            $table->integer('basis_amount')->default(0);
            $table->integer('rate_bp')->nullable();
            $table->integer('amount');
            $table->string('borne_by', 20)->default('seller');
            $table->boolean('is_actual')->default(true);
            $table->timestamps();
            $table->softDeletes();
            $table->index('order_id');
        });

        Schema::create('settlements', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('store_id')->constrained('stores')->restrictOnDelete();
            $table->foreignUuid('order_id')->nullable()->constrained('orders')->nullOnDelete();
            $table->integer('amount');
            $table->date('settled_at');
            $table->string('reference', 120)->nullable();
            $table->text('notes')->nullable();
            $table->timestamps();
            $table->softDeletes();
            $table->index(['store_id', 'settled_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('settlements');
        Schema::dropIfExists('marketplace_fees');
        Schema::dropIfExists('marketplace_fee_categories');
        Schema::dropIfExists('order_items');
        Schema::dropIfExists('orders');
    }
};
