<#
  dsh-craft-anything — installer for Windows.

  What it does, and nothing more:
    1. finds the latest upstream Craft Anything release (or a version you pin),
    2. downloads its Windows x64 portable archive into %USERPROFILE%\.dsh\tools\craft-anything,
    3. checks that the CLI answers --version.

  What it deliberately does NOT do: register an MCP server anywhere. The plugin
  ships `cordis.patch.yml` for that, and running upstream `setup --yes` over an
  entry DSH already manages would drop its `--deep` flag.

  Usage:
    pwsh -File install.ps1                 # latest release
    pwsh -File install.ps1 -Version 0.6.1  # pin a version
    pwsh -File install.ps1 -Force          # re-download even if present
#>
param(
  [string]$Version = '',
  [switch]$Force,
  [string]$Dest = (Join-Path $HOME '.dsh\tools\craft-anything')
)

$ErrorActionPreference = 'Stop'
$repo = 'storytold/craft-anything'
$exe = Join-Path $Dest 'craft-anything-cli.exe'

if ((Test-Path $exe) -and -not $Force) {
  $found = & $exe --version 2>$null
  Write-Host "already installed: $exe ($found)"
  Write-Host 'use -Force to re-download.'
  exit 0
}

Write-Host "resolving release of $repo ..."
$api = if ($Version) {
  "https://api.github.com/repos/$repo/releases/tags/v$Version"
} else {
  "https://api.github.com/repos/$repo/releases/latest"
}
$release = Invoke-RestMethod -Uri $api -Headers @{ 'User-Agent' = 'dsh-craft-anything-installer' }

$asset = $release.assets |
  Where-Object { $_.name -match 'windows-x64.*\.zip$' } |
  Select-Object -First 1
if (-not $asset) { throw "no Windows x64 asset in $($release.tag_name): $(($release.assets | ForEach-Object name) -join ', ')" }

New-Item -ItemType Directory -Force -Path $Dest | Out-Null
$zip = Join-Path $env:TEMP $asset.name
Write-Host "downloading $($asset.name) ($([math]::Round($asset.size / 1MB, 1)) MB) ..."
Invoke-WebRequest -Uri $asset.browser_download_url -OutFile $zip -Headers @{ 'User-Agent' = 'dsh-craft-anything-installer' }

Write-Host 'extracting ...'
Expand-Archive -Path $zip -DestinationPath $Dest -Force
Remove-Item $zip -Force

if (-not (Test-Path $exe)) {
  $found = Get-ChildItem -Path $Dest -Recurse -Filter 'craft-anything-cli.exe' | Select-Object -First 1
  if ($found) { $exe = $found.FullName } else { throw "archive extracted but craft-anything-cli.exe is missing under $Dest" }
}

Write-Host "installed: $exe"
Write-Host "version: $(& $exe --version)"
Write-Host ''
Write-Host 'next:'
Write-Host "  1. point the plugin config at it — cordis.patch.yml uses the portable form"
Write-Host "     '%USERPROFILE%\.dsh\tools\craft-anything\craft-anything-cli.exe', which already matches this path;"
Write-Host '  2. restart DSH so the bridge picks up the new tool surface;'
Write-Host '  3. in a session, `craft_engine` with action `status` to see engines and the current tool surface.'
