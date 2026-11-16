# ANTISLOPAI.md
# PENCA — Anti AI Slop & Engineering Quality Rules

**Project:** Penca — Konveksi Business Dashboard  
**Platform:** Android (Capacitor 8 + React 19)  
**Version:** 2.0  
**Document Type:** Engineering Quality Standard  
**Applies To:** All AI Coding Agents and Developers  
**Companion Documents:** `PRD.md` (product), `DESIGN.md` (UI)

---

# 1. PURPOSE

Dokumen ini dibuat untuk mencegah AI menghasilkan pekerjaan berkualitas rendah atau **AI Slop**.

AI Slop adalah hasil yang terlihat selesai di permukaan, tetapi sebenarnya:

- Kode tidak terstruktur.
- Banyak fitur tidak benar-benar bekerja.
- UI terlihat generik dan tidak konsisten.
- Tombol hanya dekorasi.
- Data tidak benar-benar tersimpan.
- Database tidak memiliki constraint yang benar.
- Banyak kode duplikat.
- Data dummy dipakai untuk menyamarkan fitur yang belum selesai.
- Dokumentasi proyek diabaikan.
- Pekerjaan diklaim selesai tanpa pengujian.

**Prinsip utama:**

> Build real functionality, not fake progress.

Setiap baris kode harus memiliki tujuan. Setiap fitur harus benar-benar bekerja. Setiap keputusan desain harus memiliki alasan UX. Setiap angka keuangan harus dapat dipertanggungjawabkan.

Dokumen ini bersifat **mengikat**. Jika ada instruksi yang bertentangan dengan dokumen ini, hentikan pekerjaan dan minta klarifikasi.

---

# 2. ABSOLUTE RULES

Aturan berikut wajib dipatuhi dan tidak boleh dilanggar.

## 2.1 No Fake Functionality

DILARANG:

- Membuat tombol yang tidak memiliki fungsi.
- Membuat form yang tidak menyimpan data.
- Membuat transaksi yang hanya mengubah tampilan.
- Membuat grafik dengan angka statis pada build final.
- Membuat menu navigasi yang tidak bisa dibuka.
- Membuat fitur yang hanya menampilkan alert palsu.
- Menggunakan `setTimeout` untuk berpura-pura sedang memproses transaksi.
- Menampilkan notifikasi sukses sebelum SQLite benar-benar menyimpan data.

Jika fitur belum tersedia, tampilkan status yang jujur atau jangan tampilkan sebagai fitur aktif.

## 2.2 No Mock Data in Production

DILARANG menggunakan:

- Nominal keuangan hardcoded.
- Transaksi dummy.
- Profil toko palsu.
- Statistik dashboard statis.
- Data grafik palsu.
- Riwayat pembayaran palsu.

Data contoh hanya boleh berada di seeder pengembangan dan harus terpisah jelas dari data produksi.

Jika database kosong, tampilkan **empty state** yang benar — bukan angka palsu.

## 2.3 No Placeholder Implementation

DILARANG meninggalkan kode seperti:

```ts
// TODO: implement later
```

```ts
export function saveOrder(): void {
  // Coming soon
}
```

```ts
export function handlePayment(): void {
  alert('Pembayaran berhasil');
}
```

Jangan menyatakan fitur selesai jika implementasinya masih placeholder.

Jika fitur terblokir, dokumentasikan alasannya dan tandai sebagai `BLOCKED`.

## 2.4 No False Completion Claims

DILARANG:

- Mengaku sudah menguji kode jika belum menjalankan pengujian.
- Mengklaim SQLite sudah menyimpan data tanpa memeriksa database.
- Menganggap fitur berfungsi hanya karena tidak ada error visual.
- Mengarang hasil query.
- Mengarang struktur tabel yang belum dibuat.
- Mengatakan APK berhasil dibuild tanpa memeriksa artifact.
- Menandai task selesai tanpa bukti.

Jika belum bisa diverifikasi, tulis:

