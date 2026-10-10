@echo off
echo Setting up CivicTrack for production...
echo.

cd /d C:\Users\rituk\BitsandBytes

echo Step 1: Setting environment to production
set NODE_ENV=production

echo Step 2: Building client and server...
call npm run build
if %errorlevel% neq 0 (
    echo Build failed!
    pause
    exit /b 1
)

echo.
echo Step 3: Starting production server...
echo Server will run on http://localhost:5000
echo Press Ctrl+C to stop
echo.
call npm start
