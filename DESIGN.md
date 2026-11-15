# DESIGN.md
# PENCA — UI/UX Design System

**Project:** Penca — Konveksi Business Dashboard  
**Platform:** Android (NativePHP for Mobile)  
**Style:** Modern Warm Glass  
**Primary Accent:** `#FFA500`  
**Version:** 1.0  
**Companion Documents:** `PRD.md`, `ANTISLOPAI.md`

---

# 1. BRAND & KONSEP

Penca adalah alat kerja keuangan untuk pemilik usaha konveksi. Desainnya harus terasa:

- Modern.
- Bersih.
- Profesional.
- Hangat.
- Cepat dipahami.
- Fokus pada angka, bukan dekorasi.

Konsep visual: **Warm Glass**.

Bayangkan kaca putih susu yang diletakkan di atas kanvas putih hangat, dengan cahaya kuning lembut sebagai aksen. Bukan glass biru/ungu yang generik. Kuning `#FFA500` memberi energi dan rasa optimistis, tetapi tetap terkendali.

**Prinsip utama:**

> Putih adalah kanvas. Kuning adalah aksen. Data adalah bintang.

---

# 2. DESIGN PRINCIPLES

1. **Clarity over decoration**  
   Angka keuangan harus lebih menonjol daripada efek visual.

2. **One primary action per screen**  
   Setiap layar memiliki satu aksi utama yang jelas.

3. **Glass only for floating layers**  
   Glass dipakai untuk card, bottom nav, top bar, dan bottom sheet. Bukan untuk seluruh halaman.

4. **Warm, not cold**  
   Putih dibuat sedikit hangat; kuning tidak boleh terlihat seperti peringatan bahaya.

5. **Touch-first**  
   Semua target sentuh minimal 48dp. Tidak ada hover-only interaction.

6. **Honest states**  
   Loading, empty, dan error state wajib ada. Jangan menutupi data kosong dengan angka palsu.

7. **Consistent rhythm**  
   Spacing, radius, dan tipografi mengikuti token. Tidak ada ukuran acak.

8. **Accessible by default**  
   Kontras teks aman, ukuran font dapat membesar, dan warna bukan satu-satunya penanda status.

---

# 3. COLOR SYSTEM

## 3.1 Core Palette

| Token | Hex / Value | Penggunaan |
|---|---|---|
| `color.primary` | `#FFA500` | CTA, active state, highlight, chart utama |
| `color.primary-pressed` | `#E69500` | Tombol ditekan |
| `color.primary-soft` | `#FFF4E0` | Background chip, ikon, highlight lembut |
| `color.primary-text` | `#8A4B00` | Teks kuning yang lolos kontras di atas putih |
| `color.bg` | `#FAF9F6` | Background aplikasi |
| `color.bg-warm` | `#FFFDF7` | Background layar utama |
| `color.surface` | `#FFFFFF` | Card solid |
| `color.glass` | `rgba(255,255,255,0.62)` | Card glass |
| `color.glass-strong` | `rgba(255,255,255,0.86)` | Bottom nav, sheet, top bar |
| `color.border-glass` | `rgba(255,255,255,0.75)` | Border atas glass |
| `color.border-subtle` | `rgba(28,28,30,0.08)` | Divider, border input |
| `color.text` | `#1C1C1E` | Teks utama |
| `color.text-secondary` | `#6E6E73` | Subtitle, label |
| `color.text-muted` | `#9A9AA0` | Placeholder, metadata |
| `color.success` | `#1F9D55` | Laba, selesai, aman |
| `color.success-soft` | `#E8F7EE` | Background status sukses |
| `color.danger` | `#D64545` | Refund, batal, error |
| `color.danger-soft` | `#FDECEC` | Background status bahaya |
| `color.warning` | `#FFA500` | Pending, perhatian |
| `color.warning-soft` | `#FFF4E0` | Background status pending |
| `color.info` | `#2D7FF9` | Informasi netral |
| `color.info-soft` | `#EAF2FF` | Background informasi |

## 3.2 Contrast Rules

- `#FFA500` di atas putih memiliki kontras rendah. **Jangan** memakai teks putih di atas kuning untuk body copy.
- Tombol primer: background `#FFA500`, teks `#1C1C1E`.
- Link/teks kuning di atas putih: gunakan `#8A4B00`.
- Status tidak boleh dibedakan hanya dengan warna. Selalu sertakan label atau ikon.
- Teks utama minimal kontras 4.5:1.
- Teks besar minimal kontras 3:1.

## 3.3 Background Atmosphere

Gunakan mesh gradient lembut:

