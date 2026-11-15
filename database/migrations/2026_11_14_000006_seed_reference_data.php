<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

return new class extends Migration
{
    public function up(): void
    {
        $now = now();
        $marketplaces = [
            ['shopee', 'Shopee', '#EE4D2D'],
            ['tiktok', 'TikTok Shop', '#1C1C1E'],
        ];

        foreach ($marketplaces as [$code, $name, $color]) {
            DB::table('marketplaces')->insertOrIgnore([
                'id' => (string) Str::uuid7(),
                'code' => $code,
                'name' => $name,
                'color' => $color,
                'active' => true,
                'created_at' => $now,
                'updated_at' => $now,
            ]);
        }

        $categories = [
            ['admin', 'Biaya administrasi', 'gross'],
            ['service', 'Biaya layanan', 'gross'],
            ['transaction', 'Biaya transaksi', 'gross'],
            ['promotion', 'Biaya program promosi', 'gross'],
            ['commission', 'Komisi marketplace', 'gross'],
            ['affiliate', 'Komisi afiliasi', 'gross'],
            ['other', 'Biaya lain-lain', 'fixed'],
        ];

        foreach ($categories as [$code, $name, $basis]) {
            DB::table('marketplace_fee_categories')->insertOrIgnore([
                'id' => (string) Str::uuid7(),
                'code' => $code,
                'name' => $name,
                'default_basis' => $basis,
                'active' => true,
                'created_at' => $now,
                'updated_at' => $now,
            ]);
        }

        $settings = [
            'schema_version' => '1',
            'operator_name' => '',
            'ppn_default_bp' => '1100',
            'pph_default_bp' => '50',
            'auto_backup_enabled' => '1',
            'backup_retention' => '10',
            'last_auto_backup_at' => '',
        ];

        foreach ($settings as $key => $value) {
            DB::table('settings')->insertOrIgnore([
                'key' => $key,
                'value' => $value,
                'created_at' => $now,
                'updated_at' => $now,
            ]);
        }
    }

    public function down(): void
    {
        DB::table('settings')->whereIn('key', [
            'schema_version', 'operator_name', 'ppn_default_bp', 'pph_default_bp',
            'auto_backup_enabled', 'backup_retention', 'last_auto_backup_at',
        ])->delete();
        DB::table('marketplace_fee_categories')->whereIn('code', [
            'admin', 'service', 'transaction', 'promotion', 'commission', 'affiliate', 'other',
        ])->delete();
        DB::table('marketplaces')->whereIn('code', ['shopee', 'tiktok'])->delete();
    }
};
