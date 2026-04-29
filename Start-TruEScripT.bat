@echo off
title TruE ScripT - Performance Scheduler
color 0B
cd /d "%~dp0"

echo ===================================================
echo             TruE ScripT - INITIALIZING
echo ===================================================
echo.

if not exist node_modules (
    echo [!] Dependensi tidak ditemukan. Menjalankan perbaikan...
    call Fix-Dependencies.bat
)

echo [OK] Menjalankan aplikasi...
npm run dev
pause
