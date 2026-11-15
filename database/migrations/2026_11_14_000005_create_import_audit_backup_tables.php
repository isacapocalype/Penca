<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('import_batches', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('store_id')->constrained('stores')->restrictOnDelete();
            $table->string('file_name', 255);
            $table->string('file_hash', 64);
            $table->string('status', 20)->default('preview');
            $table->json('column_mapping')->nullable();
            $table->integer('rows_total')->default(0);
            $table->integer('rows_imported')->default(0);
            $table->integer('rows_failed')->default(0);
            $table->integer('rows_skipped')->default(0);
            $table->timestamps();
            $table->unique(['store_id', 'file_hash']);
            $table->index(['store_id', 'created_at']);
        });

        Schema::create('import_errors', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('import_batch_id')->constrained('import_batches')->cascadeOnDelete();
            $table->integer('row_number');
            $table->text('message');
            $table->json('row_data')->nullable();
            $table->timestamps();
            $table->index('import_batch_id');
        });

        Schema::create('audit_logs', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('auditable_type')->nullable();
            $table->uuid('auditable_id')->nullable();
            $table->foreignUuid('store_id')->nullable()->constrained('stores')->nullOnDelete();
            $table->string('event', 30);
            $table->string('summary', 255);
            $table->json('before')->nullable();
            $table->json('after')->nullable();
            $table->timestamp('created_at')->nullable();
            $table->index(['auditable_type', 'auditable_id']);
            $table->index(['store_id', 'created_at']);
        });

        Schema::create('backups', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('file_name', 255);
            $table->string('json_path', 500);
            $table->string('db_path', 500)->nullable();
            $table->unsignedBigInteger('size')->default(0);
            $table->integer('schema_version')->default(1);
            $table->string('checksum', 64);
            $table->string('reason', 30)->default('manual');
            $table->timestamp('created_at')->nullable();
            $table->timestamp('restored_at')->nullable();
            $table->index('created_at');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('backups');
        Schema::dropIfExists('audit_logs');
        Schema::dropIfExists('import_errors');
        Schema::dropIfExists('import_batches');
    }
};