```text
NOT VERIFIED — membutuhkan pengujian manual atau akses tambahan.
```

## 2.5 No Silent Failure

DILARANG:

- `catch` kosong.
- Menelan exception tanpa log.
- Menampilkan sukses saat operasi gagal.
- Mengganti error dengan data dummy.
- Menyembunyikan bug di balik `try/catch` yang terlalu luas.

---

# 3. STACK LOCK

Stack sudah ditentukan. AI tidak boleh mengganti stack karena lebih mudah atau lebih familiar.

| Layer | Wajib | Dilarang |
|---|---|---|
| App shell | Capacitor 8.6 Android | Wrapper yang memuat situs remote |
| UI | React 19 + TypeScript + Vite + Tailwind CSS | Livewire, Blade, Flutter, native Android UI |
| Database | SQLite on-device via `@capacitor-community/sqlite` | MySQL, PostgreSQL, Supabase, API database |
| Database pengujian/browser | `sql.js` terisolasi | Mengklaim sql.js sebagai bukti SQLite native |
| Build | GitHub Actions → APK | Build manual sebagai satu-satunya jalur |
| Platform | Android first | iOS sebelum Android stabil |
| Auth | Tanpa login | User account, PIN, role, OAuth |
| Server | Tidak ada | VPS, API server, queue server, Redis |

Ketentuan tambahan:

- Jangan menambahkan dependency baru tanpa alasan teknis dan persetujuan.
- Jangan memasang library untuk fungsi sederhana yang bisa ditangani React/TypeScript.
- Jangan membangun backend API jika aplikasi memang offline-first.
- Jangan mengubah arsitektur hanya karena AI lebih nyaman dengan pola lain.
- Jangan memuat UI, font, atau data dari URL jaringan saat aplikasi berjalan.

Jika `PRD.md` masih menyebut MySQL, Livewire, PHP, atau server aplikasi, PRD tersebut belum sinkron dengan stack final dan wajib direvisi sebelum coding.

---

# 4. OFFLINE-FIRST & SQLITE INTEGRITY

Penca adalah aplikasi offline-first. Database berada di perangkat pengguna.

## 4.1 Single Source of Truth

- Semua CRUD wajib menulis ke SQLite.
- Dilarang menggunakan array, session, atau state UI sebagai penyimpanan utama.
- Dilarang menggunakan `localStorage` atau `fetch` sebagai pengganti database.
- Data wajib tetap ada setelah aplikasi ditutup dan dibuka kembali.

## 4.2 Wajib Diuji

Setiap fitur yang menyimpan data wajib diuji:

1. Simpan data.
2. Tutup aplikasi sepenuhnya.
3. Buka kembali.
4. Pastikan data masih ada.
5. Aktifkan mode pesawat.
6. Ulangi operasi utama.
7. Pastikan tidak ada fitur yang bergantung pada internet.

## 4.3 Migrasi

- Migrasi berjalan saat aplikasi start melalui `migrate()` di `src/lib/db/index.ts`.
- Migrasi wajib diuji pada dua kondisi:
  - Instalasi baru.
  - Upgrade dari versi aplikasi sebelumnya.
- Jangan mengedit migrasi yang sudah pernah dirilis. Buat migrasi baru dengan versi baru.
- Perubahan destruktif wajib memiliki backup dan rencana rollback.
- Seed data menggunakan `INSERT OR IGNORE` yang idempoten, bukan data yang berulang setiap start.

## 4.4 Tipe Data SQLite

| Data | Tipe | Aturan |
|---|---|---|
| ID utama | `TEXT` UUID v7 | Konsisten di seluruh tabel |
| Uang | `INTEGER` | Rupiah penuh, bukan `FLOAT` |
| Persentase | `INTEGER` | Basis poin, `1100` = 11,00% |
| Tanggal/waktu | `TEXT` | ISO-8601, timezone `Asia/Jakarta` |
| Boolean | `INTEGER` | `0` atau `1` |
| JSON | `TEXT` | Hanya untuk data non-kritis |
| Jumlah barang | `INTEGER` | Jika pecahan, gunakan satuan terkecil |

