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
echo.
echo [1] Launch Normally (Terminal remains open)
echo [2] Launch in Background (No terminal window)
echo.
set /p choice="Pilih mode (1/2): "

if "%choice%"=="2" (
    echo [LAUNCH] Starting in background...
    start wscript.exe Launch-TruEScripT.vbs
    exit
)

npm run dev
pause
