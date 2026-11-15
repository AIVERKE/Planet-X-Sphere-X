param([int[]]$Ports = @(8000, 5173, 8001))
foreach ($port in $Ports) {
  $conns = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue
  foreach ($c in $conns) {
    $pid = $c.OwningProcess
    if ($pid -and $pid -ne 0) {
      Write-Output "killing $pid on $port"
      Stop-Process -Id $pid -Force -ErrorAction SilentlyContinue
      & taskkill.exe /F /T /PID $pid 2>$null | Out-Null
    }
  }
}
Start-Sleep -Seconds 2
foreach ($port in $Ports) {
  $left = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue
  if ($left) { Write-Output "still:$port" } else { Write-Output "free:$port" }
}
