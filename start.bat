@echo off
title Navodaya Open 2026 - Tournament Server
cd /d "%~dp0"

echo ========================================================
echo   NAVODAYA OPEN 2026 - BADMINTON TOURNAMENT PORTAL
echo   Neon DB (PostgreSQL) + Express Server
echo ========================================================
echo.

:: 1. Check for Node.js installation
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] Node.js is not installed or not in your PATH!
    echo Please download and install Node.js from: https://nodejs.org/
    echo.
    pause
    exit /b 1
)

:: 2. Check for .env file
if not exist .env (
    if exist .env.example (
        echo [INFO] Creating .env from .env.example...
        copy .env.example .env >nul
        echo [!] Please ensure your Neon DB connection string is set in .env
    ) else (
        echo [WARNING] No .env file found. Please create one with DATABASE_URL.
    )
    echo.
)

:: 3. Check for node_modules, install if missing
if not exist node_modules (
    echo [INFO] Installing required dependencies...
    call npm install
    if %errorlevel% neq 0 (
        echo [ERROR] npm install failed. Please check your internet connection.
        pause
        exit /b 1
    )
    echo.
)

:: 4. Launch browser after a short delay in background
start "" cmd /c "timeout /t 2 /nobreak >nul && start http://localhost:3000"

:: 5. Start Server
echo [INFO] Starting server on http://localhost:3000...
echo Press Ctrl+C to stop the server.
echo.
call npm start

pause
