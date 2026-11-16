# Kebijakan Keamanan

Penca menyimpan data keuangan secara lokal di perangkat. Aplikasi tidak memiliki server, akun, login, API, atau izin INTERNET. File backup dan database harus diperlakukan sebagai data sensitif.

Jangan membuka issue publik yang memuat:

- File backup, database, atau isi data keuangan.
- Kredensial, token, atau keystore.
- Detail celah keamanan yang belum diperbaiki.

Laporkan masalah keamanan secara privat kepada pemilik proyek. Jika belum ada kanal privat, hentikan distribusi build yang terdampak dan perbaiki sebelum merilis ulang.

## Model Ancaman

- Akses fisik perangkat: siapa pun yang membuka aplikasi dapat melihat data. Perlindungan bergantung pada kunci perangkat.
- Backup JSON yang dibagikan: file memuat seluruh tabel keuangan. Simpan hanya di tempat tepercaya.
- Keystore produksi: keystore yang salah atau bocor dapat menghasilkan build yang tidak dapat diperbarui atau disalahgunakan.
- WebView lokal: aplikasi tidak boleh memuat UI, font, atau skrip dari URL jaringan.
- Android backup sistem: `allowBackup` dimatikan agar data tidak ikut diekstrak ke layanan backup perangkat.

## Batasan yang Harus Diakui

- Snapshot database `.db` tidak didukung oleh adapter SQLite native. Jangan mengklaim fitur tersebut tersedia.
- Pengujian otomatis memakai `sql.js`, bukan SQLite native. Perilaku native wajib diuji di perangkat.
- APK CI tanpa secrets ditandatangani dengan kunci sementara dan tidak boleh dipakai untuk produksi.
