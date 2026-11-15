Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -match 'uvicorn|vite' } | ForEach-Object {
  Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue
  Write-Output ("killed " + $_.ProcessId)
}
foreach ($port in 8000, 5173, 8001) {
  Get-NetTCPConnection -LocalPort $port -ErrorAction SilentlyContinue | ForEach-Object {
    Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue
    Write-Output ("killed-port-$port " + $_.OwningProcess)
  }
}
Start-Sleep -Seconds 2
try { Invoke-WebRequest http://127.0.0.1:8000/health -TimeoutSec 1 | Out-Null; 'api:up' } catch { 'api:off' }
try { Invoke-WebRequest http://127.0.0.1:5173/ -TimeoutSec 1 | Out-Null; 'vite:up' } catch { 'vite:off' }
