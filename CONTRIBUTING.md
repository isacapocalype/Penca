# Berkontribusi

Penca adalah aplikasi internal offline-first. Sebelum mengubah kode, baca `ANTISLOPAI.md`, `DESIGN.md`, dan `PRD.md`.

Aturan singkat:

- Jangan menambah dependency tanpa alasan teknis yang jelas.
- Jangan membuat fitur placeholder, tombol tanpa aksi, atau data dummy di build final.
- Semua nominal uang adalah integer rupiah; persentase adalah basis poin.
- Setiap perubahan data keuangan harus melalui service yang menjaga audit log dan integritas periode.
- Jalankan `php artisan test`, `vendor/bin/pint --test`, dan `php artisan native:validate` sebelum mengirim perubahan.
- Jangan commit `.env`, database SQLite, keystore, atau file backup.
- Jangan mengklaim build APK atau pengujian perangkat sudah berhasil tanpa artifact atau bukti nyata.
