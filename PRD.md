# PRODUCT REQUIREMENTS DOCUMENT (PRD)
# Sistem Manajemen Keuangan & Penjualan Konveksi

**Nama Proyek:** Penca — Konveksi Business Dashboard  
**Versi Dokumen:** 2.0.0  
**Status:** Implementasi MVP — disinkronkan dengan stack Capacitor/React  
**App Shell:** Capacitor 8.6 (Android)  
**Framework UI:** React 19 + TypeScript 5.9 + Vite 8  
**Database:** SQLite on-device via `@capacitor-community/sqlite`  
**UI Runtime:** WebView lokal milik aplikasi (bukan situs remote)  
**Mode Akses:** Tanpa login — tool internal single-operator  
**Bahasa:** Indonesia  
**Zona Waktu:** Asia/Jakarta  
**Target Platform:** Android (offline-first)

---

# 1. Ringkasan Proyek

## 1.1 Latar Belakang

Pemilik usaha konveksi yang berjualan melalui marketplace seperti Shopee dan TikTok Shop membutuhkan sistem terpusat untuk memantau aktivitas penjualan dan keuangan dari banyak toko.

Pencatatan manual menggunakan Excel memiliki beberapa kendala:

- Kesulitan memantau omzet setiap toko.
- Kesulitan menghitung potongan administrasi marketplace.
- Kesulitan mengetahui total pengeluaran iklan.
- Kesulitan menghitung keuntungan bersih.
- Data penjualan antar toko tercampur.
- Kesulitan membuat laporan harian dan bulanan.
- Sulit membandingkan performa Shopee dengan TikTok Shop.

Oleh karena itu, dibangun aplikasi Android untuk mengelola seluruh data toko dalam satu sistem dengan pemisahan data dan laporan per toko. Aplikasi berjalan offline di perangkat, tanpa server dan tanpa akun. UI React dirender di WebView lokal Capacitor, sedangkan data keuangan disimpan di SQLite native perangkat.

## 1.2 Tujuan Produk

1. Mengelola banyak toko Shopee dan TikTok Shop.
2. Menghitung omzet penjualan secara otomatis.
3. Menghitung potongan administrasi marketplace.
4. Mencatat pengeluaran iklan.
5. Menghitung modal produksi dan biaya operasional.
6. Mengetahui keuntungan bersih setiap toko.
7. Membuat laporan keuangan harian, mingguan, dan bulanan.
8. Membandingkan performa setiap toko.
9. Mengurangi pekerjaan pencatatan manual.

## 1.3 Target Pengguna

- Pemilik usaha konveksi sebagai pengguna utama.
- Admin marketplace.
- Staf keuangan.
- Pengelola operasional toko.

Aplikasi digunakan sebagai tool internal pada satu perangkat. Tidak ada akun, login, atau pembatasan akses berbasis pengguna.

---

# 2. Ruang Lingkup Produk

## 2.1 Fitur Utama

| ID | Fitur | Prioritas |
|---|---|---|
| F01 | Dashboard utama | Must Have |
| F02 | Manajemen toko | Must Have |
| F03 | Halaman toko terpisah | Must Have |
| F04 | Manajemen pesanan | Must Have |
| F05 | Perhitungan omzet | Must Have |
| F06 | Potongan administrasi | Must Have |
| F07 | Manajemen biaya iklan | Must Have |
| F08 | Manajemen modal produksi | Must Have |
| F09 | Perhitungan keuntungan | Must Have |
| F10 | Laporan keuangan | Must Have |
| F11 | Import CSV/XLSX | Must Have |
| F12 | Export CSV/XLSX/PDF | Must Have |
| F13 | Grafik penjualan | Should Have |
| F14 | Perbandingan antar toko | Should Have |
| F15 | Integrasi API marketplace | Future |
| F16 | Manajemen produk dan SKU | Should Have |

---

# 3. Model Penggunaan

## 3.1 Tanpa Login

Aplikasi adalah tool internal yang berjalan tanpa login.

Ketentuan:

