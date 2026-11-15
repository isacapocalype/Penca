<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder
{
    /**
     * Data referensi Penca (marketplace, kategori fee, pengaturan) disemai
     * lewat migrasi agar juga berjalan pada instalasi perangkat. Seeder ini
     * sengaja tidak membuat data contoh: aplikasi harus dimulai dengan empty
     * state yang jujur, bukan angka palsu.
     */
    public function run(): void
    {
        //
    }
}
