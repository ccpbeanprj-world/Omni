@echo off
echo 🚀 Starting Omni-Channel Platform...
echo.

REM Clean up existing processes
echo 🧹 Cleaning up existing processes...
taskkill /F /IM node.exe >nul 2>&1
taskkill /F /IM ngrok.exe >nul 2>&1

REM Start Docker services
echo 🐳 Starting Docker services...
docker-compose up -d postgres redis

REM Wait for Docker to start
timeout /t 5 /nobreak >nul

REM Start all services with concurrently
echo 🔧 Starting all services...
npm run dev:quick

pause
