- Tidak ada akun pengguna.
- Tidak ada password, PIN, atau role.
- Aplikasi langsung terbuka ke dashboard.
- Semua toko dikelola dari satu aplikasi.
- Data toko dipisahkan secara logis menggunakan `store_id`.
- Perlindungan akses bergantung pada kunci perangkat dan keamanan fisik perangkat.

## 3.2 Pengguna

Aplikasi digunakan oleh satu operator pada satu perangkat. Jika perangkat digunakan bergantian, operator bertanggung jawab menjaga perangkat.

## 3.3 Batasan

- Tidak ada isolasi keamanan antar pengguna karena tidak ada pengguna.
- Pemisahan data toko adalah fitur pelaporan, bukan batas keamanan.
- Tidak ada akses jarak jauh, API, atau multi-perangkat pada MVP.

---

# 4. Modul Manajemen Toko

## 4.1 Tujuan

Mengelola seluruh toko marketplace dalam satu sistem.

## 4.2 Data Toko

Setiap toko memiliki informasi:

| Field | Tipe |
|---|---|
| ID | TEXT UUIDv7 |
| Nama toko | String |
| Marketplace | Shopee / TikTok |
| Username toko | String |
| URL toko | String |
| Kode toko | String |
| Status | Active / Inactive |
| Tanggal dibuat | Timestamp |

## 4.3 Fungsionalitas

- Menambahkan toko.
- Mengedit informasi toko.
- Menghapus atau mengarsipkan toko.
- Mengaktifkan dan menonaktifkan toko.
- Melihat statistik toko.
- Mengakses halaman dashboard toko.

---

# 5. Modul Manajemen Pesanan

## 5.1 Tujuan

Mencatat dan mengelola seluruh pesanan dari setiap marketplace.

## 5.2 Data Pesanan

| Field | Keterangan |
|---|---|
| Order ID | ID pesanan marketplace |
| Toko | Identitas toko |
| Tanggal pesanan | Tanggal transaksi |
| Tanggal selesai | Tanggal pesanan selesai |
| SKU | Kode produk |
| Nama produk | Nama produk |
| Jumlah | Jumlah barang |
| Harga satuan | Harga jual |
| Diskon | Potongan harga |
| Omzet | Nilai penjualan |
| Status | Status pesanan |
| Catatan | Informasi tambahan |

## 5.3 Status Pesanan

- Pending.
- Processing.
- Shipped.
- Delivered.
- Completed.
- Cancelled.
- Returned.
- Refunded.

Status harus dapat disesuaikan dengan data asli marketplace saat import.

## 5.4 Fitur

- Tambah pesanan manual.
- Edit pesanan.
- Hapus dengan konfirmasi dan pencatatan audit.
- Cari berdasarkan Order ID.
- Filter berdasarkan toko.
- Filter berdasarkan tanggal.
- Filter berdasarkan status.
- Import pesanan CSV/XLSX.
- Mencegah duplikasi Order ID dalam toko yang sama.

Pesanan batal tidak dihitung sebagai penjualan selesai. Pesanan retur dan refund harus dicatat sebagai pengurang pendapatan sesuai nilai pengembalian yang sebenarnya.

---

# 6. Modul Pendapatan dan Omzet

## 6.1 Tujuan

Mengetahui total pendapatan setiap toko berdasarkan periode tertentu.

## 6.2 Perhitungan

Omzet kotor:

`Jumlah produk terjual × Harga jual`

Total omzet:

`Jumlah seluruh omzet kotor pesanan yang memenuhi kriteria`

Sistem harus membedakan:

1. Omzet kotor.
2. Diskon penjual.
3. Diskon yang ditanggung marketplace.
4. Refund.
5. Pendapatan setelah koreksi.
6. Dana bersih pencairan marketplace.

Diskon yang ditanggung marketplace tidak boleh otomatis dianggap sebagai pengeluaran penjual.

## 6.3 Dashboard Pendapatan

Menampilkan:

- Omzet hari ini.
- Omzet kemarin.
- Omzet minggu ini.
- Omzet bulan ini.
- Total produk terjual.
- Total pesanan selesai.
- Grafik omzet harian.

---

# 7. Modul Potongan Administrasi Marketplace