## 4.5 Constraint & Integritas

Wajib menggunakan:

- Foreign key.
- Unique constraint.
- Check constraint bila relevan.
- Not null.
- Index pada kolom pencarian dan foreign key.
- Timestamps.

Aktifkan foreign key SQLite di setiap koneksi database:

```ts
await db.execute('PRAGMA foreign_keys = ON;');
```

Dilarang mengandalkan validasi UI untuk menjaga integritas database.

## 4.6 Data Finansial Tidak Boleh Hilang Diam-Diam

- Jangan hard delete transaksi keuangan yang sudah masuk laporan.
- Gunakan status void/archive atau soft delete yang terdokumentasi.
- Setiap perubahan pada data keuangan wajib tercatat di `audit_logs`.
- Uninstall aplikasi menghapus database. Karena itu, backup wajib ditawarkan sejak awal.

---

# 5. FINANCIAL INTEGRITY

Bagian ini adalah bagian paling kritis. AI tidak boleh mengarang rumus atau mengubah urutan perhitungan tanpa persetujuan.

## 5.1 Presisi

- Uang disimpan sebagai `INTEGER` rupiah.
- Dilarang menggunakan `FLOAT` atau `DOUBLE` untuk uang.
- Semua operasi uang di TypeScript wajib memakai integer dan helper di `src/lib/money.ts` / `src/lib/financial.ts`. Dilarang membagi atau mengalikan uang dengan floating-point di komponen UI.
- Pembulatan dilakukan half-up ke rupiah penuh per transaksi.
- Persentase disimpan sebagai basis poin.

## 5.2 Rumus Dasar

```text
Omzet Bruto        = Σ(qty × harga_satuan)
Pendapatan Neto    = Omzet Bruto − Diskon Penjual − Refund
HPP                = Σ(qty × hpp_unit_snapshot)
Laba Kotor         = Pendapatan Neto − HPP
Laba Operasional   = Laba Kotor − Fee Marketplace − Iklan − Operasional
PPh Final          = tarif × dasar_pajak
Laba Bersih        = Laba Operasional − PPh Final
PPN Kurang Bayar   = PPN Keluaran − PPN Masukan
```

## 5.3 Aturan Wajib

- `order_items.hpp_unit_snapshot` menyimpan HPP saat transaksi terjadi.
- Perubahan harga modal hari ini tidak boleh mengubah laporan bulan lalu.
- Refund hanya berasal dari tabel `refunds`.
- Status order `returned` atau `refunded` tidak boleh mengurangi pendapatan dua kali.
- `marketplace_order_id` unik per toko:
  - Unique constraint `(store_id, marketplace_order_id)`.
- Diskon penjual dan diskon marketplace dibedakan.
- Diskon yang ditanggung marketplace tidak otomatis menjadi beban penjual.
- Fee marketplace memiliki dasar perhitungan yang eksplisit.
- Import ulang file yang sama tidak boleh membuat data ganda.
- Laporan yang sudah dikunci tidak boleh diubah tanpa proses koreksi yang tercatat.

## 5.4 Atomic Transactions

Semua operasi yang mengubah lebih dari satu tabel wajib menggunakan transaksi database.

Contoh:

```ts
await db.transaction(async () => {
  for (const item of items) {
    await db.run('INSERT INTO order_items (...) VALUES (...)', itemValues(item));
  }

  for (const fee of fees) {
    await db.run('INSERT INTO marketplace_fees (...) VALUES (...)', feeValues(fee));
  }

  await recalculateOrderTotals(db, order.id);
});
```

DILARANG:

```ts
for (const item of items) {
  await db.run('INSERT INTO order_items (...) VALUES (...)', itemValues(item));
}
```

tanpa transaksi, karena kegagalan di tengah proses dapat meninggalkan data setengah jadi.

## 5.5 Contoh Salah vs Benar

DILARANG:

```ts
const total = items.reduce((sum, item) => sum + item.qty * item.price, 0);
await db.run('UPDATE orders SET gross_revenue = ? WHERE id = ?', [total, order.id]);
showToast('Pesanan berhasil disimpan');
```

WAJIB:

```ts
await db.transaction(async () => {
  await recalculateOrderTotals(db, order.id);
  await recordAudit(db, auditEntry);
});
showToast('Pesanan berhasil disimpan');
```

Sukses hanya ditampilkan setelah transaksi commit. Jika transaksi gagal, tampilkan error dan jangan menampilkan pesan sukses.

---

# 6. TAX INTEGRITY

Pajak adalah fitur wajib, bukan tambahan opsional.

## 6.1 Jenis Pajak

- `ppn_keluaran`
- `ppn_masukan`
- `pph_final`

## 6.2 Aturan PPN

- PPN bukan biaya dan tidak mengurangi laba.
- PPN adalah kewajiban/kredit yang dilacak terpisah.
- Mode PPN per toko:
  - `none`: tidak ada PPN.
  - `included`: harga sudah termasuk PPN.
  - `added`: PPN ditambahkan di atas harga.

Rumus:

```text
Included: PPN = dasar × rate / (100 + rate)
Added:    PPN = dasar × rate / 100
```

## 6.3 Aturan PPh Final

- PPh Final adalah biaya dan mengurangi laba setelah pajak.
- Dasar pajak default adalah omzet bruto, kecuali dikonfigurasi lain.
- Tarif default 0,5%, tetapi wajib diambil dari konfigurasi.
- Dilarang hardcode tarif di kode.

## 6.4 Tax Profile

- Tarif disimpan di `tax_profiles` dengan `effective_from` dan `effective_to`.
- Perubahan tarif tidak boleh mengubah perhitungan historis.
- Toko non-PKP: PPN keluaran 0; PPN masukan diperlakukan sesuai aturan yang disepakati.
- Setiap transaksi pajak memiliki periode `YYYY-MM` dan status.
- Rekap pajak per masa harus dapat diekspor.

## 6.5 Dilarang

- Mencampur PPN dan PPh dalam satu kolom.
- Menghitung PPN dan PPh dari dasar yang sama tanpa aturan jelas.
- Menghitung pajak dua kali.
- Mengubah tarif di kode saat tarif berubah.
- Menyembunyikan kewajiban pajak dari dashboard.

Dokumen ini bukan pengganti konsultasi pajak. Perhitungan adalah alat bantu dan harus diverifikasi dengan konsultan pajak.

---

# 7. CAPACITOR & ANDROID RULES

## 7.1 Wajib Diuji di Perangkat

- Jangan menganggap aplikasi berfungsi hanya karena tampil di browser.
- Wajib diuji di HP Android fisik.
- Wajib diuji dalam mode pesawat.
- Wajib diuji setelah aplikasi ditutup paksa dan dibuka kembali.
- Wajib membuktikan database ditulis oleh adapter SQLite native, bukan sql.js.
- Wajib menguji file picker, share sheet, dan restore JSON di perangkat.

## 7.2 Perilaku Mobile

Wajib menangani:

- Tombol back Android melalui riwayat React Router/HashRouter.
- Safe area (notch, status bar, navigation bar).
- Keyboard yang menutupi input.
- File picker untuk import dan restore.
- Share sheet untuk backup dan laporan.
- App lifecycle: pause/resume.
- Izin storage hanya bila plugin benar-benar membutuhkannya.

## 7.3 Larangan Web-Only

Dilarang mengandalkan:

- `window.location` untuk navigasi; gunakan React Router.
- `localStorage` atau `sessionStorage` sebagai database.
- `fetch` ke API yang tidak ada.
- `backdrop-filter` tanpa fallback.
- Library UI yang memuat aset dari jaringan.
- `alert()` sebagai dialog utama.
- Menganggap sql.js di browser sebagai bukti SQLite native.

## 7.4 Glass Fallback