```css
background:
  radial-gradient(1200px 600px at 100% -10%, rgba(255, 165, 0, 0.14), transparent 60%),
  radial-gradient(900px 500px at -10% 110%, rgba(255, 214, 153, 0.18), transparent 60%),
  #FAF9F6;
```

Tambahkan noise halus 1–2% jika tersedia. Jangan berlebihan.

---

# 4. TYPOGRAPHY

## 4.1 Font Family

| Peran | Font | Weight |
|---|---|---|
| Heading / brand | Plus Jakarta Sans | 600–700 |
| Body / UI | Inter | 400–500 |
| Angka besar | Plus Jakarta Sans | 700 |

Fallback sistem: `system-ui, -apple-system, sans-serif`.

## 4.2 Type Scale

| Token | Size / Line Height | Weight | Penggunaan |
|---|---|---|---|
| `display` | 32 / 40 | 700 | Angka utama dashboard |
| `h1` | 28 / 36 | 700 | Judul layar |
| `h2` | 24 / 32 | 600 | Judul section |
| `h3` | 20 / 28 | 600 | Judul card |
| `body-lg` | 16 / 24 | 500 | Body utama |
| `body` | 15 / 22 | 400 | Body standar |
| `caption` | 13 / 18 | 500 | Label, metadata |
| `micro` | 11 / 16 | 500 | Badge, timestamp |

## 4.3 Aturan

- Gunakan maksimal 3 ukuran font dalam satu card.
- Angka keuangan memakai tabular numbers agar rapi.
- Jangan menggunakan ALL CAPS untuk kalimat panjang.
- Jangan mengecilkan font di bawah 11px.
- Hormati pengaturan ukuran font sistem Android.

---

# 5. SPACING, RADIUS & ELEVATION

## 5.1 Spacing Scale

```text
4, 8, 12, 16, 20, 24, 32, 40, 48
```

Gunakan kelipatan 4. Jangan memakai nilai acak seperti 13px atau 27px.

## 5.2 Radius

| Token | Nilai | Penggunaan |
|---|---|---|
| `radius.sm` | 12 | Input, chip |
| `radius.md` | 16 | Tombol, card kecil |
| `radius.lg` | 24 | Card utama |
| `radius.xl` | 28 | Bottom sheet, modal |
| `radius.pill` | 999 | Chip, badge, avatar |

## 5.3 Elevation

| Level | Shadow | Penggunaan |
|---|---|---|
| 1 | `0 2px 8px rgba(0,0,0,0.04)` | Card diam |
| 2 | `0 8px 24px rgba(255,165,0,0.10)` | Card glass |
| 3 | `0 12px 32px rgba(0,0,0,0.12)` | Bottom sheet |
| 4 | `0 16px 48px rgba(0,0,0,0.18)` | Modal |

Shadow kuning harus tipis. Jangan membuat efek glow berlebihan.

---

# 6. GLASSMORPHISM RECIPE

## 6.1 Glass Card

```css
background: linear-gradient(
  135deg,
  rgba(255, 255, 255, 0.78),
  rgba(255, 255, 255, 0.48)
);
backdrop-filter: blur(20px) saturate(140%);
border: 1px solid rgba(255, 255, 255, 0.75);
border-radius: 24px;
box-shadow:
  0 8px 32px rgba(255, 165, 0, 0.12),
  0 2px 8px rgba(0, 0, 0, 0.04);
```

## 6.2 Glass Navigation

```css
background: rgba(255, 255, 255, 0.86);
backdrop-filter: blur(24px) saturate(160%);
border-top: 1px solid rgba(255, 255, 255, 0.8);
```

## 6.3 NativePHP Fallback

`backdrop-filter` tidak dijamin tersedia di komponen native. Wajib ada fallback:

- Background putih semi-opaque (`rgba(255,255,255,0.86)`).
- Gradient vertikal halus.
- Border putih 1px.
- Shadow hangat tipis.
- Background mesh kuning di belakang card.

Jangan memakai blur berat pada list panjang. Blur hanya untuk area kecil dan statis.

## 6.4 Dilarang

- Glass di seluruh layar.
- Blur di atas teks kecil.
- Glass bertumpuk tiga lapis.
- Border dan shadow berlebihan.
- Efek glow kuning yang mengurangi keterbacaan.

---

# 7. LAYOUT & NAVIGATION

## 7.1 Mobile Frame

- Desain utama: lebar 360–430dp.
- Safe area wajib dihormati.
- Konten tidak boleh tertutup bottom nav.
- Padding horizontal layar: 16dp.
- Jarak antar section: 24dp.
- Jarak antar card: 12–16dp.