## 7.1 Tujuan

Menghitung semua biaya yang dipotong marketplace.

## 7.2 Jenis Potongan

- Biaya administrasi.
- Biaya layanan.
- Biaya transaksi.
- Biaya program promosi.
- Komisi marketplace.
- Biaya lain-lain.

Jenis biaya harus dapat dikonfigurasi sesuai marketplace dan perubahan kebijakan.

## 7.3 Metode Input

- Input manual.
- Import CSV/XLSX.
- Persentase potongan.
- Nominal tetap.
- Import nominal aktual dari laporan marketplace.

## 7.4 Perhitungan

`Total Potongan = Jumlah seluruh biaya marketplace yang dibebankan kepada penjual`

Jika menggunakan persentase:

`Biaya = Dasar Perhitungan × Persentase`

Sistem harus menyediakan penyesuaian dasar perhitungan agar tidak salah menghitung biaya yang menggunakan dasar berbeda.

Nominal aktual dari laporan marketplace menjadi sumber utama ketika tersedia.

---

# 8. Modul Biaya Iklan

## 8.1 Tujuan

Mencatat seluruh biaya iklan untuk mengetahui efektivitas promosi.

## 8.2 Platform Iklan

- Shopee Ads.
- TikTok Ads.
- Promosi lainnya.

## 8.3 Data Iklan

| Field | Keterangan |
|---|---|
| Toko | Toko yang diiklankan |
| Platform | Shopee / TikTok |
| Nama kampanye | Nama iklan |
| Tanggal | Tanggal pengeluaran |
| Biaya | Nominal iklan |
| Klik | Jumlah klik |
| Tayangan | Jumlah tayangan |
| Pesanan iklan | Jumlah pesanan atribusi iklan |
| Pendapatan iklan | Pendapatan atribusi iklan |
| Catatan | Keterangan |

## 8.4 Perhitungan

Total biaya iklan:

`Total seluruh pengeluaran iklan dalam periode`

ROAS:

`Pendapatan yang diatribusikan ke iklan / Biaya iklan`

ACOS:

`Biaya iklan / Pendapatan yang diatribusikan ke iklan × 100%`

ROAS dan ACOS hanya dihitung ketika data atribusi iklan tersedia.

---

# 9. Modul Modal Produksi dan Operasional

## 9.1 Tujuan

Mengetahui biaya sebenarnya untuk memproduksi dan menjual barang konveksi.

## 9.2 Komponen Modal Produk

- Kain.
- Benang.
- Sablon.
- Bordir.
- Jahit.
- Label.
- Packing.
- Biaya produksi tambahan.

Setiap SKU dapat memiliki harga pokok produksi (HPP).

## 9.3 Biaya Operasional

- Gaji karyawan.
- Packing tambahan.
- Transportasi.
- Listrik.
- Biaya gudang.
- Pengeluaran lain.

## 9.4 Metode Perhitungan

`Total HPP = Jumlah produk terjual × HPP per produk`

Pengeluaran operasional dicatat terpisah dari HPP untuk menghindari penghitungan biaya ganda.

---

# 10. Modul Keuntungan Bersih

## 10.1 Tujuan

Menampilkan keuntungan aktual setiap toko.

## 10.2 Rumus Utama

`Pendapatan Bersih Penjualan = Omzet Kotor - Diskon Penjual - Refund`

`Laba Bersih = Pendapatan Bersih Penjualan - Potongan Marketplace - Biaya Iklan - HPP - Biaya Operasional`

Catatan:

- Diskon yang ditanggung marketplace tidak mengurangi pendapatan penjual jika tidak dibebankan kepada penjual.
- Biaya yang sudah masuk dalam HPP tidak boleh dihitung ulang sebagai biaya operasional.
- Biaya iklan dicatat berdasarkan periode pengeluaran.
- Retur harus mengikuti nilai barang yang benar-benar dapat dipulihkan.
- Pajak dan penyesuaian lain dapat ditambahkan sebagai komponen terpisah.

## 10.3 Dashboard Keuntungan

Menampilkan:

- Total omzet.
- Total biaya admin.
- Total biaya iklan.
- Total HPP.
- Total biaya operasional.
- Total refund.
- Keuntungan bersih.
- Persentase margin keuntungan.

---

# 11. Modul Dashboard Utama

## 11.1 Tujuan

Memberikan gambaran seluruh aktivitas bisnis dalam satu halaman.

## 11.2 Informasi Dashboard

### Ringkasan Keuangan

- Total omzet seluruh toko.
- Total keuntungan bersih.
- Total biaya admin.
- Total pengeluaran iklan.
- Total modal produksi.
- Total pesanan.

### Statistik Per Toko

- Nama toko.
- Marketplace.
- Omzet.
- Jumlah pesanan.
- Biaya iklan.
- Keuntungan bersih.

### Grafik

- Grafik omzet harian.
- Grafik keuntungan.
- Grafik biaya iklan.
- Grafik perbandingan marketplace.
- Grafik perkembangan penjualan bulanan.

## 11.3 Filter

- Hari ini.
- Kemarin.
- 7 hari terakhir.
- 30 hari terakhir.
- Bulan ini.
- Bulan sebelumnya.
- Rentang tanggal custom.
- Toko tertentu.
- Semua toko.

---

# 12. Modul Laporan

## 12.1 Jenis Laporan

### A. Laporan Harian

Menampilkan:

- Total pesanan.
- Total produk terjual.
- Total omzet.
- Total potongan admin.
- Total biaya iklan.
- Total HPP.
- Total operasional.
- Total keuntungan.

### B. Laporan Mingguan

Menampilkan perkembangan penjualan dan keuntungan selama satu minggu.

### C. Laporan Bulanan

Menampilkan:

- Total omzet bulanan.
- Total pengeluaran.
- Total keuntungan.
- Perbandingan bulan sebelumnya.
- Performa setiap toko.

### D. Laporan Per Toko

Setiap toko memiliki laporan tersendiri.

### E. Laporan Gabungan

Menggabungkan seluruh toko untuk mengetahui performa usaha secara keseluruhan.

## 12.2 Export

Format yang disediakan:

- Excel (.xlsx).
- PDF (.pdf).
- CSV (.csv).

Setiap laporan harus memiliki informasi periode, toko, tanggal pembuatan, dan ringkasan perhitungan.

---

# 13. Modul Import dan Export Data

## 13.1 Import

Sistem menerima:

- File Excel.
- File CSV.

## 13.2 Alur Import

1. Pengguna memilih toko.
2. Mengunggah file.
3. Sistem membaca kolom.
4. Pengguna melakukan pemetaan kolom.
5. Sistem memvalidasi data.
6. Sistem menampilkan preview.
7. Pengguna mengonfirmasi import.
8. Data disimpan.
9. Sistem menampilkan ringkasan hasil import.

## 13.3 Validasi

- Format tanggal harus valid.
- Nilai transaksi harus numerik.
- Order ID tidak boleh duplikat dalam toko.
- SKU harus sesuai format.
- Baris yang gagal harus dapat diunduh.
- Import tidak boleh menyebabkan transaksi yang sudah benar terduplikasi.

---

# 14. Desain UI/UX

## 14.1 Konsep Desain

Mobile dashboard dalam shell Capacitor. UI React dirender di WebView lokal aplikasi; data keuangan tetap berada di SQLite native. Layout dioptimalkan untuk layar ponsel, bukan layout desktop responsif.

Karakter desain:

- Minimalis.
- Profesional.
- Modern.
- Mobile: top bar, scroll view, bottom navigation.
- Mudah digunakan satu tangan.
- Fokus pada informasi keuangan.

## 14.2 Struktur Navigasi

Bottom navigation:

1. Dashboard.
2. Pesanan.
3. Laporan.
4. Lainnya.

Layar yang diakses dari tab Lainnya dan dari konteks terkait:

- Toko dan detail toko.
- Produk, HPP, dan detail produk.
- Pajak dan profil pajak per toko.
- Biaya iklan.
- Biaya operasional.
- Import pesanan.
- Backup & restore.
- Pengaturan dan kunci periode.
- Audit log.

## 14.3 Warna