`backdrop-filter` tidak dijamin pada semua WebView Android. Setiap komponen glass wajib memiliki fallback:

- Background putih semi-opaque.
- Gradient halus.
- Border putih tipis.
- Shadow hangat tipis.

Jangan memakai blur berat pada list panjang.

## 7.5 Chart & Data Visualization

- Gunakan SVG/CSS ringan atau library chart yang tidak memuat aset jaringan.
- Jangan memuat chart dari iframe atau URL eksternal.
- Jangan menampilkan chart dengan data statis.
- Chart kosong harus menampilkan empty state.

## 7.6 Build & Release

- Build release melalui GitHub Actions.
- Command build web dan sinkronisasi:

```bash
npm ci
npm run build
npx cap sync android
```

- Command build APK non-interaktif:

```bash
cd android
./gradlew assembleRelease --no-daemon
```

- Artifact: `android/app/build/outputs/apk/release/app-release.apk`.
- Keystore dan password hanya di GitHub Secrets, diteruskan sebagai `PENCA_KEYSTORE_*`.
- Dilarang commit keystore, `.env`, database, atau file backup ke repository.
- Setiap build release wajib diuji instal pada perangkat bersih.

## 7.7 Performa & Ukuran

Target awal:

| Metrik | Target |
|---|---|
| Cold start | ≤ 3 detik pada perangkat menengah |
| Cari 100.000 order | ≤ 500 ms |
| Import 10.000 baris | ≤ 60 detik |
| Backup/restore | ≤ 10 detik |
| Ukuran APK | ≤ 120 MB |

Jika target tidak tercapai, dokumentasikan penyebab dan rencana perbaikan. Jangan mengklaim target tercapai tanpa pengukuran.

---

# 8. UI/UX ANTI-GENERIC RULES

Seluruh UI wajib mengikuti `DESIGN.md`.

## 8.1 Identitas Visual

- Palet: putih hangat + kuning `#FFA500`.
- Glassmorphism secukupnya.
- Modern, bersih, profesional.
- Fokus pada angka keuangan, bukan dekorasi.

## 8.2 Dilarang

- Gradient ungu/biru ala template AI generik.
- Terlalu banyak glass effect.
- Semua card memiliki warna berbeda tanpa alasan.
- Border dan shadow berlebihan.
- Emoji sebagai ikon.
- Ukuran font tidak konsisten.
- Layout penuh card yang tidak berguna.
- Ikon yang tidak sesuai konteks.
- Tombol dengan gaya berbeda-beda.
- Informasi penting tenggelam oleh dekorasi.
- Teks putih di atas kuning `#FFA500` untuk body copy.

## 8.3 Hierarki Dashboard

Urutan prioritas:

1. Laba bersih / kondisi keuangan utama.
2. Omzet.
3. Biaya (fee, iklan, HPP, operasional).
4. Kewajiban pajak.
5. Grafik.
6. Pesanan terbaru.

Nominal keuangan harus lebih menonjol daripada dekorasi.

## 8.4 Mobile Layout

- Bottom navigation, bukan sidebar web.
- Touch target minimum 48dp.
- Form menggunakan keyboard numerik untuk nominal.
- Tabel diganti list row/card pada layar sempit.
- Bottom sheet untuk aksi cepat.
- Tidak ada horizontal overflow.
- Tidak ada teks terpotong tanpa alasan.

## 8.5 State Wajib

Setiap layar data wajib memiliki:

- **Loading state** — skeleton, bukan angka palsu.
- **Empty state** — penjelasan + CTA.
- **Error state** — pesan jelas + tombol coba lagi.

## 8.6 Ikon

Gunakan satu set ikon yang konsisten. Setiap ikon harus sesuai makna:

- Pesanan: receipt.
- Toko: store.
- Produk: package.
- Pajak: percent.
- Laporan: chart.
- Backup: database/backup.
- Pengaturan: settings.

Dilarang menggunakan ikon acak hanya agar terlihat ramai.

---

# 9. CODE QUALITY & ARCHITECTURE

