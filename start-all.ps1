# start-all.ps1 - PowerShell script to start everything
Write-Host "🚀 Starting Omni-Channel Platform..." -ForegroundColor Green

# Check if ngrok is installed
if (-not (Get-Command ngrok -ErrorAction SilentlyContinue)) {
    Write-Host "❌ ngrok not found. Please install ngrok first." -ForegroundColor Red
    Write-Host "Download from: https://ngrok.com/download" -ForegroundColor Yellow
    exit 1
}

# Check if Docker is running
$dockerStatus = docker info 2>$null
if ($LASTEXITCODE -ne 0) {
    Write-Host "⚠️  Docker not running. Starting without database..." -ForegroundColor Yellow
    $useDocker = $false
} else {
    Write-Host "✅ Docker is running" -ForegroundColor Green
    $useDocker = $true
}

# Clean up any existing processes
Write-Host "🧹 Cleaning up existing processes..." -ForegroundColor Yellow
taskkill /F /IM node.exe 2>$null
taskkill /F /IM ngrok.exe 2>$null

# Start Docker services if available
if ($useDocker) {
    Write-Host "🐳 Starting Docker services..." -ForegroundColor Blue
    docker-compose up -d postgres redis
    Start-Sleep -Seconds 5
}

# Start backend server
Write-Host "🔧 Starting backend server..." -ForegroundColor Blue
Start-Process -FilePath "node" -ArgumentList "src/working-solution.js" -WindowStyle Minimized

# Wait a moment for backend to start
Start-Sleep -Seconds 3

# Start frontend
Write-Host "🎨 Starting frontend..." -ForegroundColor Blue
Start-Process -FilePath "cmd" -ArgumentList "/c", "cd omni-react-app && npm run dev" -WindowStyle Minimized

# Wait a moment for frontend to start
Start-Sleep -Seconds 3

# Start ngrok
Write-Host "🌐 Starting ngrok..." -ForegroundColor Blue
Start-Process -FilePath "ngrok" -ArgumentList "http", "3000" -WindowStyle Minimized

# Wait for ngrok to start
Start-Sleep -Seconds 5

# Get ngrok URL
Write-Host "🔗 Getting ngrok URL..." -ForegroundColor Blue
try {
    $ngrokResponse = Invoke-WebRequest -Uri "http://localhost:4040/api/tunnels" -UseBasicParsing
    $ngrokData = $ngrokResponse.Content | ConvertFrom-Json
    $ngrokUrl = $ngrokData.tunnels[0].public_url
    Write-Host "✅ Ngrok URL: $ngrokUrl" -ForegroundColor Green
    Write-Host "🔗 Webhook URL: $ngrokUrl/webhook/line" -ForegroundColor Cyan
} catch {
    Write-Host "⚠️  Could not get ngrok URL. Check ngrok status manually." -ForegroundColor Yellow
}

# Check services
Write-Host "`n📊 Checking services..." -ForegroundColor Blue

# Check backend
try {
    $backendResponse = Invoke-WebRequest -Uri "http://localhost:3000/health" -UseBasicParsing
    Write-Host "✅ Backend: Running (Status: $($backendResponse.StatusCode))" -ForegroundColor Green
} catch {
    Write-Host "❌ Backend: Not responding" -ForegroundColor Red
}

# Check frontend
try {
    $frontendResponse = Invoke-WebRequest -Uri "http://localhost:5173" -UseBasicParsing
    Write-Host "✅ Frontend: Running (Status: $($frontendResponse.StatusCode))" -ForegroundColor Green
} catch {
    Write-Host "❌ Frontend: Not responding" -ForegroundColor Red
}

# Check ngrok
try {
    $ngrokResponse = Invoke-WebRequest -Uri "http://localhost:4040/api/tunnels" -UseBasicParsing
    Write-Host "✅ Ngrok: Running" -ForegroundColor Green
} catch {
    Write-Host "❌ Ngrok: Not responding" -ForegroundColor Red
}

Write-Host "`n🎉 Setup complete!" -ForegroundColor Green
Write-Host "📱 Frontend: http://localhost:5173" -ForegroundColor Cyan
Write-Host "🔧 Backend: http://localhost:3000" -ForegroundColor Cyan
Write-Host "🌐 Ngrok: http://localhost:4040" -ForegroundColor Cyan
if ($ngrokUrl) {
    Write-Host "🔗 Webhook: $ngrokUrl/webhook/line" -ForegroundColor Cyan
}

Write-Host "`nPress any key to stop all services..." -ForegroundColor Yellow
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")

# Cleanup
Write-Host "`n🧹 Stopping all services..." -ForegroundColor Yellow
taskkill /F /IM node.exe 2>$null
taskkill /F /IM ngrok.exe 2>$null

if ($useDocker) {
    Write-Host "🐳 Stopping Docker services..." -ForegroundColor Blue
    docker-compose down
}

Write-Host "✅ All services stopped." -ForegroundColor Green
















