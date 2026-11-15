<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('ad_campaigns', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('store_id')->constrained('stores')->cascadeOnDelete();
            $table->string('name', 160);
            $table->string('platform', 30)->default('shopee');
            $table->boolean('active')->default(true);
            $table->timestamps();
            $table->softDeletes();
            $table->index(['store_id', 'platform']);
        });

        Schema::create('advertising_expenses', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('store_id')->constrained('stores')->restrictOnDelete();
            $table->foreignUuid('ad_campaign_id')->nullable()->constrained('ad_campaigns')->nullOnDelete();
            $table->date('spent_at');
            $table->integer('amount');
            $table->integer('clicks')->nullable();
            $table->integer('impressions')->nullable();
            $table->integer('attributed_orders')->nullable();
            $table->integer('attributed_revenue')->nullable();
            $table->text('notes')->nullable();
            $table->timestamps();
            $table->softDeletes();
            $table->index(['store_id', 'spent_at']);
        });

        Schema::create('operational_expenses', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('store_id')->nullable()->constrained('stores')->nullOnDelete();
            $table->date('spent_at');
            $table->string('category', 30);
            $table->integer('amount');
            $table->text('notes')->nullable();
            $table->timestamps();
            $table->softDeletes();
            $table->index(['store_id', 'spent_at']);
            $table->index('spent_at');
        });

        Schema::create('refunds', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('order_id')->unique()->constrained('orders')->cascadeOnDelete();
            $table->date('refunded_at');
            $table->integer('amount');
            $table->string('reason', 255)->nullable();
            $table->timestamps();
            $table->softDeletes();
        });

        Schema::create('tax_entries', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('store_id')->constrained('stores')->restrictOnDelete();
            $table->string('period', 7);
            $table->string('type', 20);
            $table->integer('base_amount')->default(0);
            $table->integer('rate_bp')->default(0);
            $table->integer('amount')->default(0);
            $table->string('status', 20)->default('draft');
            $table->string('reference', 160)->nullable();
            $table->text('notes')->nullable();
            $table->timestamps();
            $table->softDeletes();
            $table->index(['store_id', 'period', 'type']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('tax_entries');
        Schema::dropIfExists('refunds');
        Schema::dropIfExists('operational_expenses');
        Schema::dropIfExists('advertising_expenses');
        Schema::dropIfExists('ad_campaigns');
    }
};