## 9.1 Struktur yang Disarankan

```text
src/
├── components/       # komponen UI dan layout
├── hooks/            # query dan state turunan
├── lib/
│   ├── db/           # adapter, skema, migrasi, helper query
│   ├── export/       # XLSX dan PDF
│   ├── financial.ts  # rumus laba dan pajak
│   ├── money.ts      # parsing dan format rupiah
│   └── files.ts      # penyimpanan file native/browser
├── pages/            # layar aplikasi
├── services/         # aturan bisnis per domain
└── test/             # setup dan fixture

android/              # proyek Capacitor Android
```

## 9.2 Pemisahan Tanggung Jawab

Jangan mencampur dalam satu fungsi besar:

- Query database.
- Kalkulasi bisnis.
- Validasi input.
- Render UI.
- Logging.

## 9.3 Dilarang

- Satu file berisi seluruh aplikasi.
- God class.
- Fungsi terlalu panjang tanpa alasan.
- Nested conditional berlebihan.
- Duplikasi kode.
- Query di dalam loop (N+1).
- Nama variabel tidak jelas.
- Global state yang tidak terkontrol.
- Abstraksi prematur.

## 9.4 Naming

Gunakan nama yang menjelaskan tujuan.

Buruk:

```ts
function calc(a: number, b: number) {
  return a - b;
}
```

Baik:

```ts
function calculateNetRevenue(gross: number, discount: number, refund: number): number {
  return gross - discount - refund;
}
```

## 9.5 Dependency

- Gunakan stack yang sudah ditentukan.
- Setiap dependency baru harus memiliki alasan teknis.
- Jangan menambah library untuk hal yang bisa diselesaikan dengan React/TypeScript.
- Jangan menambah package yang tidak diuji di Android.

---

# 10. ERROR HANDLING

Jangan menyembunyikan error.

Buruk:

```ts
try {
  await saveOrder(db, input);
} catch {
  // diam
}
```

Baik:

```ts
try {
  await db.transaction(() => saveOrder(db, input));
  showToast('Pesanan berhasil disimpan.');
} catch (error) {
  console.error('Gagal menyimpan pesanan', error);
  setError(errorMessage(error, 'Pesanan gagal disimpan. Silakan coba lagi.'));
}
```

Ketentuan:

- Pesan user harus mudah dipahami.
- Detail teknis masuk log, bukan UI.
- Jangan membocorkan data sensitif.
- Jangan menampilkan sukses jika commit gagal.
- Sediakan retry bila relevan.
- Error file/backup harus menjelaskan langkah perbaikan.

---

# 11. VALIDATION

Validasi frontend untuk UX; validasi database untuk integritas. Keduanya wajib.

Validasi minimum:

- Field wajib tidak kosong.
- Nominal numerik dan > 0.
- Tanggal valid.
- SKU sesuai format.
- Order ID unik per toko.
- Refund tidak melebihi nilai order.
- Jumlah barang > 0.
- Diskon tidak menghasilkan total negatif.
- Persentase dalam rentang wajar.
- File import memiliki kolom wajib.
- Baris import yang gagal tidak menghentikan seluruh proses tanpa laporan.

Gunakan validasi terpusat di service domain dan constraint database. Jangan menyebar aturan validasi di banyak tempat atau mengandalkan validasi form saja.

---

# 12. IMPORT, EXPORT & BACKUP

## 12.1 Import

- Format utama: CSV.
- XLSX didukung dengan pembaca bawaan berbasis `fflate`. File XLSX marketplace nyata wajib diuji di perangkat sebelum dianggap terverifikasi.
- Wajib ada pemetaan kolom.
- Wajib ada preview sebelum commit.
- Wajib ada laporan baris gagal.
- Wajib idempotent.
- Batasi ukuran file dan jumlah baris.
- Import tidak boleh meninggalkan data setengah jadi.

## 12.2 Export

