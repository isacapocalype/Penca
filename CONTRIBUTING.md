# Berkontribusi

Penca adalah aplikasi internal offline-first. Sebelum mengubah kode, baca `ANTISLOPAI.md`, `DESIGN.md`, dan `PRD.md`.

Aturan singkat:

- Jangan menambah dependency tanpa alasan teknis yang jelas.
- Jangan membuat fitur placeholder, tombol tanpa aksi, atau data dummy di build final.
- Semua nominal uang adalah integer rupiah; persentase adalah basis poin. Jangan memakai floating-point untuk uang.
- Setiap perubahan data keuangan harus melalui service yang menjaga audit log dan integritas periode.
- Jalankan `npm run test`, `npm run typecheck`, dan `npm run build` sebelum mengirim perubahan.
- Jangan commit `node_modules`, `dist`, database SQLite, file backup, keystore, atau `.env`.
- Perubahan pada proyek Android harus disertai `npx cap sync android` dan build Gradle yang berhasil.
- Jangan mengklaim build APK, instalasi, SQLite native, file picker, atau share sudah berhasil tanpa artifact dan pengujian perangkat yang nyata.

## Alur Pengembangan

```bash
npm ci
npm run dev          # browser: sql.js + IndexedDB
npm run test
npm run typecheck
npm run build
npx cap sync android
```

Di browser, database memakai `sql.js`; di perangkat, aplikasi memakai `@capacitor-community/sqlite`. Jangan menyimpulkan perilaku native dari mode browser.

## Commit

- Satu commit sebaiknya fokus pada satu perubahan logis.
- Sertakan alasan perubahan pada pesan commit.
- Jangan mencampur perubahan dokumentasi besar dengan perubahan perilaku tanpa penjelasan.
- Untuk perubahan skema, buat migrasi baru; jangan mengedit migrasi yang sudah dirilis.
