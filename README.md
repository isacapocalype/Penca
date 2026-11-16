# Penca

Dashboard keuangan dan penjualan konveksi untuk Shopee dan TikTok Shop. Penca berjalan sepenuhnya offline di Android: tidak ada akun, server, API, atau pengiriman data ke luar perangkat.

Dokumen acuan:

- `PRD.md` — ruang lingkup produk dan aturan bisnis.
- `DESIGN.md` — sistem visual dan spesifikasi layar.
- `ANTISLOPAI.md` — standar engineering, integritas keuangan, dan aturan rilis yang mengikat.

## Stack

- Capacitor 8.6 (Android) sebagai shell aplikasi.
- React 19 + TypeScript 5.9 + Vite 8.
- Tailwind CSS 4 untuk UI; UI dirender di WebView lokal milik aplikasi, bukan situs remote.
- SQLite on-device melalui `@capacitor-community/sqlite` 8.1.
- `sql.js` hanya untuk Vitest dan fallback browser saat pengembangan.
- HashRouter, React Query, lucide-react.
- XLSX ditulis/dibaca dengan `fflate`; PDF memakai implementasi PDF minimal bawaan proyek.
- Pengujian Vitest + Testing Library.

Tidak ada framework PHP, server aplikasi, login, atau database jaringan.

## Fitur

- Dashboard omzet, laba bersih, margin, refund, dan performa per toko.
- Pesanan manual dan import CSV/XLSX dengan pratinjau, validasi, idempotensi, serta ekspor baris gagal.
- HPP per produk dengan riwayat berlaku tanpa periode tumpang tindih dan snapshot HPP pada setiap item pesanan.
- Fee marketplace, diskon penjual dan marketplace terpisah, refund aktual, pencairan, iklan, dan biaya operasional.
- Pajak PPN/PPh Final terpisah dari laba, profil pajak per toko, dan entri manual.
- Laporan harian, mingguan, bulanan dengan ekspor CSV, XLSX, PDF, dan dialog berbagi.
- Backup JSON lengkap, retensi, restore JSON dengan backup pengaman dan validasi checksum, serta audit log.
- Kunci periode untuk menolak perubahan data bulan yang sudah final.

## Menjalankan Lokal

Prasyarat: Node.js 22+ dan npm.

```bash
npm ci
npm run dev
```

Di browser, aplikasi memakai adapter `sql.js` dan menyimpan byte database ke IndexedDB. Mode ini berguna untuk pengembangan dan pengujian, bukan bukti bahwa SQLite native sudah berjalan di perangkat.

Perintah lain:

```bash
npm run typecheck
npm run test
npm run test:watch
npm run build
npm run cap:sync
```

## Android

Prasyarat build Android: Java 21, Android SDK platform 36, dan build-tools 36.0.0.

```bash
npm run build
npx cap sync android
npm run android:open
```

Build APK release dari terminal:

```bash
cd android
./gradlew assembleRelease
```

APK berada di `android/app/build/outputs/apk/release/`. Build release hanya ditandatangani jika variabel berikut diisi saat Gradle dijalankan:

```text
PENCA_KEYSTORE_FILE
PENCA_KEYSTORE_PASSWORD
PENCA_KEY_ALIAS
PENCA_KEY_PASSWORD
```

Tanpa variabel tersebut, Gradle menghasilkan APK release yang tidak ditandatangani. Untuk uji lokal tanpa signing, gunakan `./gradlew assembleDebug`.

Workflow `.github/workflows/android-apk.yml` membangun APK pada push ke `main`, tag `v*`, pull request, dan manual. Untuk rilis produksi, isi repository secrets:

| Secret | Isi |
|---|---|
| `ANDROID_KEYSTORE_BASE64` | File `.keystore` yang di-encode base64 |
| `ANDROID_KEYSTORE_PASSWORD` | Password keystore |
| `ANDROID_KEY_ALIAS` | Alias key |
| `ANDROID_KEY_PASSWORD` | Password key |

Tanpa secrets tersebut, workflow tetap membangun APK dengan keystore sementara khusus CI. APK itu dapat dipasang untuk pengujian, tetapi tidak dapat menimpa instalasi produksi dan tidak boleh diunggah ke Play Store.

## Pengujian

```bash
npm run test
npm run typecheck
npm run build
```

Test berjalan dengan database sql.js terisolasi per test dan lapisan file in-memory. Cakupan saat ini mencakup perhitungan uang, pesanan/refund/HPP, smoke test database, ringkasan keuangan, pajak, import CSV/XLSX, backup/restore, dan ekspor laporan.

## Keamanan Data

- Database berada di perangkat. Uninstall aplikasi menghapus database.
- Backup JSON adalah jalur restore di dalam aplikasi. Snapshot `.db` tidak dibuat oleh adapter SQLite native, jadi file `.db` tidak boleh dianggap tersedia atau dapat dipulihkan dari aplikasi.
- File backup memuat seluruh data keuangan. Simpan hanya di tempat pribadi dan jangan dibagikan sembarangan.
- Semua nominal disimpan sebagai integer rupiah, persentase sebagai basis poin, dan ID sebagai UUIDv7.
- Setiap perubahan data keuangan tercatat di audit log. Periode terkunci menolak perubahan.
- Android `allowBackup` dimatikan dan aplikasi tidak meminta izin INTERNET.

## Struktur Utama

```text
src/
├── components/          komponen UI dan layout
├── hooks/               query React Query
├── lib/
│   ├── db/              adapter SQLite native, sql.js, skema, migrasi
│   ├── export/          penulis XLSX dan PDF
│   ├── files.ts         Filesystem native / IndexedDB browser
│   ├── financial.ts     rumus laba dan pajak
│   └── money.ts         parsing dan format rupiah
├── pages/               layar aplikasi
├── services/            pesanan, pajak, import, backup, laporan
└── test/                setup dan fixture

android/                 proyek Capacitor Android
.github/workflows/       test web dan build APK
```

## Status Verifikasi

Status per 16 November 2026:

- `npm run test`: **VERIFIED (lokal)** — 8 file, 35 test lulus.
- `npm run typecheck` dan `npm run build`: **VERIFIED (lokal)**.
- Build APK Capacitor di GitHub Actions: **NOT VERIFIED** — workflow sudah ditulis, tetapi belum ada run Capacitor yang selesai saat README ini diperbarui.
- Pemasangan dan pengujian pada perangkat Android fisik: **NOT VERIFIED** — belum ada akses perangkat.
- SQLite native (`@capacitor-community/sqlite`): **NOT VERIFIED di perangkat** — kode adapter ada, pengujian otomatis memakai sql.js.
- File picker, Filesystem native, dan share sheet: **NOT VERIFIED di perangkat**.
- Tanda tangan rilis produksi: **NOT VERIFIED** — repository secrets keystore belum diisi.
- Restore `.db` di dalam aplikasi: **NOT DIDUKUNG** — restore hanya menerima JSON Penca.
- Import XLSX dari file marketplace nyata di perangkat: **NOT VERIFIED** — pembaca XLSX diuji dengan workbook yang dihasilkan aplikasi sendiri; CSV adalah jalur yang dijamin.

Implementasi NativePHP sebelumnya diarsipkan di git history dan tag `nativephp-final` pada commit `4c2bfa9`. Jangan mengklaim build, instalasi, atau perilaku native Capacitor sudah teruji tanpa artifact dan pengujian perangkat yang nyata.
