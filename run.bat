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

echo [LAUNCH] Starting in development mode...
echo.
npm run dev

pause
