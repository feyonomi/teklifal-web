param(
  [string]$Repo = "",
  [string[]]$Environments = @("staging", "production")
)

$ErrorActionPreference = "Stop"

function Ensure-Command($name) {
  if (-not (Get-Command $name -ErrorAction SilentlyContinue)) {
    throw "$name bulunamadı. Önce yükleyin ve PATH'e ekleyin."
  }
}

function Resolve-Repo() {
  param([string]$InputRepo)

  if ($InputRepo) {
    return $InputRepo
  }

  $repo = gh repo view --json nameWithOwner --jq ".nameWithOwner" 2>$null
  if (-not $repo) {
    throw "Repo otomatik çözümlenemedi. -Repo owner/name parametresi verin."
  }

  return $repo.Trim()
}

function Get-EnvironmentVariables() {
  param(
    [string]$RepoName,
    [string]$EnvironmentName
  )

  $lines = @(gh api --paginate "repos/$RepoName/environments/$EnvironmentName/variables" --jq ".variables[] | \"\(.name)=\(.value)\"" 2>$null)
  $map = @{}

  foreach ($line in $lines) {
    if (-not $line) {
      continue
    }
    $parts = $line -split "=", 2
    $name = $parts[0].Trim()
    $value = if ($parts.Length -gt 1) { $parts[1] } else { "" }
    if ($name) {
      $map[$name] = $value
    }
  }

  return $map
}

function Get-EnvironmentSecrets() {
  param(
    [string]$RepoName,
    [string]$EnvironmentName
  )

  $secrets = @(gh api --paginate "repos/$RepoName/environments/$EnvironmentName/secrets" --jq ".secrets[].name" 2>$null)
  return @($secrets | ForEach-Object { $_.Trim() } | Where-Object { $_ })
}

Ensure-Command "gh"

if (-not $env:GH_TOKEN -and -not $env:GITHUB_TOKEN) {
  try {
    gh auth status -h github.com | Out-Null
  } catch {
    throw "gh auth status başarısız. Önce 'gh auth login' ile giriş yapın veya GH_TOKEN sağlayın."
  }
}

$resolvedRepo = Resolve-Repo -InputRepo $Repo

$requiredSecrets = @(
  "JWT_SECRET",
  "DATABASE_URL",
  "REDIS_URL"
)

$requiredVariables = @(
  "NEXT_PUBLIC_APP_URL",
  "JWT_ISSUER",
  "JWT_AUDIENCE",
  "ACCESS_TOKEN_TTL",
  "DEMO_MODE",
  "AUTH_REGISTER_RATE_LIMIT",
  "AUTH_REGISTER_RATE_WINDOW",
  "AUTH_LOGIN_RATE_LIMIT",
  "AUTH_LOGIN_RATE_WINDOW",
  "AUTH_PASSWORD_RESET_RATE_LIMIT",
  "AUTH_PASSWORD_RESET_RATE_WINDOW",
  "AUTH_RATE_LIMIT_REDIS_REQUIRED"
)

$expectedValues = @{
  "DEMO_MODE" = "false"
  "AUTH_RATE_LIMIT_REDIS_REQUIRED" = "true"
}

$hasFailure = $false

Write-Host "Repo: $resolvedRepo"
Write-Host "Environments: $($Environments -join ', ')"
Write-Host ""

foreach ($envName in $Environments) {
  Write-Host "=== $envName ===" -ForegroundColor Cyan

  $envInfoRaw = gh api "repos/$resolvedRepo/environments/$envName" 2>$null
  if ($LASTEXITCODE -ne 0 -or -not $envInfoRaw) {
    Write-Host "[ERROR] Environment bulunamadı: $envName" -ForegroundColor Red
    $hasFailure = $true
    Write-Host ""
    continue
  }

  $secretNames = Get-EnvironmentSecrets -RepoName $resolvedRepo -EnvironmentName $envName
  $variableMap = Get-EnvironmentVariables -RepoName $resolvedRepo -EnvironmentName $envName

  $missingSecrets = @($requiredSecrets | Where-Object { $_ -notin $secretNames })
  $missingVariables = @($requiredVariables | Where-Object { -not $variableMap.ContainsKey($_) -or [string]::IsNullOrWhiteSpace($variableMap[$_]) })

  if ($missingSecrets.Count -eq 0) {
    Write-Host "[OK] Secrets tamam" -ForegroundColor Green
  } else {
    Write-Host "[ERROR] Eksik Secrets: $($missingSecrets -join ', ')" -ForegroundColor Red
    $hasFailure = $true
  }

  if ($missingVariables.Count -eq 0) {
    Write-Host "[OK] Variables tamam" -ForegroundColor Green
  } else {
    Write-Host "[ERROR] Eksik Variables: $($missingVariables -join ', ')" -ForegroundColor Red
    $hasFailure = $true
  }

  foreach ($key in $expectedValues.Keys) {
    if ($variableMap.ContainsKey($key)) {
      $actual = [string]$variableMap[$key]
      $expected = [string]$expectedValues[$key]
      if ($actual -ne $expected) {
        Write-Host "[ERROR] $key değeri '$actual', beklenen '$expected'" -ForegroundColor Red
        $hasFailure = $true
      }
    }
  }

  Write-Host ""
}

if ($hasFailure) {
  Write-Host "Eksik/hatalı environment konfigürasyonu bulundu." -ForegroundColor Red
  exit 1
}

Write-Host "Tüm environment kontrolleri geçti." -ForegroundColor Green
exit 0
