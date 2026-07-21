# BAB V. KESIMPULAN DAN SARAN

## 5.1. KESIMPULAN
Berdasarkan pada perancangan, implementasi arsitektur, dan analisis pengujian kinerja perangkat lunak *TruE ScripT* yang diuraikan pada bab-bab sebelumnya, maka dapat ditarik beberapa kesimpulan sebagai berikut:

1. **Efektivitas Orkestrasi Arsitektur *User-Space*:**
   Implementasi arsitektur hibrida 4-*layer* yang menggabungkan interaksi visual pengguna (*React/Electron*) dengan *Persistent PowerShell Runner* berhasil difungsikan secara optimal tanpa *overhead* signifikan. Aplikasi dapat memanipulasi *Win32 API* tingkat sistem untuk menyesuaikan *Process Priority Class*, presisi resolusi jam (*NtSetTimerResolution* hingga 0.5ms), dan metrik OS MMCSS (*SystemResponsiveness*) dari level lingkungan *User-Space* secara *real-time*.

2. **Keamanan Eksekusi dan Toleransi Anti-Curang (*Anti-Cheat*):**
   Sistem telah berhasil membuktikan tingkat validitas keamanan melalui mekanisme *Smart Filtering* berlapis (proteksi terhadap 90+ proses OS). Penjadwalan proses *game* menjadi *High* sementara aplikasi sekunder ditekan menjadi *BelowNormal* tidak melanggar kontrol absolut OS karena tidak memodifikasi tingkat *kernel* memori (Ring 0). Hal ini memastikan kompatibilitas yang penuh dengan seluruh subsistem *Anti-Cheat* komersial tanpa menumbulkan kerawanan serangan siber maupun distorsi stabilitas OS (*BSOD*).

3. **Reversibilitas dan Stabilitas Restorasi Sistem Otomatis:**
   Pengujian fungsionalitas dan rekayasa siklus *Background Watcher* yang digabungkan dengan algoritma pemulihan ketika *game* ditutup (*Graceful Shutdown* dan *Auto-Restore Engine*) memastikan bahwa semua modifikasi kinerja *OS Windows* bersifat temporer. Sistem operasi langsung kembali ke standar setelan bawaan perputaran (*polling*) normal ~15.6ms sesaat setelah sesi utilitas aplikasi ditutup.

4. **Validasi Peningkatan Penjadwalan *Frame*:**
   Hasil perhitungan statistik dari parameter *1% Low FPS* maupun deviasi standar latensi *frametime* dengan implementasi *Paired Sample T-Test* membuktikan bahwa penyesuaian yang dilakukan memberikan perbaikan yang terukur, dapat direplikasi secara keilmuan, dan menggugurkan asumsi bahwa rekayasa prioritas sistem tersebut hanyalah manipulasi persepsi (*efek placebo*). Akan tetapi, mode ekstrem (misal: *Preset Maximum*) diidentifikasi memiliki keterbatasan risiko terhadap kemunculan *Priority Inversion* serta memicu titik panas CPU (*Thermal Throttling*) pada beban bermain durasi tinggi, mengingat *C-States* telah sepenuhnya dinonaktifkan.

## 5.2. SARAN
Dalam upaya penyempurnaan keilmuan maupun iterasi masa depan untuk teknologi perangkat lunak optimasi OS sejenis, beberapa rekomendasi dan saran yang dapat dipertimbangkan adalah sebagai berikut:

1. **Implementasi Pengikatan Inti OS (*CPU Affinity Policy*):**
   Guna menghilangkan masalah kelaparan *Thread* (*Thread Starvation*) serta Inversi Prioritas (*Priority Inversion*) pada eksekusi aplikasi latar belakang, disarankan adanya penambahan implementasi kontrol *CPU Affinity*. Teknologi tersebut berfokus pada penguncian proses non-vital kepada *core* arsitektural efisiensi sekunder (seperti konfigurasi E-Cores pada arsitektur perangkat keras *Intel Alder Lake* Gen-12 atau yang lebih baru) sembari menjaga aplikasi target (*game*) berada di P-Cores.

2. **Integrasi Analisis Penjadwalan Berbasis Kecerdasan Buatan:**
   Pendekatan parametrik yang ada dapat dievolusikan menuju parameter prediktif dengan menggunakan integrasi model klasifikasi *Machine Learning* lokal. Sistem akan belajar menyeimbangkan profil frekuensi penjadwalan secara dinamis dengan memahami seberapa intens suatu aplikasi atau servis membebani unit kalkulasi I/O memori pada saat tertentu. 

3. **Penambahan Skala Validasi Arsitektur Perangkat Keras yang Variatif:**
   Diperlukan pengujian performa mendalam terhadap *benchmark* berbasis perangkat *CPU AMD Ryzen X3D* yang memiliki toleransi penumpukan *L3 Cache* yang masif, serta ekosistem OS *Windows 11* versi mutakhir yang secara *native* sudah merancang intervensi skeduler perputaran siklus independen (*Tickless Kernel Scheduling*), demi melihat relevansi dan efektivitas resolusi waktu ~0.5ms pada arsitektur generasi mendatang.