## 7.2 Bottom Navigation

Empat item:

1. **Dashboard** — ikon home/chart.
2. **Pesanan** — ikon receipt.
3. **Laporan** — ikon chart.
4. **Lainnya** — ikon grid/menu.

Spesifikasi:

- Tinggi 64dp + safe area.
- Background glass strong.
- Active state: pill kuning soft + ikon kuning + label teks.
- Inactive: ikon dan label `text-secondary`.
- Badge notifikasi opsional, maksimal satu.

## 7.3 Top Bar

- Background transparan atau glass.
- Judul layar 20sp semibold.
- Aksi berupa tombol glass bulat 40dp.
- Tombol back untuk layar turunan.
- Jangan menaruh lebih dari dua aksi.

## 7.4 "Lainnya" Drawer

Berisi:

- Toko.
- Produk & HPP.
- Pajak.
- Biaya Iklan.
- Biaya Operasional.
- Import.
- Backup.
- Pengaturan.

Gunakan list row dengan ikon dalam lingkaran kuning soft.

## 7.5 FAB

- Satu FAB per layar, hanya untuk aksi utama.
- Posisi kanan bawah, di atas bottom nav.
- Ukuran 56dp.
- Background kuning, ikon hitam.
- Jangan memakai FAB untuk aksi sekunder.

---

# 8. COMPONENTS

## 8.1 Button

| Varian | Background | Teks | Border |
|---|---|---|---|
| Primary | `#FFA500` | `#1C1C1E` | none |
| Secondary | Glass putih | `#1C1C1E` | `border-glass` |
| Ghost | Transparan | `#1C1C1E` | none |
| Danger | `#D64545` | `#FFFFFF` | none |

Spesifikasi:

- Tinggi 48dp.
- Radius 16.
- Padding horizontal 20.
- Font 15–16 medium.
- Pressed: scale 0.98, background `primary-pressed`.
- Disabled: opacity 40%, tanpa shadow.
- Loading: spinner kecil, teks tetap terbaca.

## 8.2 Card

- Radius 24.
- Padding 16–20.
- Glass atau solid putih.
- Judul 16–20 semibold.
- Body 14–15.
- Aksi di kanan atas atau bawah.
- Jangan menaruh lebih dari satu CTA utama.

## 8.3 Stat Card

- Grid 2 kolom.
- Label 12sp `text-secondary`.
- Nilai 24sp bold `text`.
- Delta chip hijau/merah.
- Sparkline opsional.
- Ikon di pojok kanan atas dalam lingkaran kuning soft.

Contoh:

```text
Omzet Bulan Ini
Rp 128.450.000
▲ 12,4% vs bulan lalu
```

## 8.4 List Row

- Tinggi minimal 72dp.
- Leading: ikon 40dp dalam lingkaran `primary-soft`.
- Title 16sp medium.
- Subtitle 13sp `text-secondary`.
- Trailing: nominal 16sp semibold atau chevron.
- Divider 1px `border-subtle`.
- Pressed state: background `rgba(255,165,0,0.06)`.

## 8.5 Input

- Tinggi 52dp.
- Radius 12.
- Background glass/solid putih.
- Border 1px `border-subtle`.
- Focus ring 2px `rgba(255,165,0,0.35)`.
- Label di atas input, 13sp medium.
- Helper text 12sp.
- Error text 12sp `danger`.
- Nominal memakai prefix `Rp` dan keyboard numerik.

## 8.6 Chip & Badge

| Status | Background | Teks |
|---|---|---|
| Selesai | `success-soft` | `success` |
| Pending | `warning-soft` | `primary-text` |
| Batal | `danger-soft` | `danger` |
| Refund | `info-soft` | `info` |

- Radius pill.
- Tinggi 28–32dp.
- Font 11–12sp medium.
- Jangan hanya mengandalkan warna; sertakan label.

## 8.7 Bottom Sheet

- Radius atas 28.
- Background glass strong.
- Drag handle 40×4dp.
- Backdrop `rgba(0,0,0,0.25)` + blur 4px.
- Maksimal 85% tinggi layar.
- Aksi utama di bawah, full width.

## 8.8 Dialog

- Hanya untuk konfirmasi destruktif.
- Radius 24.
- Maksimal 2 tombol.
- Tombol destruktif berwarna danger.
- Jangan memakai dialog untuk form panjang; gunakan layar penuh.

## 8.9 Toast