| Elemen | Warna |
|---|---|
| Primary | Amber `#FFA500` |
| Primary text | Coklat gelap yang kontras |
| Success | Hijau hangat |
| Danger | Merah |
| Warning | Amber tua |
| Background | Putih hangat |
| Surface | Putih |
| Text | Near-black netral |
| Outline | Netral hangat tipis |

Dilarang memakai gradient biru/ungu generik, emoji sebagai ikon, atau chart dengan data statis.

---

# 15. Database Requirements

Database menggunakan SQLite on-device. Tidak ada database server.

Entitas utama:

1. stores
2. marketplaces
3. products
4. product_costs
5. orders
6. order_items
7. marketplace_fees
8. advertising_expenses
9. advertising_campaigns
10. operational_expenses
11. refunds
12. settlements
13. import_batches
14. import_errors
15. audit_logs

## 15.1 Prinsip Database

- Setiap toko memiliki identitas unik.
- Semua transaksi memiliki store_id.
- Data transaksi harus terpisah berdasarkan toko.
- ID utama menggunakan TEXT UUIDv7.
- Nominal keuangan menggunakan INTEGER rupiah penuh, bukan FLOAT atau DECIMAL pecahan.
- Persentase menggunakan INTEGER basis poin, misalnya `1100` berarti 11,00%.
- Tanggal dan waktu disimpan sebagai ISO-8601 dengan zona waktu Asia/Jakarta.
- Order ID memiliki aturan unik per toko.
- Data penting menggunakan soft delete atau mekanisme arsip.
- Setiap perubahan keuangan harus dapat dilacak.
- Riwayat perubahan harga modal harus tersimpan.
- Foreign key, unique constraint, check constraint, dan index wajib aktif.
- Import ulang file yang sama tidak boleh membuat data ganda.

---

# 16. Security & Data Safety

Karena aplikasi tidak memakai login dan berjalan offline, keamanan berfokus pada validasi input, integritas data, dan perlindungan fisik perangkat.

1. Aplikasi tidak memiliki akun, password, PIN, atau role.
2. Perlindungan akses dilakukan melalui kunci perangkat, bukan autentikasi aplikasi.
3. Validasi input wajib dilakukan di sisi aplikasi dan constraint database.
4. Setiap perubahan transaksi keuangan dicatat di audit log.
5. Backup database wajib tersedia dan diuji restore.
6. File backup diperlakukan sebagai data sensitif.
7. Tidak ada data keuangan yang dikirim ke layanan eksternal.
8. Jika perangkat hilang atau rusak, data hanya dapat dipulihkan dari backup.

Catatan implementasi Capacitor: backup dan restore di dalam aplikasi memakai JSON Penca. Snapshot `.db` tidak dibuat oleh adapter SQLite native, sehingga file `.db` tidak boleh dianggap tersedia atau dapat dipulihkan dari aplikasi. Android `allowBackup` dimatikan agar data keuangan tidak ikut backup sistem, dan aplikasi tidak meminta izin INTERNET.

---

# 17. Non-Functional Requirements

| Kategori | Persyaratan |
|---|---|
| Performance | Dashboard normal ditargetkan tampil dalam 3 detik pada perangkat Android menengah |
| Platform | Android via Capacitor; UI WebView lokal, data SQLite native; tidak ada layout desktop |
| Security | Perlindungan data lokal, backup, dan audit perubahan |
| Scalability | Mendukung penambahan banyak toko dan puluhan ribu pesanan |
| Reliability | Transaksi keuangan tidak boleh tersimpan setengah |
| Maintainability | Struktur kode modular |
| Data Integrity | Mencegah duplikasi transaksi dan periode HPP tumpang tindih |
| Backup | Mendukung backup dan pemulihan database |
| Offline | Operasi utama tetap berjalan tanpa internet |

---

# 18. Business Rules

