#!/usr/bin/env pwsh
# Complete Dev Environment Startup Script

Write-Host "🚀 Starting Reels2Link Dev Environment..." -ForegroundColor Cyan

# 1. Kill all Node processes (hard)
Write-Host "`n[1/5] Killing all Node processes..." -ForegroundColor Yellow
$nodes = Get-Process node -ErrorAction SilentlyContinue
if ($nodes) {
    $nodes | Stop-Process -Force
    Start-Sleep 2
    Write-Host "✓ Killed $($nodes.Count) Node process(es)" -ForegroundColor Green
} else {
    Write-Host "✓ No Node processes found" -ForegroundColor Green
}

# 2. Clean up database
Write-Host "`n[2/5] Cleaning up database..." -ForegroundColor Yellow
if (Test-Path spool.db) {
    Remove-Item spool.db -Force
    Write-Host "✓ Removed spool.db" -ForegroundColor Green
} else {
    Write-Host "✓ No database to clean" -ForegroundColor Green
}

# 3. Check if ports are free
Write-Host "`n[3/5] Checking ports..." -ForegroundColor Yellow
$port3000 = Get-NetTCPConnection -LocalPort 3000 -ErrorAction SilentlyContinue
$port5173 = Get-NetTCPConnection -LocalPort 5173 -ErrorAction SilentlyContinue

if ($port3000) {
    Write-Host "⚠ Port 3000 is still in use, waiting..." -ForegroundColor Yellow
    Start-Sleep 3
}
if ($port5173) {
    Write-Host "⚠ Port 5173 is still in use, waiting..." -ForegroundColor Yellow
    Start-Sleep 3
}

Write-Host "✓ Ports should be free now" -ForegroundColor Green

# 4. Start Backend in new terminal
Write-Host "`n[4/6] Opening Backend terminal (Port 3000)..." -ForegroundColor Yellow
$backendCmd = "Set-Location '$PWD'; npm run dev; Read-Host 'Press Enter to close'"
Start-Process powershell -ArgumentList "-NoExit", "-Command", $backendCmd -WindowStyle Normal

Start-Sleep 3

# 5. Start Frontend in new terminal  
Write-Host "[5/6] Opening Frontend terminal (Port 5173)..." -ForegroundColor Yellow
$frontendCmd = "Set-Location '$PWD'; npm run dev:ui; Read-Host 'Press Enter to close'"
Start-Process powershell -ArgumentList "-NoExit", "-Command", $frontendCmd -WindowStyle Normal

Start-Sleep 2

# 6. Start Stripe CLI in new terminal
Write-Host "[6/6] Opening Stripe CLI terminal..." -ForegroundColor Yellow
$stripeCmd = "Set-Location '$PWD'; stripe listen --forward-to localhost:3000/webhooks/stripe; Read-Host 'Press Enter to close'"
Start-Process powershell -ArgumentList "-NoExit", "-Command", $stripeCmd -WindowStyle Normal

# Summary
Write-Host "`n================================" -ForegroundColor Cyan
Write-Host "✅ DEV ENVIRONMENT STARTED!" -ForegroundColor Green
Write-Host "================================" -ForegroundColor Cyan
Write-Host "Backend:  http://localhost:3000" -ForegroundColor White
Write-Host "Frontend: http://localhost:5173" -ForegroundColor White
Write-Host "Stripe:   Listening on webhooks" -ForegroundColor White
Write-Host "`n📝 3 Terminal windows opened!" -ForegroundColor Yellow
Write-Host "💡 Close each terminal individually to stop services" -ForegroundColor Gray
Write-Host "🛑 Or run: taskkill /F /IM node.exe" -ForegroundColor Gray
