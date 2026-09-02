@echo off
echo 🚀 Starting Omni Platform Services...

echo.
echo 📦 Step 1: Starting Docker services (PostgreSQL, Redis, Backend)...
docker-compose up -d postgres redis backend

echo.
echo ⏳ Waiting for backend to start...
timeout /t 15 /nobreak >nul

echo.
echo 🔍 Testing backend connection...
curl -s http://localhost:3000/health >nul
if %errorlevel% equ 0 (
    echo ✅ Backend is running on http://localhost:3000
) else (
    echo ❌ Backend failed to start
    exit /b 1
)

echo.
echo 🌐 Step 2: Starting Frontend...
cd omni-react-app
start "Frontend" cmd /k "npm run dev"
cd ..

echo.
echo 🔗 Step 3: Starting ngrok...
start "ngrok" cmd /k "ngrok http 3000"

echo.
echo ✅ All services started!
echo.
echo 📊 Service URLs:
echo    Backend:  http://localhost:3000
echo    Frontend: http://localhost:5173
echo    ngrok:    http://localhost:4040
echo.
echo 🎯 Open http://localhost:5173 in your browser
echo.
pause












