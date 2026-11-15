<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('products', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('store_id')->constrained('stores')->cascadeOnDelete();
            $table->string('sku', 80);
            $table->string('name', 160);
            $table->integer('selling_price')->default(0);
            $table->boolean('active')->default(true);
            $table->text('notes')->nullable();
            $table->timestamps();
            $table->softDeletes();
            $table->unique(['store_id', 'sku']);
            $table->index(['store_id', 'active']);
        });

        Schema::create('product_costs', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('product_id')->constrained('products')->cascadeOnDelete();
            $table->integer('hpp_unit');
            $table->date('effective_from');
            $table->date('effective_to')->nullable();
            $table->string('notes', 255)->nullable();
            $table->timestamps();
            $table->unique(['product_id', 'effective_from']);
            $table->index(['product_id', 'effective_from', 'effective_to']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('product_costs');
        Schema::dropIfExists('products');
    }
};
