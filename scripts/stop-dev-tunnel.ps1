Write-Host "Stopping ngrok processes..."
Get-Process ngrok -ErrorAction SilentlyContinue | Stop-Process -Force

Write-Host "Stopping Node.js processes..."
Get-Process node -ErrorAction SilentlyContinue | Stop-Process -Force

Write-Host "Dev server and ngrok tunnel stopped."
