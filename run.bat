@echo off
title TruE ScripT Launcher
color 0B
cd /d "%~dp0"

echo ===================================================
echo        TruE ScripT - Starting Application
echo ===================================================
echo.

if not exist node_modules (
    echo [ERROR] node_modules not found. 
    echo Running Fix-Dependencies.bat first...
    echo.
    call Fix-Dependencies.bat
)

echo [1] Launch Normally (Terminal remains open)
echo [2] Launch in Background (No terminal window)
echo.
set /p choice="Select mode (1/2): "

if "%choice%"=="2" (
    echo [LAUNCH] Starting in background...
    start wscript.exe Launch-TruEScripT.vbs
    exit
)

npm run dev
pause
