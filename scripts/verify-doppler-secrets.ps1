param(
  [string]$InventoryFile = "$(Split-Path -Parent $PSScriptRoot)\.doppler\secrets.txt"
)

$ErrorActionPreference = "Stop"
$dopplerProject = if ($env:DOPPLER_PROJECT) { $env:DOPPLER_PROJECT } else { "all" }
$dopplerConfig = if ($env:DOPPLER_CONFIG) { $env:DOPPLER_CONFIG } else { "main" }
$allowOffline = $env:ALLOW_DOPPLER_OFFLINE -eq "1"
$liveCheck = if ($env:DOPPLER_LIVE_CHECK) { $env:DOPPLER_LIVE_CHECK } else { "1" }

if (-not (Test-Path -LiteralPath $InventoryFile)) {
  throw "Missing Doppler inventory: $InventoryFile"
}

$requiredSecrets = Get-Content -LiteralPath $InventoryFile |
  Where-Object { $_ -and ($_ -notmatch '^\s*#') } |
  ForEach-Object { $_.Trim() }

if ($requiredSecrets.Count -eq 0) {
  throw "Doppler inventory has no required secrets."
}

if ($allowOffline -and $liveCheck -ne "1") {
  Write-Host "Doppler live verification disabled; validated inventory only."
  $requiredSecrets | ForEach-Object { Write-Host "  - $_" }
  exit 0
}

$doppler = Get-Command doppler -ErrorAction SilentlyContinue
if (-not $doppler) {
  if ($env:DOPPLER_TOKEN) {
    $uri = "https://api.doppler.com/v3/configs/config/secrets/download?project=$([uri]::EscapeDataString($dopplerProject))&config=$([uri]::EscapeDataString($dopplerConfig))&format=json"
    $secrets = Invoke-RestMethod -Uri $uri -Headers @{ Authorization = "Bearer $env:DOPPLER_TOKEN" } -Method Get
    $missing = $false
    foreach ($secretName in $requiredSecrets) {
      if ($secrets.PSObject.Properties.Name -contains $secretName -and $secrets.$secretName) {
        Write-Host "Verified Doppler secret: $secretName"
      } else {
        Write-Error "Missing Doppler secret: $secretName"
        $missing = $true
      }
    }
    if ($missing) {
      exit 1
    }
    exit 0
  }

  if ($allowOffline) {
    Write-Host "Doppler CLI is not installed; validated inventory only."
    $requiredSecrets | ForEach-Object { Write-Host "  - $_" }
    exit 0
  }

  throw "Doppler CLI is required for live secret verification."
}

$missing = $false
foreach ($secretName in $requiredSecrets) {
  & doppler secrets get $secretName --plain --project $dopplerProject --config $dopplerConfig *> $null
  if ($LASTEXITCODE -eq 0) {
    Write-Host "Verified Doppler secret: $secretName"
  } else {
    Write-Error "Missing Doppler secret: $secretName"
    $missing = $true
  }
}

if ($missing) {
  exit 1
}
