Set-Location "C:\Users\chcct\Desktop\QshopWebUI"
$process = Start-Process -FilePath "node" -ArgumentList "server.js" -WindowStyle Hidden -PassThru
$process.Id | Out-File -FilePath "C:\Users\chcct\Desktop\QshopWebUI\logs\server_pid.txt"
Write-Host "Server started, PID:" $process.Id