- Excel/PDF dibuat di perangkat.
- Wajib menyertakan periode, toko, dan tanggal pembuatan.
- File dibagikan lewat share sheet.
- Jangan mengklaim export berhasil jika file tidak terbentuk.

## 12.3 Backup

Backup adalah fitur inti, bukan opsional.

Wajib mendukung:

- Export data `.json` sebagai jalur backup dan restore utama.
- Restore dengan validasi versi skema dan checksum.
- Auto-backup lokal.
- Retensi N backup.
- Riwayat backup.

Tidak didukung:

- Export atau restore snapshot `.db` dari dalam aplikasi. Adapter SQLite native tidak mengekspos file database, jadi jangan menampilkan opsi `.db` atau mengklaim fitur itu ada.

Wajib diuji:

- Backup di perangkat A.
- Restore di instalasi bersih.
- Data dan relasi tetap utuh.
- Aplikasi tidak crash setelah restore.
- Backup yang dimodifikasi ditolak karena checksum tidak cocok.

Peringatan wajib ditampilkan:

> File backup berisi data keuangan. Simpan di tempat aman dan jangan dibagikan sembarangan.

---

# 13. SECURITY & SECRETS

- Tidak ada login. Perlindungan data bergantung pada kunci perangkat.
- Jangan menambahkan akun user tanpa keputusan produk baru.
- Jangan menyimpan keystore, password, atau `.env` di repository.
- Gunakan GitHub Secrets untuk signing.
- Jangan menulis data keuangan ke log.
- Jangan mengirim data ke layanan eksternal tanpa izin.
- Repositori sebaiknya private.
- Backup file harus diperlakukan sebagai data sensitif.
- Android `allowBackup` wajib `false`; aplikasi tidak boleh meminta izin INTERNET untuk operasi normal.
- Jangan memuat UI, font, atau aset dari URL jaringan.

---

# 14. TESTING & PROOF

## 14.1 Automated Tests

Wajib ada unit/service test untuk:

- Perhitungan omzet.
- Diskon penjual vs marketplace.
- Refund hanya mengurangi sekali.
- HPP snapshot tidak berubah.
- Fee marketplace.
- PPN included/added.
- PPh Final.
- Laba bersih.
- Unique order per toko.
- Import idempotent.
- Locked period menolak perubahan.
- Backup/restore.

## 14.2 Manual Device Checklist

- Install APK dari GitHub Actions.
- Buka tanpa internet.
- Pastikan database ditulis oleh SQLite native, bukan sql.js.
- Simpan data, tutup paksa, buka lagi.
- Restart HP, buka aplikasi.
- Import CSV dan file XLSX marketplace nyata.
- Export PDF/Excel dan share.
- Backup JSON, uninstall, install ulang, restore JSON.
- Pastikan tidak ada opsi snapshot `.db` yang ditampilkan.
- Uji keyboard pada form nominal.
- Uji tombol back Android.
- Uji layar kecil dan layar besar.

## 14.3 Bukti

Jangan menulis "sudah dites" tanpa:

- Perintah yang dijalankan.
- Output test.
- Langkah reproduksi.
- Screenshot bila relevan.

Jika tidak bisa diuji:

```text
NOT VERIFIED — membutuhkan pengujian di perangkat Android.
```

---

# 15. CHANGE MANAGEMENT

Sebelum mengubah arsitektur, skema, atau fitur:

1. Baca implementasi saat ini.
2. Identifikasi dampak perubahan.
3. Periksa ketergantungan antarfitur.
4. Lindungi data yang sudah ada.
5. Hindari perubahan destruktif.
6. Buat migrasi baru.
7. Uji instalasi baru dan upgrade.
8. Dokumentasikan perubahan.

Dilarang:

- Menghapus tabel/kolom/file hanya karena AI merasa tidak perlu.
- Menimpa kode yang sudah bekerja tanpa alasan.
- Mengubah migrasi yang sudah dirilis.
- Menghapus data pengguna tanpa backup.

---

# 16. DEFINITION OF DONE

Sebuah fitur hanya boleh dianggap selesai jika:

