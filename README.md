1. Persyaratan Sistem (Prerequisites)
Sebelum bisa menjalankan kode, pastikan lingkungan pengembangan di PC Anda memiliki:

Node.js: Diperlukan untuk mengeksekusi runtime JavaScript di luar browser. Disarankan menggunakan versi Long Term Support (LTS) terbaru (v18 atau v20).

NPM (Node Package Manager): Aplikasi bawaan saat Anda menginstal Node.js yang berfungsi untuk mengunduh pustaka pihak ketiga.

Sistem Operasi Windows: Program ini membutuhkan OS Windows untuk bisa mengeksekusi skrip PowerShell dan membangun instalasi .exe via sistem nsis.

2. Perintah Menjalankan Program
Buka terminal (seperti Command Prompt, PowerShell, atau terminal bawaan di Visual Studio Code), arahkan ke dalam folder proyek Anda, dan jalankan perintah berikut sesuai kebutuhan:

Langkah 1: Instalasi Dependensi (Wajib saat pertama kali)
Untuk mengunduh seluruh pustaka yang terdaftar (seperti zustand, tailwindcss, electron, dll), jalankan perintah ini:

Bash
npm install

Langkah 2: Menjalankan Mode Development (Uji Coba)
Jika Anda ingin membuka program untuk melakukan pengetesan kode (dilengkapi fitur hot-reload bawaan Vite), gunakan perintah eksekusi dev:

Bash
npm run dev

Langkah 3: Membangun Aplikasi (Mode Production / Ekspor ke Installer)
Setelah program final dan siap dipresentasikan (atau ingin diinstal murni sebagai .exe di laptop), jalankan perintah build khusus Windows yang akan mengaktifkan izin Administrator:

Bash
npm run build:win

Hasil ekspor aplikasi (file instalasi) nantinya akan disimpan secara otomatis di dalam folder dist/.

Langkah 4: Pengecekan Kode (Opsional)
Untuk memverifikasi apakah ada error pada penulisan TypeScript tanpa mengeksekusi aplikasinya, jalankan perintah typecheck:

Bash
npm run typecheck
