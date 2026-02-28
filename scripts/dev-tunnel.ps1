$repoRoot = Split-Path -Parent $PSScriptRoot
$devCommand = "Set-Location `"$repoRoot`"; npm run dev"

Write-Host "Starting Next.js dev server in a new terminal window..."
Start-Process powershell -ArgumentList "-NoExit", "-Command", $devCommand | Out-Null

Start-Sleep -Seconds 3

Set-Location $repoRoot
Write-Host "Starting ngrok tunnel in current terminal..."
npm run tunnel
