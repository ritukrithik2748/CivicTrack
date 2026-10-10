# CivicTrack Production Startup Script
# Run this to start the server in production mode

Write-Host "Setting up CivicTrack for production..." -ForegroundColor Green
Write-Host ""

Set-Location "C:\Users\rituk\BitsandBytes"

Write-Host "Step 1: Setting environment to production" -ForegroundColor Yellow
$env:NODE_ENV = "production"

Write-Host "Step 2: Building client and server..." -ForegroundColor Yellow
npm run build
if ($LASTEXITCODE -ne 0) {
    Write-Host "Build failed!" -ForegroundColor Red
    Read-Host "Press Enter to exit"
    exit 1
}

Write-Host ""
Write-Host "Step 3: Starting production server..." -ForegroundColor Yellow
Write-Host "Server will run on http://localhost:5000" -ForegroundColor Cyan
Write-Host "Press Ctrl+C to stop" -ForegroundColor Cyan
Write-Host ""
npm start
