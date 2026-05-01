# LAPORAN TEKNIS SKRIPSI: TruE ScripT

## 1. Deskripsi Umum Sistem
**TruE ScripT** adalah solusi perangkat lunak berbasis *Desktop-System Integration* yang dirancang untuk meminimalkan latensi sistem dan memaksimalkan *throughput* CPU untuk aplikasi *real-time* (Gaming). Sistem ini menggunakan arsitektur hybrid yang menggabungkan kecepatan eksekusi **PowerShell** dengan fleksibilitas antarmuka **Electron/React**.

## 2. Detail Implementasi Arsitektur

### 2.1 Persistent PowerShell Runner
TruE ScripT menggunakan **Persistent Runner** untuk efisiensi eksekusi:
- **Cara Kerja:** Program menjalankan satu instansi `powershell.exe` di latar belakang.
- **Komunikasi:** Menggunakan transmisi via *stdin/stdout* dengan *Sentinel Token* (`__TRUESCRIPT_DONE__`).
- **Efisiensi:** Menghilangkan *overhead* pembuatan proses baru, sehingga penggunaan resource aplikasi tetap minimal.

### 2.2 Algoritma Monitoring Proses
Sistem melakukan *polling* statistik proses:
- **CPU Usage:** Kalkulasi berbasis *Time Delta* pada `TotalProcessorTime`.
- **RAM Usage:** Pemantauan `WorkingSet64` secara real-time.
- **Mapping:** Penyederhanaan 6 level prioritas Windows menjadi 4 kategori intuitif (Low, Normal, High, VeryHigh).

## 3. Logika Optimasi & Manipulasi Sistem

### 3.1 Penjadwalan CPU (CPU Scheduling)
Program melakukan re-alokasi prioritas secara instan berdasarkan target:
- **Game:** Ditetapkan ke `High` agar mendapatkan kuota CPU utama.
- **Background:** Proses non-vital diturunkan ke `BelowNormal` untuk mengurangi interupsi pada proses utama.

### 3.2 High Precision System Timer (NtSetTimerResolution)
Memanggil API kernel via `ntdll.dll` untuk mengubah resolusi jam sistem dari **15.6ms** ke **0.5ms**. Hal ini krusial untuk sinkronisasi input mouse/keyboard yang lebih presisi dan stabilitas *frame time*.

### 3.3 Multimedia Class Scheduler Service (MMCSS)
Modifikasi registri pada `SystemProfile` untuk memberikan prioritas penuh pada task 'Games', menghilangkan reservasi CPU sistem sebesar 20% saat sesi gaming aktif.

## 4. Keamanan & Manajemen Risiko

### 4.1 Mekanisme Filter & Proteksi (Protected 65)
Keamanan sistem dijamin melalui dua lapis filter:
1. **Hardcoded Protection (65 Processes):** Daftar statis berisi proses kritis (Kernel, GPU Drivers, Windows Defender) yang dilarang untuk dimodifikasi.
2. **PID Threshold Filter:** Program secara otomatis mengabaikan semua proses dengan **PID < 1000**. PID rendah biasanya merupakan layanan inti kernel Windows.

### 4.2 Prasyarat Hak Akses (Administrative Rights)
Program harus dijalankan dengan hak akses **Administrator** karena:
- Manipulasi `PriorityClass` pada proses lain memerlukan izin sistem.
- Akses ke `ntdll.dll` untuk mengubah resolusi timer sistem.
- Modifikasi registri `HKEY_LOCAL_MACHINE` (HKLM).

### 4.3 Auto-Restore Engine (Watcher)
*Backend Watcher* memantau proses game. Saat game ditutup, sistem melakukan restorasi otomatis:
- Mengembalikan prioritas semua aplikasi ke `Normal`.
- Melepaskan `Timer Resolution` kembali ke default Windows.
- Mereset pengaturan registri ke kondisi standar.

## 5. Rincian Preset Optimasi

| Preset | Game Priority | Background Priority | System Timer | MMCSS Tuning |
| :--- | :--- | :--- | :--- | :--- |
| **Minimum** | AboveNormal | Normal | 0.5ms | Disabled |
| **Normal** | High | Normal | 0.5ms | Enabled (Balanced) |
| **Maximum** | High | BelowNormal | 0.5ms | Enabled (Aggressive) |

## 6. Kesimpulan Teknis
TruE ScripT mengintegrasikan otomasi sistem tingkat rendah dengan antarmuka modern untuk memberikan solusi optimasi yang aman, efisien, dan transparan bagi pengguna Windows.
