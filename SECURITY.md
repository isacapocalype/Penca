# Kebijakan Keamanan

Penca menyimpan data keuangan secara lokal di perangkat. File backup dan database harus diperlakukan sebagai data sensitif.

Jangan membuka issue publik yang memuat:

- File backup, database, atau isi data keuangan.
- Kredensial, token, atau keystore.
- Detail celah keamanan yang belum diperbaiki.

Laporkan masalah keamanan secara privat kepada pemilik proyek. Jika belum ada kanal privat, hentikan distribusi build yang terdampak dan perbaiki sebelum merilis ulang.

Aplikasi ini tidak memiliki server, akun, atau API. Risiko utama berada pada akses fisik perangkat, file backup yang dibagikan, dan build APK yang ditandatangani dengan kunci yang salah.