- Dark glass `rgba(28,28,30,0.92)`.
- Teks putih 14sp.
- Ikon sukses/error kuning/hijau/merah.
- Durasi 3 detik.
- Jangan menampilkan toast sukses sebelum commit.

## 8.10 Empty State

- Ilustrasi line-art kuning sederhana.
- Judul 18sp semibold.
- Deskripsi 14sp `text-secondary`.
- Satu CTA.
- Jangan memakai data dummy.

## 8.11 Skeleton

- Background `rgba(28,28,30,0.06)`.
- Radius mengikuti komponen.
- Animasi shimmer halus.
- Jangan menampilkan angka palsu.

---

# 9. SCREEN SPECS

## 9.1 Dashboard

Urutan:

1. Top bar: sapaan + tombol periode.
2. Hero card: laba bersih bulan ini.
3. Grid stat: omzet, pesanan, biaya, pajak.
4. Grafik omzet 7/30 hari.
5. Performa toko.
6. Pesanan terbaru.
7. Empty state jika belum ada data.

Hero card boleh memakai glass dengan aksen kuning tipis. Angka laba bersih paling besar.

## 9.2 Pesanan

- Search bar di atas.
- Filter chip: Semua, Pending, Selesai, Refund.
- List row pesanan.
- FAB tambah pesanan.
- Detail: ringkasan, item, fee, pajak, refund, audit.
- Form: toko, order ID, tanggal, item, diskon, status.

## 9.3 Laporan

- Segmented control: Harian, Mingguan, Bulanan.
- Date range picker.
- Ringkasan omzet, biaya, laba.
- Tombol export PDF/Excel.
- Share sheet setelah file terbentuk.

## 9.4 Toko

- List toko dengan marketplace badge.
- Detail: omzet, pesanan, laba, status.
- Form tambah/edit.
- Arsipkan, bukan hard delete.

## 9.5 Produk & HPP

- List produk + SKU.
- Detail: harga jual, HPP saat ini, riwayat HPP.
- Form HPP baru dengan tanggal berlaku.
- Peringatan bahwa perubahan HPP tidak mengubah laporan lama.

## 9.6 Pajak

- Profil pajak toko: PKP/non-PKP, PPN mode, tarif, PPh.
- Ringkasan PPN keluaran/masukan.
- PPh Final periode.
- Rekap per masa.
- Tombol export.

## 9.7 Biaya Iklan

- List kampanye.
- Form: platform, nama kampanye, tanggal, biaya, klik, tayangan, pesanan atribusi, pendapatan atribusi.
- ROAS/ACOS hanya jika data atribusi tersedia.

## 9.8 Biaya Operasional

- List pengeluaran.
- Kategori: gaji, packing, transport, listrik, gudang, lain-lain.
- Form nominal + tanggal + catatan.

## 9.9 Import

- Pilih toko.
- Pilih file CSV/XLSX.
- Mapping kolom.
- Preview 10 baris.
- Validasi.
- Progress.
- Hasil: sukses/gagal, unduh baris gagal.

## 9.10 Backup

- Status backup terakhir.
- Tombol backup sekarang.
- Auto-backup toggle.
- Riwayat backup.
- Restore dengan konfirmasi.
- Peringatan data sensitif.

## 9.11 Pengaturan

- Tarif PPN default.
- Tarif PPh Final default.
- Nama perangkat/operator.
- App lock opsional (biometric).
- Tentang aplikasi.
- Versi database dan aplikasi.

---

# 10. DATA VISUALIZATION

## 10.1 Chart Colors

| Peran | Warna |
|---|---|
| Seri utama | `#FFA500` |
| Seri sekunder | `#FFD580` |
| Seri kontras | `#1C1C1E` |
| Grid | `rgba(28,28,30,0.08)` |
| Label | `#6E6E73` |

## 10.2 Aturan

- Gunakan bar/line sederhana.
- Jangan memakai 3D, shadow berlebihan, atau animasi rumit.
- Tooltip glass dengan teks gelap.
- Sumbu Y tidak wajib jika label langsung cukup.
- Chart kosong menampilkan empty state.
- Jangan menampilkan chart dengan data statis.

## 10.3 Angka

- Format Rupiah: `Rp 128.450.000`.
- Ringkas di card: `Rp 128,4 jt`.
- Gunakan pemisah ribuan titik.
- Jangan memotong angka tanpa penjelasan.

---

# 11. MOTION & INTERACTION

| Interaksi | Durasi | Easing |
|---|---|---|
| Tombol press | 120ms | ease-out |
| Card press | 150ms | ease-out |
| Bottom sheet | 240ms | ease-out |
| Page transition | 280ms | ease-in-out |
| Toast | 200ms | ease-out |