1. Satu aplikasi dapat mengelola banyak toko.
2. Satu toko dapat memiliki banyak pesanan.
3. Setiap pesanan harus terhubung dengan toko.
4. Setiap toko memiliki laporan keuangan sendiri.
5. Laporan gabungan dapat mengumpulkan data seluruh toko.
6. Pesanan batal tidak dihitung sebagai penjualan selesai.
7. Refund harus mengurangi pendapatan sesuai nominal aktual.
8. Biaya iklan harus tercatat berdasarkan tanggal pengeluaran.
9. HPP dihitung berdasarkan produk yang terjual.
10. Potongan admin dapat berbeda untuk setiap marketplace.
11. Semua nominal menggunakan Rupiah (IDR).
12. Zona waktu operasional adalah Asia/Jakarta.
13. Sistem harus membedakan omzet, pendapatan setelah potongan, pencairan dana, dan laba.
14. Data keuangan yang sudah masuk laporan tidak boleh diubah tanpa pencatatan audit.

---

# 19. Integrasi Marketplace

## Tahap Awal

Sistem menggunakan input manual dan import CSV. Import XLSX dibaca di perangkat dengan parser bawaan aplikasi; CSV adalah jalur utama yang dijamin. File XLSX ekspor marketplace nyata tetap wajib diuji di perangkat sebelum dianggap terverifikasi.

## Pengembangan Berikutnya

Integrasi API resmi:

- Shopee Open Platform.
- TikTok Shop Partner Center / API resmi yang tersedia.

Data yang diharapkan:

- Pesanan.
- Status pesanan.
- Detail produk.
- Harga penjualan.
- Potongan marketplace.
- Refund.
- Settlement.
- Data iklan jika API dan izin akses tersedia.

Catatan: Integrasi API harus mengikuti persyaratan, otorisasi, dan ketersediaan endpoint resmi masing-masing marketplace. Jangan mengandalkan scraping halaman marketplace.

---

# 20. Acceptance Criteria

Fitur dianggap selesai jika memenuhi kriteria berikut.

| Fitur | Kriteria Keberhasilan |
|---|---|
| Manajemen toko | Pengguna dapat membuat dan mengelola banyak toko |
| Pemisahan data | Data toko terfilter berdasarkan `store_id` dan tidak tercampur di laporan |
| Pesanan | Pesanan dapat ditambahkan dan diimport |
| Duplikasi | Order ID yang sama tidak masuk dua kali |
| Omzet | Perhitungan omzet sesuai transaksi valid |
| Admin | Potongan dapat dicatat dan dihitung |
| Iklan | Pengeluaran iklan dapat dicatat |
| HPP | Modal produk dihitung sesuai jumlah penjualan |
| Keuntungan | Laba bersih mengikuti rumus yang ditetapkan |
| Pajak | PPN dan PPh Final dihitung terpisah dari laba |
| Kunci periode | Perubahan pada periode terkunci ditolak |
| Laporan | Laporan harian dan bulanan tersedia |
| Export | File CSV, XLSX, dan PDF nyata dapat dihasilkan dan dibagikan |
| Dashboard | Data gabungan dan per toko dapat ditampilkan |
| Keamanan lokal | Data dapat di-backup dan dipulihkan tanpa akun |

---

# 21. Roadmap Pengembangan

## Phase 1 — Foundation

- Setup Capacitor 8 + React 19 + TypeScript + Vite.
- Setup SQLite on-device via `@capacitor-community/sqlite`.
- Manajemen toko.
- Struktur database.

## Phase 2 — Core Transaction

- Modul pesanan.
- Modul produk.
- Modul omzet.
- Modul potongan admin.
- Modul biaya iklan.
- Modul HPP.
- Modul biaya operasional.

## Phase 3 — Financial Analytics

- Perhitungan keuntungan.
- Dashboard utama.
- Dashboard per toko.
- Grafik penjualan.
- Grafik keuntungan.

## Phase 4 — Reporting

- Laporan harian.
- Laporan mingguan.
- Laporan bulanan.
- Export CSV.
- Export XLSX.
- Export PDF.
- Import CSV/XLSX.

## Phase 5 — Enhancement

- Integrasi API Shopee.
- Integrasi API TikTok Shop.
- Sinkronisasi transaksi.
- Analisis performa iklan.
- Pengembangan analitik bisnis.

---

# 22. Definition of Done

Proyek dinyatakan mencapai MVP apabila:

