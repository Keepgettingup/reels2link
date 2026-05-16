# Complete dev environment reset
Write-Host "=== Killing all Node processes ===" -ForegroundColor Yellow
Get-Process node -ErrorAction SilentlyContinue | Stop-Process -Force
Start-Sleep 2

Write-Host "=== Checking for remaining processes ===" -ForegroundColor Yellow
$remaining = Get-Process node -ErrorAction SilentlyContinue
if ($remaining) {
    Write-Host "WARNING: Still found Node processes:" -ForegroundColor Red
    $remaining | Select-Object Id, ProcessName
    Write-Host "Trying harder..." -ForegroundColor Yellow
    taskkill /F /IM node.exe 2>$null
} else {
    Write-Host "All Node processes killed ✓" -ForegroundColor Green
}

Write-Host "=== Removing database ===" -ForegroundColor Yellow
if (Test-Path spool.db) {
    Remove-Item spool.db -Force
    Write-Host "Database removed ✓" -ForegroundColor Green
} else {
    Write-Host "No database found (already clean)" -ForegroundColor Green
}

Write-Host "=== Starting server ===" -ForegroundColor Yellow
npm run dev
