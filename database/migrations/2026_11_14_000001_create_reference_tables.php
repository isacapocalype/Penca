<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('marketplaces', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('code', 40)->unique();
            $table->string('name', 80);
            $table->string('color', 20)->nullable();
            $table->boolean('active')->default(true);
            $table->timestamps();
        });

        Schema::create('stores', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('marketplace_id')->constrained('marketplaces')->restrictOnDelete();
            $table->string('name', 120);
            $table->string('username', 120)->nullable();
            $table->string('url', 255)->nullable();
            $table->string('code', 60);
            $table->string('status', 20)->default('active');
            $table->text('notes')->nullable();
            $table->timestamps();
            $table->softDeletes();
            $table->unique(['marketplace_id', 'code']);
            $table->index(['status', 'name']);
        });

        Schema::create('tax_profiles', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('store_id')->constrained('stores')->cascadeOnDelete();
            $table->boolean('pkp')->default(false);
            $table->string('ppn_mode', 20)->default('none');
            $table->integer('ppn_rate_bp')->default(1100);
            $table->integer('pph_rate_bp')->default(50);
            $table->string('pph_basis', 20)->default('gross');
            $table->date('effective_from');
            $table->date('effective_to')->nullable();
            $table->timestamps();
            $table->unique(['store_id', 'effective_from']);
            $table->index(['store_id', 'effective_from', 'effective_to']);
        });

        Schema::create('settings', function (Blueprint $table) {
            $table->string('key')->primary();
            $table->text('value')->nullable();
            $table->timestamps();
        });

        Schema::create('period_locks', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('period', 7)->unique();
            $table->timestamp('locked_at');
            $table->string('locked_by', 120)->nullable();
            $table->text('notes')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('period_locks');
        Schema::dropIfExists('settings');
        Schema::dropIfExists('tax_profiles');
        Schema::dropIfExists('stores');
        Schema::dropIfExists('marketplaces');
    }
};