- Aplikasi dapat dibuka tanpa login.
- Pengguna dapat membuat banyak toko.
- Setiap toko memiliki halaman terpisah.
- Data setiap toko terfilter berdasarkan `store_id`.
- Pesanan dapat dimasukkan secara manual.
- Pesanan dapat diimport dari CSV/XLSX.
- Omzet dapat dihitung.
- Potongan admin dapat dihitung.
- Biaya iklan dapat dihitung.
- HPP dan operasional dapat dicatat.
- Keuntungan bersih dapat dihitung.
- PPN dan PPh Final dihitung terpisah.
- Dashboard menampilkan data aktual.
- Laporan harian dan bulanan tersedia.
- Export CSV, XLSX, dan PDF berjalan.
- Backup JSON dan restore berfungsi.
- Kunci periode menolak perubahan data final.
- Audit log mencatat perubahan data keuangan.
- Build APK release dihasilkan melalui GitHub Actions.
- Pemasangan dan pengujian pada perangkat Android fisik didokumentasikan dengan bukti; sebelum itu statusnya tetap `NOT VERIFIED`.

---

# 23. Status Verifikasi Implementasi

Status per 16 November 2026:

| Area | Status | Bukti / catatan |
|---|---|---|
| Test otomatis | VERIFIED (lokal + CI) | `npm run test` — 8 file, 35 test lulus; Actions run `43812239999` sukses |
| Typecheck | VERIFIED (lokal + CI) | `npm run typecheck` lulus di lokal dan Actions |
| Build web | VERIFIED (lokal + CI) | `npm run build` menghasilkan `dist/` di lokal dan Actions |
| Build APK Capacitor | VERIFIED (CI) | Actions run `43812239997` sukses; artifact `penca-android-apk-275de4a39c69333a1ac27c0df48cb761df7066c9`, `app-release.apk` 13.055.456 byte, SHA-256 `980d3b9a90d95a867a23099f16419e4a4ac608ba18773b29cbe59b229173203b` |
| Signature APK CI | VERIFIED (CI, kunci sementara) | `apksigner` memverifikasi `CN=Penca CI, OU=Mobile, O=Penca, L=Jakarta, C=ID` |
| Instalasi di perangkat | NOT VERIFIED | Belum ada akses perangkat Android |
| SQLite native | NOT VERIFIED di perangkat | Plugin terdaftar di APK; test otomatis memakai sql.js |
| File picker / share | NOT VERIFIED di perangkat | Bergantung WebView dan plugin Capacitor |
| Signing produksi | NOT VERIFIED | Secrets keystore belum diisi; build CI memakai kunci sementara |
| Restore `.db` | TIDAK DIDUKUNG | Restore aplikasi hanya menerima JSON Penca |

Implementasi NativePHP sebelumnya diarsipkan pada tag `nativephp-final` (commit `4c2bfa9`). Dokumen ini tidak boleh dipakai untuk mengklaim pengujian perangkat yang belum dilakukan.

---

# 24. Kesimpulan

Konveksi Business Dashboard merupakan sistem manajemen keuangan multi-toko yang dirancang untuk membantu pemilik usaha konveksi mengelola bisnis marketplace secara lebih terstruktur.

Fokus utama produk adalah memberikan informasi yang akurat mengenai:

- Berapa omzet setiap toko.
- Berapa total potongan marketplace.
- Berapa biaya iklan.
- Berapa modal produk yang terjual.
- Berapa biaya operasional.
- Berapa keuntungan bersih setiap hari.
- Toko mana yang memiliki performa terbaik.

**Target akhir:** satu aplikasi Android untuk mengelola seluruh keuangan toko Shopee dan TikTok Shop, dengan pencatatan terpisah, perhitungan otomatis, dan laporan bisnis yang mudah dipahami.

---

**Dokumen:** PRD Penca — Konveksi Business Dashboard  
**Versi:** 2.0.0  
**Status:** Implementasi MVP — disinkronkan dengan stack final  
**Stack:** Capacitor 8.6 + React 19 + TypeScript 5.9 + Vite 8 + SQLite on-device
