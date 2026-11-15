# Penca

Dashboard keuangan dan penjualan konveksi untuk Shopee dan TikTok Shop. Aplikasi berjalan sepenuhnya offline di Android: tidak ada akun, server, API, atau data yang dikirim keluar perangkat.

Dokumen acuan:

- `PRD.md` — ruang lingkup produk dan aturan bisnis.
- `DESIGN.md` — sistem visual dan spesifikasi layar.
- `ANTISLOPAI.md` — standar engineering, integritas keuangan, dan aturan rilis yang mengikat.

## Stack

- Laravel 13, PHP 8.4+
- NativePHP for Mobile 4.x dengan layar NativeComponent + EDGE
- SQLite on-device
- Android first, tanpa WebView dan tanpa Livewire
- Pengujian Pest, format Laravel Pint
- Build APK melalui GitHub Actions

## Fitur

- Dashboard omzet, laba bersih, margin, refund, dan performa per toko.
- Pesanan manual dan import CSV/XLSX dengan pratinjau, validasi, idempotensi, serta ekspor baris gagal.
- HPP per produk dengan riwayat berlaku tanpa periode tumpang tindih dan snapshot HPP pada setiap item pesanan.
- Fee marketplace, diskon penjual dan marketplace terpisah, refund aktual, pencairan, iklan, dan biaya operasional.
- Pajak PPN/PPh Final terpisah dari laba, profil pajak per toko, dan entri manual.
- Laporan harian, mingguan, bulanan dengan ekspor CSV, XLSX, PDF nyata dan dialog berbagi.
- Backup JSON lengkap, snapshot `.db`, retensi, restore JSON dengan backup pengaman, serta audit log.
- Kunci periode untuk menolak perubahan data bulan yang sudah final.

## Menjalankan Lokal

```bash
composer install
cp .env.example .env
php artisan key:generate
touch database/database.sqlite
php artisan migrate
php artisan test
```

Perintah pengembangan NativePHP:

```bash
php artisan native:install android
php artisan native:run android
php artisan native:watch android
php artisan native:validate
```

## Pengujian

```bash
php artisan test --compact
vendor/bin/pint --test
php artisan native:validate
```

Test berjalan terhadap SQLite in-memory melalui `RefreshDatabase`. Test alur mencakup pembuatan pesanan, HPP, import idempotent, pajak, kunci periode, backup/restore, dan penolakan backup yang dimodifikasi.

## Build APK

Workflow `.github/workflows/android-apk.yml` membangun APK release dan mengunggahnya sebagai artifact. Untuk rilis produksi, isi repository secrets berikut:

| Secret | Isi |
|---|---|
| `ANDROID_KEYSTORE_BASE64` | File `.keystore` yang di-encode base64 |
| `ANDROID_KEYSTORE_PASSWORD` | Password keystore |
| `ANDROID_KEY_ALIAS` | Alias key |
| `ANDROID_KEY_PASSWORD` | Password key |

Tanpa secrets tersebut, workflow tetap membangun APK dengan keystore sementara khusus CI. APK itu dapat dipasang untuk pengujian, tetapi tidak dapat menimpa instalasi produksi dan tidak boleh diunggah ke Play Store.

Perintah build lokal:

```bash
php artisan native:package android --no-tty
```

## Keamanan Data

- Database berada di perangkat. Uninstall aplikasi menghapus database.
- Backup JSON adalah jalur restore di dalam aplikasi. File `.db` adalah snapshot darurat dan tidak dipulihkan saat aplikasi berjalan.
- File backup memuat data keuangan. Simpan hanya di tempat pribadi dan jangan dibagikan sembarangan.
- Semua nominal disimpan sebagai integer rupiah, persentase sebagai basis poin, dan ID sebagai UUIDv7.
- Setiap perubahan data keuangan tercatat di audit log. Periode terkunci menolak perubahan.

## Struktur Utama

```text
app/NativeComponents/     layar NativeComponent
app/Native/Concerns/      trait bersama layar
app/Services/             kalkulasi, import, backup, ekspor
app/Support/              uang, periode, opsi, format
resources/views/native/   tampilan EDGE
routes/mobile.php         rute native
tests/Feature/            test layar dan alur bisnis
```

## Status Verifikasi

- Test otomatis, Pint, dan `native:validate`: lulus di lingkungan pengembangan ini.
- Build APK dan pemasangan pada perangkat Android fisik: **NOT VERIFIED** — lingkungan ini tidak memiliki Java/Android SDK maupun perangkat.
- Restore `.db` di dalam aplikasi: **NOT VERIFIED / tidak didukung** — restore di aplikasi hanya menerima JSON.
- Import XLSX membutuhkan ekstensi `ZipArchive` pada runtime perangkat: **NOT VERIFIED** — jalur CSV adalah jalur yang dijamin.
- App lock biometrik opsional dari `DESIGN.md` §9.11 tidak diaktifkan: PRD §16 menetapkan perlindungan akses melalui kunci perangkat, bukan autentikasi aplikasi. Tidak ada tombol atau klaim fitur ini di dalam aplikasi.
