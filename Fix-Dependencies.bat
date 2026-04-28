@echo off
title Memperbaiki Dependensi (Mengunduh Mermaid)
color 0B
echo ===================================================
echo Mengunduh pustaka visual Mermaid ke dalam proyek...
echo Pastikan komputer Anda terhubung ke internet.
echo ===================================================
echo.
cd /d "%~dp0"
call npm install
echo.
echo ===================================================
echo SELESAI! Pustaka berhasil dipasang secara fisik.
echo Silakan tutup jendela ini dan jalankan kembali:
echo Start-TruEScripT.bat
echo ===================================================
pause