Aturan:

- Animasi harus halus, bukan lambat.
- Hormati pengaturan "reduce motion".
- Jangan memakai animasi untuk menutupi loading.
- Jangan memakai bounce berlebihan.
- Haptic feedback opsional untuk aksi sukses/gagal.

---

# 12. ACCESSIBILITY

- Kontras teks minimal 4.5:1.
- Touch target minimal 48dp.
- Font body minimal 15sp.
- Jangan mengandalkan warna saja.
- Sertakan label pada ikon tombol.
- Dukung pembesaran font sistem.
- Pastikan form dapat dioperasikan dengan keyboard.
- Error harus terbaca oleh screen reader.
- Jangan menaruh teks penting di dalam gambar.
- Uji pada layar kecil (320dp) dan besar (430dp).

---

# 13. NATIVEPHP CONSTRAINTS

- UI dirender dengan EDGE components, bukan HTML/CSS penuh.
- `backdrop-filter` wajib memiliki fallback.
- Chart memakai canvas/native, bukan WebView berat.
- File picker dan share memakai API NativePHP.
- Jangan mengandalkan hover state.
- Jangan mengandalkan `position: fixed` seperti di web.
- Perhatikan safe area dan keyboard.
- Uji di perangkat fisik, bukan hanya browser.
- Jangan memakai library UI web yang tidak didukung runtime native.

---

# 14. CONTENT & TONE

- Bahasa Indonesia.
- Singkat, jelas, tidak teknis.
- Gunakan istilah yang konsisten:
  - Omzet.
  - Pendapatan neto.
  - HPP.
  - Fee marketplace.
  - Laba bersih.
  - PPN.
  - PPh Final.
- Hindari istilah "potongan admin" jika yang dimaksud adalah fee marketplace.
- Error message harus menjelaskan apa yang salah dan apa yang bisa dilakukan.
- Jangan memakai nada menyalahkan pengguna.

Contoh:

```text
Gagal menyimpan pesanan. Periksa koneksi penyimpanan, lalu coba lagi.
```

Bukan:

```text
Error 500.
```

---

# 15. DO / DON'T

## DO

- Gunakan putih hangat sebagai dasar.
- Gunakan kuning untuk aksi utama.
- Gunakan glass hanya untuk elemen mengambang.
- Tampilkan angka besar dan jelas.
- Beri jarak napas antar card.
- Gunakan satu CTA utama per layar.
- Tampilkan state loading, empty, dan error.
- Uji di HP fisik.

## DON'T

- Jangan memakai gradient ungu/biru ala template AI.
- Jangan memakai teks putih di atas kuning.
- Jangan memakai emoji sebagai ikon.
- Jangan memakai glass di seluruh layar.
- Jangan memakai shadow dan border berlebihan.
- Jangan memakai chart statis.
- Jangan memakai tombol tanpa fungsi.
- Jangan menampilkan angka dummy.
- Jangan memakai font di bawah 11px.
- Jangan membuat layout yang hanya bagus di desktop.

---

# 16. QA CHECKLIST

## Visual

- [ ] Palet putih + kuning konsisten.
- [ ] Kontras teks aman.
- [ ] Glass memiliki fallback.
- [ ] Radius dan spacing konsisten.
- [ ] Tidak ada overflow horizontal.
- [ ] Tidak ada teks terpotong.

## Interaction

- [ ] Semua tombol berfungsi.
- [ ] Semua form tersimpan.
- [ ] Bottom nav berfungsi.
- [ ] Back button Android benar.
- [ ] Keyboard tidak menutupi input.
- [ ] FAB tidak menutupi konten.

## States

- [ ] Loading state ada.
- [ ] Empty state ada.
- [ ] Error state ada.
- [ ] Success hanya setelah commit.
- [ ] Offline state jelas.

## Accessibility

- [ ] Touch target ≥ 48dp.
- [ ] Label ikon tersedia.
- [ ] Font dapat diperbesar.
- [ ] Status tidak hanya warna.
- [ ] Screen reader dapat membaca error.

## Data

- [ ] Tidak ada data dummy.
- [ ] Angka sesuai database.
- [ ] Chart sesuai data aktual.
- [ ] Export menghasilkan file nyata.
- [ ] Backup/restore diuji.

---

# 17. FINAL NOTE

Desain Penca harus terasa seperti alat kerja yang mahal, tenang, dan dapat dipercaya.

Bukan demo AI yang penuh gradient, glass berlebihan, dan card dekoratif.

**White canvas. Amber accent. Real data. Clear decisions.**
