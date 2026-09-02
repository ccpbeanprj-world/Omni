@echo off
echo 🚀 Starting Omni-Channel Platform...

REM Check if Docker is running
docker info >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ Docker is not running. Please start Docker first.
    pause
    exit /b 1
)

REM Check if .env file exists
if not exist .env (
    echo 📝 Creating .env file from template...
    copy env.example .env
    echo ⚠️  Please edit .env file with your configuration before continuing.
    echo    Required: Database URLs, API keys for WhatsApp, Facebook, and WeChat
    pause
    exit /b 1
)

REM Create necessary directories
echo 📁 Creating necessary directories...
if not exist logs mkdir logs
if not exist uploads mkdir uploads
if not exist ssl mkdir ssl

REM Build and start services
echo 🐳 Building and starting Docker containers...
docker-compose down
docker-compose build
docker-compose up -d

REM Wait for services to be ready
echo ⏳ Waiting for services to be ready...
timeout /t 10 /nobreak >nul

REM Check if services are running
echo 🔍 Checking service status...
docker-compose ps | findstr "Up" >nul
if %errorlevel% equ 0 (
    echo ✅ Services are running!
    echo.
    echo 🌐 Access the platform at: http://localhost
    echo 📊 Health check: http://localhost/health
    echo 🔗 Webhook status: http://localhost/webhook/status
    echo.
    echo 📋 Next steps:
    echo 1. Configure your platform API keys in .env file
    echo 2. Set up webhooks for each platform
    echo 3. Create an agent account via API or database
    echo 4. Start managing conversations!
    echo.
    echo 📖 For detailed setup instructions, see README.md
) else (
    echo ❌ Some services failed to start. Check logs with:
    echo    docker-compose logs
)

REM Show logs
echo 📋 Showing recent logs...
docker-compose logs --tail=20

pause