## Functionality

- [ ] Semua tombol berfungsi.
- [ ] Semua form tersimpan.
- [ ] CRUD benar-benar terhubung ke SQLite.
- [ ] Data bertahan setelah restart.
- [ ] Berjalan dalam mode pesawat.
- [ ] Tidak ada fitur palsu.

## Financial Accuracy

- [ ] Omzet benar.
- [ ] Diskon benar.
- [ ] Refund tidak dihitung dua kali.
- [ ] HPP snapshot benar.
- [ ] Fee benar.
- [ ] PPN benar.
- [ ] PPh Final benar.
- [ ] Laba bersih benar.
- [ ] Pembulatan benar.

## Code Quality

- [ ] Tidak ada placeholder.
- [ ] Tidak ada duplikasi yang tidak perlu.
- [ ] Tidak ada N+1.
- [ ] Struktur kode konsisten.
- [ ] Error handling tersedia.

## UI/UX

- [ ] Sesuai `DESIGN.md`.
- [ ] Mobile layout benar.
- [ ] Loading state ada.
- [ ] Empty state ada.
- [ ] Error state ada.
- [ ] Touch target memadai.
- [ ] Kontras teks aman.

## Offline & Data Safety

- [ ] Tidak butuh internet.
- [ ] Backup JSON tersedia.
- [ ] Restore JSON diuji.
- [ ] Snapshot `.db` tidak ditampilkan sebagai fitur yang tersedia.
- [ ] Migrasi upgrade diuji.

## Documentation

- [ ] `PRD.md` diperbarui bila scope berubah.
- [ ] `DESIGN.md` diperbarui bila UI berubah.
- [ ] Perubahan besar dicatat.

Visual appearance alone does not mean a feature is complete.

---

# 17. AI SELF-REVIEW PROTOCOL

Setelah menyelesaikan setiap task, AI wajib menjawab:

1. Apakah implementasi sesuai `PRD.md`?
2. Apakah implementasi mengikuti `DESIGN.md`?
3. Apakah data benar-benar tersimpan di SQLite?
4. Apakah data bertahan setelah restart?
5. Apakah fitur berjalan offline?
6. Apakah perhitungan omzet, refund, HPP, dan pajak benar?
7. Apakah ada placeholder?
8. Apakah ada error yang disembunyikan?
9. Apakah pengujian benar-benar dijalankan?
10. Apa buktinya?

Jika ada jawaban yang belum memenuhi standar, jangan tandai task sebagai selesai.

---

# 18. RED FLAGS CHECKLIST

Jika menemukan salah satu pola berikut, anggap pekerjaan belum selesai:

- `TODO`
- `Coming soon`
- `For now`
- `Dummy`
- `Placeholder`
- `Hardcoded`
- `alert('success')`
- `console.log(error)` tanpa penanganan
- `setTimeout` untuk memalsukan loading
- Data chart statis
- Tombol tanpa handler
- Form tanpa penyimpanan
- Query di dalam loop
- `FLOAT` untuk uang
- Tarif pajak hardcoded
- Refund dihitung dari status order dan tabel refunds sekaligus
- HPP dihitung dari harga master saat ini untuk laporan lama
- Backup tidak pernah diuji restore
- APK tidak pernah diinstal di perangkat bersih

---

# 19. FINAL COMMAND TO AI AGENT

You are not here to generate impressive-looking code quickly.

You are here to build a reliable, maintainable, offline-first financial application for Android.

Prioritize engineering quality over code volume.

Never sacrifice financial accuracy for speed.

Never sacrifice data integrity for convenience.

Never sacrifice usability for visual decoration.

Do not generate unnecessary components, abstractions, dependencies, or features.

Read the existing project before modifying it.

Implement only what is needed, but implement it properly.

When something is uncertain, investigate before making assumptions.

When something is broken, fix the root cause instead of hiding the error.

When something is incomplete, report it honestly.

**Build Penca like a real production product, not an AI-generated demo.**
